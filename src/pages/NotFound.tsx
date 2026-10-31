import { Link } from 'react-router-dom';
import { ArrowLeft, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return <section className="flex min-h-[70vh] items-center bg-[#f7f8f2] py-16"><div className="section-wrap grid max-w-5xl gap-10 md:grid-cols-2 md:items-center"><div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f0df] text-[#3f7048]"><Sprout className="h-6 w-6" /></span><p className="eyebrow mt-7">CropSense · 404</p><h1 className="display-title mt-3 text-5xl text-[#203c2c]">{t('notFound.title', 'Page not found')}</h1><p className="mt-5 text-[#718074]">{t('notFound.description', 'This page could not be found. Return to CropSense to start a new soil analysis.')}</p><Link to="/" className="primary-button mt-7"><ArrowLeft className="h-4 w-4" />{t('notFound.home', 'Back to home')}</Link></div><img className="h-64 w-full rounded-3xl object-cover shadow-xl sm:h-80" src="https://images.pexels.com/photos/2248000/pexels-photo-2248000.jpeg?auto=compress&cs=tinysrgb&w=1000" alt={t('notFound.imageAlt', 'Agricultural field')} /></div></section>;
}
