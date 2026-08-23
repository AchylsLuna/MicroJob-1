import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import i18n from "../i18n";

// Web uses the ISO code "tl" (Tagalog) for the second language. The mobile app
// uses "fil" (Filipino) instead, since that's what expo-localization reports on
// a Filipino-locale device. Nothing on either platform compares these codes
// against each other, so this is an intentional difference — don't unify it
// into a shared constant.
export type Language = "en" | "tl";

const LANGUAGE_STORAGE_KEY = "microjobs_language";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "en" || stored === "tl") return stored;
  } catch {
    // localStorage unavailable (e.g. private browsing) — fall back to default
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const initial = readStoredLanguage();
    i18n.changeLanguage(initial);
    return initial;
  });

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    i18n.changeLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // best-effort persistence only
    }
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
