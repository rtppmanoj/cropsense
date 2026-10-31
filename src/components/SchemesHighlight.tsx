import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../services/apiClient';
import type { FarmerSchemesResponse } from './SchemeTypes';

export default function SchemesHighlight() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FarmerSchemesResponse['items']>([]);
  useEffect(() => {
    let active = true;
    apiFetch<FarmerSchemesResponse>('/farmer/schemes')
      .then((data) => { if (active) setItems(data.items); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  const highlights = items.filter((item) => item.id === 'pmfby' || item.id === 'pm-kisan');
  return <section className="surface-card mt-8 p-5 sm:p-6" aria-labelledby="scheme-highlight-title">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><p className="eyebrow">Farmer support</p><h2 id="scheme-highlight-title" className="mt-1 text-xl font-bold text-[#203c2c]">Schemes That May Help You</h2><p className="mt-1 text-sm text-[#718074]">Check official eligibility and current deadlines before applying.</p></div>
      <Link to="/farmer/schemes" className="inline-flex items-center gap-2 text-sm font-bold text-[#356746] hover:underline">{t('nav.farmerSchemes')} <ArrowRight className="h-4 w-4" /></Link>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {highlights.map((scheme) => <article key={scheme.id} className="rounded-2xl border border-[#e6ecdf] bg-[#fbfcf9] p-4">
        <div className="flex items-center gap-2 text-[#4d7848]"><ShieldCheck className="h-4 w-4" /><span className="text-[10px] font-extrabold uppercase tracking-wider">{scheme.category === 'crop_insurance' ? 'Crop insurance' : 'Income support'}</span></div>
        <h3 className="mt-2 font-bold text-[#294634]">{scheme.name}</h3><p className="mt-1 text-xs leading-5 text-[#718074]">{scheme.summary}</p>
      </article>)}
    </div>
  </section>;
}
