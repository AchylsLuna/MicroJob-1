import { useEffect, useRef, useState, type RefObject } from "react";

interface UseHideOnScrollOptions {
  /**
   * Distance (px) from the top of the container that always counts as
   * "near the top" — the header shows regardless of scroll direction so it
   * never flickers hidden right after the very first tick of scroll.
   */
  threshold?: number;
  /** Minimum scroll delta (px) between frames before a direction registers as intentional. */
  deltaThreshold?: number;
  /** When true, the header never hides — used to honor reduced-motion / open menus. */
  disabled?: boolean;
}

/**
 * Tracks scroll direction on a specific scrollable container (not
 * window/document — this app's dashboard shell scrolls an inner div, see
 * `webUi.layout.content`) and reports whether a sticky header above it
 * should be hidden.
 *
 * Scroll position is sampled with `requestAnimationFrame`, not on every raw
 * `scroll` event, to avoid layout thrash while scrolling long lists.
 */
export function useHideOnScroll(
  scrollContainerRef: RefObject<HTMLElement | null>,
  { threshold = 24, deltaThreshold = 4, disabled = false }: UseHideOnScrollOptions = {},
) {
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollTopRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (disabled) {
      setIsHidden(false);
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    lastScrollTopRef.current = container.scrollTop;

    const measure = () => {
      frameRef.current = null;
      const currentScrollTop = container.scrollTop;
      const lastScrollTop = lastScrollTopRef.current;
      const delta = currentScrollTop - lastScrollTop;

      if (currentScrollTop <= threshold) {
        setIsHidden(false);
      } else if (delta > deltaThreshold) {
        setIsHidden(true);
      } else if (delta < -deltaThreshold) {
        setIsHidden(false);
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    const handleScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(measure);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scrollContainerRef, threshold, deltaThreshold, disabled]);

  return isHidden;
}
