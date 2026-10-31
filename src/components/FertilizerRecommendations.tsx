import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, FlaskConical, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFertilizerGuidance } from '../data/fertilizerGuidance';
import { getGenericFertilizerText, getPulseFallbackText } from '../i18n/fertilizerTranslations';

interface Props {
  crop: string;
  state?: string | null;
  npk?: { nitrogen: string; phosphorus: string; potassium: string };
}

export default function FertilizerRecommendations({ crop, state, npk }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const guide = getFertilizerGuidance(crop, state);
  const guideText = (field: 'nutrients' | 'fertilizers' | 'timing' | 'dosage' | 'condition') => {
    if (guide.nutrients.startsWith('Prioritize phosphorus and soil-test-needed potassium')) {
      const translatedField = field === 'fertilizers' ? 'products' : field;
      if (translatedField === 'nutrients' || translatedField === 'products' || translatedField === 'timing') {
        return getPulseFallbackText(i18n.resolvedLanguage ?? i18n.language, translatedField);
      }
    }
    if (guide.nutrients.startsWith('Nitrogen (N), phosphorus (P₂O₅), and potassium (K₂O); add secondary')) {
      const translatedField = field === 'fertilizers' ? 'products' : field;
      if (translatedField === 'nutrients' || translatedField === 'products' || translatedField === 'timing') {
        const group = guide.fertilizers.startsWith('Urea or neem-coated urea as a nitrogen source') ? 'fruit' : 'general';
        return getGenericFertilizerText(i18n.resolvedLanguage ?? i18n.language, group, translatedField);
      }
    }
    return t(`fertilizer.guides.${guide.crop}.${field}`, { defaultValue: guide[field] ?? '' });
  };
  const formatCheckedDate = (date: string) => new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="secondary-button mt-4 w-full px-3 py-2 text-xs" aria-haspopup="dialog">
      <FlaskConical className="h-4 w-4" />{t('fertilizer.button', 'Fertilizer guidance')}
    </button>
    {open && createPortal(<div className="print-hidden fixed inset-0 z-[100] flex items-end justify-center bg-[#142319]/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-5" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="false" aria-labelledby={`fertilizer-${crop}-title`} className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#dfe9d6] bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header className="flex items-start justify-between gap-3 border-b border-[#edf0e9] pb-4">
          <div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf4e5] text-[#397048]"><FlaskConical className="h-5 w-5" /></span><div><p className="eyebrow">{t('fertilizer.eyebrow')}</p><h2 id={`fertilizer-${crop}-title`} className="mt-1 text-lg font-bold capitalize text-[#203c2c]">{t('fertilizer.title')}: {crop}</h2><p className="mt-1 text-xs leading-5 text-[#667769]">{t('fertilizer.guidanceNote', 'Crop fertilizer options and timing are references. Use your tested NPK values with a current crop package to determine the application rate.')}</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close', 'Close')} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e1e8dc] text-[#526657] hover:bg-[#f4f8ef]"><X className="h-4 w-4" /></button>
        </header>
        {npk && <div className="mt-4 flex flex-wrap gap-2" aria-label={t('fertilizer.inputValues')}>
          {(['nitrogen', 'phosphorus', 'potassium'] as const).map((key) => {
            const labels = { nitrogen: 'N', phosphorus: 'P₂O₅', potassium: 'K₂O' };
            return <span key={key} className="rounded-full border border-[#dce7d5] bg-[#fbfcf9] px-2.5 py-1 text-[11px] font-semibold text-[#536b56]">{labels[key]}: {npk[key]} <span className="font-normal">({t('form.units.kgPerHa')})</span></span>;
          })}
        </div>}
        <dl className="mt-4 space-y-3 text-sm leading-6 text-[#5f6e61]">
          <div><dt className="font-bold text-[#405b46]">{t('fertilizer.nutrients')}</dt><dd>{guideText('nutrients')}</dd></div>
          <div className="rounded-xl bg-[#f6f8f2] p-3"><dt className="font-bold text-[#405b46]">{t('fertilizer.products')}</dt><dd>{guideText('fertilizers')}</dd></div>
          <div><dt className="font-bold text-[#405b46]">{t('fertilizer.timing')}</dt><dd>{guideText('timing')}</dd></div>
          {guide.dosage && <div className="rounded-xl bg-[#f6f8f2] p-3"><dt className="font-bold text-[#405b46]">{t('fertilizer.dose')}</dt><dd>{guideText('dosage')}</dd></div>}
          {guide.condition && <div className="rounded-xl border border-[#e7dfc8] bg-[#fffdf5] p-3 text-[#695b38]"><dt className="font-bold">{t('fertilizer.checkLocally')}</dt><dd>{guideText('condition')}</dd></div>}
        </dl>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0e9] pt-3 text-xs text-[#829082]"><span>{t('fertilizer.checkedOn', { date: formatCheckedDate(guide.checkedOn) })} · {guide.source}</span><a href={guide.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#356746] hover:underline">{t('fertilizer.officialGuide')}<ExternalLink className="h-3 w-3" /></a></footer>
      </section>
    </div>, document.body)}
  </>;
}
