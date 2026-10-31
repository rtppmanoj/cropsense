import { CloudSun, FileText, HelpCircle, Landmark, LineChart, ShieldCheck } from 'lucide-react';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import HardwarePromo from '../components/HardwarePromo';

export default function Homepage() {
  const { t } = useTranslation();
  return <div className="homepage">
    <HeroSection />
    <div className="section-wrap home-proof-band">
      {[['verified', ShieldCheck], ['transparent', LineChart], ['support', HelpCircle]].map(([key, Icon]) => { const ItemIcon = Icon as typeof ShieldCheck; return <div key={key as string} className="home-proof-item"><span><ItemIcon className="h-4 w-4" /></span><span>{t(`home.highlights.${key as string}`)}</span></div>; })}
    </div>
    <section className="section-wrap home-section" aria-labelledby="home-offers-title">
      <div className="home-section-heading"><p className="eyebrow">{t('home.highlights.support')}</p><h2 id="home-offers-title" className="display-title">{t('home.offerTitle')}</h2><p>{t('home.offerIntro')}</p></div>
      <div className="home-offer-grid mt-5">{[
        ['offerCrops', 'offerCropsDesc', ShieldCheck], ['offerWeather', 'offerWeatherDesc', CloudSun],
        ['offerSchemes', 'offerSchemesDesc', Landmark], ['offerReports', 'offerReportsDesc', FileText],
      ].map(([title, description, Icon], index) => { const CardIcon = Icon as typeof ShieldCheck; return <article key={title as string} className="home-offer-item"><span className="home-offer-index">0{index + 1}</span><span className="home-offer-icon"><CardIcon className="h-4 w-4" /></span><div><h3>{t(`home.${title as string}`)}</h3><p>{t(`home.${description as string}`)}</p></div></article>; })}</div>
      <div className="home-pricing-cta"><div><h3>{t('home.pricingTitle')}</h3><p>{t('home.pricingDescription')}</p></div><Link to="/pricing" className="secondary-button shrink-0">{t('home.viewPlans')}</Link></div>
    </section>
    <section className="home-hardware-section" aria-label={t('hardware.title')}><div className="section-wrap"><HardwarePromo /></div></section>
    <FeaturesSection />
    <section className="home-process-section"><div className="section-wrap"><div className="home-section-heading"><p className="eyebrow">{t('home.processEyebrow')}</p><h2 className="display-title">{t('home.processTitle')}</h2></div><div className="home-process-grid">{['measure','compare','review'].map((step, index) => <article key={step}><span>0{index + 1}</span><h3>{t(`home.steps.${step}.title`)}</h3><p>{t(`home.steps.${step}.description`)}</p></article>)}</div></div></section>
  </div>;
}
