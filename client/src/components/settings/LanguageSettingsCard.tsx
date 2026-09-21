import { ChevronDown, Languages } from "lucide-react";
import { useLanguage, type Language } from "../../hooks/useLanguage";

/** A compact account preference shown in the Settings page header. */
export function LanguageSettingsCard() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="w-full sm:w-[180px]">
      <label htmlFor="settings-language" className="sr-only">Language</label>
      <div className="relative">
        <Languages
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1C4D8D]"
          aria-hidden="true"
        />
        <select
          id="settings-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
          className="w-full cursor-pointer appearance-none rounded-[10px] border border-slate-200 bg-white py-3 pl-10 pr-10 text-[14px] font-medium text-slate-900 outline-none transition-all hover:border-[#1C4D8D] focus:border-transparent focus:ring-2 focus:ring-[#1C4D8D]"
        >
          <option value="en">English (US)</option>
          <option value="tl">Filipino</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
