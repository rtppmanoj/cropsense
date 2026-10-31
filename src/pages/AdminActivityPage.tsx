import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Filter, Search, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../i18n/format';
import { apiFetch } from '../services/apiClient';

interface ActivityItem { id: string; created_at: string; farmer_email: string; farmer_name: string; farmer_id: string; location_name: string; model_name: string; model_version: string; recommendations: { crop: string; score: number }[] }
interface ActivityPage { items: ActivityItem[]; total: number }

export default function AdminActivityPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ActivityPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    apiFetch<ActivityPage>(`/admin/activity?limit=10&offset=${page * 10}`).then((response) => { if (active) setData(response); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('dashboard.admin.loadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, t]);
  const total = data?.total ?? 0; const pages = Math.max(1, Math.ceil(total / 10));
  const cutoff = new Date();
  if (period === 'today') cutoff.setHours(0, 0, 0, 0);
  if (period === 'week') cutoff.setDate(cutoff.getDate() - 7);
  if (period === 'month') cutoff.setDate(cutoff.getDate() - 30);
  const visibleItems = (data?.items ?? []).filter((item) => {
    const text = `${item.farmer_name} ${item.farmer_email} ${item.farmer_id} ${item.location_name} ${item.recommendations.map((crop) => crop.crop).join(' ')}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase())) && (period === 'all' || new Date(item.created_at) >= cutoff);
  });
  const periods = [['all', 'All'], ['today', 'Today'], ['week', 'Last 7 days'], ['month', 'Last 30 days']] as const;
  return <main className="min-h-[70vh] bg-[#f4f6ef] py-5 sm:py-7"><div className="section-wrap max-w-5xl"><p className="eyebrow">{t('nav.adminPortal')}</p><h1 className="display-title mt-1 text-3xl text-[#203c2c] sm:text-4xl">{t('dashboard.admin.activity')}</h1><p className="mt-2 text-sm text-[#718074]">{t('dashboard.admin.activitySubtitle')}</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section className="surface-card mt-4 divide-y divide-[#edf0e9] overflow-hidden"><div className="flex flex-wrap items-center gap-3 p-3 sm:p-4"><label className="relative min-w-[min(100%,250px)] flex-1"><span className="sr-only">Search recommendations</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#789078]" /><input className="h-10 w-full rounded-xl border border-[#e1e8dc] bg-[#fbfcf9] pl-9 pr-3 text-sm text-[#294634] outline-none focus:border-[#a9c69a]" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search farmer, location or crop" /></label><div className="flex flex-wrap items-center gap-1" aria-label="Filter recommendations"><Filter className="mr-1 h-4 w-4 text-[#789078]" />{periods.map(([key, label]) => <button key={key} type="button" onClick={() => { setPeriod(key); setPage(0); }} aria-pressed={period === key} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${period === key ? 'bg-[#eaf2e3] text-[#31583c]' : 'text-[#718074] hover:bg-[#f4f7f1]'}`}>{label}</button>)}</div><p className="w-full text-xs text-[#829082]">Showing {visibleItems.length} of {total} on this page</p></div>
      {loading && <p role="status" className="p-5 text-sm text-[#718074]">{t('dashboard.loading')}</p>}{!loading && visibleItems.length ? visibleItems.map((item) => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="flex min-w-0 gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf4e6] text-[#467149]"><Sprout className="h-4 w-4" /></span><div className="min-w-0"><h2 className="truncate text-sm font-bold text-[#294634]">{item.farmer_name || item.farmer_email}</h2><p className="mt-0.5 break-all text-xs text-[#829082]">{item.farmer_email}</p><p className="mt-0.5 font-mono text-[11px] text-[#537d50]">{t('nav.farmerId')}: {item.farmer_id}</p><p className="mt-2 text-sm capitalize text-[#526657]">{item.recommendations.map((crop) => `${crop.crop} (${Math.round(crop.score * 100)}%)`).join(' · ')}</p><p className="mt-1 text-xs text-[#829082]">{item.location_name || '—'} · {item.model_name.replaceAll('_', ' ')} {item.model_version}</p></div></div><time className="text-xs text-[#829082]">{formatDateTime(item.created_at)}</time></article>) : !loading && <p className="p-8 text-center text-sm text-[#829082]">{query || period !== 'all' ? 'No recommendations match these filters.' : t('dashboard.admin.noActivity')}</p>}
      <div className="flex items-center justify-between px-4 py-3"><button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ArrowLeft className="h-4 w-4" />{t('dashboard.farmer.previousPage')}</button><span className="text-xs font-semibold text-[#718074]">{t('dashboard.farmer.pageOf', { page: Math.min(page + 1, pages), pages })} · {total}</span><button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setPage((value) => value + 1)} disabled={page + 1 >= pages}>{t('dashboard.farmer.nextPage')}<ArrowRight className="h-4 w-4" /></button></div>
    </section>
  </div></main>;
}

