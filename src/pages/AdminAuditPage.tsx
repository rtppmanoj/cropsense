import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Clock3, Filter, RefreshCw, Search, ShieldCheck, Sprout, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatTime } from '../i18n/format';
import { apiFetch } from '../services/apiClient';

interface AuditItem { id: string; action: string; created_at: string; actor_email?: string; target_email?: string; detail: Record<string, unknown> }
type EventFilter = 'all' | 'accounts' | 'recommendations' | 'admin';
const category = (action: string): Exclude<EventFilter, 'all'> => action.includes('recommendation') ? 'recommendations' : /(login|logout|password|profile|registered)/.test(action) ? 'accounts' : 'admin';

export default function AdminAuditPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EventFilter>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await apiFetch<{ items: AuditItem[]; total: number }>(`/admin/audit?limit=10&offset=${page * 10}`); setItems(result.items); setTotal(result.total); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('audit.loadError')); }
    finally { setLoading(false); }
  }, [page, t]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => (filter === 'all' || category(item.action) === filter) && (!needle || `${item.action} ${item.actor_email ?? ''} ${item.target_email ?? ''} ${JSON.stringify(item.detail)}`.toLowerCase().includes(needle)));
  }, [items, filter, query]);
  const actors = new Set(visible.map((item) => item.actor_email).filter(Boolean)).size;
  const filterOptions: { key: EventFilter; label: string; Icon: typeof Activity }[] = [
    { key: 'all', label: t('audit.all'), Icon: Activity }, { key: 'accounts', label: t('audit.accounts'), Icon: UserRound },
    { key: 'recommendations', label: t('audit.recommendations'), Icon: Sprout }, { key: 'admin', label: t('audit.admin'), Icon: ShieldCheck },
  ];

  return <div className="page-enter min-h-[75vh] bg-[#f4f6ef] py-8 sm:py-12"><div className="section-wrap max-w-6xl">
    <div className="audit-heading"><div><p className="eyebrow">{t('nav.adminPortal')}</p><h1 className="display-title mt-3 text-4xl text-[#203c2c] sm:text-5xl">{t('nav.auditLogs')}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#718074]">{t('dashboard.admin.auditSubtitle')}</p></div><button type="button" onClick={() => void load()} className="secondary-button" disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('audit.refresh')}</button></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="audit-metrics mt-5"><article className="audit-metric"><span><Activity className="h-5 w-5" /></span><div><strong>{total}</strong><small>{t('audit.events')}</small></div></article><article className="audit-metric"><span><UserRound className="h-5 w-5" /></span><div><strong>{actors}</strong><small>{t('audit.actor')}</small></div></article><article className="audit-metric"><span><Clock3 className="h-5 w-5" /></span><div><strong>{visible.length ? formatDate(visible[0].created_at) : '—'}</strong><small>{t('audit.latest')}</small></div></article></div>
    <section className="audit-board mt-6">
      <div className="audit-toolbar"><label className="audit-search"><Search className="h-4 w-4" /><span className="sr-only">{t('audit.search')}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('audit.search')} /></label><div className="audit-filters" aria-label={t('audit.filters', 'Filter audit events')}><Filter className="mr-1 h-4 w-4 text-[#789078]" />{filterOptions.map(({ key, label, Icon }) => <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className="audit-filter"><Icon className="h-3.5 w-3.5" />{label}</button>)}</div><p className="audit-count">{t('audit.showing', { count: visible.length })}</p></div>
      {loading && <p role="status" className="px-6 py-10 text-center text-sm text-[#718074]">{t('dashboard.loading')}</p>}
      {!loading && !visible.length && <div className="audit-empty"><ShieldCheck className="h-8 w-8 text-[#8ba17d]" /><p className="mt-3 font-bold text-[#405944]">{items.length ? t('audit.emptySearch') : t('dashboard.admin.noAudit')}</p></div>}
      {!loading && visible.length > 0 && <div className="audit-timeline">{visible.map((item) => {
        const kind = category(item.action); const Icon = kind === 'recommendations' ? Sprout : kind === 'accounts' ? UserRound : ShieldCheck;
        const date = new Date(item.created_at);
        return <article className={`audit-event audit-event-${kind}`} key={item.id}><div className="audit-event-mark"><Icon className="h-4 w-4" /></div><div className="audit-event-body"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="audit-event-kind">{t(`audit.${kind}`)}</p><h2 className="mt-1 text-base font-extrabold capitalize text-[#203c2c]">{item.action.replaceAll('_', ' ')}</h2></div><time className="audit-time" dateTime={item.created_at}>{formatDate(date)} <span>·</span> {formatTime(date)}</time></div><div className="audit-identities"><span><small>{t('audit.actor')}</small>{item.actor_email || t('dashboard.admin.systemActor')}</span>{item.target_email && <span><small>{t('audit.target')}</small>{item.target_email}</span>}</div>{Object.keys(item.detail).length > 0 && <details className="audit-details"><summary>{t('audit.detail')} <span>+</span></summary><pre>{JSON.stringify(item.detail, null, 2)}</pre></details>}</div></article>;
      })}</div>}
      <div className="flex items-center justify-between border-t border-[#edf0e9] px-4 py-3"><button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ArrowLeft aria-hidden="true" className="h-4 w-4" />{t('dashboard.farmer.previousPage')}</button><span className="text-xs font-semibold text-[#718074]">{t('dashboard.farmer.pageOf', { page: Math.min(page + 1, Math.max(1, Math.ceil(total / 10))), pages: Math.max(1, Math.ceil(total / 10)) })}</span><button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setPage((value) => value + 1)} disabled={(page + 1) * 10 >= total}>{t('dashboard.farmer.nextPage')}<ArrowRight aria-hidden="true" className="h-4 w-4" /></button></div>
    </section>
  </div></div>;
}


