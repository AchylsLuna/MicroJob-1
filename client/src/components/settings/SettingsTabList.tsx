import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

type TabOption<T extends string> = { id: T; label: string };

type SettingsTabListProps<T extends string> = {
  ariaLabel: string;
  idPrefix: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SettingsTabList<T extends string>({
  ariaLabel,
  idPrefix,
  options,
  value,
  onChange,
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

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2">
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
            className={`min-h-11 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C4D8D] focus-visible:ring-offset-2 ${
              selected
                ? "bg-[#1C4D8D]/[0.08] text-[#1C4D8D]"
                : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
