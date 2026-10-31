import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/apiClient';
import { defaultPlanFeatureKeys, planDescriptionKey, planDisplayNameKey, type PlanKey } from '../data/planFeatures';

type PlanCatalog = { key: PlanKey; price_inr: number; annual_limit: number; display_name: string | null; description: string | null; features: string[]; is_recommended?: number };
type Plan = PlanCatalog & { display_name: string; description: string; features: string[]; highlighted?: boolean };
type Translation = (key: string, options?: Record<string, string>) => string;

const initialCatalogue: PlanCatalog[] = [
  { key: 'free', price_inr: 0, annual_limit: 3, display_name: null, description: null, features: [], is_recommended: 0 },
  { key: 'basic', price_inr: 49, annual_limit: 5, display_name: null, description: null, features: [], is_recommended: 0 },
  { key: 'plus', price_inr: 149, annual_limit: 15, display_name: null, description: null, features: [], is_recommended: 1 },
  { key: 'premium', price_inr: 399, annual_limit: 50, display_name: null, description: null, features: [], is_recommended: 0 },
  { key: 'organizationStarter', price_inr: 999, annual_limit: 500, display_name: null, description: null, features: [], is_recommended: 0 },
  { key: 'organizationGrowth', price_inr: 2499, annual_limit: 2000, display_name: null, description: null, features: [], is_recommended: 0 },
];

function getPlans(t: Translation, catalogue: PlanCatalog[]) {
  const byKey = Object.fromEntries(catalogue.map((plan) => [plan.key, plan])) as Partial<Record<PlanKey, PlanCatalog>>;
  const createPlan = (key: PlanKey, highlighted = false): Plan => {
    const stored = byKey[key];
    const featureKeys = defaultPlanFeatureKeys(key);
    const featureLabels = (keys: string[]) => keys.map((feature) => { const label = feature === 'chatbotFeature' ? t('pricingChatbotFeature') : t(`pricingPage.features.${feature}`); return label === `pricingPage.features.${feature}` ? feature : label; });
    const defaultFeatures = featureLabels(featureKeys);
    return {
      key,
      price_inr: stored?.price_inr ?? 0,
      annual_limit: stored?.annual_limit ?? 0,
      display_name: stored?.display_name || t(planDisplayNameKey(key)),
      description: stored?.description || t(planDescriptionKey(key)),
      features: stored?.features?.length ? featureLabels(stored.features) : defaultFeatures,
      highlighted: stored ? Boolean(stored.is_recommended) : highlighted,
    };
  };
  return {
    farmerPlans: (['free', 'basic', 'plus', 'premium'] as PlanKey[]).filter((key) => Boolean(byKey[key])).map((key) => createPlan(key, key === 'plus')),
    organizationPlans: (['organizationStarter', 'organizationGrowth'] as PlanKey[]).filter((key) => Boolean(byKey[key])).map((key) => createPlan(key)),
  };
}

function PlanCard({ plan, onSelect, t }: { plan: Plan; onSelect: (plan: Plan) => void; t: Translation }) {
  return <article className={`relative flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${plan.highlighted ? 'border-[#6d9458] ring-2 ring-[#a9c98d]' : 'border-[#e3e9dd]'}`}>
    {plan.highlighted && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#356746] px-3 py-1 text-xs font-bold text-white">{t('pricingPage.recommended')}</span>}
    <div className="flex items-center gap-2 text-[#356746]"><Sprout className="h-5 w-5" /><h3 className="text-lg font-extrabold text-[#294634]">{plan.display_name}</h3></div>
    <p className="mt-2 min-h-10 text-sm leading-5 text-[#718074]">{plan.description}</p>
    <p className="mt-4 text-3xl font-extrabold text-[#203c2c]">₹{plan.price_inr}<span className="ml-1 text-sm font-semibold text-[#718074]">/{t('pricingPage.year')}</span></p>
    <p className="mt-1 text-sm font-semibold text-[#537d50]">{t('pricingPage.recommendationsPerYear', { count: String(plan.annual_limit) })}</p>
    <ul className="mt-5 flex-1 space-y-2.5 text-sm leading-5 text-[#526657]">{plan.features.map((feature, index) => <li key={`${plan.key}-${index}`} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#56804f]" /><span>{feature}</span></li>)}</ul>
    <button type="button" onClick={() => onSelect(plan)} className={`mt-6 w-full justify-center ${plan.highlighted ? 'primary-button' : 'secondary-button'}`}>{t('pricingPage.choosePlan', { plan: plan.display_name })}</button>
  </article>;
}

export default function PricingPlans() {
  const { t } = useTranslation();
  const [catalogue, setCatalogue] = useState(initialCatalogue);
  useEffect(() => {
    let active = true;
    apiFetch<{ plans: PlanCatalog[] }>('/plans').then((result) => { if (active) setCatalogue(result.plans); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const { farmerPlans, organizationPlans } = useMemo(() => getPlans(t, catalogue), [t, catalogue]);
  const selectPlan = (plan: Plan) => {
    void apiFetch(`/plans/${plan.key}/select`, { method: 'POST', body: JSON.stringify({}) }).catch(() => undefined);
  };
  const comparison: [string, (boolean | string)[]][] = [
    [t('pricingPage.annualLimit'), farmerPlans.map((plan) => String(plan.annual_limit))],
    ...Array.from(new Set(farmerPlans.flatMap((plan) => plan.features))).map((feature) => [feature, farmerPlans.map((plan) => plan.features.includes(feature))] as [string, boolean[]]),
  ];
  return <main className="page-enter min-h-[70vh] bg-[#f6f8f2] py-8 sm:py-12">
    <div className="section-wrap max-w-7xl">
      <header className="mx-auto max-w-3xl text-center"><p className="eyebrow">{t('pricingPage.eyebrow')}</p><h1 className="display-title mt-2 text-3xl text-[#203c2c] sm:text-5xl">{t('pricingPage.title')}</h1><p className="mt-3 text-sm leading-6 text-[#718074] sm:text-base">{t('pricingPage.subtitle')}</p></header>
      <section className="mt-9" aria-labelledby="farmer-plans-title"><div className="mb-5"><p className="eyebrow">{t('pricingPage.farmersEyebrow')}</p><h2 id="farmer-plans-title" className="mt-1 text-2xl font-extrabold text-[#294634]">{t('pricingPage.farmerPlans')}</h2></div><div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">{farmerPlans.map((plan) => <PlanCard key={plan.key} plan={plan} onSelect={selectPlan} t={t} />)}</div></section>
      <section className="mt-12" aria-labelledby="comparison-title"><div className="mb-4"><p className="eyebrow">{t('pricingPage.comparisonEyebrow')}</p><h2 id="comparison-title" className="mt-1 text-2xl font-extrabold text-[#294634]">{t('pricingPage.comparisonTitle')}</h2></div><div className="overflow-x-auto rounded-2xl border border-[#e3e9dd] bg-white shadow-sm"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="bg-[#edf3e7] text-[#294634]"><th scope="col" className="p-3 font-bold">{t('pricingPage.feature')}</th>{farmerPlans.map((plan) => <th scope="col" key={plan.key} className="p-3 text-center font-bold">{plan.display_name}<span className="mt-1 block text-xs font-semibold">₹{plan.price_inr}/{t('pricingPage.year')}</span></th>)}</tr></thead><tbody>{comparison.map(([label, values]) => <tr key={label} className="border-t border-[#edf0e9]"><th scope="row" className="p-3 font-semibold text-[#526657]">{label}</th>{values.map((value, index) => <td key={`${label}-${index}`} className="p-3 text-center text-[#526657]">{typeof value === 'boolean' ? value ? <Check aria-label={t('pricingPage.included')} className="mx-auto h-4 w-4 text-[#4c814d]" /> : <X aria-label={t('pricingPage.notIncluded')} className="mx-auto h-4 w-4 text-[#a1aaa0]" /> : <span className="font-bold">{value}{label === t('pricingPage.annualLimit') ? `/${t('pricingPage.year')}` : ''}</span>}</td>)}</tr>)}</tbody></table></div><p className="mt-2 text-xs text-[#829082]">{t('pricingPage.recommendedNote')}</p></section>
      <section className="mt-12" aria-labelledby="organization-plans-title"><div className="mb-5"><p className="eyebrow">{t('pricingPage.organizationEyebrow')}</p><h2 id="organization-plans-title" className="mt-1 text-2xl font-extrabold text-[#294634]">{t('pricingPage.organizationTitle')}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#718074]">{t('pricingPage.organizationDescription')}</p></div><div className="grid gap-5 md:grid-cols-2">{organizationPlans.map((plan) => <PlanCard key={plan.key} plan={plan} onSelect={selectPlan} t={t} />)}</div></section>
      <div className="mt-10 text-center"><Link to="/" className="text-sm font-bold text-[#356746] underline underline-offset-4">{t('pricingPage.backHome')}</Link></div>
    </div>
  </main>;
}
