import { ArrowDownRight, ArrowRight, CloudSun, Leaf, ScanLine, ShieldCheck, Sprout, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import fieldPhoto from '../assets/cropsense-field-hero.webp';

export default function HeroSection() {
  const { t } = useTranslation();
  return <section className="hero-section">
    <div className="section-wrap hero-inner">
      <div className="hero-copy soft-enter">
        <div className="hero-kicker"><ScanLine className="h-4 w-4" /> {t('hero.kicker')}</div>
        <h1 className="display-title hero-title">{t('hero.headline')} <span>{t('hero.headlineAccent')}</span></h1>
        <p className="hero-description">{t('hero.description')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/login" className="primary-button">{t('auth.signIn')} <ArrowRight className="h-4 w-4" /></Link>
          <a href="/about" className="secondary-button">{t('hero.learnMore')} <ArrowDownRight className="h-4 w-4" /></a>
        </div>
        <div className="hero-benefits"><span><span><Leaf className="h-4 w-4" /></span>{t('hero.trustLine')}</span><span><span><Sprout className="h-4 w-4" /></span>{t('hero.noteTitle')}</span></div>
      </div>
      <div className="hero-visual-wrap">
        <figure className="hero-visual-card">
          <img className="hero-field-photo" src={fieldPhoto} alt={t('hero.imageField')} fetchPriority="high" />
          <span className="hero-photo-scanline" aria-hidden="true" />
          <div className="hero-photo-badge"><span><Sprout className="h-4 w-4" /></span>{t('hero.photoTag')}</div>
          <div className="hero-data-panel">
            <div className="hero-data-heading"><span>{t('home.offerCrops')}</span><span className="hero-data-status"><i /> {t('hero.noteTitle')}</span></div>
            <div className="hero-data-row"><span className="hero-data-icon"><Waves className="h-4 w-4" /></span><span className="hero-data-copy"><strong>{t('form.fields.nitrogen')} / P / K</strong></span><span className="hero-data-spark spark-one" /></div>
            <div className="hero-data-row"><span className="hero-data-icon"><CloudSun className="h-4 w-4" /></span><span className="hero-data-copy"><strong>{t('home.offerWeather')}</strong></span><span className="hero-data-spark spark-two" /></div>
            <div className="hero-data-row hero-data-last"><span className="hero-data-icon"><ShieldCheck className="h-4 w-4" /></span><span className="hero-data-copy"><strong>{t('hero.trustLine')}</strong></span></div>
          </div>
        </figure>
      </div>
    </div>
  </section>;
}
