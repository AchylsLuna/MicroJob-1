import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: { id: T; label: string; content: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const tabId = useId();
  const buttons = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});
  const current = tabs.some((tab) => tab.id === value) ? value : tabs[0]?.id;

  const navigate = (event: KeyboardEvent<HTMLButtonElement>, id: T) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const next = tabs[nextIndex].id;
    onChange(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className="min-w-0 space-y-6 break-words">
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white">
        {tabs.map((tab) => (
          <button key={tab.id} ref={(element) => { buttons.current[tab.id] = element; }} type="button" role="tab"
            id={`${tabId}-tab-${encodeURIComponent(tab.id)}`} aria-selected={current === tab.id} aria-controls={`${tabId}-panel-${encodeURIComponent(tab.id)}`}
            tabIndex={current === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={(event) => navigate(event, tab.id)}
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${current === tab.id ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {/* Keep drafts and native file selections mounted when switching tabs. */}
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${tabId}-panel-${encodeURIComponent(tab.id)}`} aria-labelledby={`${tabId}-tab-${encodeURIComponent(tab.id)}`}
          hidden={current !== tab.id} tabIndex={0} className="space-y-6 focus-visible:outline-brand">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
