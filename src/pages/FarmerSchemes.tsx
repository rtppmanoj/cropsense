import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BookOpenCheck, Check, HelpCircle, FileCheck2, PhoneCall, Search, ShieldCheck, Sprout, X } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { formatDate } from '../i18n/format';
import { useTranslation } from 'react-i18next';
import { getDisasterSupportCopy, getSchemeCopy, getSchemeUi } from '../i18n/schemeTranslations';
import type { ApplicationStatus, FarmerSchemesResponse, Scheme } from '../components/SchemeTypes';

const statuses: { value: ApplicationStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'preparing', label: 'Preparing documents' },
  { value: 'applied', label: 'Applied' },
  { value: 'follow_up', label: 'Follow-up needed' },
  { value: 'completed', label: 'Completed' },
];

export default function FarmerSchemes() {
  const { t } = useTranslation();
  const [data, setData] = useState<FarmerSchemesResponse | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try { setData(await apiFetch<FarmerSchemesResponse>('/farmer/schemes')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load schemes. Please try again.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => (data?.items ?? []).filter((scheme) => {
    const term = query.trim().toLowerCase();
    return (!term || `${scheme.name} ${scheme.summary} ${scheme.benefit}`.toLowerCase().includes(term))
      && (category === 'all' || scheme.category === category)
      && (!savedOnly || scheme.saved);
  }), [data, query, category, savedOnly]);

  const toggleSaved = async (scheme: Scheme) => {
    setError(''); setBusyId(scheme.id);
    try {
      if (scheme.saved) {
        await apiFetch(`/farmer/schemes/${scheme.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      } else {
        await apiFetch(`/farmer/schemes/${scheme.id}`, { method: 'PUT', body: '{}' });
      }
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update saved schemes.'); }
    finally { setBusyId(''); }
  };

  const updateStatus = async (schemeId: string, application_status: ApplicationStatus) => {
    setError(''); setBusyId(schemeId);
    try {
      await apiFetch(`/farmer/schemes/${schemeId}/status`, { method: 'PATCH', body: JSON.stringify({ application_status }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update application status.'); }
    finally { setBusyId(''); }
  };

  const context = data?.farmer_context;
  return <main className="min-h-[75vh] bg-gradient-to-br from-[#f4f6ef] via-[#f8faf5] to-[#eaf3ee] py-7 sm:py-10">
    <div className="section-wrap max-w-6xl">
      <header className="surface-card overflow-hidden p-5 sm:p-8">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e5efdc] text-[#376447]"><Sprout className="h-5 w-5" /></span><div><p className="eyebrow">{t('schemePage.eyebrow')}</p><h1 className="display-title mt-1 text-3xl text-[#203c2c] sm:text-4xl">{t('schemePage.title')}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#718074]">{t('schemePage.intro')}</p></div></div>
        {context && <p className="mt-4 rounded-xl bg-[#f5f8f1] px-4 py-3 text-xs leading-5 text-[#5e7063]">Using your latest recommendation for context: {[context.farm_district, context.farm_state].filter(Boolean).join(', ') || context.location_name || 'location not saved'}{context.crops.length ? ` · crops: ${context.crops.slice(0, 3).join(', ')}` : ''}. You can update missing details in an eligibility check; this guide does not save those answers.</p>}
      </header>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <section className="mt-6" aria-label={t('schemePage.searchAndFilter')}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="audit-search min-w-0"><Search className="h-4 w-4 shrink-0" /><span className="sr-only">{t('schemePage.search')}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('schemePage.search')} /></label>
          <select className="field-input sm:max-w-56" value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t('schemePage.filterCategory')}><option value="all">{t('schemePage.allCategories')}</option>{Array.from(new Set((data?.items ?? []).map((item) => item.category))).map((item) => <option key={item} value={item}>{t(`schemePage.categories.${item}`, { defaultValue: item.replaceAll('_', ' ') })}</option>)}</select>
          <button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly((value) => !value)} className={`secondary-button ${savedOnly ? 'border-[#b9cdb0] bg-[#edf4e8]' : ''}`}><BookOpenCheck className="h-4 w-4" />{t('schemePage.savedSchemes')}</button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#dce8d4] bg-white p-4 sm:p-5">
        <p className="font-bold text-[#294634]">{t('schemePage.stateSchemes')}</p>
        <p className="mt-1 text-sm leading-6 text-[#718074]">{context?.farm_state ? `Your farm location: ${[context.farm_district, context.farm_state].filter(Boolean).join(', ')}. The catalogue below shows verified central schemes; local programs, application windows and eligibility are maintained by each government.` : 'Add your farm state in your profile or recommendation to make location guidance more relevant.'} Use the official myScheme finder to select your State/UT and see its current agriculture schemes alongside central programs.</p>
        <a href="https://www.myscheme.gov.in/search/category/Agriculture%2CRural%20%26%20Environment" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#356746] underline">Find current State/UT schemes on myScheme <ArrowUpRight className="h-4 w-4" /></a>
      </section>

      {!data && !error && <p role="status" className="surface-card mt-5 p-6 text-sm text-[#718074]">{t('schemePage.loading')}</p>}
      {data && filtered.length === 0 && <p className="surface-card mt-5 p-6 text-sm text-[#718074]">{t('schemePage.noMatches')}</p>}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        {filtered.map((scheme) => <SchemeCard key={scheme.id} scheme={scheme} context={context} busy={busyId === scheme.id} onToggleSaved={() => void toggleSaved(scheme)} onUpdateStatus={(status) => void updateStatus(scheme.id, status)} />)}
      </div>

      <CropLossAssistance />

      <section className="mt-6 rounded-2xl border border-[#e1e8dc] bg-white p-4 text-xs leading-5 text-[#718074] sm:p-5">
        <p className="font-bold text-[#526657]">{t('schemePage.catalogueTitle')}</p>
        <p className="mt-1">{t('schemePage.catalogueNote')}</p>
      </section>
    </div>
  </main>;
}

function SchemeCard({ scheme, context, busy, onToggleSaved, onUpdateStatus }: {
  scheme: Scheme;
  context: FarmerSchemesResponse['farmer_context'];
  busy: boolean;
  onToggleSaved: () => void;
  onUpdateStatus: (status: ApplicationStatus) => void;
}) {
  const { i18n } = useTranslation();
  const ui = getSchemeUi(i18n.resolvedLanguage ?? i18n.language);
  const copy = getSchemeCopy(i18n.resolvedLanguage ?? i18n.language, scheme);
  const detailsDialog = useRef<HTMLDialogElement>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [check, setCheck] = useState<Record<string, string>>({});
  const [landState, setLandState] = useState(context?.farm_state ?? '');
  const [district, setDistrict] = useState(context?.farm_district ?? '');
  const [crop, setCrop] = useState(context?.crops[0] ?? '');
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
  const verifiedDate = new Date(`${scheme.verified_at}T00:00:00`);
  const isOld = (Date.now() - verifiedDate.getTime()) / 86_400_000 > 180;
  const pmfbyContextComplete = !!(landState.trim() && district.trim() && crop.trim());

  let eligibilityResult = '';
  if (scheme.eligibility_rule === 'pm_kisan') {
    if (check.landholding === 'no') eligibilityResult = 'Based on your answer, the basic landholding condition is not met.';
    else if (check.landholding === 'yes' && check.exclusions === 'yes') eligibilityResult = 'One or more listed exclusion categories may apply. Confirm your situation with PM-KISAN.';
    else if (check.landholding === 'yes' && check.exclusions === 'no') eligibilityResult = 'You may meet these basic conditions. The government makes the final eligibility decision.';
    else if (check.landholding === 'yes' && check.exclusions === 'unsure') eligibilityResult = 'Landholding is indicated, but exclusion status needs checking on the official portal.';
  } else {
    if (!pmfbyContextComplete && check.notified) eligibilityResult = 'Add the missing crop, district, or state before checking. Confirm the current notification on the official portal.';
    else if (check.notified === 'no') eligibilityResult = 'This crop/location/season does not match the notified-crop condition based on your answer.';
    else if (check.notified === 'yes') eligibilityResult = 'You may meet the notified crop and area condition. Confirm insurable interest and current enrollment with an official channel.';
  }

  return <article className="surface-card min-w-0 overflow-hidden">
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex rounded-full bg-[#edf4e8] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#426b48]">{copy.category}</span><h2 className="mt-3 text-lg font-extrabold leading-snug text-[#203c2c]">{scheme.name}</h2></div><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#5b874d]" /></div>
      <p className="mt-3 text-sm leading-6 text-[#647468]">{copy.summary}</p>
      <p className="mt-3 rounded-xl bg-[#f5f8f1] p-3 text-sm leading-6 text-[#405b47]"><strong>{ui.support}:</strong> {copy.benefit}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onToggleSaved} disabled={busy} className="secondary-button px-3 py-2 text-xs"><BookOpenCheck className="h-4 w-4" />{scheme.saved ? ui.remove : ui.save}</button>
        {scheme.saved && <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-[#526657]">{ui.myStatus} <select className="field-input min-w-0 flex-1 py-2 text-xs" value={scheme.application_status ?? 'not_started'} disabled={busy} onChange={(event) => onUpdateStatus(event.target.value as ApplicationStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{ui[status.value]}</option>)}</select></label>}
      </div>
      {scheme.saved && scheme.updated_at && <p className="mt-2 text-[10px] text-[#899589]">{ui.statusUpdated} {formatDate(scheme.updated_at)}</p>}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-[#edf0e9] pt-4 text-xs font-bold">
        <a href={scheme.apply_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#356746] hover:underline">{ui.officialApplication} <ArrowUpRight className="h-3.5 w-3.5" /></a>
        <a href={scheme.official_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#607464] hover:underline">{ui.officialInfo} <ArrowUpRight className="h-3.5 w-3.5" /></a>
      </div>
      <button type="button" onClick={() => detailsDialog.current?.showModal()} aria-haspopup="dialog" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbdcc4] bg-[#f6f9f3] px-4 py-2 text-sm font-bold text-[#356746] transition hover:bg-[#edf4e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b874d]">{ui.details}</button>
    </div>
    <dialog ref={detailsDialog} aria-labelledby={`scheme-details-title-${scheme.id}`} onClick={(event) => { if (event.target === event.currentTarget) detailsDialog.current?.close(); }} className="m-auto max-h-[88dvh] w-[min(94vw,48rem)] max-w-none overflow-hidden rounded-3xl border border-[#dce8d4] bg-white p-0 text-[#294634] shadow-2xl backdrop:bg-[#14231b]/50">
      <div className="flex max-h-[88dvh] flex-col">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#edf0e9] bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0"><p className="eyebrow">{ui.schemeDetails}</p><h2 id={`scheme-details-title-${scheme.id}`} className="mt-1 text-lg font-extrabold leading-snug text-[#203c2c] sm:text-xl">{scheme.name}</h2></div>
          <button type="button" onClick={() => detailsDialog.current?.close()} aria-label={ui.close} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#526657] transition hover:bg-[#f2f5ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b874d]"><X aria-hidden="true" className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto bg-[#fcfdfb] p-5 sm:p-6">
      <h3 className="font-bold text-[#294634]">{ui.eligibility}</h3><p className="mt-1 text-sm leading-6 text-[#647468]">{copy.eligibility}</p>
      <p className="mt-2 text-xs leading-5 text-[#718074]"><strong>{ui.deadline}:</strong> {copy.deadline}</p>
      <button type="button" onClick={() => setCheckOpen((value) => !value)} aria-expanded={checkOpen} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#dce8d4] bg-white px-3 py-2 text-xs font-bold text-[#356746]"><HelpCircle className="h-4 w-4" />{checkOpen ? ui.closeCheck : ui.checkEligibility}</button>
      {checkOpen && <div className="mt-3 rounded-xl border border-[#e3eadf] bg-white p-4">
        {scheme.eligibility_rule === 'pm_kisan' ? <>
          <Question label="Is cultivable landholding recorded in your farmer family's name?" value={check.landholding ?? ''} onChange={(value) => setCheck((old) => ({ ...old, landholding: value, exclusions: '' }))} options={[["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]]} />
          {check.landholding === 'yes' && <Question label="Does any listed PM-KISAN exclusion category apply to a family member?" value={check.exclusions ?? ''} onChange={(value) => setCheck((old) => ({ ...old, exclusions: value }))} options={[["no", "No"], ["yes", "Yes"], ["unsure", "Not sure"]]} />}
          <p className="mt-3 text-[11px] leading-5 text-[#718074]">This brief check cannot determine all exclusions. The official portal has the full criteria and status check.</p>
        </> : <>
          {!context?.farm_state && <TextQuestion label="Farm state" value={landState} onChange={setLandState} />}
          {!context?.farm_district && <TextQuestion label="Farm district" value={district} onChange={setDistrict} />}
          {!context?.crops.length && <TextQuestion label="Crop you intend to insure" value={crop} onChange={setCrop} />}
          <p className="mt-2 text-xs leading-5 text-[#647468]">Check the current PMFBY notification for {crop || context?.crops[0] || 'your crop'} in {district || context?.farm_district || 'your district'}, {landState || context?.farm_state || 'your state'} and season.</p>
          <Question label="Does the current official notification list this crop and area?" value={check.notified ?? ''} onChange={(value) => setCheck((old) => ({ ...old, notified: value }))} options={[["yes", "Yes"], ["no", "No"], ["unsure", "Not checked yet"]]} />
        </>}
        {eligibilityResult && <p role="status" className="mt-3 rounded-lg bg-[#edf4e8] p-3 text-xs font-semibold leading-5 text-[#31583c]">{eligibilityResult}</p>}
      </div>}
      <div className="mt-5">
        <h3 className="flex items-center gap-2 font-bold text-[#294634]"><FileCheck2 className="h-4 w-4 text-[#5b874d]" />{ui.checklist}</h3>
        <p className="mt-1 text-xs leading-5 text-[#718074]">{ui.checklistNote}</p>
        <div className="mt-3 space-y-2">{copy.documents.map((document) => <label key={document} className="flex items-start gap-2 text-sm text-[#526657]"><input type="checkbox" checked={!!checkedDocs[document]} onChange={(event) => setCheckedDocs((old) => ({ ...old, [document]: event.target.checked }))} className="mt-1 accent-[#356746]" /><span>{document}</span></label>)}</div>
        <p className={`mt-3 text-xs leading-5 ${isOld ? 'text-[#896e32]' : 'text-[#718074]'}`}>{isOld ? ui.oldSource : ''}{copy.documentNote}</p>
      </div>
      <div className="mt-5 border-t border-[#e9eee5] pt-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#879486]">{ui.verified} {scheme.verified_at}</p><ul className="mt-2 space-y-1">{scheme.sources.map((source, index) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#356746] hover:underline">{index === 0 && copy.sourceLabel ? copy.sourceLabel : source.label}<ArrowUpRight className="h-3 w-3" /></a></li>)}</ul></div>
        </div>
      </div>
    </dialog>
  </article>;
}

function Question({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <label className="mt-3 block text-xs font-semibold leading-5 text-[#405b47]">{label}<select className="field-input mt-1 py-2 text-xs" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Choose an answer</option>{options.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>;
}

function TextQuestion({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mt-3 block text-xs font-semibold text-[#405b47]">{label}<input className="field-input mt-1 py-2 text-xs" value={value} maxLength={100} onChange={(event) => onChange(event.target.value)} /></label>;
}

function CropLossAssistance() {
  const { i18n } = useTranslation();
  const copy = getDisasterSupportCopy(i18n.resolvedLanguage ?? i18n.language);
  return <section className="mt-7 overflow-hidden rounded-3xl border border-[#e9dfc6] bg-white" aria-labelledby="crop-loss-title">
    <div className="flex items-start justify-between gap-3 bg-[#fbf7ea] p-5 sm:gap-5 sm:p-6"><div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#987736]"><AlertTriangle className="h-5 w-5" /></span><div className="min-w-0"><p className="eyebrow">{copy.eyebrow}</p><h2 id="crop-loss-title" className="mt-1 text-xl font-extrabold text-[#493e27]">{copy.title}</h2><p className="mt-2 text-sm leading-6 text-[#6c624b]">{copy.intro}</p></div></div><a href="tel:14447" aria-label={copy.callAria} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#d6a91d] bg-[#f8d85e] px-3 py-2.5 text-[#183b28] shadow-sm transition hover:bg-[#edc84a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356746] sm:px-4"><PhoneCall aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="flex flex-col items-start leading-tight"><span className="whitespace-nowrap text-[10px] font-bold text-[#294634] sm:text-xs">{copy.call}</span><span className="text-sm font-extrabold tracking-wide">14447</span></span></a></div>
    <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
      <div><h3 className="font-bold text-[#294634]">{copy.reportingTitle}</h3><p className="mt-2 text-sm leading-6 text-[#647468]">{copy.reporting.split('14447')[0]}<a href="tel:14447" className="font-extrabold text-[#356746] underline">14447</a>{copy.reporting.split('14447').slice(1).join('14447')}</p><p className="mt-2 text-xs leading-5 text-[#647468]">{copy.timing}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold"><a href="https://pmfby.gov.in/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#356746] hover:underline">{copy.portal} <ArrowUpRight className="h-3.5 w-3.5" /></a><a href="https://pmfby.gov.in/faq" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#607464] hover:underline">{copy.faq} <ArrowUpRight className="h-3.5 w-3.5" /></a><a href="https://pmfby.gov.in/pdf/Revised_Operational_Guidelines.pdf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#607464] hover:underline">{copy.guideline} <ArrowUpRight className="h-3.5 w-3.5" /></a></div></div>
      <div><h3 className="font-bold text-[#294634]">{copy.readyTitle}</h3><ul className="mt-2 space-y-2 text-sm leading-6 text-[#647468]">{copy.checklist.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#5b874d]" />{item}</li>)}</ul><p className="mt-2 text-xs leading-5 text-[#718074]">{copy.checklistNote}</p></div>
    </div>
    <div className="border-t border-[#edf0e9] px-5 py-4 text-xs leading-5 text-[#718074] sm:px-6"><strong className="text-[#526657]">{copy.otherTitle}</strong> {copy.other} <a href="https://www.myscheme.gov.in/" target="_blank" rel="noreferrer" className="font-semibold text-[#356746] underline">myScheme</a>. {copy.noUnverified}</div>
  </section>;
}

