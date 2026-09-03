# Dependency advisory record

Reviewed: 2026-09-04

## Web

`npm audit` on the root install unit reports **no advisories**, in either the
production-only (`--omit=dev`) or full audit.

The two high-severity `react-router-dom@7.18.2` findings recorded in the previous
review no longer appear. The moderate `qs` advisory, plus high-severity
`browserslist` and `postcss-selector-parser` findings that surfaced afterwards,
were resolved with a plain `npm audit fix` — semver-compatible updates only, no
`--force`, and no change to any direct dependency.

Do not add a broad `minimatch` override: it breaks `eslint-plugin-jsx-a11y` at
runtime.

## Mobile

The Mobile install unit reports 16 findings (7 moderate, 9 high). A plain
`npm audit fix` cleared the `@xmldom/xmldom` XML-injection advisories reached
through `plist`. Everything that remains is Expo's bundled build toolchain —
Expo CLI, Metro, PostCSS, `image-size`, `query-string` — where npm's remediation
requires Expo 57 and would break the required Expo Go SDK 54 target.

These are build and development tooling. The installed application does not
process untrusted source, CSS, source maps, or Metro configuration at runtime,
so none of them is reachable by an attacker against a shipped build.

`scripts/check-security.mjs` holds the corresponding exception list. Each entry
names the package and why it is accepted; the most recent addition is
`decode-uri-component` (advisory 1147955, moderate denial of service on
malformed percent-encoded input), reached only through Expo's `query-string`
and carrying no non-breaking fix.

## Review policy

- Keep the lockfiles committed and use `npm ci`.
- Never use `npm audit fix --force`.
- Re-run full and production audits for all three install units on dependency changes.
- Reassess mobile advisories when Expo Go SDK 54 support is no longer required.
- When allowlisting an advisory in `scripts/check-security.mjs`, record the
  package, the severity, and why it is not reachable at runtime — an ID alone
  makes the next review impossible to do properly.
