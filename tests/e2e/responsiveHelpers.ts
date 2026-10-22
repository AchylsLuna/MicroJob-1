import { expect, type Page } from "@playwright/test";

/**
 * Geometric assertions for the responsive audit.
 *
 * The existing specs check `scrollWidth <= innerWidth`, which only catches
 * overflow that produces a horizontal scrollbar. It says nothing about an
 * element that sits *on top of* another -- and `.dashboard-scope` sets
 * `overflow-x: clip`, so on dashboard routes overflow is hidden rather than
 * reported, making the scrollWidth check blind there by construction. These
 * helpers assert against element rectangles and hit-testing instead.
 */

export const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[role="tab"]',
  '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** No horizontal scrollbar on the document. */
export async function expectNoHorizontalScroll(page: Page, context: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `${context}: document scrolls horizontally (${overflow.scrollWidth}px of content in ${overflow.clientWidth}px)`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/**
 * No visible element extends past the right edge of the viewport.
 *
 * Catches what the scrollWidth check cannot: content clipped by an
 * `overflow: clip`/`hidden` ancestor is invisible to scrollWidth but is still
 * unreachable to the user.
 */
export async function expectNothingOverflowsViewport(page: Page, context: string) {
  const offenders = await page.evaluate((selector) => {
    const viewportWidth = document.documentElement.clientWidth;
    const results: Array<{ tag: string; text: string; right: number; left: number }> = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;
      // A horizontally scrollable ancestor (the admin table wrappers) is the
      // supported way to present wide content -- its children are reachable by
      // scrolling that container, so they are not overflow bugs.
      let ancestor: HTMLElement | null = element.parentElement;
      let insideScroller = false;
      while (ancestor) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") { insideScroller = true; break; }
        ancestor = ancestor.parentElement;
      }
      if (insideScroller) continue;
      if (rect.right > viewportWidth + 1 || rect.left < -1) {
        results.push({
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || "").trim().slice(0, 40),
          right: Math.round(rect.right),
          left: Math.round(rect.left),
        });
      }
    }
    return results.slice(0, 8);
  }, INTERACTIVE_SELECTOR);

  expect(
    offenders,
    `${context}: interactive elements extend outside the viewport:\n${JSON.stringify(offenders, null, 2)}`,
  ).toEqual([]);
}

/**
 * Every visible interactive element is actually hittable at its centre.
 *
 * Hit-testing rather than pairwise rect intersection: nested interactive
 * elements overlap legitimately all the time, so intersection produces mostly
 * false positives. `elementFromPoint` answers the question that matters --
 * if the user taps this control, do they get this control? That is exactly the
 * failure mode for a control hidden behind fixed chrome (a bottom tab bar, a
 * cookie banner, a toast).
 */
export async function expectInteractiveElementsReachable(page: Page, context: string, scope = "body") {
  // Two passes, because "covered at the current scroll position" is not the
  // same as "unreachable". Fixed chrome -- a bottom tab bar, the cookie banner
  // -- permanently occupies a band of the viewport, so anything that happens to
  // sit in that band right now is flagged by a single pass even though the user
  // can simply scroll it out. The second pass scrolls each candidate to the
  // middle of the viewport, away from both bands, and re-tests. Whatever is
  // still covered there is genuinely unreachable: either the scroll container
  // does not reserve room for the chrome (so the element cannot reach the
  // middle), or something is sitting on top of it regardless of scrolling.
  const covered = await page.evaluate(
    ({ selector, scopeSelector }) => {
      const root = document.querySelector(scopeSelector);
      if (!root) return [];
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      const describe = (node: Element) => {
        const tag = node.tagName.toLowerCase();
        const cls = node.className && typeof node.className === "string" ? node.className : "";
        return `${tag}${cls ? `.${cls.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`;
      };
      const label = (element: HTMLElement) =>
        element.getAttribute("aria-label") ||
        (element.textContent || "").trim().slice(0, 40) ||
        element.getAttribute("placeholder") ||
        "(no label)";

      // A backdrop is a full-bleed click-catcher sitting *behind* the panel it
      // dismisses, so its centre is covered by that panel by design. Judging it
      // as an unreachable control is a false positive -- the user dismisses it
      // by tapping the margins, which is the whole point of the pattern.
      const isBackdrop = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= viewportWidth * 0.9 && rect.height >= viewportHeight * 0.9;
      };

      const isObscured = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        if (x < 0 || y < 0 || x > viewportWidth || y > viewportHeight) return null;
        const hit = document.elementFromPoint(x, y);
        if (!hit) return null;
        if (hit === element || element.contains(hit) || hit.contains(element)) return null;
        return { hit, x, y };
      };

      // Pass 1 -- everything obscured where it currently sits.
      const candidates: HTMLElement[] = [];
      for (const element of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
        const rect = element.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") continue;
        if (Number(style.opacity) === 0) continue;
        if (isBackdrop(element)) continue;
        if (isObscured(element)) candidates.push(element);
      }

      // Pass 2 -- scroll each to the middle and see whether it is still
      // obscured there.
      const results: Array<{ tag: string; label: string; coveredBy: string; at: string }> = [];
      const scrollTop = window.scrollY;
      for (const element of candidates) {
        // Try more than one resting place. Centring is the usual way to get
        // clear of chrome pinned to the top and bottom, but it stops working
        // when that chrome is tall relative to the viewport -- in landscape on
        // a phone the tab bar plus the cookie banner can own most of the
        // height, so the centre of the viewport is itself covered. If any
        // alignment leaves the element exposed, the user can reach it.
        let still: ReturnType<typeof isObscured> = null;
        for (const block of ["center", "start", "end"] as const) {
          element.scrollIntoView({ block, inline: "nearest", behavior: "instant" as ScrollBehavior });
          still = isObscured(element);
          if (!still) break;
        }

        // One more probe. `block: "start"` aligns the element with the top of
        // its scrollport, which a sticky header sits on top of -- so on a short
        // viewport, where the only clear band is the strip between that header
        // and the bottom chrome, none of the three alignments lands in it.
        // Nudging the scroll container back by a header's worth walks the
        // element down into that strip.
        if (still) {
          let scroller: HTMLElement | null = element.parentElement;
          while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement;
          if (scroller) {
            element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" as ScrollBehavior });
            for (const nudge of [64, 96, 128]) {
              scroller.scrollTop -= nudge;
              still = isObscured(element);
              if (!still) break;
            }
          }
        }
        if (!still) continue;
        results.push({
          tag: element.tagName.toLowerCase(),
          label: label(element),
          coveredBy: describe(still.hit),
          at: `${Math.round(still.x)},${Math.round(still.y)}`,
        });
        if (results.length >= 8) break;
      }
      window.scrollTo({ top: scrollTop, behavior: "instant" as ScrollBehavior });
      return results;
    },
    { selector: INTERACTIVE_SELECTOR, scopeSelector: scope },
  );

  expect(
    covered,
    `${context}: interactive elements are covered by something else:\n${JSON.stringify(covered, null, 2)}`,
  ).toEqual([]);
}

/**
 * Touch targets are tall enough to hit and wide enough to distinguish.
 *
 * The two floors are deliberately different, and the docblock used to claim a
 * flat "44px minimum" that the code never enforced:
 *   - height >= 44px, the Apple HIG thumb target. This is the axis that
 *     actually goes wrong here -- controls end up short, not narrow.
 *   - width >= 24px, the WCAG 2.2 AA minimum. A lower bar on purpose: plenty
 *     of legitimate controls are naturally narrow (an icon button in a toolbar,
 *     a single-character stepper) and forcing 44px across would distort them.
 */
export async function expectAdequateTapTargets(page: Page, context: string) {
  const small = await page.evaluate((selector) => {
    const results: Array<{ tag: string; label: string; size: string }> = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") continue;
      // Inline links inside a paragraph are not tap targets in the button
      // sense; the 44px rule is about discrete controls.
      if (element.tagName === "A" && element.closest("p")) continue;
      if (rect.height < 44 || rect.width < 24) {
        results.push({
          tag: element.tagName.toLowerCase(),
          label: element.getAttribute("aria-label") || (element.textContent || "").trim().slice(0, 30) || "(no label)",
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        });
      }
    }
    return results.slice(0, 10);
  }, INTERACTIVE_SELECTOR);

  expect(small, `${context}: tap targets below 44px:\n${JSON.stringify(small, null, 2)}`).toEqual([]);
}

/** The whole geometric battery for one rendered screen. */
export async function auditScreen(page: Page, context: string, options: { tapTargets?: boolean } = {}) {
  await expectNoHorizontalScroll(page, context);
  await expectNothingOverflowsViewport(page, context);
  await expectInteractiveElementsReachable(page, context);
  if (options.tapTargets) await expectAdequateTapTargets(page, context);
}
