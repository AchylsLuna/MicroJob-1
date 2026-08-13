# MicroJobs

MicroJobs contains three application areas:

- Repository root: Vite web application, the `server/` npm workspace, and shared verification tooling.
- `server/`: Express, MongoDB, and Socket.IO API workspace.
- `Mobile/`: Expo application.

Use Node.js 22.13 LTS or Node.js 24.3 or newer. Install the web and API dependencies from the repository root:

```powershell
cd C:\Users\Admin\Desktop\MicroJobs
npm ci
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
For local testing on a physical phone, keep the API running in one terminal with
`npm run dev:server`, then start Expo in a second terminal with
`npm run mobile:start:clear`. The phone and development computer must be on the
same local network. The Expo launcher selects the computer's LAN address and
prints the resulting Mobile API URL; it must not show `localhost` on a physical
device. The API server itself listens on `0.0.0.0`, but `0.0.0.0` must never be
used as the phone's API destination. Restart Expo after changing networks so it
detects the computer's new LAN address. Devices on a different network require
the deployed HTTPS API URL (or a separately configured secure API tunnel).
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
origin, set `VITE_API_BASE=/api` (or leave it unset), and omit `VITE_SOCKET_URL`.
On Vercel, configure runtime values in Project Settings > Environment Variables;
local files such as `server/.env` are intentionally ignored and are not deployment
configuration. At minimum, production needs `MONGO_URI`, `JWT_SECRET`, and the SMTP
variables used by the required sign-in email verification flow. After changing any
Vercel environment variable, create a new deployment.

If `WEB_ORIGIN`, `CLIENT_ORIGIN`, or `FRONTEND_URL` is set, it must exactly match the
browser origin, including the complete Vercel hostname. Vercel-provided deployment,
branch, and production aliases are also included automatically in the API CORS allowlist.

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
