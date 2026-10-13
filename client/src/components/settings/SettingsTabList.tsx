import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

type TabOption<T extends string> = { id: T; label: string };

/**
 * `pill` is the original look and stays the default so Settings — the first
 * consumer — is unaffected. `underline` is the flatter, quieter treatment the
 * profile pages opt into. Both share one implementation so the keyboard and
 * ARIA behaviour below can never drift between two copies.
 */
type TabVariant = "pill" | "underline";

type SettingsTabListProps<T extends string> = {
  ariaLabel: string;
  idPrefix: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: TabVariant;
};

const VARIANT_CLASSES: Record<TabVariant, { list: string; base: string; selected: string; idle: string; focus: string }> = {
  pill: {
    list: "flex flex-wrap gap-2",
    base: "min-h-11 rounded-full px-4 py-2 text-body-sm font-semibold transition-colors",
    selected: "bg-brand/[0.08] text-brand",
    idle: "text-slate-500 hover:bg-slate-50",
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
  },
  underline: {
    // -mb-px pulls the tab's own border onto the container's bottom border so
    // the active underline sits flush with it instead of floating above.
    //
    // Scrolls rather than wraps. These tabs share one baseline, so a wrapped
    // second row lands *below* the container's bottom border and the border
    // reads as a rule struck through the middle of the list -- which is what
    // happened to Settings at 375px, where (unlike the wallet pager, which only
    // shows tabs from `lg` up) this strip is on screen at every width.
    list: "-mb-px flex gap-6 overflow-x-auto",
    base: "min-h-11 shrink-0 whitespace-nowrap border-b-2 px-1 pb-3 text-body font-semibold transition-colors",
    selected: "border-brand text-brand",
    idle: "border-transparent text-slate-500 hover:text-slate-900",
    // Inset: an offset ring would be clipped by the scroll container above.
    focus: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
  },
};

export function SettingsTabList<T extends string>({
  ariaLabel,
  idPrefix,
  options,
  value,
  onChange,
  variant = "pill",
}: SettingsTabListProps<T>) {
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());
  const pendingFocusRef = useRef<T | null>(null);

  useLayoutEffect(() => {
    if (pendingFocusRef.current !== value) return;
    tabRefs.current.get(value)?.focus();
    pendingFocusRef.current = null;
  }, [value]);

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else return;

    event.preventDefault();
    const nextTab = options[nextIndex];
    if (nextTab.id === value) {
      tabRefs.current.get(nextTab.id)?.focus();
      return;
    }
    pendingFocusRef.current = nextTab.id;
    onChange(nextTab.id);
  };

  const styles = VARIANT_CLASSES[variant];

  return (
    <div role="tablist" aria-label={ariaLabel} className={styles.list}>
      {options.map((tab, index) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.id, node);
              else tabRefs.current.delete(tab.id);
            }}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => moveFocus(event, index)}
            className={`${styles.base} ${styles.focus} ${
              selected ? styles.selected : styles.idle
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
