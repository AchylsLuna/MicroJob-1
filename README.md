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

## Production configuration

For a same-origin deployment, serve the API and Socket.IO endpoint on the web
origin, set `VITE_API_BASE=/api`, and omit `VITE_SOCKET_URL`.

For separate hosts, set `VITE_API_BASE=https://api.example.com/api`,
`VITE_SOCKET_URL=https://api.example.com`, and configure `WEB_ORIGIN` plus any
additional exact origins on the API. Production origins must use HTTPS/WSS.
Configure `TRUST_PROXY` only when the API is behind a trusted reverse proxy.

Keep `JWT_SECRET`, database credentials, SMTP credentials, and payment-provider
keys in the deployment provider's secret store. Never place real secrets in Git.
The complete environment contract is documented in `client/.env.example` and
`server/.env.example`.

## Verification

Run `npm run verify` for static checks, server tests, and the production web
build. Run `npm run verify:full` to include Playwright. From `Mobile/`, run
`npx expo-doctor` after native dependency changes.
