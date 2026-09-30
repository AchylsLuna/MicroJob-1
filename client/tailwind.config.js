import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/*
 * Scale values here are mirrored by hand from `src/constants/tokens.ts`.
 * They cannot be imported: this file is loaded by PostCSS in plain Node, with
 * no TypeScript loader, so `tokens.ts` is unreachable from here. That also
 * means `scripts/check-token-drift.mjs` does NOT cover this file -- it
 * compares the token files to each other only. Change a value here and you
 * must change it there too, by hand.
 *
 * The rule for this `extend` block: only ever ADD keys that Tailwind does not
 * already define. Never redefine a stock scale key. The `blue` ramp that used
 * to live here is exactly why -- it silently replaced Tailwind's standard
 * `blue`, so `hover:bg-blue-800` was a no-op (500-950 were all the same hex)
 * and `bg-blue-100` was a 10% alpha wash rather than an opaque tint. Nothing
 * in the config signalled either surprise.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(__dirname, "index.html"),
    resolve(__dirname, "src/**/*.{js,ts,jsx,tsx}")
  ],
  theme: {
    extend: {
      colors: {
        /*
         * The brand ramp, renamed from `blue` so it no longer shadows a stock
         * Tailwind colour. Values are byte-identical to what `blue` held, so
         * the rename was a pure alias swap with no visual change.
         *
         * Two inherited quirks, documented rather than silently fixed, because
         * correcting them would restyle ~200 call sites:
         *   - 50-400 are ALPHA values, not opaque tints. `bg-brand-100` is the
         *     brand at 10% over whatever is behind it.
         *   - 500-950 are all the same hex. The brand has no shade steps, so
         *     hover and pressed states must come from opacity, ring or
         *     brightness -- never a darker step, which renders identically.
         *     See the same rule stated in `src/constants/tokens.ts`.
         */
        brand: {
          50: "rgb(28 77 141 / 0.06)",
          100: "rgb(28 77 141 / 0.1)",
          200: "rgb(28 77 141 / 0.2)",
          300: "rgb(28 77 141 / 0.3)",
          400: "rgb(28 77 141 / 0.4)",
          500: "#1C4D8D",
          600: "#1C4D8D",
          700: "#1C4D8D",
          800: "#1C4D8D",
          900: "#1C4D8D",
          950: "#1C4D8D",
          DEFAULT: "#1C4D8D",
        },
      },
      fontSize: {
        /*
         * `tokens.typography.body` / `.bodySm` / `.caption`.
         *
         * Each is a bare string, so it compiles to `font-size` ALONE. That is
         * deliberate and load-bearing: Tailwind's own `text-sm` / `text-xs`
         * set a `line-height` as well, so rewriting the existing
         * `text-[14px]` / `text-[12px]` call sites to them would have silently
         * changed leading on hundreds of elements. These tokens are exact
         * aliases of the arbitrary values they replace.
         *
         * `body-sm` (13px) is the most-used size in the client and the only
         * one with no stock equivalent at all -- it falls between `text-xs`
         * (12) and `text-sm` (14), so it was spelled `text-[13px]` 312 times.
         */
        body: "14px",
        "body-sm": "13px",
        caption: "12px",
      },
      borderRadius: {
        /*
         * `tokens.radius.sm` and `.card`. Named rather than numbered so they
         * cannot collide with Tailwind's own `rounded-sm|md|lg`, which have 65
         * live uses that must not shift.
         *
         * The web scale is deliberately three steps: `rounded-control` (10),
         * `rounded-xl` (12, stock) and `rounded-card` (16). There is no 14px
         * step -- the 53 `rounded-[14px]` call sites were folded into
         * `rounded-card`, a 2px change, so that panels on the same screen stop
         * disagreeing. `tokens.radius.md` (14) still exists in the token file
         * for parity with mobile, but is not a web step; adding it here would
         * just recreate the split.
         */
        control: "10px",
        card: "16px",
      },
    },
  },
  plugins: [],
};
