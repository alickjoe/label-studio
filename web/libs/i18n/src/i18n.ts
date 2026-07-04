import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhCommon from "./locales/zh-CN/common.json";
import zhApp from "./locales/zh-CN/app.json";
import enCommon from "./locales/en/common.json";
import enApp from "./locales/en/app.json";

export const SUPPORTED_LANGUAGES = ["zh-CN", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "zh-CN";

/**
 * Normalize language codes from Django (zh-hans) to i18n format (zh-CN).
 */
function normalizeLanguage(lang: string): SupportedLanguage {
  if (lang === "zh-hans" || lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("en")) return "en";
  return DEFAULT_LANGUAGE;
}

const resources = {
  "zh-CN": {
    common: zhCommon,
    app: zhApp,
  },
  en: {
    common: enCommon,
    app: enApp,
  },
};

/**
 * Initialize i18next without React bindings.
 * Call this once at app startup, before rendering.
 */
export function initI18n(defaultLanguage?: string) {
  const lang = normalizeLanguage(defaultLanguage || getInitialLanguage());

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: lang,
      fallbackLng: "en",
      defaultNS: "app",
      ns: ["common", "app"],
      interpolation: {
        escapeValue: false, // React already escapes
      },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "i18nextLng",
      },
    });

  return i18n;
}

/**
 * Get the initial language from backend-provided APP_SETTINGS or fallback to browser.
 */
export function getInitialLanguage(): string {
  // Check backend-injected language preference (Django uses zh-hans, we normalize to zh-CN)
  if (typeof window !== "undefined" && window.APP_SETTINGS?.language) {
    return normalizeLanguage(window.APP_SETTINGS.language);
  }

  // Check localStorage cache
  if (typeof localStorage !== "undefined") {
    const cached = localStorage.getItem("i18nextLng");
    if (cached && SUPPORTED_LANGUAGES.includes(cached as SupportedLanguage)) {
      return cached;
    }
  }

  // Fallback to browser language
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language;
    if (browserLang.startsWith("zh")) return "zh-CN";
    if (browserLang.startsWith("en")) return "en";
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Persist language preference to backend API and localStorage.
 */
export async function persistLanguage(language: string): Promise<void> {
  // Convert to Django format (zh-hans) for the backend API
  const djangoLang = language === "zh-CN" ? "zh-hans" : language;
  localStorage.setItem("i18nextLng", language);

  try {
    await fetch("/api/current-user/language/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: djangoLang }),
    });
  } catch {
    // Silently fail - the language switch is still effective locally
  }
}

export default i18n;
