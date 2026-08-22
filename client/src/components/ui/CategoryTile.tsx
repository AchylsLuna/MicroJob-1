import { getCategoryVisual } from "../../lib/categoryVisuals";

type Size = "sm" | "md" | "lg";

const DIMENSIONS: Record<Size, { box: number; icon: number; radius: string }> = {
  sm: { box: 44, icon: 18, radius: "rounded-[14px]" },
  md: { box: 56, icon: 22, radius: "rounded-[14px]" },
  lg: { box: 96, icon: 26, radius: "rounded-2xl" },
};

type Props = {
  category?: { id?: string; name?: string } | string | null;
  size?: Size;
  showLabel?: boolean;
  count?: number;
  className?: string;
};

export function CategoryTile({ category, size = "md", showLabel = false, count, className }: Props) {
  const visual = getCategoryVisual(category);
  const dims = DIMENSIONS[size];
  const Icon = visual.icon;
  const name = typeof category === "string" ? undefined : category?.name;

  return (
    <div className={`flex flex-col items-center gap-1.5 ${showLabel ? "w-[116px]" : ""} ${className || ""}`}>
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center shadow-sm ${dims.radius}`}
        style={{
          width: dims.box,
          height: dims.box,
          backgroundColor: visual.fill,
        }}
      >
        <Icon size={dims.icon} color={visual.onFill} strokeWidth={2} />
      </div>
      {showLabel ? (
        <div className="flex flex-col items-center gap-0.5 text-center">
          {typeof count === "number" ? <span className="text-[18px] font-extrabold text-[#0F2954]">{count}</span> : null}
          {name ? <span className="text-[12px] font-semibold leading-tight text-[#475569] line-clamp-2">{name}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
