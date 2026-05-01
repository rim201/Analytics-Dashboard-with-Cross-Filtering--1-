import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { translations, type Lang, type Translations } from './translations';

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem('lang');
      return stored === 'fr' || stored === 'en' ? stored : 'fr';
    } catch {
      return 'fr';
    }
  });

  const toggleLang = useMemo(
    () => () => {
      setLang((l) => {
        const next: Lang = l === 'en' ? 'fr' : 'en';
        try {
          localStorage.setItem('lang', next);
        } catch {}
        return next;
      });
    },
    [],
  );

  const value = useMemo<LanguageContextType>(
    () => ({ lang, t: translations[lang], toggleLang }),
    [lang, toggleLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
