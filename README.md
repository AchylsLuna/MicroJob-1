# MicroJobs

MicroJobs contains three independent install units:

- Repository root: Vite web application and shared verification tooling.
- `server/`: Express, MongoDB, and Socket.IO API.
- `Mobile/`: Expo application.

Use Node.js 22.13 LTS or Node.js 24.3 or newer. Install the web and API dependencies:

```powershell
cd C:\Users\Admin\Desktop\MicroJobs
npm ci
npm ci --prefix server
```

Run the web application and API together from the repository root with `npm run dev`.
Use `npm run dev:client` for only the web application or `npm run dev:server` for
only the API. The `client/` directory intentionally has no `package.json`, so do
not run npm commands from inside that directory.

Android builds require JDK 17. Expo Go compatibility is intentionally pinned to
Expo SDK 54 and React Native 0.81; do not run a forced audit upgrade that changes
that compatibility set.
Always start Expo from the repository root with `npm run mobile:start` (or from
`Mobile/` with `npm start`) so the authoritative `Mobile/app.config.js` is used.
If Expo Go reports a version mismatch after installing the SDK 54-compatible
client, restart Metro with `npm run mobile:start:clear`. Compatible historical
Expo Go clients can be installed on Android devices/emulators and iOS simulators
from <https://expo.dev/go>; physical iPhones can only install the current App
Store client, so use an SDK 54 development build if that client moves on.
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
