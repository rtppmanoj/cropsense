import { Database, Fingerprint, FlaskConical, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const items = [
  { icon: Database, number: '01', title: 'features.items.dataset.title', description: 'features.items.dataset.description' },
  { icon: FlaskConical, number: '02', title: 'features.items.evaluation.title', description: 'features.items.evaluation.description' },
  { icon: Fingerprint, number: '03', title: 'features.items.explanations.title', description: 'features.items.explanations.description' },
  { icon: Waves, number: '04', title: 'features.items.honest.title', description: 'features.items.honest.description' },
];

export default function FeaturesSection() {
  const { t } = useTranslation();
  return <section className="home-feature-section">
    <div className="section-wrap">
      <div className="home-feature-heading">
        <div><p className="eyebrow">{t('features.title')}</p><h2 className="display-title">{t('features.subtitle')}</h2></div>
        <p>{t('features.description')}</p>
      </div>
      <div className="home-feature-grid">{items.map(({ icon: Icon, number, title, description }) => <article key={number} className="home-feature-card group">
        <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf4e5] text-[#356746] transition group-hover:bg-[#dfeecf]"><Icon className="h-5 w-5" /></span><span className="text-xs font-bold tracking-widest text-[#9baa91]">{number}</span></div>
        <h3 className="mt-4 text-lg font-bold text-[#203c2c]">{t(title)}</h3><p className="mt-2 text-sm leading-6 text-[#718074]">{t(description)}</p>
      </article>)}</div>
      <div className="home-feature-note"><span>{t('features.note')}</span><span>{t('features.noteDetail')}</span></div>
    </div>
  </section>;
}
