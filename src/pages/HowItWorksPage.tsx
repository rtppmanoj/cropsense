import { ArrowDown, ArrowRight, BadgeCheck, Check, CloudSun, Database, FlaskConical, Leaf, MapPin, ShieldCheck, SlidersHorizontal, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HowItWorksPage() {
  const { t } = useTranslation();
  const cards = [
    { icon: Database, title: 'about.cards.data.title', text: 'about.cards.data.text' },
    { icon: FlaskConical, title: 'about.cards.model.title', text: 'about.cards.model.text' },
    { icon: ShieldCheck, title: 'about.cards.honesty.title', text: 'about.cards.honesty.text' },
  ];
  const steps = [
    { key: 'measure', Icon: SlidersHorizontal, color: 'process-input', tag: '01' },
    { key: 'validate', Icon: Check, color: 'process-check', tag: '02' },
    { key: 'match', Icon: Sprout, color: 'process-match', tag: '03' },
    { key: 'results', Icon: BadgeCheck, color: 'process-results', tag: '04' },
  ];
  return <div className="page-enter min-h-[70vh] bg-[#f7f8f2] py-8 sm:py-12"><div className="section-wrap max-w-5xl">
    <p className="eyebrow">{t('howItWorks.eyebrow')}</p><h1 className="display-title mt-4 max-w-3xl text-4xl text-[#203c2c] sm:text-6xl">{t('howItWorks.title')}</h1><p className="mt-6 max-w-3xl text-base leading-8 text-[#68766a] sm:text-lg">{t('howItWorks.intro')}</p>
    <section className="process-overview mt-10" aria-labelledby="process-overview-title">
      <div className="process-overview-heading"><div><p className="eyebrow">{t('howItWorks.flowEyebrow')}</p><h2 id="process-overview-title" className="display-title mt-2 text-3xl text-[#203c2c] sm:text-4xl">{t('howItWorks.flowTitle')}</h2></div><p>{t('howItWorks.flowIntro')}</p></div>
      <div className="process-flow" aria-label={t('howItWorks.flowLabel')}>
        {steps.map(({ key, Icon, color, tag }, index) => <div className="process-flow-item" key={key}>
          <article className={`process-stage ${color}`}><div className="process-stage-top"><span className="process-stage-icon"><Icon aria-hidden="true" /></span><span className="process-stage-tag">{tag}</span></div><h3>{t(`howItWorks.stages.${key}.title`)}</h3><p>{t(`howItWorks.stages.${key}.description`)}</p>
            {key === 'measure' && <div className="process-input-chips"><span>N</span><span>P</span><span>K</span><span>pH</span><span><MapPin aria-hidden="true" /> {t('howItWorks.location')}</span></div>}
            {key === 'results' && <div className="process-result-preview"><span><Leaf aria-hidden="true" /> {t('howItWorks.cropMatches')}</span><span><CloudSun aria-hidden="true" /> {t('howItWorks.weatherContext')}</span></div>}
          </article>
          {index < steps.length - 1 && <div className="process-stage-connector" aria-hidden="true"><ArrowRight className="hidden md:block" /><ArrowDown className="md:hidden" /></div>}
        </div>)}
      </div>
      <div className="process-output-note"><span className="process-output-icon"><Database aria-hidden="true" /></span><p><strong>{t('howItWorks.outputTitle')}</strong>{t('howItWorks.outputDescription')}</p></div>
    </section>
    <div className="mt-10 grid gap-4 md:grid-cols-3">{cards.map(({ icon: Icon, title, text }) => <article key={title} className="dashboard-stat surface-card p-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf4e5] text-[#356746]"><Icon className="h-5 w-5" /></span><h2 className="mt-5 font-bold text-[#294634]">{t(title)}</h2><p className="mt-2 text-sm leading-6 text-[#718074]">{t(text)}</p></article>)}</div>
  </div></div>;
}
