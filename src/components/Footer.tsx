import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { useLocation } from 'react-router-dom';
import cropsenseMark from '../assets/cropsense-mark.png';
import smartFarmLabsLogo from '../assets/smart-farm-labs-logo.webp';

export default function Footer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user?.role === 'admin' || pathname === '/login' || pathname === '/admin/login' || pathname === '/farmer/login' || pathname === '/farmer/register') return null;
  return <footer className="site-footer"><div className="section-wrap grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><div className="flex items-center gap-3 text-white"><img src={cropsenseMark} alt="" aria-hidden="true" className="h-10 w-10 rounded-xl border border-white/40 bg-white object-contain p-1 shadow-md" /><span className="text-base font-bold">CropSense</span></div><p className="mt-1 max-w-md text-xs leading-5 text-white/65">{t('footer.description')}</p></div><div className="flex flex-wrap items-center gap-3 sm:justify-end"><a className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20" href="mailto:cropsensevit@gmail.com"><Mail className="h-4 w-4" />{t('footer.contactUs', 'Contact us')}</a><p className="text-xs font-medium text-white/75">© {new Date().getFullYear()} CropSense</p></div><div className="flex flex-col gap-2 border-t border-white/15 pt-3 text-xs leading-4 text-white/60 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between"><div><p>{t('footer.maintained')}</p><p className="font-semibold text-white/80">{t('chatbot.poweredBy')}</p></div><img src={smartFarmLabsLogo} alt="Smart Farm Labs" loading="lazy" decoding="async" className="h-12 w-32 rounded-xl bg-white p-1.5 object-contain" /></div></div></footer>;
}
