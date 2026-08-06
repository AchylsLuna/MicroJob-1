# Dependency advisory record

Reviewed: 2026-08-02

## Web

The production audit reports two high-severity advisories through
`react-router-dom@7.18.2`. They affect React Server Components usage. MicroJobs is a
Vite single-page application and does not use React Server Components. The npm
registry has no newer stable `react-router-dom` release with a fix; its suggested
downgrade is not accepted because it reintroduces older resolved advisories.

The full root audit reports the same two production findings and no additional
development-only advisories. Do not add a broad `minimatch` override: it breaks
`eslint-plugin-jsx-a11y` at runtime.

## Mobile

The production audit reports one high-severity PostCSS advisory and three moderate
advisories through Expo CLI, Expo, and Metro configuration. npm's remediation
requires Expo 57, which is incompatible with the required Expo Go SDK 54 target.
The affected packages are build/development tooling; the installed application does
not process untrusted source, CSS, source maps, or Metro configuration at runtime.

## Review policy

- Keep the lockfiles committed and use `npm ci`.
- Never use `npm audit fix --force`.
- Re-run full and production audits for all three install units on dependency changes.
- Reassess the web advisories when a patched stable React Router release exists.
- Reassess mobile advisories when Expo Go SDK 54 support is no longer required.
