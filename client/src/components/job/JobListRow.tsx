import { Bookmark, Clock, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens, seconds } from "@/constants/motion";
import { CategoryTile } from "../ui/CategoryTile";
import { MatchBadge } from "./MatchBadge";
import type { JobCardData } from "./jobCardModel";
import { useTranslation } from "react-i18next";
import verifiedBadgeUrl from "../../assets/verified-badge.svg";

type Props = {
  job: JobCardData;
  selected?: boolean;
  saved?: boolean;
  applicationStatus?: string;
  onPress: () => void;
  onToggleSave?: () => void;
  index?: number;
};

/**
 * A compact row for the left column of split-pane Find Jobs. This is the only
 * job-list presentation the web client has now that the worker dashboard (and
 * with it the taller grid-cell `JobCard`) is gone; mobile still has its own
 * `JobCard` for the same data shape.
 */
export function JobListRow({ job, selected, saved, applicationStatus, onPress, onToggleSave, index = 0 }: Props) {
  const { t } = useTranslation("worker");
  const prefersReducedMotion = useReducedMotion();

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPress();
    }
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={handleKeyDown}
      aria-current={selected ? "true" : undefined}
      aria-label={`View ${job.title}${job.location ? ` in ${job.location}` : ""}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: seconds(motionTokens.duration.fast) }}
      className={`group flex cursor-pointer items-start gap-3 rounded-xl border-l-2 p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        job.highlighted
          ? "border-l-amber-500 bg-amber-50 hover:bg-amber-100/70"
          : selected
            ? "border-l-[#1C4D8D] bg-[#EAF1FB]"
            : "border-l-transparent bg-white hover:bg-slate-50"
      }`}
    >
      <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="sm" />
      <div className="min-w-0 flex-1">
        {job.highlighted ? (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800">
            {t("findJobs.card.highlightedByEmployer")}
          </p>
        ) : null}
        <p className="line-clamp-1 text-[14px] font-bold leading-tight text-slate-950 group-hover:text-blue-700">
          {job.title}
          {job.urgent ? <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 align-middle">Urgent</span> : null}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] text-slate-500">
          <span className="truncate">{job.posterName}</span>
          {job.employerVerified ? (
            <span
              role="img"
              aria-label={t("findJobs.card.verifiedEmployer")}
              className="group/verification relative inline-flex shrink-0"
            >
              <img src={verifiedBadgeUrl} alt="" aria-hidden="true" className="h-3.5 w-3.5" />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-56 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/verification:opacity-100"
              >
                {t("findJobs.card.verifiedEmployerTooltip")}
              </span>
            </span>
          ) : null}
        </p>
        {/* Only recommendation results carry a match; ordinary search results
            leave these undefined and render no badge. */}
        {job.matchLevel && typeof job.matchPercentage === "number" ? (
          <div className="mt-1.5">
            <MatchBadge percentage={job.matchPercentage} level={job.matchLevel} />
          </div>
        ) : null}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
          {job.jobType ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {job.jobType}
            </span>
          ) : null}
          {job.location ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{job.location}</span>
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] font-bold text-slate-950">{job.salaryLabel}</p>
        {applicationStatus ? (
          <div className={`mt-2 rounded-lg px-2.5 py-2 text-[11px] font-bold ${
            applicationStatus === "Rejected"
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}>
            <span className="block">
              {applicationStatus === "Applied"
                ? t("findJobs.card.alreadyApplied")
                : applicationStatus === "Rejected"
                  ? t("findJobs.card.applicationRejected")
                  : applicationStatus}
            </span>
          </div>
        ) : null}
      </div>
      {onToggleSave ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSave();
          }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
            saved ? "bg-white/85 hover:bg-white" : "bg-slate-100 hover:bg-slate-200"
          }`}
          aria-label={saved ? "Remove from saved jobs" : "Save job"}
          aria-pressed={Boolean(saved)}
        >
          <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-[#1C4D8D] text-[#1C4D8D]" : "text-slate-500"}`} />
        </button>
      ) : null}
    </motion.div>
  );
}
