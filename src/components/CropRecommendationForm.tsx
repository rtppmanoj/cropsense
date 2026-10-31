import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Info, MapPin } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { indianStates } from '../data/indianStates';
import { getDistrictsForState } from '../data/indianDistricts';

export type CropFormData = { nitrogen: string; phosphorus: string; potassium: string; ph: string; soil_moisture: string; temperature: string; humidity: string; land_area_acres: string; location_name?: string; village_town?: string; latitude?: string; longitude?: string; location_source?: string; farm_state?: string; farm_district?: string };
type FieldName = 'nitrogen' | 'phosphorus' | 'potassium' | 'ph' | 'soil_moisture' | 'temperature' | 'humidity';
type Field = { name: FieldName; label: string; unit: string; min: number; max: number; step: string; group: 'npk' | 'soil' | 'environment'; help: string };
const fields: Field[] = [
  { name: 'nitrogen', label: 'N', unit: 'form.units.kgPerHa', min: 0, max: 500, step: '0.1', group: 'npk', help: 'form.help.nitrogen' },
  { name: 'phosphorus', label: 'P₂O₅', unit: 'form.units.kgPerHa', min: 0, max: 500, step: '0.1', group: 'npk', help: 'form.help.phosphorus' },
  { name: 'potassium', label: 'K₂O', unit: 'form.units.kgPerHa', min: 0, max: 500, step: '0.1', group: 'npk', help: 'form.help.potassium' },
  { name: 'ph', label: 'form.fields.ph', unit: 'form.units.ph', min: 0, max: 14, step: '0.1', group: 'soil', help: 'form.help.ph' },
  { name: 'soil_moisture', label: 'form.fields.soil_moisture', unit: 'form.units.percent', min: 0, max: 100, step: '0.1', group: 'soil', help: 'form.help.moisture' },
  { name: 'temperature', label: 'form.fields.temperature', unit: 'form.units.celsius', min: -10, max: 70, step: '0.1', group: 'environment', help: 'form.help.temperature' },
  { name: 'humidity', label: 'form.fields.humidity', unit: 'form.units.percent', min: 0, max: 100, step: '0.1', group: 'environment', help: 'form.help.humidity' },
];
const emptyForm: CropFormData = { nitrogen: '', phosphorus: '', potassium: '', ph: '', soil_moisture: '', temperature: '', humidity: '', land_area_acres: '' };

export default function CropRecommendationForm() {
  const navigate = useNavigate(); const { t, i18n } = useTranslation();
  const hardwareTip = ({
    en: 'For better soil testing, use the CropSense Soil Testing Tool. Read the values on its LCD and enter them here.',
    hi: 'बेहतर मिट्टी परीक्षण के लिए CropSense मिट्टी परीक्षण टूल का उपयोग करें। LCD पर रीडिंग देखकर यहां दर्ज करें।',
    ta: 'சிறந்த மண் பரிசோதனைக்கு CropSense மண் பரிசோதனைக் கருவியைப் பயன்படுத்துங்கள். LCD அளவீடுகளை இங்கே உள்ளிடுங்கள்.',
    te: 'మెరుగైన మట్టి పరీక్ష కోసం CropSense మట్టి పరీక్ష సాధనాన్ని ఉపయోగించండి. LCD రీడింగ్‌లను ఇక్కడ నమోదు చేయండి.',
  } as Record<string, string>)[(i18n.resolvedLanguage ?? 'en').split('-')[0]] ?? 'For better soil testing, use the CropSense Soil Testing Tool. Read the values on its LCD and enter them here.';
  const { farmerDraft, setFarmerDraft } = useAuth();
  const [values, setValues] = useState<CropFormData>(() => ({ ...emptyForm, ...(farmerDraft as Partial<CropFormData> | null), location_name: farmerDraft?.location_name ?? '', village_town: farmerDraft?.village_town ?? '', farm_state: farmerDraft?.farm_state ?? '', farm_district: farmerDraft?.farm_district ?? '', latitude: '', longitude: '', location_source: 'manual' }));
  const [errors, setErrors] = useState<Partial<Record<keyof CropFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); const nextErrors: typeof errors = {};
    for (const field of fields) { const value = Number(values[field.name]); if (!values[field.name].trim() || !Number.isFinite(value)) nextErrors[field.name] = t('form.validation.required'); else if (value < field.min || value > field.max) nextErrors[field.name] = `${t('form.validation.range')} ${field.min} ${t('form.validation.and')} ${field.max}`; }
    const area = Number(values.land_area_acres);
    if (!values.land_area_acres.trim() || !Number.isFinite(area) || area <= 0 || area > 100000) nextErrors.land_area_acres = t('form.validation.landArea');
    if (!values.farm_state) nextErrors.farm_state = t('form.location.stateRequired');
    if (!values.farm_district) nextErrors.farm_district = t('form.location.districtRequired');
    if (!values.village_town?.trim()) nextErrors.village_town = t('form.location.villageRequired');
    setErrors(nextErrors); if (Object.keys(nextErrors).length) { const firstError = Object.keys(nextErrors)[0]; const fieldId = firstError === 'farm_state' ? 'farm-state' : firstError === 'farm_district' ? 'farm-district' : firstError === 'village_town' ? 'farm-village' : firstError === 'land_area_acres' ? 'land-area' : firstError; document.getElementById(fieldId)?.focus(); return; }
    setSubmitting(true);
    try {
      setFarmerDraft(values); navigate('/farmer/result');
    } finally { setSubmitting(false); }
  };
  const fieldGroup = (group: Field['group']) => <div className="grid gap-4 sm:grid-cols-2">{fields.filter((field) => field.group === group).map((field) => <div key={field.name}>
    <label htmlFor={field.name} className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-[#334c3a]"><span>{field.label.startsWith('form.') ? t(field.label) : field.label}</span><span className="flex items-center gap-1.5"><span className="text-xs font-medium text-[#829082]">{t(field.unit)}</span><span className="group relative inline-flex" tabIndex={0} aria-label={t(field.help)}><Info className="h-3.5 w-3.5 text-[#8da08a]" /><span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-52 rounded-xl bg-[#173a2a] p-3 text-xs font-normal leading-5 text-white opacity-0 shadow-xl transition group-hover:opacity-100 group-focus:opacity-100">{t(field.help)}</span></span></span></label>
    <input className="field-input" id={field.name} name={field.name} type="number" inputMode="decimal" required min={field.min} max={field.max} step={field.step} value={values[field.name]} placeholder={t('form.placeholder')} onBlur={(event) => { const raw = event.currentTarget.value.trim(); const value = Number(raw); const error = raw && Number.isFinite(value) && (value < field.min || value > field.max) ? `${t('form.validation.range')} ${field.min} ${t('form.validation.and')} ${field.max}` : undefined; setErrors((current) => ({ ...current, [field.name]: error })); }} onChange={(event) => { setValues((current) => ({ ...current, [field.name]: event.target.value })); setErrors((current) => ({ ...current, [field.name]: undefined })); }} aria-invalid={Boolean(errors[field.name])} aria-describedby={`${field.name}-range${errors[field.name] ? ` ${field.name}-error` : ''}`} />
    <p id={`${field.name}-range`} className="mt-1.5 text-xs text-[#718074]">{t('form.acceptableRange', { min: field.min, max: field.max })}</p>
    {errors[field.name] && <p id={`${field.name}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700">{errors[field.name]}</p>}
  </div>)}</div>;
  const locationSection = <section className="mt-7 rounded-2xl border border-[#e4eadf] bg-[#fbfcf9] p-4 sm:p-5"><div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf4e5] text-[#386543]"><MapPin className="h-4 w-4" /></span><div><h4 className="font-bold text-[#294634]">{t('form.location.title')}</h4><p className="mt-1 text-xs leading-5 text-[#849084]">{t('form.location.description')}</p></div></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <div><label htmlFor="farm-state" className="mb-2 block text-sm font-semibold text-[#334c3a]">{t('form.location.state')}</label><select id="farm-state" className="field-input" required value={values.farm_state ?? ''} onChange={(event) => { setValues((current) => ({ ...current, farm_state: event.target.value, farm_district: '', village_town: '', location_name: '' })); setErrors((current) => ({ ...current, farm_state: undefined, farm_district: undefined, village_town: undefined })); }} aria-invalid={Boolean(errors.farm_state)}><option value="">{t('form.location.selectState')}</option>{indianStates.map((state) => <option key={state} value={state}>{state}</option>)}</select>{errors.farm_state && <p role="alert" className="mt-1.5 text-xs text-red-700">{errors.farm_state}</p>}</div>
      <div><label htmlFor="farm-district" className="mb-2 block text-sm font-semibold text-[#334c3a]">{t('form.location.district')}</label><select id="farm-district" className="field-input" required disabled={!values.farm_state} value={values.farm_district ?? ''} onChange={(event) => { setValues((current) => ({ ...current, farm_district: event.target.value, village_town: '', location_name: '' })); setErrors((current) => ({ ...current, farm_district: undefined, village_town: undefined })); }} aria-invalid={Boolean(errors.farm_district)}><option value="">{t('form.location.selectDistrict')}</option>{getDistrictsForState(values.farm_state ?? '').map((district) => <option key={district} value={district}>{district}</option>)}</select>{errors.farm_district && <p role="alert" className="mt-1.5 text-xs text-red-700">{errors.farm_district}</p>}</div>
      <div><label htmlFor="farm-village" className="mb-2 block text-sm font-semibold text-[#334c3a]">{t('form.location.villageTown')}</label><input id="farm-village" className="field-input" required maxLength={100} list="farm-village-suggestions" disabled={!values.farm_district} placeholder={t('form.location.villagePlaceholder')} value={values.village_town ?? ''} onChange={(event) => { const village = event.target.value; setValues((current) => ({ ...current, village_town: village, location_name: [village, current.farm_district, current.farm_state].filter(Boolean).join(', ') })); setErrors((current) => ({ ...current, village_town: undefined })); }} aria-invalid={Boolean(errors.village_town)} /><datalist id="farm-village-suggestions">{values.farm_district && <option value={values.farm_district} />}</datalist>{errors.village_town && <p role="alert" className="mt-1.5 text-xs text-red-700">{errors.village_town}</p>}</div>
    </div>
    <p className="mt-3 text-xs leading-5 text-[#829082]">{t('form.location.privacy')}</p>
  </section>;
  return <form onSubmit={submit} className="surface-card mx-auto max-w-4xl p-5 sm:p-8 lg:p-10" aria-busy={submitting}>
    <div className="flex flex-col justify-between gap-3 border-b border-[#edf0e9] pb-6 sm:flex-row sm:items-center"><div><p className="eyebrow">{t('form.eyebrow')}</p><h3 className="mt-2 text-xl font-bold text-[#203c2c]">{t('form.title')}</h3><p className="mt-1 text-sm leading-6 text-[#718074]">{t('form.description')}</p><a href="/about#soil-testing-tool" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#47734b] hover:underline"><Info className="h-3.5 w-3.5 shrink-0" />{hardwareTip}</a></div><span className="w-fit rounded-full bg-[#eff4e9] px-3 py-1.5 text-xs font-bold text-[#51734b]">{t('form.fieldsCount')}</span></div>
    {locationSection}
    <section className="mt-6 rounded-2xl border border-[#e4eadf] bg-[#fbfcf9] p-4 sm:p-5"><label htmlFor="land-area" className="mb-2 block text-sm font-semibold text-[#334c3a]">{t('form.landArea.label')}</label><div className="flex items-center gap-3"><input id="land-area" className="field-input max-w-xs" name="land_area_acres" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" required value={values.land_area_acres} placeholder={t('form.landArea.placeholder')} onChange={(event) => { setValues((current) => ({ ...current, land_area_acres: event.target.value })); setErrors((current) => ({ ...current, land_area_acres: undefined })); }} aria-invalid={Boolean(errors.land_area_acres)} aria-describedby={errors.land_area_acres ? 'land-area-error' : undefined} /><span className="text-sm font-semibold text-[#718074]">{t('form.units.acres')}</span></div>{errors.land_area_acres && <p id="land-area-error" role="alert" className="mt-1.5 text-xs text-red-700">{errors.land_area_acres}</p>}</section>
    <section className="mt-7"><div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf4e5] text-xs font-extrabold text-[#386543]">01</span><div><h4 className="font-bold text-[#294634]">{t('form.sections.npk.title')}</h4><p className="mt-1 text-xs leading-5 text-[#849084]">{t('form.sections.npk.description')}</p></div></div>{fieldGroup('npk')}</section>
    <section className="mt-8 border-t border-[#edf0e9] pt-7"><div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf4e5] text-xs font-extrabold text-[#386543]">02</span><div><h4 className="font-bold text-[#294634]">{t('form.sections.soil.title')}</h4><p className="mt-1 text-xs leading-5 text-[#849084]">{t('form.sections.soil.description')}</p></div></div>{fieldGroup('soil')}</section>
    <section className="mt-8 border-t border-[#edf0e9] pt-7"><div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf4e5] text-xs font-extrabold text-[#386543]">03</span><div><h4 className="font-bold text-[#294634]">{t('form.sections.environment.title')}</h4><p className="mt-1 text-xs leading-5 text-[#849084]">{t('form.sections.environment.description')}</p></div></div>{fieldGroup('environment')}</section>
    <div className="mt-8 flex flex-col justify-between gap-4 border-t border-[#edf0e9] pt-6 sm:flex-row sm:items-center"><p className="max-w-md text-xs leading-5 text-[#849084]">{t('form.privacyNote')}</p><button type="submit" disabled={submitting} className="primary-button disabled:cursor-wait disabled:opacity-70">{submitting ? t('form.loading') : t('form.submit')} <ArrowRight className="h-4 w-4" /></button></div>
  </form>;
}
