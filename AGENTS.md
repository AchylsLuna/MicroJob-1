# Repository tooling

Use the existing `server/Dockerfile` for the production API container:

```powershell
docker build -t microjobs-api ./server
docker run --rm --env-file ./server/.env -p 8080:8080 microjobs-api
```

The container installs its dependencies with `npm ci --omit=dev`. Do not print environment files or bake them into images. The Docker engine must be running. If it is unavailable, use existing workspace dependencies for checks without installing host packages, and report the limitation.

After evidence/chat/payment changes, run web/mobile typechecks, focused ESLint, both locale checks, the client production build, and the relevant server tests. See `docs/COMPLETION_EVIDENCE.md` for the upload contract and private Azure configuration.
