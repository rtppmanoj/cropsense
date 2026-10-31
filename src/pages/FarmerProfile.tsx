import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Save, UserRound, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import PasswordInput from '../components/PasswordInput';
import { apiFetch } from '../services/apiClient';

export default function FarmerProfile() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.display_name ?? '');
  const [mobile, setMobile] = useState(user?.mobile_number ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(window.location.hash === '#password-settings');
  useEffect(() => {
    if (window.location.hash === '#password-settings') {
      window.setTimeout(() => document.getElementById('password-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setError('');
    try {
      await apiFetch('/farmer/profile', { method: 'PATCH', body: JSON.stringify({ display_name: name, mobile_number: mobile }) });
      await refresh(); setMessage(t('dashboard.farmer.profileSaved'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('dashboard.farmer.saveError')); }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setError('');
    if (newPassword !== confirmPassword) { setError(t('auth.errors.passwordMatch')); return; }
    try {
      await apiFetch('/farmer/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage(t('dashboard.farmer.passwordChanged'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('dashboard.farmer.saveError')); }
  };

  return <main className="min-h-[70vh] bg-gradient-to-br from-[#f4f6ef] via-[#f8faf5] to-[#eaf3ee] py-5 sm:py-7"><div className="section-wrap max-w-4xl">
    <p className="eyebrow">{t('nav.farmerPortal')}</p><h1 className="display-title mt-1 text-3xl text-[#203c2c] sm:text-4xl">{t('nav.farmerProfile')}</h1>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p role="status" className="mt-4 rounded-xl border border-[#d7e6cd] bg-[#edf5e8] p-3 text-sm text-[#31583c]">{message}</p>}
    <div className="mt-4 space-y-3">
      <section className="surface-card border-t-4 border-t-[#77a45c] p-4 sm:p-5"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-[#537d50]" /><h2 className="text-lg font-bold text-[#294634]">{t('dashboard.farmer.profile')}</h2></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><p className="rounded-xl bg-[#f7f9f4] p-3"><span className="block text-xs text-[#829082]">{t('nav.farmerId')}</span><span className="font-mono text-sm font-semibold text-[#334c3a]">{user?.farmer_id || 'N/A'}</span></p><p className="rounded-xl bg-[#f7f9f4] p-3"><span className="block text-xs text-[#829082]">{t('auth.name')}</span><span className="text-sm font-semibold text-[#334c3a]">{user?.display_name || '—'}</span></p><p className="rounded-xl bg-[#f7f9f4] p-3"><span className="block text-xs text-[#829082]">{t('auth.email')}</span><span className="break-all text-sm font-semibold text-[#334c3a]">{user?.email}</span></p><p className="rounded-xl bg-[#f7f9f4] p-3"><span className="block text-xs text-[#829082]">{t('auth.mobile')}</span><span className="text-sm font-semibold text-[#334c3a]">{user?.mobile_number || '—'}</span></p></div><form onSubmit={saveProfile} className="mt-3 grid gap-3 sm:grid-cols-2"><div><label htmlFor="profile-name" className="mb-1.5 block text-xs font-semibold text-[#334c3a]">{t('auth.name')}</label><input id="profile-name" className="field-input py-2.5" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} /></div><div><label htmlFor="profile-mobile" className="mb-1.5 block text-xs font-semibold text-[#334c3a]">{t('auth.mobile')}</label><input id="profile-mobile" className="field-input py-2.5" type="tel" autoComplete="tel" required minLength={10} maxLength={16} value={mobile} onChange={(event) => setMobile(event.target.value)} /></div><div className="sm:col-span-2"><button className="secondary-button px-4 py-2.5 text-sm" type="submit"><Save className="h-4 w-4" />{t('dashboard.farmer.saveProfile')}</button></div></form></section>
      <section id="password-settings" className="surface-card scroll-mt-24 border-t-4 border-t-[#5d9a9a] p-4 sm:p-5"><button type="button" onClick={() => setPasswordOpen((open) => !open)} aria-expanded={passwordOpen} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-[#537d50]" /><span className="text-lg font-bold text-[#294634]">{t('dashboard.farmer.changePassword')}</span></span>{passwordOpen ? <ChevronUp className="h-4 w-4 text-[#718074]" /> : <ChevronDown className="h-4 w-4 text-[#718074]" />}</button>{passwordOpen && <form onSubmit={changePassword} className="mt-4 grid gap-3 sm:grid-cols-2">{[[t('dashboard.farmer.currentPassword'), currentPassword, setCurrentPassword, 'current-password'], [t('dashboard.farmer.newPassword'), newPassword, setNewPassword, 'new-password'], [t('auth.confirmPassword'), confirmPassword, setConfirmPassword, 'new-password']].map(([label, value, setter, autocomplete], index) => { const setValue = setter as (value: string) => void; return <PasswordInput key={index} id={`password-${index}`} className="[&_label]:mb-1.5 [&_label]:text-xs [&_label]:text-[#526657]" label={label as string} autoComplete={autocomplete as string} minLength={index === 0 ? 1 : 8} value={value as string} onChange={setValue} />; })}<p className="text-xs text-[#829082] sm:col-span-2">{t('auth.passwordRule')}</p><button className="primary-button px-4 py-2.5 text-sm sm:col-span-2 sm:justify-self-start" type="submit">{t('dashboard.farmer.updatePassword')}</button></form>}</section>
    </div>
  </div></main>;
}
