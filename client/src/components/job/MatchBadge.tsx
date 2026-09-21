import { useTranslation } from "react-i18next";

/**
 * The match quality the recommendation endpoint reports for a job.
 *
 * Both values come straight from the server (`scoreJobForWorker` in
 * `server/lib/jobMatching.js`), which owns the thresholds: Excellent >= 80,
 * Strong >= 60, Good >= 40, Potential below that. Nothing is recomputed here --
 * a second copy of those cutoffs on the client would silently disagree the
 * first time the server's tuning changed.
 *
 * Note this is a different concept from the "match" shown in
 * employer/JobsManagement.tsx, which derives a percentage from applicant count
 * rather than any profile comparison. The two must not be conflated.
 */
type Props = {
  percentage: number;
  /** The server's English level string, mapped to a translation key below. */
  level: string;
};

// The server sends its level as display-ready English. Rendering that directly
// would leave the badge untranslated, so map the known values onto keys and
// fall back to the neutral one if the server ever adds a level.
const LEVEL_KEYS: Record<string, string> = {
  "Excellent match": "excellent",
  "Strong match": "strong",
  "Good match": "good",
  "Potential match": "potential",
};

export function MatchBadge({ percentage, level }: Props) {
  const { t } = useTranslation("worker");
  const levelKey = LEVEL_KEYS[level] || "potential";
  const strong = percentage >= 60;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        strong ? "bg-[#EAF1FB] text-[#1C4D8D]" : "bg-slate-100 text-slate-600"
      }`}
    >
      {t(`findJobs.recommended.level.${levelKey}`)}
      <span aria-hidden="true">·</span>
      {t("findJobs.recommended.percentage", { percentage })}
    </span>
  );
}
