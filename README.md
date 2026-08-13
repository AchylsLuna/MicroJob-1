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

Run the complete local environment from the repository root:

```bash
npm run dev
```

This is the authoritative development command. It starts or safely reuses the
MicroJobs API, responsive web app, and Expo Go QR server. Scan the QR shown in
that terminal. Ctrl+C stops only services started by that invocation. Use
`npm run dev:tunnel` when guest Wi-Fi, client isolation, or different networks
prevent the phone from reaching the computer.

Use `npm run dev:client` or `npm run dev:server` only when intentionally working
on one service in isolation. The `client/` directory intentionally has no
`package.json`, so do not run npm commands from inside that directory.

Local ports are fixed by service: API `5050`, web `8082`, and Expo Metro `8081`.
Override them only with `DEV_API_PORT`, `DEV_CLIENT_PORT`, and `METRO_PORT`
respectively. `EXPO_PUBLIC_API_PORT` may override the API port visible to Expo.
Avoid a generic `PORT` when starting Expo because it is intentionally ignored.

Android builds require JDK 17. Expo Go compatibility is intentionally pinned to
Expo SDK 54 and React Native 0.81; do not run a forced audit upgrade that changes
that compatibility set.
For normal Expo Go development, use the unified `npm run dev` command rather
than starting another Metro process. Mobile API requests derive their origin
from the current Expo QR host and use Metro's `/microjobs-api/api/*` proxy to API
port `5050`; Socket.IO uses `/microjobs-socket/*`. This prevents stale LAN
addresses and works the same way in explicit tunnel mode. Restart the unified
launcher after changing networks, or bring the app to the foreground and use
Retry while the new QR is loading.
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
