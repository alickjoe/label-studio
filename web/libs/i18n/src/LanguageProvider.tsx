import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage, DEFAULT_LANGUAGE, persistLanguage } from "./i18n";

interface LanguageContextValue {
  currentLanguage: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  availableLanguages: readonly SupportedLanguage[];
  languageNames: Record<SupportedLanguage, string>;
}

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  "zh-CN": "简体中文",
  en: "English",
};

const LanguageContext = createContext<LanguageContextValue>({
  currentLanguage: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  availableLanguages: SUPPORTED_LANGUAGES,
  languageNames: LANGUAGE_NAMES,
});

/**
 * Provider that manages the current language and syncs with i18next.
 */
export function LanguageProvider({ children, defaultLanguage }: { children: ReactNode; defaultLanguage?: string }) {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    (defaultLanguage || i18n.language || DEFAULT_LANGUAGE) as SupportedLanguage,
  );

  useEffect(() => {
    const lang = (defaultLanguage || i18n.language || DEFAULT_LANGUAGE) as SupportedLanguage;
    if (lang !== currentLanguage) {
      setCurrentLanguage(lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    setCurrentLanguage(lang);
    document.documentElement.lang = lang;
    persistLanguage(lang);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      currentLanguage,
      setLanguage,
      availableLanguages: SUPPORTED_LANGUAGES,
      languageNames: LANGUAGE_NAMES,
    }),
    [currentLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Hook to access language context (current language, switch function).
 */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
