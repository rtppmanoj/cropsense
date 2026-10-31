import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sprout, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../i18n/format';
import { apiFetch } from '../services/apiClient';

interface TodayRecommendation {
  id: string; report_id: string; created_at: string; farmer_email: string; farmer_name: string; farmer_id: string;
  location_name: string; recommendations: { crop: string; score: number }[];
}
interface Overview {
  farmers_total: number; farmers_active: number; recommendations_total: number; recommendations_today: number;
  users_currently_signed_in: number; recommendation_trend: { date: string; count: number }[];
  today_recommendations: TodayRecommendation[]; top_crops_30_days: { crop: string; count: number }[];
  revenue_inr: number; payments_recorded: number; popular_plans_30_days: { key: string; name: string; count: number }[];
}

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<7 | 30>(7);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setOverview(await apiFetch<Overview>('/admin/overview')); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('dashboard.admin.loadError')); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);
  const stats = [
    [Users, t('dashboard.admin.farmers'), overview?.farmers_total ?? '—', '/admin/accounts', ''],
    [Sprout, t('dashboard.admin.recommendations'), overview?.recommendations_total ?? '—', '/admin/activity', ''],
    [Sprout, t('dashboard.admin.today'), overview?.recommendations_today ?? '—', '/admin/activity', ''],
    [WalletCards, t('dashboard.admin.revenue'), overview ? new Intl.NumberFormat(i18n.resolvedLanguage || undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(overview.revenue_inr) : '—', '/admin/plans', t('dashboard.admin.revenueHint', { count: overview?.payments_recorded ?? 0 })],
  ] as const;
  const trend = (overview?.recommendation_trend ?? []).slice(-range);
  const peak = Math.max(1, ...trend.map((item) => item.count));
  return <main className="admin-dashboard-page page-enter min-h-[calc(100svh-64px)] bg-[#f4f6ef] py-4 sm:py-6"><div className="section-wrap max-w-6xl">
    <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">{t('dashboard.admin.kicker')}</p><h1 className="display-title mt-1 text-3xl text-[#203c2c] sm:text-4xl">{t('dashboard.admin.welcome')}</h1><p className="mt-1 text-sm text-[#718074]">{t('dashboard.admin.dashboardSubtitle')}</p></div><button type="button" onClick={() => void load()} className="secondary-button px-3 py-2 text-sm" disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('dashboard.refresh')}</button></div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([Icon, label, value, href, hint]) => <Link key={label} to={href} aria-label={`${label}: ${value}`} title={`Open ${label}`} className="surface-card group flex min-h-24 items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-[#b8cda9] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8a54]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf4e5] text-[#356746] transition group-hover:bg-[#dfeecf]"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-2xl font-extrabold leading-none text-[#203c2c]">{value}</p><p className="mt-1 whitespace-normal break-words text-[11px] font-bold leading-4 text-[#647568]">{label}</p>{hint && <p className="mt-1 text-[10px] leading-4 text-[#829082]">{hint}</p>}</div></Link>)}</div>
    <section className="surface-card mt-4 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-[#294634]">{t('dashboard.admin.recommendationTrend')}</h2><p className="mt-0.5 text-xs text-[#829082]">{t('dashboard.admin.recommendationTrendHint')}</p></div><div className="flex rounded-full bg-[#f1f5ed] p-1" aria-label={t('dashboard.admin.trendRange')}><button type="button" onClick={() => setRange(7)} aria-pressed={range === 7} className={`rounded-full px-3 py-1.5 text-xs font-bold ${range === 7 ? 'bg-white text-[#31583c] shadow-sm' : 'text-[#718074]'}`}>{t('dashboard.admin.last7Days')}</button><button type="button" onClick={() => setRange(30)} aria-pressed={range === 30} className={`rounded-full px-3 py-1.5 text-xs font-bold ${range === 30 ? 'bg-white text-[#31583c] shadow-sm' : 'text-[#718074]'}`}>{t('dashboard.admin.last30Days')}</button></div></div>
      <div className="mt-4 grid h-48 items-end gap-2 sm:h-56 sm:gap-3" style={{ gridTemplateColumns: `repeat(${range}, minmax(0, 1fr))` }} role="img" aria-label={t('dashboard.admin.recommendationTrend')}>
        {trend.map((item, index) => <div key={item.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-1"><span className={`text-[10px] font-bold text-[#617361] ${range === 30 ? 'hidden sm:block' : ''}`}>{item.count}</span><div title={`${item.date}: ${item.count}`} className="w-full rounded-t-lg bg-gradient-to-t from-[#41784d] to-[#a8cb73] transition-all duration-500" style={{ height: `${Math.max(item.count ? 10 : 3, (item.count / peak) * 75)}%` }} /><time className={`text-[9px] text-[#829082] ${range === 30 && index % 5 !== 0 ? 'invisible' : ''}`}>{formatDate(`${item.date}T12:00:00+05:30`, { day: 'numeric', month: range === 7 ? 'short' : undefined, timeZone: 'Asia/Kolkata' })}</time></div>)}
      </div>
    </section>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="surface-card overflow-hidden"><div className="border-b border-[#edf0e9] px-4 py-3"><h2 className="font-bold text-[#294634]">{t('dashboard.admin.todayListTitle', "Today's recommendations")}</h2><p className="mt-0.5 text-xs text-[#829082]">{t('dashboard.admin.todayListHint', 'Latest recommendations submitted today (India time).')}</p></div>
        {overview?.today_recommendations.length ? <div className="divide-y divide-[#edf0e9]">{overview.today_recommendations.map((item) => <article key={item.id} className="flex flex-wrap justify-between gap-2 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#294634]">{item.farmer_name || item.farmer_email} <span className="font-mono text-[10px] text-[#537d50]">· {item.farmer_id}</span></p><p className="mt-1 text-xs capitalize text-[#526657]">{item.recommendations.map((crop) => `${crop.crop} (${Math.round(crop.score * 100)}%)`).join(' · ')}</p><p className="mt-1 truncate text-[11px] text-[#829082]">{item.location_name || item.farmer_email} · {t('dashboard.admin.reportId', 'Report')} {item.report_id}</p></div><time className="text-[11px] text-[#829082]">{formatDate(item.created_at, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</time></article>)}</div> : <p className="p-6 text-center text-sm text-[#829082]">{t('dashboard.admin.noRecommendationsToday', 'No recommendations have been submitted today yet.')}</p>}
      </section>
      <section className="surface-card p-4"><h2 className="font-bold text-[#294634]">{t('dashboard.admin.planSelections')}</h2><p className="mt-0.5 text-xs text-[#829082]">{t('dashboard.admin.planSelectionsHint')}</p>
        <div className="mt-3 space-y-3">{overview?.popular_plans_30_days.length ? overview.popular_plans_30_days.map((item) => <div key={item.key}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="font-semibold text-[#405b46]">{item.name}</span><span className="text-[#829082]">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full rounded-full bg-[#78a55d]" style={{ width: `${Math.max(5, item.count / Math.max(...overview.popular_plans_30_days.map((entry) => entry.count), 1) * 100)}%` }} /></div></div>) : <p className="py-5 text-center text-sm text-[#829082]">{t('dashboard.admin.noPlanSelections')}</p>}</div>
      </section>
    </div>
  </div></main>;
}
