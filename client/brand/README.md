# MicroJobs brand assets

Standalone exports of the logo used in `client/src/components/MicroJobsLogo.tsx`.

| File | Use on |
|---|---|
| `microjobs-logo-dark.svg` | light backgrounds (white/grey pages, documents, slides) |
| `microjobs-logo-light.svg` | dark backgrounds (brand blue `#1C4D8D`, photos) |
| `../client/public/favicon.svg` | browser tab — mark only, no wordmark |

## Construction

The mark is a **42×42 rounded square, corner radius 6 (15% of the side), rotated 30°**,
with an upright **M** on top.

The 15% radius matters. It was previously 31% (`rounded-[13px]` on 42px), at which the
corner arcs nearly meet, the straight edges all but disappear, and the rotated silhouette
reads as a blob — or as two shapes overlapping — rather than a tilted square.

The **M is a stroked path, not `<text>`**, so the mark renders identically everywhere and
never depends on a font being installed.

## Colours

| Token | Hex | Where |
|---|---|---|
| brand | `#1C4D8D` | mark fill (dark variant), "Jobs" |
| brandDark | `#0F2954` | "Micro" |
| white | `#FFFFFF` | mark fill (light variant), all light-variant text |

## Known limitation: the wordmark is live text

The "MicroJobs" wordmark in these two files is an SVG `<text>` element set in Inter 700
with `-0.6` letter-spacing. **Anywhere Inter is not installed it will fall back** to Segoe
UI, Helvetica Neue, or Arial, and the spacing will shift slightly.

That is fine for web use, where the app already loads Inter. It is *not* safe for print, a
third-party logo upload, or anything you cannot control the fonts on. For those, convert
the text to outlined paths first — open the SVG in Figma or Illustrator and use
`Type > Create Outlines` (Illustrator) or `Outline stroke` / flatten (Figma), then re-export.

The mark alone has no such caveat and is safe to use anywhere as-is.
