import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import * as Localization from 'expo-localization';
import storage from '../lib/storage';
import i18n from '../i18n';

// Mobile uses the code "fil" (Filipino) for the second language, since that's
// what expo-localization reports on a Filipino-locale device. The web app uses
// the ISO code "tl" (Tagalog) instead. Nothing on either platform compares these
// codes against each other, so this is an intentional difference — don't unify
// it into a shared constant.
export type Language = 'en' | 'fil';

const LANGUAGE_STORAGE_KEY = 'microjobs_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectDeviceLanguage(): Language {
  try {
    const deviceLocale = Localization.getLocales()[0]?.languageCode;
    if (deviceLocale === 'fil') return 'fil';
  } catch {
    // Localization unavailable — fall back to default
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolved: Language = 'en';
      try {
        const stored = await storage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored === 'en' || stored === 'fil') {
          resolved = stored;
        } else {
          resolved = detectDeviceLanguage();
          await storage.setItem(LANGUAGE_STORAGE_KEY, resolved);
        }
      } catch {
        resolved = detectDeviceLanguage();
      }
      if (cancelled) return;
      i18n.changeLanguage(resolved);
      setLanguageState(resolved);
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    i18n.changeLanguage(next);
    storage.setItem(LANGUAGE_STORAGE_KEY, next).catch(() => {
      // best-effort persistence only
    });
  }, []);

  const value = useMemo<LanguageContextType>(
    () => ({ language, setLanguage, isReady }),
    [language, setLanguage, isReady],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
