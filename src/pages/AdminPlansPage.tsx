import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, Sprout, Star, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../services/apiClient';
import { defaultPlanFeatureKeys, planDescriptionKey, planDisplayNameKey, planKeys, type PlanKey } from '../data/planFeatures';

type Plan = { key: PlanKey; price_inr: number; annual_limit: number; display_name: string | null; description: string | null; features: string[]; active: number; is_recommended: number };
type EditablePlan = Pick<Plan, 'display_name' | 'description' | 'features' | 'price_inr' | 'annual_limit'>;
const farmerPlanKeys: PlanKey[] = ['free', 'basic', 'plus', 'premium'];
const farmerFeatures = defaultPlanFeatureKeys('premium');
const organizationFeatures = defaultPlanFeatureKeys('organizationStarter');

function labelForFeature(key: string, t: (key: string) => string) {
  return key === 'chatbotFeature' ? t('pricingChatbotFeature') : t(`pricingPage.features.${key}`);
}

export default function AdminPlansPage() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [draft, setDraft] = useState<EditablePlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await apiFetch<{ plans: Plan[] }>('/admin/plans');
      setPlans(result.plans);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('adminPlans.loadError')); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!editingPlan && !deleteTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setEditingPlan(null); setDraft(null); setDeleteTarget(null); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [editingPlan, deleteTarget]);
  useEffect(() => {
    if (!editingPlan && !deleteTarget) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [editingPlan, deleteTarget]);

  const beginEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setDraft({
      display_name: plan.display_name || t(planDisplayNameKey(plan.key)),
      description: plan.description || t(planDescriptionKey(plan.key)),
      features: plan.features.length ? [...plan.features] : defaultPlanFeatureKeys(plan.key),
      price_inr: plan.price_inr,
      annual_limit: plan.annual_limit,
    });
    setError(''); setNotice('');
  };
  const availableFeatures = useMemo(() => editingPlan && farmerPlanKeys.includes(editingPlan.key) ? farmerFeatures : organizationFeatures, [editingPlan]);
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPlan || !draft) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await apiFetch<{ plans: Plan[] }>('/admin/plans', { method: 'PUT', body: JSON.stringify({ plans: [{ key: editingPlan.key, ...draft }] }) });
      setPlans(result.plans); setEditingPlan(null); setDraft(null); setNotice(t('adminPlans.saved'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('adminPlans.saveError')); }
    finally { setSaving(false); }
  };
  const markRecommended = async (key: PlanKey) => {
    setError(''); setNotice('');
    try {
      const result = await apiFetch<{ plans: Plan[] }>('/admin/plans', { method: 'PUT', body: JSON.stringify({ plans: [{ key, is_recommended: true }] }) });
      setPlans(result.plans); setNotice(t('adminPlans.recommendedSaved'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('adminPlans.saveError')); }
  };
  const archivePlan = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await apiFetch<{ plans: Plan[] }>(`/admin/plans/${deleteTarget.key}`, { method: 'DELETE' });
      setPlans(result.plans); setDeleteTarget(null); setNotice(t('adminPlans.deleted'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('adminPlans.saveError')); setDeleteTarget(null); }
    finally { setSaving(false); }
  };

  const activePlans = plans.filter((plan) => plan.active !== 0);
  return <main className="page-enter min-h-[70vh] bg-[#f6f8f2] py-8 sm:py-12">
    <div className="section-wrap max-w-5xl">
      <header className="mb-6"><p className="eyebrow">{t('nav.adminPortal')}</p><h1 className="display-title mt-2 text-3xl text-[#203c2c] sm:text-4xl">{t('adminPlans.title')}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718074]">{t('adminPlans.description')}</p></header>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-[#cfe0c4] bg-white p-3 text-sm font-semibold text-[#356746]">{notice}</p>}
      {loading ? <p role="status" className="surface-card p-5 text-sm text-[#718074]">{t('dashboard.loading')}</p> : <div className="grid gap-4 md:grid-cols-2">
        {planKeys.map((key) => {
          const plan = activePlans.find((item) => item.key === key);
          if (!plan) return null;
          const name = plan.display_name || t(planDisplayNameKey(key));
          const description = plan.description || t(planDescriptionKey(key));
          const features = plan.features.length ? plan.features : defaultPlanFeatureKeys(key);
          return <article key={key} className={`surface-card flex h-full flex-col p-4 sm:p-5 ${plan.is_recommended ? 'border-2 border-[#79a45f]' : ''}`}>
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2 text-[#356746]"><Sprout className="mt-1 h-4 w-4 shrink-0" /><div><h2 className="font-bold text-[#294634]">{name}</h2><p className="mt-1 text-sm leading-5 text-[#718074]">{description}</p></div></div>{Boolean(plan.is_recommended) && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eaf2df] px-2.5 py-1 text-xs font-bold text-[#356746]"><Star className="h-3 w-3" />{t('adminPlans.recommended')}</span>}</div>
            <p className="mt-4 font-bold text-[#203c2c]">{`\u20b9`}{plan.price_inr}<span className="ml-1 text-xs font-medium text-[#718074]">/{t('pricingPage.year')}</span><span className="mx-2 text-[#bdc8ba]">|</span>{t('pricingPage.recommendationsPerYear', { count: String(plan.annual_limit) })}</p>
            <ul className="mt-4 flex-1 space-y-2 border-t border-[#edf0e9] pt-3 text-sm text-[#526657]">{features.map((feature) => <li key={feature} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#56804f]" /><span>{labelForFeature(feature, t) === `pricingPage.features.${feature}` ? feature : labelForFeature(feature, t)}</span></li>)}</ul>
            {farmerPlanKeys.includes(key) && <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-[#edf0e9] pt-3 text-sm font-semibold text-[#42664a]"><input type="radio" name="recommended-plan" checked={Boolean(plan.is_recommended)} onChange={() => void markRecommended(key)} className="accent-[#356746]" />{t('adminPlans.setRecommended')}</label>}
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => beginEdit(plan)} className="secondary-button"><Pencil aria-hidden="true" className="h-4 w-4" />{t('adminPlans.edit')}</button><button type="button" onClick={() => { setDeleteTarget(plan); setError(''); }} disabled={key === 'free'} title={key === 'free' ? t('adminPlans.freeRequired') : undefined} className="secondary-button border-[#ead2cc] text-[#8a4438] hover:bg-[#fff7f5] disabled:opacity-45"><Trash2 aria-hidden="true" className="h-4 w-4" />{t('adminPlans.delete')}</button></div>
          </article>;
        })}
      </div>}
    </div>
    {editingPlan && draft && createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#14291f]/55 p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setEditingPlan(null); setDraft(null); } }}>
      <div className="flex min-h-full items-center justify-center">
      <section role="dialog" aria-modal="true" aria-labelledby="edit-plan-title" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-[#e3eadb] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{t('adminPlans.edit')}</p><h2 id="edit-plan-title" className="mt-1 text-xl font-extrabold text-[#203c2c]">{editingPlan.display_name || t(planDisplayNameKey(editingPlan.key))}</h2></div><button type="button" onClick={() => { setEditingPlan(null); setDraft(null); }} aria-label={t('adminPlans.close')} className="rounded-full p-2 text-[#607366] hover:bg-[#eef3ea]"><X className="h-5 w-5" /></button></div>
        <form onSubmit={saveEdit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-[#526657]">{t('adminPlans.name')}<input required maxLength={60} value={draft.display_name ?? ''} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} className="field-input mt-1" /></label><label className="text-xs font-semibold text-[#526657]">{t('adminPlans.descriptionLabel')}<textarea required maxLength={240} rows={3} value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="field-input mt-1 resize-y" /></label><label className="text-xs font-semibold text-[#526657]">{t('adminPlans.price')}<input type="number" min="0" max="10000000" step="1" required value={draft.price_inr} onChange={(event) => setDraft({ ...draft, price_inr: Number(event.target.value) })} className="field-input mt-1" /></label><label className="text-xs font-semibold text-[#526657]">{t('adminPlans.limit')}<input type="number" min="1" max="1000000" step="1" required value={draft.annual_limit} onChange={(event) => setDraft({ ...draft, annual_limit: Number(event.target.value) })} className="field-input mt-1" /></label></div>
          <fieldset><legend className="text-sm font-bold text-[#294634]">{t('adminPlans.features')}</legend><p className="mb-3 mt-1 text-xs text-[#718074]">{t('adminPlans.featureHint')}</p><div className="grid gap-2 sm:grid-cols-2">{availableFeatures.map((feature) => <label key={feature} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#e5ebdf] bg-[#fafcf8] p-3 text-sm text-[#526657]"><input type="checkbox" checked={draft.features.includes(feature)} onChange={(event) => setDraft({ ...draft, features: event.target.checked ? [...draft.features, feature] : draft.features.filter((item) => item !== feature) })} className="mt-0.5 accent-[#356746]" /><span>{labelForFeature(feature, t)}</span></label>)}</div></fieldset>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => { setEditingPlan(null); setDraft(null); }} className="secondary-button">{t('adminPlans.cancel')}</button><button type="submit" disabled={saving} className="primary-button">{saving ? t('adminPlans.saving') : t('adminPlans.save')}</button></div>
        </form>
      </section>
      </div>
    </div>, document.body)}
    {deleteTarget && createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#14291f]/55 p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDeleteTarget(null); }}><div className="flex min-h-full items-center justify-center"><section role="dialog" aria-modal="true" aria-labelledby="delete-plan-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 id="delete-plan-title" className="text-lg font-bold text-[#203c2c]">{t('adminPlans.delete')} ? {deleteTarget.display_name || t(planDisplayNameKey(deleteTarget.key))}</h2><p className="mt-2 text-sm leading-6 text-[#718074]">{t('adminPlans.deleteConfirm')}</p>{error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="secondary-button">{t('adminPlans.cancel')}</button><button type="button" disabled={saving} onClick={() => void archivePlan()} className="secondary-button border-[#ead2cc] text-[#8a4438]">{saving ? t('adminPlans.saving') : t('adminPlans.confirmDelete')}</button></div></section></div></div>, document.body)}
  </main>;
}
