import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Filter, Search, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../i18n/format';
import type { User } from '../auth/types';
import { apiFetch } from '../services/apiClient';

export default function AdminAccountsPage() {
  const { t } = useTranslation();
  const [farmers, setFarmers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ items: User[] }>(`/admin/farmers?q=${encodeURIComponent(query)}&status=${status}`);
      setFarmers(result.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('dashboard.admin.loadError'));
    } finally {
      setLoading(false);
    }
  }, [query, status, t]);
  useEffect(() => { void load(); }, [load]);
  const setActive = async (farmer: User) => {
    setBusyId(farmer.id);
    setError('');
    try {
      await apiFetch(`/admin/farmers/${farmer.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !farmer.active }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('dashboard.admin.actionError'));
    } finally {
      setBusyId('');
    }
  };

  return <div className="page-enter min-h-[75vh] bg-[#f4f6ef] py-8 sm:py-12"><div className="section-wrap max-w-6xl">
    <p className="eyebrow">{t('nav.adminPortal')}</p><h1 className="display-title mt-3 text-4xl text-[#203c2c] sm:text-5xl">{t('nav.accountManagement')}</h1>
    <p className="mt-3 text-sm text-[#718074]">{t('dashboard.admin.accountsSubtitle')}</p>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="surface-card mt-7 p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#537d50]" /><h2 className="text-lg font-bold text-[#294634]">{t('dashboard.admin.farmerAccounts')}</h2></div><p className="mt-1 text-sm text-[#829082]">{t('dashboard.admin.accountsCount', { count: farmers.length })}</p></div>
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); void load(); }} className="grid w-full gap-2 rounded-[18px] border border-[#e2e9de] bg-[#f6f8f3] p-2 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center lg:max-w-xl">
          <label className="relative block min-w-0"><span className="sr-only">{t('dashboard.admin.search')}</span><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66824f]" />
            <input aria-label={t('dashboard.admin.search')} className="field-input !h-11 !rounded-xl !border-transparent !bg-white !py-2.5 !pl-10 !shadow-[0_1px_4px_rgba(31,56,35,.06)] focus:!border-[#a9c69a]" placeholder={t('dashboard.admin.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" aria-label={t('dashboard.admin.clearSearch')} onClick={() => setQuery('')} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#829082] hover:bg-[#f0f4ec] hover:text-[#31583c]"><X className="h-4 w-4" /></button>}
          </label>
          <label className="relative block"><span className="sr-only">{t('dashboard.admin.filter')}</span><Filter aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66824f]" />
            <select aria-label={t('dashboard.admin.filter')} value={status} onChange={(event) => setStatus(event.target.value)} className="field-input !h-11 !cursor-pointer !rounded-xl !border-transparent !bg-white !py-2.5 !pl-10 !pr-3 !shadow-[0_1px_4px_rgba(31,56,35,.06)] focus:!border-[#a9c69a]"><option value="all">{t('dashboard.admin.allStatuses')}</option><option value="active">{t('dashboard.admin.active')}</option><option value="suspended">{t('dashboard.admin.suspended')}</option></select>
          </label>
        </form>
      </div>
      <div className="table-scroll mt-5"><table><thead><tr><th>{t('dashboard.admin.farmer')}</th><th>{t('dashboard.admin.created')}</th><th>{t('dashboard.admin.status')}</th><th>{t('dashboard.admin.action')}</th></tr></thead><tbody>
        {farmers.map((farmer) => <tr key={farmer.id}><td><span className="block font-semibold">{farmer.display_name || farmer.email}</span><span className="block text-xs text-[#829082]">{farmer.email}</span><span className="mt-1 block font-mono text-[11px] text-[#537d50]">{t('nav.farmerId')}: {farmer.farmer_id}</span></td><td>{formatDate(farmer.created_at)}</td><td><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${farmer.active ? 'bg-[#eaf3e5] text-[#426b48]' : 'bg-[#f8e9e5] text-[#8a473c]'}`}>{farmer.active ? t('dashboard.admin.active') : t('dashboard.admin.suspended')}</span></td><td><button type="button" disabled={busyId === farmer.id} onClick={() => void setActive(farmer)} className="text-xs font-bold text-[#3f714a] underline disabled:opacity-50">{farmer.active ? t('dashboard.admin.suspend') : t('dashboard.admin.reactivate')}</button></td></tr>)}
        {!loading && farmers.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[#829082]">{t('dashboard.admin.noFarmers')}</td></tr>}
      </tbody></table></div>
      {loading && <p role="status" className="mt-4 text-sm text-[#829082]">{t('dashboard.loading')}</p>}
    </section>
  </div></div>;
}
