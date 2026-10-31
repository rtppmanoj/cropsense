import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Activity, CircleUserRound, LayoutDashboard, LogOut, Menu, UsersRound, ClipboardList, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import { useAuth } from '../auth/useAuth';
import cropsenseWordmark from '../assets/cropsense-wordmark.png';

export default function Navbar() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const showAccountMenu = Boolean(user) || pathname !== '/';
  const authPage = ['/login', '/admin/login', '/farmer/login', '/farmer/register'].includes(pathname);
  const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link flex items-center ${isActive ? 'bg-[#edf3e7] text-[#22553a]' : ''}`;
  const close = () => setProfileOpen(false);
  useEffect(() => {
    if (!profileOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);
  useEffect(() => { close(); }, [pathname]);
  const signOut = async () => {
    setSignOutError('');
    try { await logout(); close(); navigate('/login', { replace: true }); }
    catch (reason) { setSignOutError(reason instanceof Error ? reason.message : t('auth.errors.logout')); }
  };

  return <header className="sticky top-0 z-50 border-b border-[#e9ece4] bg-[#fbfcf8]/95 backdrop-blur-xl">
    <nav className="section-wrap relative flex h-14 items-center justify-between sm:h-20" aria-label={t('nav.mainLabel')}>
      <Link to={isAdmin ? '/admin/dashboard' : '/'} onClick={close} className="flex items-center gap-3">
        <img src={cropsenseWordmark} alt="CropSense — Right Crop Bright Tomorrow" className="h-12 w-[min(52vw,180px)] object-contain object-left sm:h-16 sm:w-[200px]" />
      </Link>

      {!isAdmin && !authPage && <div className="hidden items-center gap-1 md:flex">
        <NavLink end to="/" className={linkClass}>{t('nav.home')}</NavLink><NavLink to="/how-it-works" className={linkClass}>{t('nav.howItWorks')}</NavLink><NavLink to="/pricing" className={linkClass}>{t('nav.pricing')}</NavLink><NavLink to="/about" className={linkClass}>{t('nav.about')}</NavLink>
      </div>}
      <div className="flex items-center gap-2">
        {!user && !authPage && <Link to="/login" className="primary-button nav-account-button !inline-flex !px-3 !py-2 text-xs">{t('nav.account')}</Link>}
        <LanguageSelector />
        <div ref={menuRef} className="relative">
          {showAccountMenu && <button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-controls="account-menu"
            aria-label={t(user ? 'nav.profileMenu' : 'nav.openMenu', 'Open navigation menu')}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dfe7d9] bg-white text-[#31583c] shadow-sm transition hover:bg-[#edf3e7] hover:shadow-md">
            {user ? <CircleUserRound className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>}
          {showAccountMenu && profileOpen && <>
            <div id="account-menu" className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(21rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-[#dfe8da] bg-white shadow-[0_20px_60px_rgba(28,58,38,.2)] soft-enter">
              {user && <div className="bg-[linear-gradient(120deg,#f4f8ef,#fff)] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e5efdc] text-[#3e7048]">{isAdmin ? <LayoutDashboard className="h-5 w-5" /> : <CircleUserRound className="h-5 w-5" />}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-[#294634]">{user.display_name || user.email}</p><p className="truncate text-xs text-[#829082]">{user.email}</p></div>
                </div>
                <span className="ml-14 mt-2 inline-flex rounded-full border border-[#dce8d3] bg-white/80 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#426b48]">{isAdmin ? t('nav.adminPortal') : t('nav.farmerPortal')}</span>
                {!isAdmin && user.farmer_id && <p className="ml-14 mt-2 text-xs font-semibold text-[#526657]">{t('nav.farmerId')}: <span className="font-mono text-[#31583c]">{user.farmer_id}</span></p>}
              </div>}
              <div className="flex flex-col gap-1 p-2.5">
                {user && isAdmin ? <>
                  <NavLink to="/admin/dashboard" onClick={close} className={linkClass}><LayoutDashboard aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.adminDashboard')}</NavLink>
                  <NavLink to="/admin/activity" onClick={close} className={linkClass}><ClipboardList aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.adminActivity')}</NavLink>
                  <NavLink to="/admin/audit" onClick={close} className={linkClass}><Activity aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.auditLogs')}</NavLink>
                  <NavLink to="/admin/accounts" onClick={close} className={linkClass}><UsersRound aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.accountManagement')}</NavLink>
                  <NavLink to="/admin/plans" onClick={close} className={linkClass}><Sprout aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.adminPlans')}</NavLink>
                </> : user ? <>
                  <NavLink to="/farmer/profile" onClick={close} className={linkClass}><CircleUserRound aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.farmerProfile')}</NavLink>
                  <NavLink to="/farmer/profile#password-settings" onClick={close} className={linkClass}>{t('nav.farmerPassword')}</NavLink>
                  <NavLink to="/farmer/dashboard" onClick={close} className={linkClass}><Sprout aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.farmerDashboard')}</NavLink>
                  <NavLink to="/farmer/history" onClick={close} className={linkClass}>{t('nav.farmerHistory')}</NavLink>
                  <NavLink to="/farmer/schemes" onClick={close} className={linkClass}><Sprout aria-hidden="true" className="mr-3 h-4 w-4 opacity-65" />{t('nav.farmerSchemes')}</NavLink>
                </> : <>
                  <NavLink to="/login" onClick={close} className={linkClass}>{t('nav.account')}</NavLink>
                </>}
              </div>
              {signOutError && <p role="alert" className="px-3 py-2 text-xs text-red-700">{signOutError}</p>}
              {user && <button type="button" onClick={() => void signOut()} className="mx-2.5 mb-2.5 flex w-[calc(100%-1.25rem)] items-center gap-3 rounded-xl border-t border-[#edf0e9] px-3 py-3 text-left text-sm font-semibold text-[#8a473c] transition hover:bg-[#fff4f1]"><LogOut aria-hidden="true" className="h-4 w-4" />{t('dashboard.logout')}</button>}
            </div>
          </>}
        </div>
      </div>
    </nav>
    {!isAdmin && !authPage && <nav className="section-wrap mobile-primary-nav flex items-center justify-center gap-1 border-t border-[#eef0e9] py-1 md:hidden" aria-label={t('nav.mainLabel')}><NavLink end to="/" className={linkClass}>{t('nav.home')}</NavLink><NavLink to="/how-it-works" className={linkClass}>{t('nav.howItWorks')}</NavLink><NavLink to="/pricing" className={linkClass}>{t('nav.pricing')}</NavLink><NavLink to="/about" className={linkClass}>{t('nav.about')}</NavLink></nav>}
  </header>;
}
