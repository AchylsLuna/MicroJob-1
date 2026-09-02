import { Bookmark, Clock, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CategoryTile } from "../ui/CategoryTile";
import type { JobCardData } from "./jobCardModel";

type Props = {
  job: JobCardData;
  selected?: boolean;
  saved?: boolean;
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
export function JobListRow({ job, selected, saved, onPress, onToggleSave, index = 0 }: Props) {
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
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.2 }}
      className={`group flex cursor-pointer items-start gap-3 rounded-xl border-l-2 p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        selected ? "border-l-[#1C4D8D] bg-[#EAF1FB]" : "border-l-transparent bg-white hover:bg-slate-50"
      }`}
    >
      <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[14px] font-bold leading-tight text-slate-950 group-hover:text-blue-700">
          {job.title}
          {job.urgent ? <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 align-middle">Urgent</span> : null}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">{job.posterName}</p>
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
