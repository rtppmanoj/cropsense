import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, CloudRain, MapPin, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, ApiError } from '../services/apiClient';

type Month = { month: string; precipitation_mm?: number; precipitation_anomaly_mm?: number; temperature_mean_c?: number; temperature_mean_anomaly_c?: number; temperature_min_c?: number; temperature_max_c?: number; wind_speed_kmh?: number; cloud_cover_percent?: number; sunshine_duration_seconds?: number; soil_temperature_0_7cm_c?: number; soil_moisture_0_7cm?: number; evapotranspiration_mm?: number };
export type WeatherReportData = { location: { village: string; district: string; state: string; latitude: number; longitude: number; report_level: 'village' | 'district' }; forecast: Month[]; historical_monthly: { month: number; precipitation_mm: number; years: number }[]; historical_period: string; forecast_model: string; forecast_model_updated_at: string | null; refreshed_at: string; sources: { name: string; url: string }[]; attribution: string };
export type WeatherReportStatus = 'loading' | 'available' | 'ambiguous' | 'unavailable' | 'empty' | 'locationNoMatch' | 'notRequested';
type WeatherData = WeatherReportData;

type WeatherLocation = { village_town: string; farm_district: string; farm_state: string; latitude: number | null; longitude: number | null };
const pendingWeatherRequests = new Map<string, Promise<WeatherData>>();

function requestWeather(location: WeatherLocation): Promise<WeatherData> {
  const query = new URLSearchParams({ village_town: location.village_town, farm_district: location.farm_district, farm_state: location.farm_state });
  if (location.latitude !== null && location.longitude !== null) { query.set('latitude', String(location.latitude)); query.set('longitude', String(location.longitude)); }
  const path = `/farmer/weather?${query.toString()}`;
  const key = path;
  const pending = pendingWeatherRequests.get(key);
  if (pending) return pending;
  const request = apiFetch<WeatherData>(path);
  pendingWeatherRequests.set(key, request);
  request.then(() => pendingWeatherRequests.delete(key), () => pendingWeatherRequests.delete(key));
  return request;
}

export default function WeatherClimateSection({ location, onReportChange }: { location: WeatherLocation; onReportChange?: (data: WeatherReportData | null, status: WeatherReportStatus) => void }) {
  const { t, i18n } = useTranslation();
  const { village_town, farm_district, farm_state, latitude, longitude } = location;
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<'none' | 'ambiguous' | 'unavailable' | 'empty' | 'locationNoMatch'>('none');
  const load = useCallback(async () => {
    setLoading(true); setError('none'); onReportChange?.(null, 'loading');
    try { const report = await requestWeather({ village_town, farm_district, farm_state, latitude, longitude }); setData(report); onReportChange?.(report, 'available'); }
    catch (reason) {
      setData(null);
      if (reason instanceof ApiError && reason.status === 404) { setError('empty'); onReportChange?.(null, 'empty'); }
      else if (reason instanceof ApiError && reason.status === 409) { setError('ambiguous'); onReportChange?.(null, 'ambiguous'); }
      else if (reason instanceof ApiError && reason.status === 422) { setError('locationNoMatch'); onReportChange?.(null, 'locationNoMatch'); }
      else { setError('unavailable'); onReportChange?.(null, 'unavailable'); }
    } finally { setLoading(false); }
  }, [village_town, farm_district, farm_state, latitude, longitude, onReportChange]);
  useEffect(() => { void load(); }, [load]);

  const monthName = (value: string | number) => {
    const date = typeof value === 'number' ? new Date(2020, value - 1, 1, 12) : new Date(`${value}-01T12:00:00`);
    return new Intl.DateTimeFormat(i18n.language, { month: 'short', year: typeof value === 'string' ? 'numeric' : undefined }).format(date);
  };
  const forecastMonths = data?.forecast ?? [];
  const rain = forecastMonths.filter((month) => month.precipitation_mm !== undefined);
  const anomalies = rain.filter((month) => month.precipitation_anomaly_mm !== undefined);
  const wet = anomalies.filter((month) => (month.precipitation_anomaly_mm ?? 0) > 0).map((month) => monthName(month.month));
  const dry = anomalies.filter((month) => (month.precipitation_anomaly_mm ?? 0) < 0).map((month) => monthName(month.month));
  const highest = rain.length ? rain.reduce((a, b) => (a.precipitation_mm ?? 0) > (b.precipitation_mm ?? 0) ? a : b) : undefined;
  const lowest = rain.length ? rain.reduce((a, b) => (a.precipitation_mm ?? Infinity) < (b.precipitation_mm ?? Infinity) ? a : b) : undefined;
  const dateTime = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const historical = data?.historical_monthly ?? [];
  const maxRain = Math.max(1, ...rain.map((month) => month.precipitation_mm ?? 0), ...historical.map((month) => month.precipitation_mm));

  return <section id="weather-climate" className="surface-card mt-8 scroll-mt-24 overflow-hidden">
    <div className="bg-gradient-to-r from-[#e8f1df] via-[#f0f5e8] to-[#e3eff0] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-[#386543]"><CloudRain className="h-5 w-5" /></span><div><p className="eyebrow">{t('weather.kicker')}</p><h2 className="mt-1 text-xl font-bold text-[#203c2c]">{t('weather.title')}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#718074]">{t('weather.description')}</p></div></div>
        <div className="flex flex-wrap gap-2"><button type="button" className="primary-button" aria-expanded={expanded} aria-controls="weather-analysis-report" onClick={() => setExpanded((value) => !value)}><CloudRain className="h-4 w-4" />{t(expanded ? 'weather.closeAnalysis' : 'weather.openAnalysis')}<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
          {expanded && <button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('weather.refresh')}</button>}</div>
      </div>
      {expanded && data && <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#46664c]"><MapPin className="h-4 w-4" /><span>{data.location.report_level === 'district' ? t('weather.districtLevel', { district: data.location.district, state: data.location.state }) : `${data.location.village}, ${data.location.district}, ${data.location.state}`}</span><span className="font-normal text-[#829082]">· {data.forecast_model}</span></div>}
    </div>
    {expanded && <div id="weather-analysis-report" className="p-5 sm:p-7">
      {loading && <p role="status" className="rounded-xl bg-[#f7f8f4] p-4 text-sm text-[#718074]">{t('weather.loading')}</p>}
      {!loading && error !== 'none' && <div role={error === 'unavailable' ? 'alert' : 'status'} className="flex gap-3 rounded-xl border border-[#e6e9df] bg-[#fafbf8] p-4 text-sm leading-6 text-[#627264]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8b9b77]" /><p>{t(`weather.${error === 'empty' ? 'noLocation' : error}`)}</p></div>}
      {!loading && data && <>
        <div className="grid gap-6 xl:grid-cols-2">
          <section><div className="flex items-end justify-between gap-3"><div><h3 className="font-bold text-[#294634]">{t('weather.forecastTitle')}</h3></div><span className="shrink-0 text-xs text-[#829082]">{forecastMonths.length} {t('weather.monthsLabel', { defaultValue: 'months' })}</span></div>
            {forecastMonths.length ? <div className="mt-5 space-y-4">{forecastMonths.map((month) => <article key={month.month} className="rounded-xl border border-[#edf0e9] p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[#334c3a]">{monthName(month.month)}</p><p className="text-sm font-bold tabular-nums text-[#294634]">{month.precipitation_mm === undefined ? t('weather.missingValue') : `${month.precipitation_mm.toFixed(0)} mm`}</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef1e9]"><div className="h-full rounded-full bg-[#5d9a9a]" style={{ width: `${Math.max(2, (month.precipitation_mm ?? 0) / maxRain * 100)}%` }} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#718074]">{month.temperature_mean_c !== undefined && <span>{t('weather.temperature')}: {month.temperature_mean_c.toFixed(1)} °C</span>}{month.temperature_min_c !== undefined && <span>{t('weather.minTemperature')}: {month.temperature_min_c.toFixed(1)} °C</span>}{month.temperature_max_c !== undefined && <span>{t('weather.maxTemperature')}: {month.temperature_max_c.toFixed(1)} °C</span>}{month.precipitation_anomaly_mm !== undefined && <span>{t('weather.anomaly')}: {month.precipitation_anomaly_mm > 0 ? '+' : ''}{month.precipitation_anomaly_mm.toFixed(0)} mm</span>}</div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#829082]">{[
                { value: month.wind_speed_kmh, label: t('weather.wind'), unit: ' km/h' },
                { value: month.cloud_cover_percent, label: t('weather.cloud'), unit: '%' },
                { value: month.sunshine_duration_seconds === undefined ? undefined : month.sunshine_duration_seconds / 3600, label: t('weather.sunshine'), unit: ' h' },
                { value: month.soil_temperature_0_7cm_c, label: t('weather.soilTemperature'), unit: ' deg C' },
                { value: month.soil_moisture_0_7cm, label: t('weather.soilMoisture'), unit: ' m3/m3' },
                { value: month.evapotranspiration_mm, label: t('weather.evapotranspiration'), unit: ' mm' },
              ].filter((metric) => metric.value !== undefined).map((metric) => <span key={metric.label}>{metric.label}: {metric.value!.toFixed(1)}{metric.unit}</span>)}</div></article>)}</div> : <p className="mt-4 rounded-xl bg-[#f7f8f4] p-4 text-sm text-[#829082]">{t('weather.noMonths')}</p>}
          </section>
          <section><h3 className="font-bold text-[#294634]">{t('weather.comparisonTitle')}</h3><div className="mt-4 flex flex-wrap gap-4 text-xs text-[#718074]"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#5d9a9a]" />{t('weather.rain')}</span><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#c8d4ae]" />{t('weather.historical')}</span></div>
            {rain.length && historical.length ? <div className="mt-4 space-y-3">{rain.map((month) => { const hist = historical.find((item) => item.month === Number(month.month.slice(5, 7))); return <div key={month.month} className="grid grid-cols-[3.25rem_1fr_3rem] items-center gap-2"><span className="text-[11px] text-[#718074]">{monthName(month.month)}</span><div className="space-y-1"><div className="h-2 overflow-hidden rounded-full bg-[#f0f2ed]"><div className="h-full rounded-full bg-[#5d9a9a]" style={{ width: `${Math.max(1, (month.precipitation_mm ?? 0) / maxRain * 100)}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-[#f0f2ed]"><div className="h-full rounded-full bg-[#c8d4ae]" style={{ width: `${Math.max(1, (hist?.precipitation_mm ?? 0) / maxRain * 100)}%` }} /></div></div><span className="text-right text-[10px] tabular-nums text-[#829082]">{hist ? `${hist.precipitation_mm.toFixed(0)} mm` : '—'}</span></div>; })}</div> : <p className="mt-4 rounded-xl bg-[#f7f8f4] p-4 text-sm text-[#829082]">{!rain.length ? t('weather.noForecast') : t('weather.noHistory')}</p>}
          </section>
        </div>
        <div className="mt-6 grid gap-6 border-t border-[#edf0e9] pt-6 md:grid-cols-2">
          <section><h3 className="font-bold text-[#294634]">{t('weather.summaryTitle')}</h3><div className="mt-2 space-y-1 text-sm leading-6 text-[#718074]">{wet.length ? <p>{t('weather.wetMonths', { months: wet.join(', ') })}</p> : null}{dry.length ? <p>{t('weather.dryMonths', { months: dry.join(', ') })}</p> : null}{!wet.length && !dry.length && <p>{anomalies.length ? t('weather.neutralMonths') : t('weather.noAnomaly')}</p>}{!anomalies.length && highest && lowest && <p>{t('weather.highRainfall', { month: monthName(highest.month) })} {t('weather.lowRainfall', { month: monthName(lowest.month) })}</p>}</div>
            {historical.length > 0 && <><h4 className="mt-4 text-sm font-semibold text-[#46664c]">{t('weather.climateTitle')}</h4><p className="mt-1 text-xs text-[#829082]">{t('weather.climateNote', { period: data.historical_period })}</p><div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">{historical.map((item) => <div key={item.month} className="text-center"><div className="flex h-16 items-end justify-center rounded-lg bg-[#f7f8f4] p-1"><div className="w-full rounded-sm bg-[#c8d4ae]" style={{ height: `${Math.max(3, item.precipitation_mm / maxRain * 100)}%` }} title={`${item.precipitation_mm.toFixed(1)} mm`} /></div><p className="mt-1 text-[10px] text-[#829082]">{monthName(item.month)}</p><p className="text-[10px] font-semibold text-[#526657]">{item.precipitation_mm.toFixed(0)}</p></div>)}</div></>}
          </section>
          <section className="rounded-xl bg-[#f7f8f4] p-4"><h3 className="font-bold text-[#294634]">{t('weather.source')}</h3><ul className="mt-3 space-y-1 text-xs">{data.sources.map((source) => <li key={source.url}><a className="font-semibold text-[#3f714a] underline decoration-[#b8cba9] underline-offset-2" href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul><p className="mt-2 text-xs text-[#718074]">{data.attribution} · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY 4.0</a></p><p className="mt-3 text-[11px] text-[#829082]">{t('weather.refreshed', { time: dateTime(data.refreshed_at) })}</p>{data.forecast_model_updated_at && <p className="text-[11px] text-[#829082]">{t('weather.modelUpdate', { date: data.forecast_model_updated_at })}</p>}</section>
        </div>
      </>}
    </div>}
  </section>;
}
