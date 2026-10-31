import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../services/apiClient';

interface HistoryItem {
  id: string; report_id: string; created_at: string; inputs: Record<string, number | string>;
  recommendations: { crop: string; score: number; explanation?: string }[];
  model_name: string; model_version: string; location_name: string; land_area_acres: number;
}
interface HistoryPage { items: HistoryItem[]; total: number; limit: number; offset: number }

export default function FarmerHistory() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<HistoryPage | null>(null);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError(''); setResult(null); setLoading(true);
    apiFetch<HistoryPage>(`/farmer/history?limit=10&offset=${page * 10}&q=${encodeURIComponent(query.trim())}`)
      .then((data) => { if (active) setResult(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('dashboard.farmer.loadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, t]);
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 10));
  const formatDate = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const formatKey = (key: string) => key.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  return <main className="min-h-[70vh] bg-gradient-to-br from-[#f4f6ef] via-[#f8faf5] to-[#eaf3ee] py-5 sm:py-7"><div className="section-wrap max-w-5xl">
    <p className="eyebrow">{t('nav.farmerPortal')}</p><h1 className="display-title mt-1 text-3xl text-[#203c2c] sm:text-4xl">{t('nav.farmerHistory')}</h1><p className="mt-2 text-sm text-[#718074]">{t('dashboard.farmer.historyPrivate')}</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section className="surface-card mt-4 border-t-4 border-t-[#77a45c] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-[#537d50]" /><div><h2 className="text-lg font-bold text-[#294634]">{t('dashboard.farmer.history')}</h2><p className="text-xs text-[#829082]">{t('dashboard.farmer.historyEntries', { count: total })}</p></div></div>
        <label className="flex min-w-[min(100%,260px)] items-center gap-2 rounded-xl border border-[#e1e8dc] bg-[#fbfcf9] px-3 text-[#829082]"><Search className="h-4 w-4" /><span className="sr-only">{t('dashboard.farmer.searchHistory')}</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); setSelected(null); }} placeholder={t('dashboard.farmer.searchHistory')} className="h-10 w-full border-0 bg-transparent text-sm text-[#294634] outline-none" /></label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{loading ? <p role="status" className="rounded-xl bg-[#f7f8f4] p-4 text-sm text-[#718074] sm:col-span-2">{t('dashboard.farmer.historyLoading')}</p> : result?.items.length ? result.items.map((entry) => <button key={entry.id} type="button" onClick={() => setSelected(entry)} className="rounded-xl border border-[#e8eee3] bg-[#fbfcf9] p-3 text-left transition hover:border-[#a8c392] hover:bg-[#f2f7ec]"><time className="text-xs text-[#829082]">{formatDate(entry.created_at)}</time><p className="mt-1 text-xs font-bold text-[#376447]">{t('results.reportId')}: {entry.report_id}</p><p className="mt-1 text-sm font-semibold capitalize leading-5 text-[#334c3a]">{entry.recommendations.map((item, index) => `${index + 1}. ${item.crop} (${Math.round(item.score * 100)}%)`).join(' · ')}</p><p className="mt-1 text-xs text-[#829082]">{entry.location_name} · {entry.land_area_acres} {t('form.units.acres')}</p></button>) : result && <div className="rounded-xl border border-dashed border-[#dce4d7] p-6 text-center text-sm text-[#829082] sm:col-span-2">{t('dashboard.farmer.emptyHistory')}</div>}</div>
      <div className="mt-4 flex items-center justify-between border-t border-[#edf0e9] pt-3"><button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ArrowLeft className="h-4 w-4" />{t('dashboard.farmer.previousPage')}</button><span className="text-xs font-semibold text-[#718074]">{t('dashboard.farmer.pageOf', { page: Math.min(page + 1, pages), pages })}</span><button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setPage((value) => value + 1)} disabled={page + 1 >= pages}>{t('dashboard.farmer.nextPage')}<ArrowRight className="h-4 w-4" /></button></div>
    </section>
  </div>
  {selected && <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#102619]/45 px-4 py-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="history-detail-title" className="mx-auto mt-2 max-w-2xl rounded-2xl border border-[#e0e9da] bg-white p-5 shadow-2xl sm:mt-8 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{formatDate(selected.created_at)}</p><h2 id="history-detail-title" className="mt-1 text-xl font-extrabold text-[#294634]">{t('dashboard.farmer.pastRecommendation')}</h2><p className="mt-1 text-xs font-bold text-[#376447]">{t('results.reportId')}: {selected.report_id}</p><p className="mt-1 text-sm text-[#718074]">{selected.location_name} · {selected.land_area_acres} {t('form.units.acres')}</p></div><button type="button" aria-label={t('common.close', 'Close')} onClick={() => setSelected(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e1e8dc] text-[#526657] hover:bg-[#f2f6ee]"><X className="h-4 w-4" /></button></div><div className="mt-4 rounded-xl bg-[#f5f8f1] p-4"><h3 className="font-bold text-[#294634]">{t('results.topCrops')}</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[#526657]">{selected.recommendations.map((item) => <li key={item.crop} className="capitalize">{item.crop} — {Math.round(item.score * 100)}%{item.explanation && <span className="mt-0.5 block text-xs leading-5 text-[#718074]">{item.explanation}</span>}</li>)}</ol></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(selected.inputs).map(([key, value]) => <p key={key} className="rounded-lg bg-[#f8faf6] p-2 text-xs"><span className="block text-[#829082]">{formatKey(key)}</span><span className="font-semibold text-[#334c3a]">{value}</span></p>)}</div><p className="mt-3 border-t border-[#edf0e9] pt-3 text-xs text-[#829082]">{selected.model_name.replaceAll('_', ' ')} · {selected.model_version}</p></section></div>}
  </main>;
}
