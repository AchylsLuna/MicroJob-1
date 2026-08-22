import { ArrowUpRight } from "lucide-react";

type Props = {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  className?: string;
};

export function SectionHeader({ title, onSeeAll, seeAllLabel = "See all", className }: Props) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className || ""}`}>
      <h2 className="text-xl font-extrabold tracking-tight text-[#0F2954]">{title}</h2>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-bold text-[#1C4D8D] transition hover:opacity-80"
        >
          {seeAllLabel}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
