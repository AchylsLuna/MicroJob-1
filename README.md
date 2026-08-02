# MicroJobs

MicroJobs contains three independent install units:

- Repository root: Vite web application and shared verification tooling.
- `server/`: Express, MongoDB, and Socket.IO API.
- `Mobile/`: Expo application.

Use Node.js 22.13 or newer. Install each unit with `npm ci`, then use `npm run dev`
from the root for the web/API development environment.

Android builds require JDK 17. Expo Go compatibility is intentionally pinned to
Expo SDK 54 and React Native 0.81; do not run a forced audit upgrade that changes
that compatibility set.
The tracked Android project is native-managed: package identity, permissions, and
Expo module configuration belong under `Mobile/android`. Do not add matching
Prebuild-only `android` or `plugins` fields to `Mobile/app.config.js` without first
regenerating and reviewing the native project.

## Production configuration

For a same-origin deployment, serve the API and Socket.IO endpoint on the web
origin, set `VITE_API_BASE=/api`, and omit `VITE_SOCKET_URL`.

For separate hosts, set `VITE_API_BASE=https://api.example.com/api`,
`VITE_SOCKET_URL=https://api.example.com`, and configure `WEB_ORIGIN` plus any
additional exact origins on the API. Production origins must use HTTPS/WSS.
Configure `TRUST_PROXY` only when the API is behind a trusted reverse proxy.
Use same-origin hosting or subdomains of the same site. Unrelated top-level domains
are not supported by the secure `SameSite=Lax` session-cookie configuration.
For split subdomains, set `COOKIE_DOMAIN` to the controlled shared parent domain
(for example, `.example.com`) so the web client can read the non-HTTP-only CSRF
cookie. Do not use a parent domain that hosts untrusted tenants.

Keep `JWT_SECRET`, database credentials, SMTP credentials, and payment-provider
keys in the deployment provider's secret store. Never place real secrets in Git.
The complete environment contract is documented in `client/.env.example` and
`server/.env.example`.

## Verification

Run `npm run verify` for static checks, server tests, and the production web
build. Run `npm run verify:full` to include Playwright. From `Mobile/`, run
`npx expo-doctor` after native dependency changes.

## Dependency advisory policy

Production and full audits are reviewed separately. Expo SDK 54 currently carries
upstream build-tool advisories whose npm-suggested fix upgrades Expo and React Native
beyond the supported Expo Go version. These advisories are accepted only while SDK 54
is required; reassess them during each Expo compatibility upgrade. Never use
`npm audit fix --force` for this repository.
