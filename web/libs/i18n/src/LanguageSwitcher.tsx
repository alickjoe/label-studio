import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage, type SupportedLanguage } from "./LanguageProvider";

/**
 * A dropdown component for switching the application language.
 * Can be placed in navigation bars or settings panels.
 */
export function LanguageSwitcher({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { t } = useTranslation("common");
  const { currentLanguage, setLanguage, availableLanguages, languageNames } = useLanguage();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLanguage(e.target.value as SupportedLanguage);
    },
    [setLanguage],
  );

  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {showLabel && <span style={{ fontSize: 14 }}>{t("common:language")}:</span>}
      <select
        value={currentLanguage}
        onChange={handleChange}
        style={{
          padding: "4px 8px",
          borderRadius: 4,
          border: "1px solid #d9d9d9",
          fontSize: 14,
          cursor: "pointer",
          background: "transparent",
        }}
      >
        {availableLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {languageNames[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}
