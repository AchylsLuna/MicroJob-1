# Dependency advisory record

Reviewed: 2026-07-30

## Web

The production audit reports two high-severity advisories through
`react-router-dom@7.18.2`. They affect React Server Components usage. MicroJobs is a
Vite single-page application and does not use React Server Components. The npm
registry has no newer stable `react-router-dom` release with a fix; its suggested
downgrade is not accepted because it reintroduces older resolved advisories.

The full root audit also reports six high-severity findings in the current ESLint
toolchain. These packages are development-only, do not ship in the web bundle, and
the registry currently offers only incompatible downgrades. Do not add a broad
`minimatch` override: it breaks `eslint-plugin-jsx-a11y` at runtime.

## Mobile

The production audit reports 19 high and one moderate advisory through Expo SDK 54,
React Native 0.81, Babel, Metro, and their build/test tooling. npm's remediation
requires Expo 57 and a newer React Native release, which is incompatible with the
required Expo Go SDK 54 target. The application does not process untrusted source,
CSS, source maps, or test configuration at runtime.

## Review policy

- Keep the lockfiles committed and use `npm ci`.
- Never use `npm audit fix --force`.
- Re-run full and production audits for all three install units on dependency changes.
- Reassess the web advisories when a patched stable React Router release exists.
- Reassess mobile advisories when Expo Go SDK 54 support is no longer required.
