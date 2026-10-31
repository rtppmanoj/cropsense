import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, LineChart, ShieldCheck, Wheat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import type { UserRole } from '../auth/types';
import { protectedRouteDecision } from '../auth/routePolicy.js';
import cropsenseMark from '../assets/cropsense-mark.png';
import PasswordInput from '../components/PasswordInput';
import { apiFetch } from '../services/apiClient';

const destination = (role: UserRole) => role === 'admin' ? '/admin/dashboard' : '/farmer/dashboard';

export function RequireAuth({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, loading } = useAuth(); const { t } = useTranslation();
  const decision = protectedRouteDecision(role, user?.role ?? null, loading);
  if (decision === 'loading') return <div role="status" className="flex min-h-[65vh] items-center justify-center text-sm font-semibold text-[#51734b]">{t('auth.checkingSession')}</div>;
  if (decision !== 'allow') return <Navigate to={decision} replace />;
  return children;
}

export function LoginPage({ adminPortal = false }: { adminPortal?: boolean }) {
  const { user, loading, login } = useAuth(); const navigate = useNavigate(); const { t } = useTranslation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false); const [resetSent, setResetSent] = useState(false); const [otp, setOtp] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [notice, setNotice] = useState('');
  if (!loading && user) return <Navigate to={destination(user.role)} replace />;
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setNotice(''); setBusy(true); try { const account = await login(email, password); navigate(destination(account.role), { replace: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : t('auth.errors.login')); } finally { setBusy(false); } };
  const requestReset = async (event: FormEvent) => { event.preventDefault(); setError(''); setBusy(true); try { await apiFetch('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }); setResetSent(true); setNotice(t('auth.forgotPassword.sent')); } catch (reason) { setError(reason instanceof Error ? reason.message : t('auth.errors.resetRequest')); } finally { setBusy(false); } };
  const completeReset = async (event: FormEvent) => { event.preventDefault(); setError(''); if (newPassword !== confirmPassword) { setError(t('auth.errors.passwordMatch')); return; } setBusy(true); try { await apiFetch('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ email, otp, new_password: newPassword }) }); setResetMode(false); setResetSent(false); setPassword(''); setOtp(''); setNewPassword(''); setConfirmPassword(''); setNotice(t('auth.forgotPassword.changed')); } catch (reason) { setError(reason instanceof Error ? reason.message : t('auth.errors.resetComplete')); } finally { setBusy(false); } };
  const openReset = () => { setError(''); setNotice(''); setResetMode(true); setResetSent(false); };
  return <AuthShell role={adminPortal ? 'admin' : null} title={t(adminPortal ? 'auth.admin.title' : 'auth.login.title')} description={t(adminPortal ? 'auth.admin.description' : 'auth.login.description')}>
    {loading ? <p role="status" className="text-sm text-[#718074]">{t('auth.checkingSession')}</p> : resetMode ? <form onSubmit={resetSent ? completeReset : requestReset} className="space-y-4">
      <div><label htmlFor="reset-email" className="mb-2 block text-sm font-semibold text-[#334c3a]">{t('auth.email')}</label><input id="reset-email" className="field-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      {resetSent && <><p className="text-sm leading-5 text-[#607366]">{t('auth.forgotPassword.instructions')}</p><div><label htmlFor="reset-otp" className="mb-2 block text-sm font-semibold text-[#334c3a]">{t('auth.forgotPassword.otp')}</label><input id="reset-otp" className="field-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div><div className="grid gap-3 sm:grid-cols-2"><PasswordInput id="reset-new-password" label={t('auth.forgotPassword.newPassword')} value={newPassword} onChange={setNewPassword} autoComplete="new-password" /><PasswordInput id="reset-confirm-password" label={t('auth.confirmPassword')} value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" /></div></>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-60">{busy ? t('auth.forgotPassword.working') : t(resetSent ? 'auth.forgotPassword.reset' : 'auth.forgotPassword.send')} <ArrowRight className="h-4 w-4" /></button>
      <button type="button" onClick={() => { setResetMode(false); setError(''); setNotice(''); }} className="w-full text-center text-sm font-semibold text-[#356746] hover:underline">{t('auth.forgotPassword.back')}</button>
    </form> : <form onSubmit={submit} className="space-y-5">
      <div><label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-[#334c3a]">{t('auth.email')}</label><input id="login-email" className="field-input" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div><PasswordInput id="login-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="current-password" />{!adminPortal && <button type="button" onClick={openReset} className="mt-2 text-sm font-semibold text-[#356746] hover:underline">{t('auth.forgotPassword.link')}</button>}</div>
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="primary-button w-full disabled:opacity-60">{busy ? t('auth.signingIn') : t('auth.signIn')} <ArrowRight className="h-4 w-4" /></button>
      <p className="text-center text-sm text-[#718074]">{t('auth.noAccount')} <Link to="/farmer/register" className="font-bold text-[#356746] underline">{t('auth.createAccount')}</Link></p>
    </form>}
  </AuthShell>;
}

export function FarmerRegistrationPage() {
  const { user, loading, register } = useAuth(); const navigate = useNavigate(); const { t } = useTranslation();
  const [name, setName] = useState(''); const [mobile, setMobile] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (!loading && user) return <Navigate to={destination(user.role)} replace />;
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); if (password !== confirm) { setError(t('auth.errors.passwordMatch')); return; } setBusy(true); try { await register(email, password, name, mobile); navigate('/farmer/dashboard', { replace: true }); } catch (reason) { setError(reason instanceof Error ? reason.message : t('auth.errors.register')); } finally { setBusy(false); } };
  return <AuthShell role="farmer" title={t('auth.register.title')} description={t('auth.register.description')}>
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="register-name" className="mb-1.5 block text-sm font-semibold text-[#334c3a]">{t('auth.name')}</label><input id="register-name" className="field-input" autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div><label htmlFor="register-mobile" className="mb-1.5 block text-sm font-semibold text-[#334c3a]">{t('auth.mobile')}</label><input id="register-mobile" className="field-input" type="tel" autoComplete="tel" required minLength={10} maxLength={16} value={mobile} onChange={(event) => setMobile(event.target.value)} /></div></div>
      <div><label htmlFor="register-email" className="mb-1.5 block text-sm font-semibold text-[#334c3a]">{t('auth.email')}</label><input id="register-email" className="field-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <div className="grid gap-3 sm:grid-cols-2"><PasswordInput id="register-password" label={t('auth.password')} value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordInput id="register-confirm" label={t('auth.confirmPassword')} value={confirm} onChange={setConfirm} autoComplete="new-password" /></div><p className="text-xs text-[#829082]">{t('auth.passwordRule')}</p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy || loading} className="primary-button w-full disabled:opacity-60">{busy ? t('auth.creatingAccount') : t('auth.register.submit')} <ArrowRight className="h-4 w-4" /></button>
      <p className="text-center text-sm text-[#718074]">{t('auth.haveAccount')} <Link to="/login" className="font-bold text-[#356746] underline">{t('auth.signIn')}</Link></p>
    </form>
  </AuthShell>;
}

function AuthShell({ role = null, title, description, children }: { role?: UserRole | null; title: string; description: string; children: ReactNode }) {
  const { t } = useTranslation(); const portal = role ? t(role === 'admin' ? 'auth.admin.portal' : 'auth.farmer.portal') : t('auth.login.portal');
  return <section className="auth-page"><div className="auth-layout">
    <aside className="auth-aside">
      <Link to="/" className="relative z-10 inline-flex w-fit items-center gap-2 text-sm font-extrabold text-white"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm"><img src={cropsenseMark} alt="" className="h-7 w-7 object-contain" /></span><span className="text-lg">CropSense</span></Link>
      <div className="auth-aside-copy"><h2>{t('auth.visualTitle')}</h2><p>{t('auth.visualDescription')}</p></div>
      <div className="auth-aside-points"><div className="auth-aside-point"><span><Wheat className="h-4 w-4" /></span>{t('auth.visualPoints.measurements')}</div><div className="auth-aside-point"><span><LineChart className="h-4 w-4" /></span>{t('auth.visualPoints.evidence')}</div><div className="auth-aside-point"><span><ShieldCheck className="h-4 w-4" /></span>{t('auth.visualPoints.privacy')}</div></div>
    </aside>
    <div className="auth-panel">
      <Link to={role === 'admin' ? '/admin/login' : '/'} className="mb-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#214831]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm"><img src={cropsenseMark} alt="" className="h-7 w-7 object-contain" /></span>CropSense</Link>
      <div className="mb-5"><p className="eyebrow">{portal}</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#203c2c]">{title}</h1><p className="mt-1 text-sm leading-5 text-[#718074]">{description}</p></div>
      {children}{role !== 'admin' && <Link to="/" className="mt-4 inline-block text-xs font-semibold text-[#789078] hover:underline">{t('auth.backHome')}</Link>}
    </div>
  </div></section>;
}
