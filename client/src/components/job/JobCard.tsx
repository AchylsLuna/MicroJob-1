import { motion, useReducedMotion } from "motion/react";
import { Bookmark, Clock, MapPin, Star } from "lucide-react";
import { CategoryTile } from "../ui/CategoryTile";
import type { JobCardData } from "./jobCardModel";

type Variant = "carousel" | "list" | "compact";

type Props = {
  job: JobCardData;
  variant: Variant;
  saved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
  showMatch?: boolean;
  index?: number;
  footerSlot?: React.ReactNode;
  className?: string;
};

function BookmarkButton({ saved, onToggleSave, onFill }: { saved?: boolean; onToggleSave?: () => void; onFill?: boolean }) {
  if (!onToggleSave) return null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleSave();
      }}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
        onFill ? "bg-white/85 hover:bg-white" : "bg-slate-100 hover:bg-slate-200"
      }`}
      aria-label={saved ? "Remove from saved jobs" : "Save job"}
      aria-pressed={Boolean(saved)}
    >
      <Bookmark className={`h-4 w-4 ${saved ? "fill-[#1C4D8D] text-[#1C4D8D]" : "text-slate-500"}`} />
    </button>
  );
}

export function JobCard({ job, variant, saved, onPress, onToggleSave, showMatch = false, index = 0, footerSlot, className }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPress();
    }
  };

  const motionProps = {
    initial: prefersReducedMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: Math.min(index, 8) * 0.04, duration: 0.3 },
  };

  if (variant === "carousel") {
    return (
      <motion.div
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={handleKeyDown}
        className={`group shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${className || "w-[260px]"}`}
        aria-label={`View ${job.title}`}
        {...motionProps}
      >
        <div className="relative flex h-32 w-full items-center justify-center bg-[#EAF1FB]">
          <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="lg" />
          {job.categoryName ? (
            <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/45 px-2.5 py-1 text-[11px] font-bold text-white">
              {job.categoryName}
            </span>
          ) : null}
          {job.urgent ? (
            <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white">Urgent</span>
          ) : null}
          <div className="absolute right-3 top-3">
            <BookmarkButton saved={saved} onToggleSave={onToggleSave} onFill />
          </div>
        </div>
        <div className="space-y-0.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="line-clamp-1 text-[15px] font-bold text-slate-950">{job.title}</h3>
            {showMatch && typeof job.matchPercentage === "number" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EAF1FB] px-2 py-0.5 text-[11px] font-bold text-[#1C4D8D]">
                <Star className="h-3 w-3" /> {job.matchPercentage}%
              </span>
            ) : null}
          </div>
          <p className="line-clamp-1 text-[12px] text-slate-500">{job.posterName}</p>
          <p className="pt-1 text-[14px] font-bold text-[#1C4D8D]">{job.salaryLabel}</p>
        </div>
      </motion.div>
    );
  }

  if (variant === "compact") {
    return (
      <motion.div
        role="button"
        tabIndex={0}
        onClick={onPress}
        onKeyDown={handleKeyDown}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${className || ""}`}
        aria-label={`View ${job.title}`}
        {...motionProps}
      >
        <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[14px] font-semibold text-slate-900">{job.title}</p>
          <p className="line-clamp-1 text-[12px] text-slate-500">
            {job.location}
            {job.location && job.salaryLabel ? " · " : ""}
            {job.salaryLabel}
          </p>
        </div>
        {footerSlot}
      </motion.div>
    );
  }

  // variant === "list"
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={handleKeyDown}
      className={`group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:p-6 ${className || ""}`}
      aria-label={`View ${job.title}${job.location ? ` in ${job.location}` : ""}`}
      {...motionProps}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <CategoryTile category={{ id: job.categoryId, name: job.categoryName }} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="line-clamp-1 text-lg font-bold leading-tight text-slate-950 group-hover:text-blue-700">
                {job.title}
              </h3>
              {job.urgent ? (
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Urgent</span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-slate-500">{job.posterName}</p>
            {showMatch && typeof job.matchPercentage === "number" ? (
              <p className="mt-0.5 text-[12px] font-semibold text-[#1C4D8D]">
                {job.matchPercentage}% Match{job.matchLevel ? ` · ${job.matchLevel}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <BookmarkButton saved={saved} onToggleSave={onToggleSave} />
      </div>

      {job.skills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {job.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded-full bg-[#EAF1FB] px-3 py-1 text-[11px] font-semibold text-[#1C4D8D]">
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          {job.jobType ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-slate-500">
              <Clock className="h-3.5 w-3.5" /> {job.jobType}
            </span>
          ) : null}
          {job.location ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{job.location}</span>
            </span>
          ) : null}
        </div>
        <p className="shrink-0 text-[15px] font-bold text-slate-950">{job.salaryLabel}</p>
      </div>
      {footerSlot}
    </motion.div>
  );
}
