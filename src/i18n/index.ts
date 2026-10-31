import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en.json';
import translationHI from './locales/hi.json';
import translationTA from './locales/ta.json';
import translationTE from './locales/te.json';

const resources = {
  en: translationEN,
  hi: translationHI,
  ta: translationTA,
  te: translationTE,
};

const applyDocumentLanguage = (language: string) => {
  const code = language.split('-')[0];
  document.documentElement.lang = code;
  document.documentElement.dir = 'ltr';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: Object.keys(resources),
    load: 'languageOnly',
    cleanCode: true,
    detection: { caches: ['localStorage'], lookupLocalStorage: 'cropsense-language' },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language ?? 'en');
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
