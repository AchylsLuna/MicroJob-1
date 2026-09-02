import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query in JS. Used where a component needs to branch its
 * *behavior* (not just its styling) on viewport size — e.g. choosing between
 * navigating to a full page versus updating in place. Pure styling should
 * still prefer Tailwind's responsive prefixes.
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
