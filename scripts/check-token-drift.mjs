#!/usr/bin/env node
/**
 * Fails when the web and mobile design tokens disagree.
 *
 * The two platforms are separate npm projects with separate bundlers, so they
 * cannot import a shared package without adding monorepo wiring the repo has
 * deliberately avoided. The token values are therefore duplicated —
 * `client/src/constants/tokens.ts` and `Mobile/theme/tokens.ts`,
 * `client/src/constants/motion.ts` and `Mobile/theme/motion.ts` — and this
 * check is what keeps the duplication honest.
 *
 * Only the scales both platforms share are compared. Web has no brand colours
 * of its own (tailwind.config.js owns those) and mobile has native-only groups
 * like `shadow` and `navigation`, so those are skipped rather than forced into
 * a shared shape.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = {
  webTokens: "client/src/constants/tokens.ts",
  mobileTokens: "Mobile/theme/tokens.ts",
  webMotion: "client/src/constants/motion.ts",
  mobileMotion: "Mobile/theme/motion.ts",
};

/**
 * Pulls a `key: { ... }` block out of a token file and returns its leaf
 * key/value pairs. Values are kept as raw strings so `10` and `'#EF4444'`
 * compare exactly as written.
 */
function readGroup(source, groupName) {
  const opening = new RegExp(`(?:^|\\n)\\s*${groupName}\\s*:\\s*\\{`);
  const match = opening.exec(source);
  if (!match) return null;

  const start = match.index + match[0].length;
  let depth = 1;
  let end = start;
  while (end < source.length && depth > 0) {
    const char = source[end];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    end += 1;
  }

  const body = source.slice(start, end - 1);
  const entries = {};
  for (const entry of body.matchAll(/(\w+)\s*:\s*([^,\n{]+)/g)) {
    const value = entry[2].trim().replace(/['"]/g, "").toLowerCase();
    if (value.endsWith("{")) continue;
    entries[entry[1]] = value;
  }
  return entries;
}

const files = Object.fromEntries(
  Object.entries(SOURCES).map(([name, relativePath]) => {
    try {
      return [name, readFileSync(resolve(repoRoot, relativePath), "utf8")];
    } catch {
      console.error(`Token drift check failed: missing ${relativePath}`);
      process.exit(1);
    }
  }),
);

// [group, webSource, mobileSource, label]
const COMPARISONS = [
  ["radius", "webTokens", "mobileTokens"],
  ["spacing", "webTokens", "mobileTokens"],
  ["typography", "webTokens", "mobileTokens"],
  ["controls", "webTokens", "mobileTokens"],
  ["duration", "webMotion", "mobileMotion"],
  ["press", "webMotion", "mobileMotion"],
  ["spring", "webMotion", "mobileMotion"],
  ["distance", "webMotion", "mobileMotion"],
];

// Colour keys web defines; mobile has many more, so compare only the overlap.
const SHARED_COLOR_KEYS = [
  "success",
  "danger",
  "warning",
  "info",
  "successSoft",
  "dangerSoft",
  "warningSoft",
  "infoSoft",
];

const failures = [];

for (const [group, webKey, mobileKey] of COMPARISONS) {
  const web = readGroup(files[webKey], group);
  const mobile = readGroup(files[mobileKey], group);

  if (!web) {
    failures.push(`${SOURCES[webKey]}: missing "${group}" group`);
    continue;
  }
  if (!mobile) {
    failures.push(`${SOURCES[mobileKey]}: missing "${group}" group`);
    continue;
  }

  for (const [key, webValue] of Object.entries(web)) {
    const mobileValue = mobile[key];
    if (mobileValue === undefined) {
      failures.push(`${group}.${key}: defined on web but missing on mobile`);
    } else if (mobileValue !== webValue) {
      failures.push(`${group}.${key}: web is ${webValue}, mobile is ${mobileValue}`);
    }
  }
}

const webColors = readGroup(files.webTokens, "colors") || {};
const mobileColors = readGroup(files.mobileTokens, "colors") || {};
for (const key of SHARED_COLOR_KEYS) {
  const webValue = webColors[key];
  const mobileValue = mobileColors[key];
  if (webValue === undefined) {
    failures.push(`colors.${key}: missing from ${SOURCES.webTokens}`);
  } else if (mobileValue === undefined) {
    failures.push(`colors.${key}: missing from ${SOURCES.mobileTokens}`);
  } else if (webValue !== mobileValue) {
    failures.push(`colors.${key}: web is ${webValue}, mobile is ${mobileValue}`);
  }
}

if (failures.length) {
  console.error(
    `Design tokens have drifted between web and mobile:\n${failures
      .map((failure) => `- ${failure}`)
      .join("\n")}\n\nUpdate both ${SOURCES.webTokens} and ${SOURCES.mobileTokens} (or the motion files) so they agree.`,
  );
  process.exit(1);
}

console.log("Design tokens match across web and mobile.");
