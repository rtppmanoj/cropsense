import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'te', name: 'Telugu', nativeName: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41' },
  { code: 'ta', name: 'Tamil', nativeName: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd' },
];

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const activeCode = (i18n.resolvedLanguage ?? i18n.language).split('-')[0];
  const active = languages.find((language) => language.code === activeCode) ?? languages[0];

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, []);

  const select = (code: string) => { void i18n.changeLanguage(code); setOpen(false); };
  return <div className="relative z-[60]" ref={container}>
    <button type="button" className="language-trigger" aria-label={`${t('nav.language', 'Language')}: ${active.name}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Globe aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{active.code.toUpperCase()}</span><ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="language-menu max-h-[min(70vh,560px)] overflow-y-auto" role="listbox" aria-label={t('nav.language', 'Choose language')}>
      {languages.map((language) => <button key={language.code} type="button" role="option" aria-selected={active.code === language.code} className="language-option" onClick={() => select(language.code)}>
        <span className="min-w-0"><span className="block font-semibold">{language.nativeName}</span><span className="mt-0.5 block text-xs text-[#829082]">{language.name}</span></span>
        {active.code === language.code && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#4c7b43]" />}
      </button>)}
    </div>}
  </div>;
}
