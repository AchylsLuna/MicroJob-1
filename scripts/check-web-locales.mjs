#!/usr/bin/env node

// Web counterpart to Mobile/scripts/checkLocales.cjs. Mobile has had a locale
// gate wired into `verify` for a while; the web client had none, so an
// English-only string could ship silently.
//
// The two differ in one deliberate way. Mobile's check treats a missing key as
// a hard failure because it can afford to -- it is already at parity. The web
// locales are not: there are missing Filipino translations today, mostly on
// the employer job-management screens. `client/src/i18n/index.ts` sets
// `fallbackLng: "en"`, so those render the English string rather than a raw
// key path -- a mixed-language UI, not a broken one -- which is why this is a
// ratchet rather than a wall.
//
// So this mirrors the HEX_LITERAL_BUDGET idiom already used by
// Mobile/scripts/checkTheme.cjs: record the current shortfall, fail if it
// grows. Lower MISSING_KEY_BUDGET whenever translations are added; never
// raise it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const localesRoot = path.join(repoRoot, "client", "src", "locales");
const BASE_LOCALE = "en";

// Untranslated keys as of 2026-09-21. This number must never rise.
const MISSING_KEY_BUDGET = 90;

const failures = [];

const flatten = (value, prefix = "", out = new Map()) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
};

// i18next interpolation: a placeholder present in one locale but not the other
// renders the literal "{{name}}" to the user.
const placeholdersOf = (value) =>
  typeof value === "string"
    ? [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).sort()
    : [];

if (!fs.existsSync(path.join(localesRoot, BASE_LOCALE))) {
  console.error(`Locale check failed: no "${BASE_LOCALE}" directory under client/src/locales.`);
  process.exit(1);
}

const locales = fs
  .readdirSync(localesRoot)
  .filter((entry) => fs.statSync(path.join(localesRoot, entry)).isDirectory())
  .sort();

const namespaces = fs
  .readdirSync(path.join(localesRoot, BASE_LOCALE))
  .filter((entry) => entry.endsWith(".json"))
  .sort();

const parsed = new Map();
for (const locale of locales) {
  for (const namespace of namespaces) {
    const file = path.join(localesRoot, locale, namespace);
    const relative = path.relative(repoRoot, file);
    if (!fs.existsSync(file)) {
      failures.push(`${relative}: missing (every locale must define every namespace)`);
      continue;
    }
    try {
      parsed.set(`${locale}/${namespace}`, flatten(JSON.parse(fs.readFileSync(file, "utf8"))));
    } catch (error) {
      failures.push(`${relative}: invalid JSON — ${error.message}`);
    }
  }
}

let comparedKeys = 0;
let missingKeys = 0;
const missingByNamespace = new Map();

for (const namespace of namespaces) {
  const base = parsed.get(`${BASE_LOCALE}/${namespace}`);
  if (!base) continue;
  comparedKeys += base.size;

  for (const locale of locales) {
    if (locale === BASE_LOCALE) continue;
    const other = parsed.get(`${locale}/${namespace}`);
    if (!other) continue;
    const where = `client/src/locales/${locale}/${namespace}`;

    for (const [key, baseValue] of base) {
      if (!other.has(key)) {
        // Counted against the budget rather than failing outright: these fall
        // back to English, so they are a polish gap, not a broken screen.
        missingKeys += 1;
        missingByNamespace.set(where, (missingByNamespace.get(where) || 0) + 1);
        continue;
      }
      // Placeholder mismatches DO fail immediately -- unlike a missing key,
      // there is no fallback that saves the user from seeing "{{count}}".
      const expected = placeholdersOf(baseValue).join(",");
      const actual = placeholdersOf(other.get(key)).join(",");
      if (expected !== actual) {
        failures.push(
          `${where}: key "${key}" placeholders differ — ${BASE_LOCALE} has [${expected}], ${locale} has [${actual}]`,
        );
      }
    }

    // A key with no English counterpart is dead weight and usually a rename
    // that only got applied to one side.
    for (const key of other.keys()) {
      if (!base.has(key)) {
        failures.push(`${where}: key "${key}" does not exist in ${BASE_LOCALE} (dead translation)`);
      }
    }
  }
}

if (missingKeys > MISSING_KEY_BUDGET) {
  const detail = [...missingByNamespace.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([where, count]) => `  - ${where}: ${count}`)
    .join("\n");
  failures.push(
    `untranslated keys rose to ${missingKeys}, above the budget of ${MISSING_KEY_BUDGET}.\n` +
      `Add the translation instead of raising the budget. Most affected:\n${detail}`,
  );
}

if (failures.length) {
  console.error(`Web locale checks failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

const headroom = MISSING_KEY_BUDGET - missingKeys;
console.log(
  `Web locale checks passed: ${locales.length} locales × ${namespaces.length} namespaces, ` +
    `${comparedKeys} keys compared, ${missingKeys} untranslated (budget ${MISSING_KEY_BUDGET}` +
    `${headroom > 0 ? ` — lower MISSING_KEY_BUDGET to ${missingKeys}` : ""}).`,
);
