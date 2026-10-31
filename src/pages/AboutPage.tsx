import { ArrowUpRight, Cpu, UsersRound, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import cropsenseMark from '../assets/cropsense-mark.png';
import HardwarePromo from '../components/HardwarePromo';

const team = [
  { name: 'Manoj P', designation: 'about.team.manoj.designation', role: 'about.team.manoj.role', focus: 'about.team.manoj.focus', initials: 'MP', Icon: Cpu, tone: 'bg-[#e8f1df] text-[#326346]', featured: true },
  { name: 'Abdul Basheeruddin R', designation: 'about.team.abdul.designation', focus: 'about.team.abdul.focus', initials: 'AB', Icon: UsersRound, tone: 'bg-[#f2ead7] text-[#87672d]' },
  { name: 'Hariharan B', designation: 'about.team.hariharan.designation', focus: 'about.team.hariharan.focus', initials: 'HB', Icon: Waves, tone: 'bg-[#e0eeeb] text-[#377467]' },
];

export default function AboutPage() {
  const { t } = useTranslation();
  const ventures = ['cropTrackers', 'cropVision', 'cropSense'] as const;
  return <main className="about-page page-enter">
    <section className="about-hero">
      <div className="section-wrap about-hero-grid">
        <div className="max-w-3xl"><p className="eyebrow">{t('about.eyebrow')}</p><h1 className="display-title mt-4 text-4xl text-[#193c2d] sm:text-6xl">{t('about.smartTitle')}</h1><p className="mt-6 text-base leading-8 text-[#5e7063] sm:text-lg">{t('about.smartIntro')}</p></div>
        <div className="about-mark" aria-hidden="true"><div className="about-mark-ring"><img src={cropsenseMark} alt="" className="h-20 w-20 object-contain" /></div><span>SMART<br />FARM LABS</span><i className="about-orbit about-orbit-one" /><i className="about-orbit about-orbit-two" /></div>
      </div>
    </section>
    <div className="section-wrap max-w-6xl py-14 sm:py-20">
      <section className="about-cropsense surface-card p-6 sm:p-10"><div className="about-current-badge"><span className="h-2 w-2 rounded-full bg-[#80aa54]" />{t('about.currentPlatform')}</div><h2 className="display-title mt-5 text-3xl text-[#193c2d] sm:text-4xl">{t('about.cropSenseTitle')}</h2><p className="mt-4 max-w-3xl leading-7 text-[#647468]">{t('about.cropSenseIntro')}</p><div className="mt-6 flex flex-wrap gap-2">{['NPK', 'pH', t('form.fields.soil_moisture'), t('about.environmentalReadings')].map((item) => <span key={item} className="rounded-full border border-[#e2e9df] bg-[#f7f9f3] px-3 py-1.5 text-xs font-bold text-[#45634c]">{item}</span>)}</div></section>
      <div className="mt-6"><HardwarePromo compact /></div>
      <section className="mt-16"><div className="max-w-2xl"><p className="eyebrow">{t('about.peopleEyebrow')}</p><h2 className="display-title mt-3 text-3xl text-[#193c2d] sm:text-4xl">{t('about.teamTitle')}</h2><p className="mt-3 leading-7 text-[#647468]">{t('about.teamIntro')}</p></div><div className="mt-7 grid gap-4 md:grid-cols-3">{team.map(({ name, designation, role, focus, initials, Icon, tone, featured }) => <article className={`team-card surface-card p-6 ${featured ? 'border-[#c9d9bd] ring-1 ring-[#c9d9bd]' : ''}`} key={name}><div className="flex items-center justify-between"><span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-6 w-6" /></span><span className="text-xs font-extrabold tracking-[.16em] text-[#9aa697]">{initials}</span></div><h3 className="mt-5 text-lg font-extrabold text-[#203c2c]">{name}</h3><p className="mt-1 text-sm font-bold leading-5 text-[#5a8150]">{t(designation)}</p>{role && <p className="mt-1 text-xs font-semibold leading-5 text-[#526657]">{t('about.teamRoleLabel')}: {t(role)}</p>}<p className="mt-3 text-sm leading-6 text-[#6c796e]">{t(focus)}</p></article>)}</div></section>
      <section className="mt-16"><p className="eyebrow">{t('about.ecosystemEyebrow')}</p><h2 className="display-title mt-3 text-3xl text-[#193c2d] sm:text-4xl">{t('about.ecosystemTitle')}</h2><div className="ecosystem-line mt-7 grid gap-4 md:grid-cols-3">{ventures.map((key, index) => <article key={key} className={`venture-card surface-card p-6 ${key === 'cropSense' ? 'venture-current' : ''}`}><div className="flex items-center justify-between"><span className="text-xs font-black tracking-[.2em] text-[#8aa17c]">0{index + 1}</span>{key === 'cropSense' && <span className="rounded-full bg-[#e7f1dc] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#376443]">{t('about.currentPlatform')}</span>}</div><h3 className="mt-5 text-xl font-extrabold text-[#203c2c]">{t(`about.ventures.${key}.name`)}</h3><p className="mt-2 text-xs font-extrabold uppercase tracking-[.11em] text-[#648455]">{t(`about.ventures.${key}.focus`)}</p><p className="mt-4 text-sm leading-6 text-[#6c796e]">{t(`about.ventures.${key}.description`)}</p></article>)}</div></section>
      <section className="support-card mt-14 flex flex-col justify-between gap-5 rounded-[26px] p-6 sm:flex-row sm:items-center sm:p-9"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#d7e8bd]">{t('about.supportEyebrow')}</p><h2 className="mt-2 text-2xl font-extrabold text-white">{t('about.supportTitle')}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#e0eadc]">{t('about.supportDescription')}</p></div><a className="support-link" href="mailto:cropsensevit@gmail.com">{t('about.contactTeam')}<ArrowUpRight className="h-4 w-4" /></a></section>
    </div>
  </main>;
}
