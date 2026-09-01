import { useTranslation } from "react-i18next";
import { useLanguage, type Language } from "../../hooks/useLanguage";
import { Card } from "../ui";

/** Moved here from the NavBar account dropdown — a display preference belongs
 * in Settings, not in the sign-out menu. Shared across every role, since the
 * "personal" account tab this renders in is the one panel worker, employer,
 * and admin all land on. */
export function LanguageSettingsCard() {
  const { t } = useTranslation("common");
  const { language, setLanguage } = useLanguage();

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">{t("language.label")}</h2>
      <div className="mt-4 flex max-w-xs gap-2">
        <button
          type="button"
          onClick={() => setLanguage("en" as Language)}
          aria-pressed={language === "en"}
          className={`min-h-9 flex-1 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] ${language === "en" ? "border-[#1C4D8D] bg-[#EAF1FB] text-[#1C4D8D]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          {t("language.english")}
        </button>
        <button
          type="button"
          onClick={() => setLanguage("tl" as Language)}
          aria-pressed={language === "tl"}
          className={`min-h-9 flex-1 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] ${language === "tl" ? "border-[#1C4D8D] bg-[#EAF1FB] text-[#1C4D8D]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          {t("language.filipino")}
        </button>
      </div>
    </Card>
  );
}
