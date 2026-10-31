import { ArrowRight, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import CropRecommendationForm from '../components/CropRecommendationForm';
import HardwarePromo from '../components/HardwarePromo';

export default function FarmerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return <main className="farmer-dashboard-page min-h-[75vh] bg-gradient-to-br from-[#f4f6ef] via-[#f8faf5] to-[#eaf3ee] py-8 sm:py-12"><div className="section-wrap max-w-6xl">
    <div className="page-enter"><p className="eyebrow">{t('dashboard.farmer.kicker')}</p><h1 className="display-title mt-3 text-4xl text-[#203c2c] sm:text-5xl">{t('dashboard.farmer.welcome', { name: user?.display_name || user?.email })}</h1>{user?.farmer_id && <p className="mt-2 text-xs font-semibold text-[#526657]">{t('nav.farmerId')}: <span className="font-mono">{user.farmer_id}</span></p>}</div>
    <div className="mt-6"><HardwarePromo compact /></div>
    <Link to="/farmer/schemes" className="surface-card mt-6 flex flex-col justify-between gap-3 p-4 transition hover:border-[#c9dcbf] hover:shadow-md sm:flex-row sm:items-center sm:p-5"><span><span className="block font-bold text-[#294634]">{t('nav.farmerSchemes')}</span><span className="mt-1 block text-sm text-[#718074]">Explore verified scheme information, check likely eligibility, and track saved schemes.</span></span><span className="inline-flex items-center gap-2 text-sm font-bold text-[#356746]">Explore schemes <ArrowRight className="h-4 w-4" /></span></Link>
    <section id="farmer-recommendation" className="mt-8 scroll-mt-24"><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e5efdc] text-[#376447]"><Sprout className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-[#294634]">{t('form.title')}</h2><p className="text-sm text-[#829082]">{t('dashboard.farmer.recommendationNote')}</p></div></div><CropRecommendationForm /></section>
  </div></main>;
}
