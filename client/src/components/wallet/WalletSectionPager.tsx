import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens, seconds } from "@/constants/motion";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { SettingsTabList } from "../settings/SettingsTabList";

export type WalletSection = {
  id: string;
  /** Tab label. The panel keeps its own heading, which is what the stacked layout reads by. */
  label: string;
  content: ReactNode;
};

type WalletSectionPagerProps = {
  sections: WalletSection[];
  /** Names the tablist and the two arrows for screen readers. */
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
  idPrefix?: string;
  /**
   * Optional controlled mode. Pass both to let the page drive which section is
   * showing -- the wallet needs it so its "Withdraw Funds" button can bring the
   * form's section forward before scrolling to it. Omit both and the pager
   * keeps its own state.
   */
  activeId?: string;
  onActiveIdChange?: (id: string) => void;
};

/**
 * Shows one wallet section at a time behind a tab strip, with arrows that fade
 * in on hover.
 *
 * Two things shape the implementation:
 *
 * Below `lg` it stacks instead of paging. A hover-revealed arrow does not
 * exist on a touch screen, so on a phone the other sections would simply be
 * undiscoverable. The switch is in JS rather than CSS on purpose -- rendering
 * both layouts and hiding one would put two copies of the withdrawal form in
 * the DOM, and with them two elements sharing every input id.
 *
 * It does not wrap. The left arrow is absent on the first section and the
 * right arrow on the last, so the ends of the sequence are visible rather than
 * something you discover by cycling past them.
 */
export function WalletSectionPager({
  sections,
  ariaLabel,
  previousLabel,
  nextLabel,
  idPrefix = "wallet-section",
  activeId,
  onActiveIdChange,
}: WalletSectionPagerProps) {
  const prefersReducedMotion = useReducedMotion();
  const isPaged = useMediaQuery("(min-width: 1024px)");
  const [uncontrolledId, setUncontrolledId] = useState<string>(sections[0]?.id ?? "");
  const currentId = activeId ?? uncontrolledId;
  const setCurrentId = (id: string) => {
    if (activeId === undefined) setUncontrolledId(id);
    onActiveIdChange?.(id);
  };
  // Derived, not stored: the section list changes with the signed-in role, and
  // a stored index would survive into a shorter list and point at nothing.
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === currentId));
  const [direction, setDirection] = useState(0);

  if (sections.length === 0) return null;

  if (!isPaged || sections.length < 2) {
    return <div className="space-y-6">{sections.map((section) => <div key={section.id}>{section.content}</div>)}</div>;
  }

  const active = sections[activeIndex];
  const previous = activeIndex > 0 ? sections[activeIndex - 1] : null;
  const next = activeIndex < sections.length - 1 ? sections[activeIndex + 1] : null;

  const goTo = (section: WalletSection, towards: number) => {
    setDirection(towards);
    setCurrentId(section.id);
  };

  const paneMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: direction >= 0 ? 16 : -16 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction >= 0 ? -16 : 16 },
        transition: { duration: seconds(motionTokens.duration.fast) },
      };

  // `pointer-events-none` travels with the hidden state: an arrow that is only
  // invisible still swallows clicks aimed at the card underneath it.
  const arrowClasses =
    "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 opacity-0 shadow-lg transition-opacity pointer-events-none hover:text-brand group-hover/pager:pointer-events-auto group-hover/pager:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200">
        <SettingsTabList
          ariaLabel={ariaLabel}
          idPrefix={idPrefix}
          options={sections.map(({ id, label }) => ({ id, label }))}
          value={active.id}
          onChange={(id) => {
            const target = sections.findIndex((section) => section.id === id);
            goTo(sections[target], target >= activeIndex ? 1 : -1);
          }}
          variant="underline"
        />
      </div>

      <div className="group/pager relative">
        <div
          id={`${idPrefix}-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-${active.id}`}
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 rounded-2xl"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={active.id} {...paneMotion}>
              {active.content}
            </motion.div>
          </AnimatePresence>
        </div>

        {previous ? (
          <button
            type="button"
            onClick={() => goTo(previous, -1)}
            className={`${arrowClasses} left-2`}
            aria-label={`${previousLabel}: ${previous.label}`}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}

        {next ? (
          <button
            type="button"
            onClick={() => goTo(next, 1)}
            className={`${arrowClasses} right-2`}
            aria-label={`${nextLabel}: ${next.label}`}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
