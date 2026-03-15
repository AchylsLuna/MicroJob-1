# MicroJobs

MicroJobs is a full-stack job marketplace platform in one monorepo, composed of:

- `client/` for the web app (React + Vite + TypeScript)
- `mobile/` for the mobile app (React Native + Expo)
- `server/` for the API and realtime backend (Node.js + Express + MongoDB)

This README focuses on implementation and integration, so you can understand how each app works and how they connect.

## 1) System Architecture

### High-level flow

1. Web and mobile clients call REST endpoints exposed by the backend under `/api/*`.
2. Authentication uses JWT + cookie/session validation on protected endpoints.
3. Realtime features use Socket.IO.
4. MongoDB stores users, jobs, applications, messages, notifications, payments, sessions, and support data.
5. Uploaded files are served from `server/uploads`, with access controls for sensitive files.

### Main folders

- `client/src/services/api.ts`: web API integration layer
- `mobile/lib/api.ts`: mobile request wrapper and response parser
- `mobile/config.ts`: mobile API and socket URL resolution
- `server/index.js`: backend bootstrap, middleware, routes, and runtime config
- `server/routes/*`: route modules per domain
- `server/controllers/*`: business logic
- `server/models/*`: MongoDB schemas

## 2) Backend Implementation (server)

### Boot and configuration

The backend starts from `server/index.js` and does the following:

- Loads environment variables from project root `.env` first, then `server/.env`.
- Configures security and infrastructure middleware:
	- `helmet`
	- `cors`
	- `express-rate-limit`
	- request sanitization middleware
	- `cookie-parser`, `express.json`, `express.urlencoded`
- Applies optional HTTPS redirect + HSTS in production.
- Connects to MongoDB via `MONGO_URI` (or fallback in-memory MongoDB when enabled).
- Registers API routes and initializes socket support.

### Route groups

The API is split by domain:

- `/api/auth`
- `/api/categories`
- `/api/jobs`
- `/api/users`
- `/api/applications` and related application endpoints (mounted via `JobApplicationRoute`)
- `/api/messages`
- `/api/payment`
- `/api/alerts`
- `/api/notifications`
- `/api/admin`
- `/api/saved-jobs`
- `/api/support`

### Security behaviors

- CORS is permissive in non-production and origin-restricted in production.
- Global rate limiting is applied for `/api/*` (with webhook/preflight exceptions).
- JWT is validated for protected routes.
- Session records are checked for active/expired state when session-bound tokens are used.
- Sensitive uploaded files (resume/KYC docs) are restricted to owner or admin access.

## 3) Web App Implementation (client)

### Integration approach

Web integration is centralized in `client/src/services/api.ts`:

- Base URL: `VITE_API_BASE` (default `/api`)
- Request helper automatically:
	- sets JSON headers (except FormData)
	- sends credentials (`credentials: include`)
	- parses JSON response
	- throws normalized errors
- Domain functions are grouped by capability (auth, jobs, applications, categories, etc.).

### Why this matters

This keeps UI components simple and moves all transport concerns (headers, parsing, auth/session error handling) into one place.

## 4) Mobile App Implementation (mobile)

### Integration approach

Mobile integration is split into:

- `mobile/config.ts`: resolves `API_URL` and `SOCKET_URL`
- `mobile/lib/api.ts`: request helper utilities

`mobile/config.ts` supports two modes:

1. Explicit mode via env vars:
	 - `EXPO_PUBLIC_API_URL`
	 - `EXPO_PUBLIC_SOCKET_URL`
2. Auto-detect mode:
	 - derives host from Expo runtime and builds a fallback API origin
	 - uses `EXPO_PUBLIC_API_PORT` (default `5055`)

`mobile/lib/api.ts` returns a normalized envelope:

```ts
type APIResult<T> = {
	ok: boolean;
	status: number;
	message: string;
	data: T | null;
	raw: unknown;
}
```

When using this helper, consume payloads from `result.data` (or `result.raw` when needed), not from the full wrapper object.

## 5) Environment and Secrets

Use `server/.env.example` as a reference for required keys.

Recommended setup:

1. Create a root `.env` for local development.
2. Put backend secrets there (or `server/.env`).
3. Keep client/mobile public config separate:
	 - web: `VITE_*`
	 - mobile: `EXPO_PUBLIC_*`

Important:

- Do not commit real credentials/tokens.
- Rotate any secrets that were exposed in history.
- Keep production secrets in deployment environment settings.

## 6) Local Development and Integration Runbook

### Prerequisites

- Node.js `>= 22.12.0`
- npm
- MongoDB Atlas URI (or enable in-memory Mongo for local-only testing)

### Install dependencies

From repo root:

```bash
npm install
```

Install workspace app dependencies if needed:

```bash
npm install --prefix server
npm install --prefix client
npm install --prefix mobile
```

### Start backend

```bash
npm run dev
```

Backend default port is `5055` unless overridden by `PORT`.

### Start web app

```bash
npm run dev:client
```

Vite serves on port `5173` by default.

If backend is on another origin, set `client/.env`:

```bash
VITE_API_BASE=http://localhost:5055/api
```

### Start mobile app

```bash
npm run mobile:start
```

For device/simulator-specific runs:

```bash
npm run mobile:android
npm run mobile:ios
npm run mobile:web
```

Set public mobile env vars when not using auto-detect:

```bash
EXPO_PUBLIC_API_URL=http://<your-host-ip>:5055/api
EXPO_PUBLIC_SOCKET_URL=http://<your-host-ip>:5055
```

## 7) Integration Contract Summary

### Auth and session

- Clients authenticate via `/api/auth/*`.
- Requests include cookies/credentials where required.
- Backend validates JWT and active session state for protected resources.

### File access

- Public avatars are accessible via `/uploads/:fileName`.
- Sensitive docs require authenticated owner/admin context.

### Realtime

- Socket.IO is used for live messaging/notifications.
- Mobile and web connect to the backend socket origin, not `/api` path.

### Payments and external services

Backend integrations include:

- PayMongo
- Xendit
- Twilio Verify
- SMTP email transport

All provider credentials must come from environment variables.

## 8) Root Scripts Reference

From repo root:

- `npm run dev` -> start backend (dev)
- `npm run dev:server` -> explicit backend dev command
- `npm run dev:client` -> start web app
- `npm run start` -> start backend (non-nodemon)
- `npm run build` -> build web app
- `npm run preview` -> preview web build
- `npm run mobile:start` -> start Expo
- `npm run mobile:android` -> run Android
- `npm run mobile:ios` -> run iOS
- `npm run mobile:web` -> run Expo web
- `npm run seed:superadmin` -> seed superadmin
- `npm run seed:demo-user` -> seed demo user
- `npm run seed:alerts` -> seed alerts

## 9) Testing

Server tests use Node's built-in test runner:

```bash
npm run test --prefix server
```

Current tests cover utility libraries in `server/tests/lib`.

## 10) Troubleshooting

### Web says it cannot reach server

- Confirm backend is running on expected port.
- Confirm `VITE_API_BASE` points to the backend `/api` base.
- Check CORS origin settings in backend env.

### Mobile cannot connect on physical device

- Use host machine LAN IP, not `localhost`.
- Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` explicitly.
- Confirm device and dev machine are on the same network.

### 401/403 on protected endpoints

- Verify login flow stores expected auth context.
- Ensure cookie/token is being sent from the client.
- Check token/session validity on backend.

---

If you want, the next step can be adding dedicated implementation READMEs for each workspace (`server`, `client`, and `mobile`) that link back to this root integration guide.
