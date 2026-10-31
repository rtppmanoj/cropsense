import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Download, Loader2, Mail, Printer, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CropCard from '../components/CropCard';
import WeatherClimateSection, { type WeatherReportData, type WeatherReportStatus } from '../components/WeatherClimateSection';
import type { CropFormData } from '../components/CropRecommendationForm';
import { useAuth } from '../auth/useAuth';
import SchemesHighlight from '../components/SchemesHighlight';
import HardwarePromo from '../components/HardwarePromo';
import { getFertilizerGuidance } from '../data/fertilizerGuidance';
import { formatCropMonths, getCropCalendar } from '../data/cropCalendar';
import { apiFetch } from '../services/apiClient';
import cropsenseWordmark from '../assets/cropsense-wordmark.png';
import cropsenseMark from '../assets/cropsense-mark.png';
import smartFarmLabsLogo from '../assets/smart-farm-labs-logo.webp';

interface Recommendation { crop: string; score: number; explanation: string; expected_yield_quintals_per_acre: number | null; expected_harvest_quintals: number | null }
interface ApiResult { report_id: string; recommendations: Recommendation[]; within_observed_feature_ranges: boolean; warnings: string[]; score_interpretation: string; model_name: string; model_version: string; evaluated_accuracy: number; evaluated_macro_f1: number }
const inputFields: (keyof CropFormData)[] = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'soil_moisture', 'temperature', 'humidity'];

export default function RecommendationResult() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { farmerDraft, user } = useAuth();
  const [result, setResult] = useState<ApiResult | null>(null);
  const [input, setInput] = useState<CropFormData | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<{ blob: Blob; base64: string; filename: string } | null>(null);
  const [weatherReport, setWeatherReport] = useState<{ data: WeatherReportData | null; status: WeatherReportStatus }>({ data: null, status: 'notRequested' });
  const updateWeatherReport = useCallback((data: WeatherReportData | null, status: WeatherReportStatus) => setWeatherReport({ data, status }), []);

  useEffect(() => {
    if (!farmerDraft) {
      navigate('/farmer/dashboard');
      return;
    }
    const controller = new AbortController();
    const parsed = farmerDraft as CropFormData;
    setInput(parsed);
    setProgress(0);
    const payload: Record<string, number | string | null> = Object.fromEntries(inputFields.map((key) => [key, Number(parsed[key])]));
    payload.location_name = parsed.location_name?.trim() || [parsed.village_town, parsed.farm_district, parsed.farm_state].filter(Boolean).join(', ');
    payload.village_town = parsed.village_town?.trim() ?? '';
    payload.farm_district = parsed.farm_district?.trim() ?? '';
    payload.farm_state = parsed.farm_state?.trim() ?? '';
    payload.latitude = parsed.latitude ? Number(parsed.latitude) : null;
    payload.longitude = parsed.longitude ? Number(parsed.longitude) : null;
    payload.location_source = parsed.location_source ?? 'manual';
    payload.land_area_acres = Number(parsed.land_area_acres);
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(94, current + Math.max(0.35, (94 - current) * 0.055)));
    }, 130);
    let completionTimer: number | undefined;

    fetch('/api/farmer/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const detail = typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail)
            ? body.detail.map((item: { loc?: (string | number)[]; msg?: string }) => `${item.loc?.join('.') ?? ''}: ${item.msg ?? ''}`).join('; ')
            : t('results.apiUnavailable');
          throw new Error(detail || t('results.apiUnavailable'));
        }
        return response.json() as Promise<ApiResult>;
      })
      .then((data) => {
        setProgress(100);
        completionTimer = window.setTimeout(() => {
          if (!controller.signal.aborted) setResult(data);
        }, 220);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : t('results.apiUnavailable'));
        }
      })
      .finally(() => window.clearInterval(timer));
    return () => {
      controller.abort();
      window.clearInterval(timer);
      if (completionTimer !== undefined) window.clearTimeout(completionTimer);
    };
  }, [navigate, farmerDraft, t]);

  const generatePdf = async () => {
    if (!result || !input) return;
    setGeneratingPdf(true);
    setDownloadMessage('');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      // Keep PDF content in English regardless of the selected UI language.
      const pdfT = i18n.getFixedT('en');
      const toDataUrl = async (asset: string) => {
        const blob = await fetch(asset).then((response) => response.blob());
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not load a CropSense brand asset.'));
          reader.onerror = () => reject(new Error('Could not load a CropSense brand asset.'));
          reader.readAsDataURL(blob);
        });
      };
      const toPngDataUrl = async (dataUrl: string) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not prepare the Smart Farm Labs logo for the PDF.');
        context.drawImage(image, 0, 0);
        return canvas.toDataURL('image/png');
      };
      const [logoDataUrl, markDataUrl, labsDataUrlRaw] = await Promise.all([toDataUrl(cropsenseWordmark), toDataUrl(cropsenseMark), toDataUrl(smartFarmLabsLogo)]);
      const labsDataUrl = await toPngDataUrl(labsDataUrlRaw);
      const margin = 18;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = 49;
      pdf.setProperties({ title: `${pdfT('results.title')} - CropSense`, subject: 'CropSense agricultural report', author: 'CropSense' });
      const ensureSpace = (height: number) => { if (y + height > pageHeight - 25) { pdf.addPage(); y = 49; } };
      const addText = (text: string, size = 9, bold = false, color: [number, number, number] = [48, 65, 52], indent = 0, italic = false) => {
        const lines = pdf.splitTextToSize(String(text), pageWidth - margin * 2 - indent);
        ensureSpace(lines.length * size * 0.42 + 3);
        pdf.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal')); pdf.setFontSize(size); pdf.setTextColor(...color);
        pdf.text(lines, margin + indent, y); y += lines.length * size * 0.42 + 2.5;
      };
      const addSection = (title: string) => {
        ensureSpace(15); y += 4; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(33, 89, 59);
        pdf.text(title.toUpperCase(), margin, y); y += 2; pdf.setDrawColor(210, 225, 203); pdf.setLineWidth(0.45); pdf.line(margin, y, pageWidth - margin, y); y += 6;
      };
      const addPair = (label: string, value: string | number | null | undefined) => {
        if (value === undefined || value === null || value === '') return;
        const labelWidth = 48;
        const valueX = margin + labelWidth + 4;
        const valueWidth = pageWidth - margin - valueX;
        const labelLines = pdf.splitTextToSize(String(label), labelWidth);
        const valueLines = pdf.splitTextToSize(String(value), valueWidth);
        const lines = Math.max(labelLines.length, valueLines.length);
        const rowHeight = lines * 4.3 + 2;
        ensureSpace(rowHeight);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.8); pdf.setTextColor(82, 105, 86);
        pdf.text(labelLines, margin, y);
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(48, 65, 52);
        pdf.text(valueLines, valueX, y);
        y += rowHeight;
      };
      const displayMonth = (value: string | number) => {
        const date = typeof value === 'number' ? new Date(2020, value - 1, 1, 12) : new Date(`${value}-01T12:00:00`);
        return new Intl.DateTimeFormat('en-IN', { month: 'long', year: typeof value === 'string' ? 'numeric' : undefined }).format(date);
      };
      const metric = (label: string, value: number | undefined, unit: string) => value === undefined ? undefined : `${label} ${value.toFixed(1)} ${unit}`;

      addText('CropSense Agricultural Report', 21, true, [33, 75, 49]);
      addText('DIGITALLY GENERATED FARMER REPORT', 8, true, [93, 124, 88]);
      addText(`Report generated: ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date())} IST`, 9, false, [101, 126, 103], 0, true);
      addPair('Farmer name', user?.display_name || user?.email || 'Not available');
      addPair('Farmer ID', user?.farmer_id || 'Not available');
      addPair('Report ID', result.report_id);
      addSection('Land and report details');
      addPair('Land location', input.location_name?.trim() || [input.village_town, input.farm_district, input.farm_state].filter(Boolean).join(', ') || 'Not provided');
      addPair('Village / town', input.village_town); addPair('District', input.farm_district); addPair('State', input.farm_state);
      addPair('Cultivated land area', `${input.land_area_acres} acres`);
      if (input.latitude && input.longitude) addPair('Selected coordinates', `${input.latitude}, ${input.longitude}`);

      addSection('Submitted measurements');
      const names: Record<string, string> = Object.fromEntries(inputFields.map((key) => [key, pdfT(`form.fields.${key}`)]));
      const measurementUnits: Record<string, string> = { nitrogen: `${pdfT('form.units.kgPerHa')} available N`, phosphorus: `${pdfT('form.units.kgPerHa')} available P2O5`, potassium: `${pdfT('form.units.kgPerHa')} available K2O`, ph: pdfT('form.units.ph'), soil_moisture: pdfT('form.units.percent'), temperature: 'deg C', humidity: pdfT('form.units.percent') };
      for (const key of inputFields) addPair(names[key], `${input[key]} ${measurementUnits[key]}`);

      addSection('Recommendation model');
      addPair('Model', result.model_name.replaceAll('_', ' ')); addPair('Model version', result.model_version);
      addPair('Holdout macro F1', `${(result.evaluated_macro_f1 * 100).toFixed(1)}%`);
      addPair('Holdout accuracy', `${(result.evaluated_accuracy * 100).toFixed(1)}%`);
      addSection('Recommended crops');
      result.recommendations.forEach((item, index) => {
        addText(`${index + 1}. ${item.crop}  |  ${Math.round(item.score * 100)}% model score`, 10, true, [33, 89, 59]);
        if (item.expected_yield_quintals_per_acre !== null) addText(`Indicative benchmark yield: ${item.expected_yield_quintals_per_acre} quintals/acre`, 9, true, [67, 101, 71], 3);
        if (item.expected_harvest_quintals !== null) addText(`Estimated harvest for this land area: ${item.expected_harvest_quintals.toFixed(2)} quintals`, 9, false, [67, 101, 71], 3);
        const cropCalendar = getCropCalendar(item.crop);
        if (cropCalendar) {
          addText(`Suitable sowing period: ${formatCropMonths(cropCalendar.sowing, 'en-IN')}`, 9, false, [67, 101, 71], 3);
          addText(`Harvest period: ${formatCropMonths(cropCalendar.harvest, 'en-IN')}`, 9, false, [67, 101, 71], 3);
          addText('Indicative India-wide timing; local seasons vary by state, variety, and water availability.', 8, false, [112, 122, 111], 3, true);
        }
        addText(item.explanation, 9, false, [83, 99, 85], 3); y += 1;
      });
      addSection('Fertilizer recommendations');
      addText('These are fertilizer-source options and crop-guide references, not prescriptions. Submitted values are soil-tested available N, P2O5, and K2O in kg/ha. Select the needed nutrients based on these results and apply at the crop rate recommended for your location.', 9, false, [125, 79, 37]);
      result.recommendations.forEach((item) => {
        const guide = getFertilizerGuidance(item.crop, input.farm_state);
        addText(item.crop, 10, true, [33, 89, 59]);
        addText(`Key nutrients: ${guide.nutrients}`, 9, false, [83, 99, 85], 3);
        addText(`Fertilizer selection: ${guide.fertilizers}`, 9, false, [83, 99, 85], 3);
        addText(`Timing: ${guide.timing}`, 9, false, [83, 99, 85], 3);
        if (guide.dosage) addText(`Guideline dosage: ${guide.dosage}`, 9, false, [83, 99, 85], 3);
        if (guide.condition) addText(`Local check: ${guide.condition}`, 9, false, [125, 79, 37], 3);
        addText(`Official source: ${guide.source} — ${guide.url} (checked ${guide.checkedOn})`, 8, false, [83, 99, 85], 3);
        y += 1;
      });
      if (result.warnings.length) { addSection('Additional result notes'); result.warnings.forEach((warning) => addText(`- ${warning}`, 9, false, [125, 79, 37], 2)); }

      addSection(pdfT('weather.title'));
      const weather = weatherReport.data;
      if (!weather) {
        const messages: Record<WeatherReportStatus, string> = {
          loading: 'Weather analysis was still loading when this report was generated.',
          available: 'Weather analysis data is not available in this report.',
          ambiguous: 'Weather analysis could not resolve the selected location.',
          unavailable: 'Weather analysis is temporarily unavailable.',
          empty: 'No weather report data was returned for this location.',
          locationNoMatch: 'Weather analysis could not match the selected location.',
          notRequested: 'Weather analysis has not been requested on the results page yet.',
        };
        addText(messages[weatherReport.status]);
      } else {
        addPair('Report location', weather.location.report_level === 'district' ? `${weather.location.district}, ${weather.location.state} (district level)` : `${weather.location.village}, ${weather.location.district}, ${weather.location.state}`);
        addPair('Coordinates', `${weather.location.latitude.toFixed(4)}, ${weather.location.longitude.toFixed(4)}`);
        addPair('Forecast model', weather.forecast_model);
        addPair('Report refreshed', new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(weather.refreshed_at)));
        if (weather.forecast_model_updated_at) addPair('Forecast model updated', weather.forecast_model_updated_at);
        addText('Monthly outlook', 9, true, [33, 89, 59]);
        if (weather.forecast.length) weather.forecast.forEach((month) => {
          const values = [
            metric('Rainfall', month.precipitation_mm, 'mm'),
            metric('Rainfall anomaly', month.precipitation_anomaly_mm, 'mm'),
            metric('Mean temperature', month.temperature_mean_c, 'deg C'),
            metric('Minimum temperature', month.temperature_min_c, 'deg C'),
            metric('Maximum temperature', month.temperature_max_c, 'deg C'),
            metric('Wind', month.wind_speed_kmh, 'km/h'),
            metric('Cloud cover', month.cloud_cover_percent, '%'),
            month.sunshine_duration_seconds === undefined ? undefined : metric('Sunshine', month.sunshine_duration_seconds / 3600, 'h'),
            metric('Soil temperature', month.soil_temperature_0_7cm_c, 'deg C'),
            metric('Soil moisture', month.soil_moisture_0_7cm, 'm3/m3'),
            metric('Reference ET', month.evapotranspiration_mm, 'mm'),
          ].filter(Boolean).join(' | ');
          addText(`${displayMonth(month.month)}: ${values || 'No monthly measurements returned'}`, 8.5, false, [66, 88, 72], 3);
        }); else addText('No monthly forecast values were returned.');
        const wetterMonths = weather.forecast.filter((month) => (month.precipitation_anomaly_mm ?? 0) > 0).map((month) => displayMonth(month.month));
        const drierMonths = weather.forecast.filter((month) => (month.precipitation_anomaly_mm ?? 0) < 0).map((month) => displayMonth(month.month));
        const rainfallMonths = weather.forecast.filter((month) => month.precipitation_mm !== undefined);
        if (wetterMonths.length) addPair('Above-average rainfall outlook', wetterMonths.join(', '));
        if (drierMonths.length) addPair('Below-average rainfall outlook', drierMonths.join(', '));
        if (rainfallMonths.length) {
          const highestRain = rainfallMonths.reduce((a, b) => (a.precipitation_mm ?? 0) > (b.precipitation_mm ?? 0) ? a : b);
          const lowestRain = rainfallMonths.reduce((a, b) => (a.precipitation_mm ?? Infinity) < (b.precipitation_mm ?? Infinity) ? a : b);
          addPair('Highest outlook rainfall', displayMonth(highestRain.month)); addPair('Lowest outlook rainfall', displayMonth(lowestRain.month));
        }
        if (weather.historical_monthly.length) {
          addText(`Historical monthly rainfall (${weather.historical_period})`, 9, true, [33, 89, 59]);
          weather.historical_monthly.forEach((month) => addText(`${displayMonth(month.month)}: ${month.precipitation_mm.toFixed(1)} mm average across ${month.years} years`, 8.5, false, [66, 88, 72], 3));
        }
        addPair('Weather data sources', weather.sources.map((source) => `${source.name} (${source.url})`).join('; ')); addPair('Attribution', weather.attribution);
      }

      const pageCount = pdf.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page); pdf.setFillColor(245, 249, 240); pdf.rect(0, 0, pageWidth, 36, 'F');
        pdf.addImage(logoDataUrl, 'PNG', margin, 8, 48, 18);
        pdf.setTextColor(33, 75, 49); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text('CROPSENSE AGRICULTURAL REPORT', margin + 54, 14);
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(101, 126, 103); pdf.text('Digitally generated farmer report', margin + 54, 21);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.text(`Report generated ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date())} IST`, margin + 54, 27);
        // Subtle CropSense symbol watermark is kept in the reserved header area.
        pdf.setGState(pdf.GState({ opacity: 0.025 }));
        pdf.addImage(markDataUrl, 'PNG', pageWidth - margin - 28, 4, 28, 28);
        pdf.setGState(pdf.GState({ opacity: 1 }));
        pdf.setFillColor(33, 75, 49); pdf.rect(0, pageHeight - 20, pageWidth, 20, 'F');
        pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
        pdf.text('An initiative of Smart Farm Labs', margin, pageHeight - 17);
        pdf.text('CropSense · Digitally generated report', margin, pageHeight - 11);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
        pdf.text('cropsensevit@gmail.com', margin, pageHeight - 5);
        pdf.setFontSize(7.5); pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin - 45, pageHeight - 11, { align: 'right' });
        pdf.setFillColor(255, 255, 255); pdf.roundedRect(pageWidth - margin - 42, pageHeight - 17, 42, 14, 2, 2, 'F');
        pdf.addImage(labsDataUrl, 'PNG', pageWidth - margin - 37, pageHeight - 17, 32, 14, undefined, 'FAST');
      }
      const filename = `cropsense-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      const bytes = new Uint8Array(await pdf.output('arraybuffer'));
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      setPreparedPdf({ blob: pdf.output('blob'), base64: btoa(binary), filename });
      setDownloadMessage(t('results.pdfGenerated'));
      window.setTimeout(() => setDownloadMessage(''), 6000);
    } catch (reason) {
      setDownloadMessage(reason instanceof Error ? reason.message : t('results.pdfError'));
    } finally {
      setGeneratingPdf(false);
    }
  };
  const downloadPdf = () => {
    if (!preparedPdf) return;
    const url = URL.createObjectURL(preparedPdf.blob);
    const link = document.createElement('a'); link.href = url; link.download = preparedPdf.filename; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloadMessage(t('results.downloadedPdf'));
  };
  const deliverPdfByEmail = async () => {
    if (!preparedPdf || !user?.email) return;
    setEmailing(true);
    setDownloadMessage('');
    try {
      await apiFetch<{ status: string }>('/email-report', {
        timeoutMs: 15_000, method: 'POST', body: JSON.stringify({ pdf_base64: preparedPdf.base64, filename: preparedPdf.filename }),
      });
      setDownloadMessage(t('results.emailSent', { email: user.email }));
      window.setTimeout(() => setDownloadMessage(''), 6000);
    } catch (reason) {
      setDownloadMessage(reason instanceof Error ? reason.message : t('results.pdfError'));
    } finally {
      setEmailing(false);
    }
  };
  const inputLabel = (key: keyof CropFormData) => t(`form.fields.${key}`);
  const units: Record<keyof CropFormData, string> = { nitrogen: t('form.units.kgPerHa'), phosphorus: t('form.units.kgPerHa'), potassium: t('form.units.kgPerHa'), ph: t('form.units.ph'), soil_moisture: t('form.units.percent'), temperature: t('form.units.celsius'), humidity: t('form.units.percent') };
  const stage = progress < 30 ? t('results.loadingValidate') : progress < 70 ? t('results.loading') : t('results.loadingPrepare');

  return <div className="print-content min-h-[75vh] bg-[radial-gradient(ellipse_at_90%_0%,#eef3e4,transparent_38%),#f7f8f2] py-10 sm:py-16"><div className="section-wrap max-w-6xl">
    <Link to="/farmer/dashboard" className="print-hidden inline-flex items-center gap-2 text-sm font-semibold text-[#46664c] transition hover:translate-x-[-2px] hover:text-[#193b2b]"><ArrowLeft className="h-4 w-4" />{t('results.back')}</Link>
    <div className="mt-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eaf1e2] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#42664a]"><Sprout className="h-4 w-4" />{t('results.kicker')}</div><h1 className="display-title text-4xl text-[#203c2c] sm:text-5xl">{t('results.title')}</h1><p className="mt-3 max-w-2xl leading-7 text-[#718074]">{t('results.subtitle')}</p>{result?.report_id && <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#dce8d4] bg-white/80 px-3 py-1.5 text-sm font-semibold text-[#385c3c]"><span>{t('results.reportId')}:</span><code className="font-mono font-extrabold tracking-wider text-[#1c4930]">{result.report_id}</code></p>}</div>
      {result && <div className="print-hidden flex flex-wrap gap-2">
        {!preparedPdf ? <button type="button" onClick={() => void generatePdf()} disabled={generatingPdf || weatherReport.status === 'notRequested' || weatherReport.status === 'loading'} aria-busy={generatingPdf} className="primary-button disabled:cursor-wait disabled:opacity-60">{generatingPdf ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{generatingPdf ? t('results.generatingPdf') : t('results.generatePdf')}</button> : <>
          <button type="button" onClick={downloadPdf} className="primary-button"><Download className="h-4 w-4" />{t('results.downloadPdf')}</button>
          <button type="button" onClick={() => void deliverPdfByEmail()} disabled={emailing || !user?.email} aria-busy={emailing} className="secondary-button disabled:cursor-wait disabled:opacity-60">{emailing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{emailing ? t('results.emailSending') : t('results.emailPdf')}</button>
          <button type="button" onClick={() => window.print()} className="secondary-button"><Printer className="h-4 w-4" />{t('results.printPage')}</button>
        </>}
      </div>}
    </div>
    {downloadMessage && <p role="status" className="mt-3 text-right text-sm font-semibold text-[#426b48]">{downloadMessage}</p>}
    {!result && !error && <div role="status" aria-live="polite" className="surface-card soft-enter mt-10 flex flex-col items-center p-8 text-center sm:p-12">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4e5] text-[#386543]"><Sprout className="h-7 w-7 animate-pulse" /></span>
      <p className="mt-4 font-semibold text-[#35513d]">{stage}</p>
      <div className="mt-6 w-full max-w-md">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#526657]"><span>{t('results.progressLabel')}</span><span>{Math.round(progress)}%</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#e8eee2]" role="progressbar" aria-label={t('results.progressLabel')} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gradient-to-r from-[#6d984f] to-[#a5c76f] transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} /></div>
      </div>
    </div>}
    {error && <div role="alert" className="mt-10 rounded-2xl border border-[#efd0c9] bg-[#fff7f5] p-6 text-[#743c31]"><div className="flex gap-3"><AlertCircle className="h-5 w-5 shrink-0" /><div><h2 className="font-semibold">{t('results.unavailable')}</h2><p className="mt-1 text-sm">{error}</p><p className="mt-3 text-sm">{t('results.startApi')}</p><button onClick={() => window.location.reload()} className="secondary-button mt-4">{t('results.tryAgain')}</button></div></div></div>}
    {result && <div className="soft-enter">
      <div data-cropsaathi-context={JSON.stringify({
        report_id: result.report_id,
        form_values: input ? {
          nitrogen: input.nitrogen,
          phosphorus: input.phosphorus,
          potassium: input.potassium,
          ph: input.ph,
          soil_moisture: input.soil_moisture,
          temperature: input.temperature,
          humidity: input.humidity,
          land_area_acres: input.land_area_acres,
          location_name: input.location_name?.slice(0, 160),
          village_town: input.village_town?.slice(0, 100),
          farm_district: input.farm_district?.slice(0, 100),
          farm_state: input.farm_state?.slice(0, 100),
        } : null,
        recommendations: result.recommendations.map((item) => {
          const guide = getFertilizerGuidance(item.crop, input?.farm_state);
          return { crop: item.crop, score: item.score, explanation: item.explanation, fertilizer: {
            fertilizers: guide.fertilizers, nutrients: guide.nutrients, timing: guide.timing,
            dosage: guide.dosage, source: guide.source, url: guide.url, checked_on: guide.checkedOn,
          } };
        }),
        weather: weatherReport.status === 'available' && weatherReport.data ? {
          location: `${weatherReport.data.location.village}, ${weatherReport.data.location.district}, ${weatherReport.data.location.state}`,
          refreshed_at: weatherReport.data.refreshed_at,
          forecast: weatherReport.data.forecast.slice(0, 3).map(({ month, precipitation_mm, temperature_mean_c, temperature_min_c, temperature_max_c }) => ({
            month, precipitation_mm: precipitation_mm ?? null, temperature_mean_c: temperature_mean_c ?? null,
            temperature_min_c: temperature_min_c ?? null, temperature_max_c: temperature_max_c ?? null,
          })),
        } : null,
      })} aria-hidden="true" className="sr-only" />
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><Stat label={t('results.model')} value={result.model_name.replaceAll('_', ' ')} /><Stat label={t('results.validation')} value={`${(result.evaluated_macro_f1 * 100).toFixed(1)}% macro F1`} /><Stat label={t('results.version')} value={result.model_version} /></div>
      {result.warnings.map((warning) => <div key={warning} className={`mt-4 flex gap-3 rounded-2xl border p-4 text-sm leading-6 ${result.within_observed_feature_ranges ? 'border-[#eadcb6] bg-[#fbf7e9] text-[#69572a]' : 'border-[#ebd2bf] bg-[#fff7f0] text-[#714528]'}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{warning}</p></div>)}
      <section className="surface-card mt-6 p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-base font-bold text-[#294634]">{t('results.inputTitle')}</h2><p className="mt-1 text-sm text-[#829082]">{t('results.inputSubtitle')}</p></div><Link to="/farmer/dashboard#farmer-recommendation" className="print-hidden text-sm font-semibold text-[#3f714a] hover:underline">{t('results.editInputs')}</Link></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{input && inputFields.map((key) => <div key={key} className="rounded-xl bg-[#f6f8f3] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#879486]">{inputLabel(key)}</p><p className="mt-1 text-sm font-bold text-[#294634]">{input[key]} <span className="text-[10px] font-medium text-[#839083]">{units[key]}</span></p></div>)}</div></section>
      <div className="mb-4 mt-7 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="eyebrow">{t('results.ranked')}</p><h2 className="mt-2 text-2xl font-bold text-[#203c2c]">{t('results.topCrops')}</h2></div></div>
      {result.recommendations.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.recommendations.map((item, index) => <CropCard key={item.crop} cropName={item.crop} score={item.score} accuracy={result.evaluated_accuracy} explanation={item.explanation} rank={index + 1} yieldPerAcre={item.expected_yield_quintals_per_acre} expectedHarvest={item.expected_harvest_quintals} farmState={input?.farm_state} npk={input ? { nitrogen: input.nitrogen, phosphorus: input.phosphorus, potassium: input.potassium } : undefined} />)}</div> : <p className="surface-card p-6 text-[#526657]">{t('results.noResults')}</p>}
      {input && <WeatherClimateSection location={{ village_town: input.village_town ?? '', farm_district: input.farm_district ?? '', farm_state: input.farm_state ?? '', latitude: input.latitude ? Number(input.latitude) : null, longitude: input.longitude ? Number(input.longitude) : null }} onReportChange={updateWeatherReport} />}
      <div className="mt-7 print-hidden"><HardwarePromo compact /></div>
      <SchemesHighlight />
      {result.recommendations.length > 1 && <section className="surface-card mt-8 p-5 sm:p-7"><p className="eyebrow">{t('results.comparisonEyebrow')}</p><h2 className="mt-2 text-xl font-bold text-[#203c2c]">{t('results.comparisonTitle')}</h2><p className="mt-1 text-sm text-[#829082]">{t('results.comparisonDescription')}</p><div className="table-scroll mt-4"><table><thead><tr><th>{t('results.rank')}</th><th>{t('results.crop')}</th><th>{t('results.score')}</th><th>{t('results.visualScore')}</th></tr></thead><tbody>{result.recommendations.map((item, index) => <tr key={item.crop}><td>#{index + 1}</td><td className="font-semibold capitalize">{item.crop}</td><td>{Math.round(item.score * 100)}%</td><td><div className="h-2 w-28 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full rounded-full bg-[#6f9b55] transition-[width] duration-700" style={{ width: `${Math.min(100, item.score * 100)}%` }} /></div></td></tr>)}</tbody></table></div></section>}
    </div>}
  </div></div>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="surface-card result-stat p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#869283]">{label}</p><p className="mt-2 truncate text-lg font-semibold capitalize text-[#294634]">{value}</p></div>; }
