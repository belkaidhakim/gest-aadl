import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, TranslationKey, translations } from './translations';

const LANG_STORAGE_KEY = 'gest_aadl_language';

interface LanguageContextValue {
  lang: Language;
  isRtl: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'ar' || saved === 'fr') return saved;
    }
    return 'fr';
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const setLang = (next: Language) => setLangState(next);
  const toggleLang = () => setLangState((prev) => (prev === 'fr' ? 'ar' : 'fr'));
  const t = (key: TranslationKey): string => translations[lang][key] || translations.fr[key];

  return (
    <LanguageContext.Provider value={{ lang, isRtl: lang === 'ar', setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'fr',
      isRtl: false,
      setLang: () => {},
      toggleLang: () => {},
      t: (key) => translations.fr[key],
    };
  }
  return ctx;
}
