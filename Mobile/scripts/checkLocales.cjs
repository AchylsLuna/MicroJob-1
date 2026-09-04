#!/usr/bin/env node

// Guards the i18n JSON files against the ways they quietly break:
//   1. invalid JSON (a bad hand-edit takes the whole bundle down)
//   2. keys missing from a locale (i18next renders the raw key path to the user)
//   3. interpolation placeholders that differ between locales
//   4. wholesale reformatting (a JSON round-trip rewrites untouched lines and
//      buries the real change in diff noise)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const mobileRoot = path.resolve(__dirname, '..');
const localesRoot = path.join(mobileRoot, 'locales');
const BASE_LOCALE = 'en';
// A reformat rewrites far more lines than the keys it adds. Allow generous head-room
// for legitimately reflowed entries before calling it churn.
const CHURN_LINE_ALLOWANCE = 10;
const CHURN_LINES_PER_KEY = 4;

const failures = [];

const readJson = (file) => {
  const source = fs.readFileSync(file, 'utf8');
  try {
    return { value: JSON.parse(source) };
  } catch (error) {
    return { error: error.message };
  }
};

const flatten = (value, prefix = '', out = new Map()) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
};

const placeholdersOf = (value) =>
  typeof value === 'string'
    ? [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).sort()
    : [];

const locales = fs
  .readdirSync(localesRoot)
  .filter((entry) => fs.statSync(path.join(localesRoot, entry)).isDirectory())
  .sort();

if (!locales.includes(BASE_LOCALE)) {
  console.error(`Locale check failed: no "${BASE_LOCALE}" directory under locales/.`);
  process.exit(1);
}

const namespaces = fs
  .readdirSync(path.join(localesRoot, BASE_LOCALE))
  .filter((entry) => entry.endsWith('.json'))
  .sort();

// --- 1 & 2 & 3: parse, key parity, placeholder parity -----------------------
const parsed = new Map();
for (const locale of locales) {
  for (const namespace of namespaces) {
    const file = path.join(localesRoot, locale, namespace);
    const relative = path.relative(mobileRoot, file);
    if (!fs.existsSync(file)) {
      failures.push(`${relative}: missing (every locale must define every namespace)`);
      continue;
    }
    const { value, error } = readJson(file);
    if (error) {
      failures.push(`${relative}: invalid JSON — ${error}`);
      continue;
    }
    parsed.set(`${locale}/${namespace}`, flatten(value));
  }
}

let comparedKeys = 0;
for (const namespace of namespaces) {
  const base = parsed.get(`${BASE_LOCALE}/${namespace}`);
  if (!base) continue;
  comparedKeys += base.size;

  for (const locale of locales) {
    if (locale === BASE_LOCALE) continue;
    const other = parsed.get(`${locale}/${namespace}`);
    if (!other) continue;
    const where = `locales/${locale}/${namespace}`;

    for (const [key, baseValue] of base) {
      if (!other.has(key)) {
        failures.push(`${where}: missing key "${key}" (would render as raw text)`);
        continue;
      }
      const expected = placeholdersOf(baseValue).join(',');
      const actual = placeholdersOf(other.get(key)).join(',');
      if (expected !== actual) {
        failures.push(
          `${where}: key "${key}" placeholders differ — ${BASE_LOCALE} has [${expected}], ${locale} has [${actual}]`,
        );
      }
    }

    for (const key of other.keys()) {
      if (!base.has(key)) {
        failures.push(`${where}: key "${key}" does not exist in ${BASE_LOCALE} (dead translation)`);
      }
    }
  }
}

// --- 4: reformatting churn against git HEAD --------------------------------
const git = (args) =>
  execFileSync('git', args, { cwd: mobileRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// git reports paths relative to the repository root, not the cwd, so resolve from there.
const repoRoot = (() => {
  try {
    return git(['rev-parse', '--show-toplevel']).trim();
  } catch {
    return null; // not a git checkout, or git unavailable — skip the churn check
  }
})();

const gitNumstat = () => {
  if (!repoRoot) return null;
  try {
    const out = git(['diff', '--numstat', '--', 'locales']);
    return out.trim() ? out.trim().split('\n') : [];
  } catch {
    return null;
  }
};

const headVersion = (repoRelativePath) => {
  try {
    return JSON.parse(git(['show', `HEAD:${repoRelativePath}`]));
  } catch {
    return null;
  }
};

const numstat = gitNumstat();
let churnChecked = 0;
if (numstat) {
  for (const row of numstat) {
    const [addedRaw, removedRaw, file] = row.split('\t');
    if (!file || !file.endsWith('.json')) continue;
    const added = Number(addedRaw);
    const removed = Number(removedRaw);
    if (!Number.isFinite(added) || !Number.isFinite(removed)) continue; // binary marker

    const abs = path.join(repoRoot, file);
    if (!fs.existsSync(abs)) continue;
    const { value: current, error } = readJson(abs);
    if (error) continue; // already reported above

    const before = headVersion(file);
    if (!before) continue;
    churnChecked += 1;

    const beforeFlat = flatten(before);
    const afterFlat = flatten(current);
    let changedKeys = 0;
    for (const [key, val] of afterFlat) {
      if (!beforeFlat.has(key) || beforeFlat.get(key) !== val) changedKeys += 1;
    }
    for (const key of beforeFlat.keys()) if (!afterFlat.has(key)) changedKeys += 1;

    const changedLines = added + removed;
    const budget = changedKeys * CHURN_LINES_PER_KEY + CHURN_LINE_ALLOWANCE;
    if (changedLines > budget) {
      failures.push(
        `${file}: ${changedLines} lines changed for only ${changedKeys} key change(s) — ` +
          'this looks like the file was reformatted (a JSON round-trip rewrites untouched lines). ' +
          'Re-apply the edit without reserialising the whole file.',
      );
    }
  }
}

if (failures.length) {
  console.error(`Locale checks failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}

console.log(
  `Locale checks passed: ${locales.length} locales × ${namespaces.length} namespaces, ` +
    `${comparedKeys} keys compared, ${churnChecked} changed file(s) checked for reformatting.`,
);
