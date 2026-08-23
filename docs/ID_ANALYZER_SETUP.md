ID Analyzer integration

Server-side requirements:
- Set `IDANALYZER_KEY` (or `IDANALYZER_API_KEY`) in the server environment. Keep this secret — never expose to the frontend.
- (Optional) Set `KYC_PROFILE_ID` to the profile id to use for scans, or pass `profileId` in the form upload.

Endpoint:
- `POST /api/verify-id/verify` — multipart form with field `document` (file) and optional `profileId`.
- This route requires authentication (Bearer token or cookie session) and keeps the uploaded file in memory only.

Frontend:
- Use the `IdVerifier` component at `src/components/IdVerifier.tsx` as an example that posts the file to the endpoint via `FormData`.

Error handling:
- The server maps provider errors to safe responses: `429` for rate limits, generic `5xx` for provider/server failures, and `400` for bad submissions.
