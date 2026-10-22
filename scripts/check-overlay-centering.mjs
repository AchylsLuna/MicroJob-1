/**
 * Guards the three things that make a web modal land in the middle of the
 * screen, each of which has broken here before:
 *
 *  1. LAYERING -- a full-screen overlay must take its z-index from the ladder
 *     in `client/src/components/ui/layers.ts`, not spell its own. Five modals
 *     sat at `z-50`, under the navbar (60) and the cookie banner (90): centred,
 *     but with the app's own chrome painted across them. `styles/webUi.ts` had
 *     carried a comment describing that as an outstanding bug.
 *
 *  2. CENTRING -- an `aria-modal` overlay must actually say `items-center
 *     justify-center`. Bottom sheets and drawers are centred on one axis only
 *     by design and are listed in INTENTIONAL_ALIGNMENT below, with the reason.
 *
 *  3. HEIGHT CAP -- a centred flex child taller than its container overflows in
 *     *both* directions, so its header leaves the top edge with nothing able to
 *     scroll it back. `SignIn`'s two modals and `OTPVerification` had no cap and
 *     did exactly that on a 375px-high landscape phone. An overlay must pair
 *     centring with a `max-h-` panel that can scroll, or scroll itself.
 *
 * Scope is deliberately `fixed inset-0` overlays in `client/src` only. An
 * `absolute` dropdown is anchored inside its own stacking context and cannot
 * collide across the app, so policing its z-index would be churn, not safety.
 * Mobile is React Native, where none of these CSS mechanics apply.
 */
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const sourceExtensions = new Set(['.tsx']);

/**
 * Overlays that are intentionally not centred on both axes.
 *
 * `match` has to appear in the overlay's *own* class list, so an entry exempts
 * one overlay rather than every overlay in its file. Keying on the filename
 * alone would have exempted `ui/index.tsx`'s `Dialog` -- the reference
 * implementation every migrated confirm now uses -- along with the `AlertLayer`
 * the entry was written for. Adding an entry here is a design decision and
 * should read like one.
 */
const INTENTIONAL_ALIGNMENT = [
  {
    file: 'client/src/components/ui/CalendarPanel.tsx',
    match: 'items-end',
    reason: 'bottom sheet on phones, centred from `sm` up -- thumb reach',
  },
  {
    file: 'client/src/components/messaging/MessageDock.tsx',
    match: 'items-end',
    reason: 'bottom sheet: the dock slides up from the composer it replaces',
  },
  {
    file: 'client/src/components/DashboardLayout.tsx',
    match: 'lg:hidden',
    reason: 'navigation drawer, anchored to the left edge it slides in from',
  },
  {
    file: 'client/src/components/ui/index.tsx',
    match: 'items-start',
    reason: 'AlertLayer is top-aligned on short viewports and scrolls, so a tall stack of alerts stays reachable',
  },
];

/** Overlays exempt from the height-cap rule, because they cap elsewhere. */
const INTENTIONAL_UNCAPPED = [
  {
    file: 'client/src/components/DashboardLayout.tsx',
    match: 'lg:hidden',
    reason: 'drawer is full-height by construction; its panel owns its own scroll',
  },
  {
    file: 'client/src/components/messaging/MessageDock.tsx',
    match: 'items-end',
    reason: 'sheet caps against the viewport in its own panel class',
  },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolute)));
    else if (sourceExtensions.has(extname(entry.name))) files.push(absolute);
  }
  return files;
}

/**
 * Blanks out comment bodies while preserving every byte offset and newline, so
 * line numbers stay true and prose *about* overlays is not mistaken for one.
 * Several of these files carry post-mortems quoting the broken `fixed inset-0`
 * class strings they replaced.
 */
function stripComments(source) {
  let out = '';
  let mode = 'code';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === 'code') {
      if (char === '/' && next === '/') { mode = 'line'; out += '  '; index += 1; continue; }
      if (char === '/' && next === '*') { mode = 'block'; out += '  '; index += 1; continue; }
      out += char;
      continue;
    }
    if (mode === 'line') {
      if (char === '\n') { mode = 'code'; out += '\n'; continue; }
      out += ' ';
      continue;
    }
    if (char === '*' && next === '/') { mode = 'code'; out += '  '; index += 1; continue; }
    out += char === '\n' ? '\n' : ' ';
  }
  return out;
}

const QUOTES = new Set(['"', '`', "'"]);

/** The class list of the `className` attribute starting at `attribute`. */
function readClassList(source, attribute) {
  let index = attribute + 'className'.length;
  while (index < source.length && !QUOTES.has(source[index])) {
    // Left the element without finding a string: it has no literal className.
    if (source[index] === '>') return { value: '', end: index };
    index += 1;
  }
  const quote = source[index];
  if (!QUOTES.has(quote)) return { value: '', end: -1 };
  const end = source.indexOf(quote, index + 1);
  return end === -1 ? { value: '', end: -1 } : { value: source.slice(index + 1, end), end };
}

/**
 * The class lists of the next `count` elements after `from`, stopping early at
 * the next overlay.
 *
 * Two levels rather than one because the scroll-wrapper pattern puts the
 * centring on the backdrop's child and the height cap on *its* child --
 * `PostJob` is built that way on purpose, so a tall dialog can scroll. Stopping
 * at the next `fixed inset-0` is what keeps that from becoming a loophole: a
 * fixed-size character window here reached from `SignIn`'s first modal into its
 * second, so a missing cap read as present and the rule silently passed.
 */
function followingClassLists(source, from, count) {
  const lists = [];
  let cursor = from;
  while (lists.length < count) {
    const attribute = source.indexOf('className', cursor);
    if (attribute === -1) break;
    const { value, end } = readClassList(source, attribute);
    if (end === -1) break;
    // A sibling overlay's classes may never vouch for this one's.
    if (value.includes('fixed inset-0')) break;
    lists.push(value);
    cursor = end + 1;
  }
  return lists.join(' ');
}

/** Every `fixed inset-0` class string in a file, with its 1-based line. */
function findOverlays(rawSource) {
  const source = stripComments(rawSource);
  const overlays = [];
  const needle = /fixed inset-0/g;
  let match;
  while ((match = needle.exec(source))) {
    // Walk out to the enclosing string literal so the whole class list is
    // inspected, not just the fragment the regex landed on.
    const open = Math.max(
      source.lastIndexOf('"', match.index),
      source.lastIndexOf('`', match.index),
      source.lastIndexOf("'", match.index),
    );
    if (open === -1) continue;
    const quote = source[open];
    const close = source.indexOf(quote, open + 1);
    if (close === -1) continue;
    overlays.push({
      classes: source.slice(open + 1, close),
      line: source.slice(0, match.index).split('\n').length,
      // The enclosing className expression, which is where a token passed as a
      // `join(...)` argument rather than interpolated into the string lives.
      expression: source.slice(Math.max(0, open - 200), close + 200),
      // The panel the overlay wraps, and that panel's own child. Both the
      // height cap and, for the scroll-wrapper pattern, the centring itself
      // live there rather than on the backdrop.
      panel: followingClassLists(source, close, 2),
    });
  }
  return overlays;
}

const exemptFor = (list, name, classes) =>
  list.find((entry) => entry.file === name && classes.includes(entry.match));

const findings = [];
const files = await collectFiles(join(root, 'client', 'src'));
let overlayCount = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const name = relative(root, file).replaceAll('\\', '/');
  if (name.endsWith('components/ui/layers.ts')) continue;

  for (const overlay of findOverlays(source)) {
    overlayCount += 1;
    const at = `${name}:${overlay.line}`;
    const { classes } = overlay;

    // 1. Layering.
    const literalZ = classes.match(/(?<![\w-])z-(?:\[\d+\]|\d+)/);
    const fromLadder =
      /(?:ALERT_)?LAYER_Z\./.test(overlay.expression) ||
      // `AlertLayer` takes its rung as a prop so a caller can raise it.
      /\bjoin\([^)]*\bz\b/.test(overlay.expression);
    if (literalZ) {
      findings.push(
        `${at}: full-screen overlay spells its own z-index (\`${literalZ[0]}\`). Take a rung from \`components/ui/layers.ts\` instead -- a hand-picked z-index is how modals ended up under the navbar and the cookie banner.`,
      );
    } else if (!fromLadder) {
      findings.push(
        `${at}: full-screen overlay declares no z-index. Take a rung from \`components/ui/layers.ts\` so it outranks the navbar and the cookie banner.`,
      );
    }

    // 2. Centring.
    // The scroll-wrapper pattern centres on the inner div rather than the
    // backdrop -- `PostJob` does this deliberately so a tall dialog can scroll.
    const centringScope = `${classes} ${overlay.panel}`;
    const centred = centringScope.includes('items-center') && centringScope.includes('justify-center');
    const alignmentExempt = exemptFor(INTENTIONAL_ALIGNMENT, name, classes);
    if (!centred && !alignmentExempt) {
      findings.push(
        `${at}: full-screen overlay is not centred (needs \`items-center justify-center\`). If it is a sheet or a drawer, add it to INTENTIONAL_ALIGNMENT in this script with the reason.`,
      );
    }

    // 3. Height cap -- only meaningful for the ones that do centre.
    if (centred && !exemptFor(INTENTIONAL_UNCAPPED, name, classes)) {
      const capped =
        /max-h-/.test(classes) ||
        /overflow-y-auto/.test(classes) ||
        /max-h-/.test(overlay.panel);
      if (!capped) {
        findings.push(
          `${at}: centred overlay with no \`max-h-\` on its panel. A flex child taller than the viewport overflows both ways, putting its header and close button off the top edge with no way to scroll back -- see OTPVerification before this rule existed.`,
        );
      }
    }
  }
}

if (findings.length) {
  console.error(`Overlay centering checks failed:\n${findings.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Overlay centering checks passed across ${overlayCount} full-screen overlays in ${files.length} files.`);
}
