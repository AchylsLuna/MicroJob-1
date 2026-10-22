# MicroJobs

MicroJobs contains three application areas:

- Repository root: Vite web application, the `server/` npm workspace, and shared verification tooling.
- `server/`: Express, MongoDB, and Socket.IO API workspace.
- `Mobile/`: Expo application.

Completion evidence requires private Azure blob settings on the API server. See [Completion images and employer approval](docs/COMPLETION_EVIDENCE.md) for configuration, upload limits, chat confirmation, and verification.

Employers may attach a per-worker checklist at hire confirmation and track its completion in Job Management details. See [Optional hire checklists](docs/HIRE_CHECKLISTS.md); marks never block evidence submission or payment.

New ongoing/long-term roles (`Recruiting`) require selected calendar dates, start/end work times, and guaranteed daily pay of at least PHP 480 per worker. Listings show the shift, daily hours, daily pay, and hourly equivalent truncated to two decimal places. All selected dates are secured upfront; workers submit date-specific proofs in the same chat and employers use **Confirm and Pay** for each day without changing the job status. A backend checker sends pending-payment reminders every 12 hours. See [Long-term daily work](docs/LONG_TERM_DAILY_WORK.md) for the API, funding rules, compatibility, and scheduler. `Short-term` and `Side hustle` retain their single-assignment flow and PHP 50 minimum; legacy opportunity types retain their positive-pay rule.

Use Node.js 22.13 LTS or Node.js 24.3 or newer. Install the web and API dependencies from the repository root:

```powershell
cd C:\Users\Admin\Desktop\MicroJobs
npm ci
```

Run the development environment from the repository root:

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
respectively.
Avoid a generic `PORT` when starting Expo because it is intentionally ignored.

Android builds require JDK 17. The mobile SDK and React Native versions are
pinned together in `Mobile/package.json` and `Mobile/package-lock.json`. Keep that
compatibility set intact when applying dependency security updates.
For normal Expo Go development, use the unified `npm run dev` command rather
than starting another Metro process. Mobile API and Socket.IO requests use the
deployed endpoints configured in `Mobile/.env.example`, in both LAN and tunnel
mode. The local API on port `5050` serves the web app. The launcher leaves
`MICROJOBS_METRO_API_TARGET` unset so Metro uses its deployed API default;
explicit Metro proxy overrides must also point to a deployed API. Restart the unified
launcher after changing networks, or bring the app to the foreground and use
Retry while the new QR is loading.
Metro readiness uses its local `/status` and `/microjobs-dev/health` endpoints.
A deployed API outage does not stop the local development servers; mobile API
features still require the configured deployed service to be available.
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
Use same-origin hosting or subdomains of the same site whenever possible. For
unrelated HTTPS hosts, such as Azure's `azurestaticapps.net` frontend and
`azurewebsites.net` API defaults, build the client with `VITE_AUTH_TRANSPORT=bearer`.
This opt-in mode sends access tokens in `Authorization` and holds the rotating
refresh token in `sessionStorage` (one browser tab only), avoiding third-party
cookies. Leave it unset for local development and same-site deployments.
For split subdomains, set `COOKIE_DOMAIN` to the controlled shared parent domain
(for example, `.example.com`) so the web client can read the non-HTTP-only CSRF
cookie. Do not use a parent domain that hosts untrusted tenants.

Keep `JWT_SECRET`, database credentials, SMTP credentials, and payment-provider
keys in the deployment provider's secret store. Never place real secrets in Git.
The complete environment contract is documented in `client/.env.example` and
`server/.env.example`.

## Verification

Government ID verification records and the admin Government ID / Proof of Address
tabs are documented in [Government ID verification](docs/government-id-verification.md).

Staff primary-email sign-in, secondary-email OTP, setup warnings, Admins OTP tags,
and password-change OTP routing are
documented in [Staff secondary email](docs/staff-secondary-email.md).

The User Management three-dot actions, role permissions, and suspension/ban
behavior are documented in [User Management actions](docs/admin-user-actions.md).

Run `npm run verify` for static checks, server tests, and the production web
build. Run `npm run verify:full` to include Playwright. From `Mobile/`, run
`npx expo-doctor` after native dependency changes.

## Dependency advisory policy

Production and full audits are reviewed separately. Expo SDK 54 currently carries
upstream build-tool advisories whose npm-suggested fix upgrades Expo and React Native
beyond the supported Expo Go version. These advisories are accepted only while SDK 54
is required; reassess them during each Expo compatibility upgrade. Never use
`npm audit fix --force` for this repository.

## Job lifecycle and withdrawal rollout

See [the operational policy and rollout guide](docs/lifecycle-policy.md) for cancellation,
financial disputes, automatic employer withdrawals, migration dry runs, and maintenance
configuration. Automatic transfers are disabled until explicitly configured and verified.
