import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Geometric assertions for the overlay audit.
 *
 * `responsiveHelpers.ts` asks whether the page fits its viewport. These ask a
 * narrower question about one overlay at a time: is the panel actually in the
 * middle of the screen, and is it actually the thing on top there?
 *
 * Both halves are needed, because the two ways this has broken look identical
 * in a class list and nothing alike on screen:
 *
 *  - A modal at `z-50` is centred perfectly and painted *under* the navbar
 *    (`z-[60]`) and the cookie banner (`z-[90]`). Measuring rectangles alone
 *    calls that a pass, so `expectOverlayOnTop` hit-tests instead.
 *  - A modal with no height cap is centred by the same two classes, but a flex
 *    child taller than its container overflows in *both* directions, so its
 *    header leaves the top edge with nothing able to scroll it back. Measuring
 *    the centre point alone calls that a pass too, so `expectOverlayCentred`
 *    switches rules once the panel stops fitting.
 */

/**
 * Half a CSS pixel of asymmetry is invisible; two is the most that sub-pixel
 * layout and `deviceScaleFactor: 3` rounding can account for on their own.
 * Anything past that is a real offset, not rounding.
 */
export const CENTRE_TOLERANCE_PX = 2;

type OverlayMetrics = {
  panel: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  viewport: { width: number; height: number };
  /** Whether the panel or an ancestor can scroll the panel's overflow. */
  scrollable: boolean;
};

async function measure(panel: Locator): Promise<OverlayMetrics> {
  return panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    let scrollable = element.scrollHeight > element.clientHeight + 1;
    let ancestor: HTMLElement | null = element as HTMLElement;
    while (!scrollable && ancestor) {
      const overflowY = getComputedStyle(ancestor).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && ancestor.scrollHeight > ancestor.clientHeight + 1) {
        scrollable = true;
      }
      ancestor = ancestor.parentElement;
    }
    return {
      panel: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      scrollable,
    };
  });
}

/**
 * The panel is centred on the axes it can be centred on.
 *
 * Horizontal centring is unconditional. Vertical centring is asserted only
 * while the panel fits the viewport: a panel taller than the screen *cannot* be
 * vertically centred, and top-aligned-and-scrollable is the correct behaviour
 * there -- which is what `max-h-[calc(100dvh-2rem)]` and `PostJob`'s
 * `min-h-full items-center` wrapper are both arranging. Asserting a strict
 * vertical centre would fail those correct implementations, so for a tall panel
 * the rule becomes: the top edge must be reachable and the overflow scrollable.
 *
 * Pass `axis: "horizontal"` for a bottom sheet or a drawer, which is centred on
 * one axis by design.
 */
export async function expectOverlayCentred(
  panel: Locator,
  context: string,
  { axis = "both" }: { axis?: "both" | "horizontal" } = {},
) {
  const { panel: rect, viewport, scrollable } = await measure(panel);

  const horizontalOffset = (rect.left + rect.right) / 2 - viewport.width / 2;
  expect(
    Math.abs(horizontalOffset),
    `${context}: panel is ${horizontalOffset.toFixed(1)}px off the horizontal centre ` +
      `(panel ${Math.round(rect.left)}–${Math.round(rect.right)} in ${viewport.width}px)`,
  ).toBeLessThanOrEqual(CENTRE_TOLERANCE_PX);

  if (axis === "horizontal") return;

  const fits = rect.height <= viewport.height + 1;
  if (fits) {
    const verticalOffset = (rect.top + rect.bottom) / 2 - viewport.height / 2;
    expect(
      Math.abs(verticalOffset),
      `${context}: panel is ${verticalOffset.toFixed(1)}px off the vertical centre ` +
        `(panel ${Math.round(rect.top)}–${Math.round(rect.bottom)} in ${viewport.height}px)`,
    ).toBeLessThanOrEqual(CENTRE_TOLERANCE_PX);
    return;
  }

  // Taller than the viewport: the only correct arrangement is a reachable top
  // edge plus somewhere to scroll. A centred overflow puts the panel's header
  // and its close button above y=0 with no scroll container to bring them back.
  expect(
    rect.top,
    `${context}: panel is taller than the viewport (${Math.round(rect.height)}px in ${viewport.height}px) and its ` +
      `top edge is at ${Math.round(rect.top)}px -- above the screen, so its header and close button are unreachable. ` +
      `A centred flex child overflows in both directions; cap the panel with \`max-h-\` and let it scroll.`,
  ).toBeGreaterThanOrEqual(-1);
  expect(
    scrollable,
    `${context}: panel is taller than the viewport (${Math.round(rect.height)}px in ${viewport.height}px) but nothing ` +
      `can scroll it, so its lower half is unreachable.`,
  ).toBe(true);
}

/**
 * The overlay is the top layer where it matters.
 *
 * Hit-tests the panel's centre and the midpoint of each of its four edges, a
 * couple of pixels inside. A modal that loses this is the `z-50` failure: the
 * rectangle is exactly where it should be, and the navbar or the cookie banner
 * is painted across it. The reported `coveredBy` names the offender, which is
 * the part a screenshot diff would leave you to work out.
 */
export async function expectOverlayOnTop(panel: Locator, context: string) {
  const covered = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const inset = 3;
    const probes: Array<{ name: string; x: number; y: number }> = [
      { name: "centre", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      { name: "top edge", x: rect.left + rect.width / 2, y: rect.top + inset },
      { name: "bottom edge", x: rect.left + rect.width / 2, y: rect.bottom - inset },
      { name: "left edge", x: rect.left + inset, y: rect.top + rect.height / 2 },
      { name: "right edge", x: rect.right - inset, y: rect.top + rect.height / 2 },
    ];
    const describe = (node: Element) => {
      const tag = node.tagName.toLowerCase();
      const cls = typeof node.className === "string" ? node.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
      const z = getComputedStyle(node).zIndex;
      return `${tag}${cls ? `.${cls}` : ""}${z !== "auto" ? ` [z-index: ${z}]` : ""}`;
    };
    const results: Array<{ probe: string; coveredBy: string; at: string }> = [];
    for (const probe of probes) {
      // Skip probes that fall outside the viewport -- "off screen" is the
      // business of expectOverlayCentred, and double-reporting it here would
      // just make that failure harder to read.
      if (
        probe.x < 0 ||
        probe.y < 0 ||
        probe.x > document.documentElement.clientWidth ||
        probe.y > document.documentElement.clientHeight
      ) {
        continue;
      }
      const hit = document.elementFromPoint(probe.x, probe.y);
      if (!hit) continue;
      if (hit === element || element.contains(hit) || hit.contains(element)) continue;
      results.push({
        probe: probe.name,
        coveredBy: describe(hit),
        at: `${Math.round(probe.x)},${Math.round(probe.y)}`,
      });
    }
    return results;
  });

  expect(
    covered,
    `${context}: something is painted over the panel -- it is positioned correctly but not the top layer. ` +
      `Take a rung from \`client/src/components/ui/layers.ts\`:\n${JSON.stringify(covered, null, 2)}`,
  ).toEqual([]);
}

/**
 * The overlay's own controls are all inside the viewport and hittable.
 *
 * Narrower than `expectInteractiveElementsReachable`: scoped to the panel, and
 * without the scroll-into-view passes, because a modal's controls have to be
 * reachable *in the modal*, not after scrolling the page behind it. A control
 * below the fold of a scrollable panel is fine -- one outside the viewport with
 * no scroll container is the `OTPVerification` bug.
 */
export async function expectOverlayControlsReachable(panel: Locator, context: string) {
  const unreachable = await panel.evaluate((element) => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const selector = "a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea";

    let scroller: HTMLElement | null = element as HTMLElement;
    let hasScroll = false;
    while (scroller) {
      if (scroller.scrollHeight > scroller.clientHeight + 1) {
        const overflowY = getComputedStyle(scroller).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") { hasScroll = true; break; }
      }
      scroller = scroller.parentElement;
    }

    const results: Array<{ label: string; reason: string; rect: string }> = [];
    for (const control of Array.from(element.querySelectorAll<HTMLElement>(selector))) {
      const rect = control.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const style = getComputedStyle(control);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
      const label =
        control.getAttribute("aria-label") ||
        (control.textContent || "").trim().slice(0, 32) ||
        control.getAttribute("placeholder") ||
        `<${control.tagName.toLowerCase()}>`;
      const describe = `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;

      // Horizontally outside is never recoverable -- a modal does not scroll
      // sideways.
      if (rect.right < 0 || rect.left > viewportWidth) {
        results.push({ label, reason: "outside the viewport horizontally", rect: describe });
        continue;
      }
      // Vertically outside is only acceptable when something can scroll to it.
      if ((rect.bottom < 0 || rect.top > viewportHeight) && !hasScroll) {
        results.push({ label, reason: "outside the viewport vertically with no scroll container", rect: describe });
      }
    }
    return results.slice(0, 8);
  });

  expect(
    unreachable,
    `${context}: controls inside the overlay cannot be reached:\n${JSON.stringify(unreachable, null, 2)}`,
  ).toEqual([]);
}

/** The three assertions together, which is how every case uses them. */
export async function expectOverlayWellPlaced(
  page: Page,
  panel: Locator,
  context: string,
  options: { axis?: "both" | "horizontal" } = {},
) {
  await expect(panel).toBeVisible();
  // Let an enter animation settle before measuring. `Messages`' delete confirm
  // animates `y` and `scale`, so a measurement taken mid-flight reads as an
  // off-centre panel. The Playwright config sets `reducedMotion: "reduce"`,
  // which `useReducedMotion` honours by skipping the offset entirely -- this is
  // belt and braces for the overlays that animate regardless.
  await page.waitForTimeout(150);
  await expectOverlayCentred(panel, context, options);
  await expectOverlayOnTop(panel, context);
  await expectOverlayControlsReachable(panel, context);
}
