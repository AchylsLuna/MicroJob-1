# Government ID verification records

Successful automated Government ID verification now writes a separate MongoDB
`GovernmentIdVerification` record. Both direct scan finalization and confirmation
of a pending scan use the same transactional persistence service.

| Field | Meaning |
| --- | --- |
| `user` | Reference to the verified User; used for the View profile action. |
| `userName` | Account first and last name at verification time. |
| `govIdName` | Full name extracted by the ID provider, including middle names when supplied. Older pending scans fall back to their extracted first and last names. |
| `documentType` | Government ID type selected in the existing verification flow. |
| `date` | Successful verification timestamp; matches the user's ID review timestamp. |
| `verified` | Current Government ID verification state. |
| `revokedAt`, `revokedBy` | Time and staff user responsible for revocation. |

There is one record per user. A fresh successful verification updates that record
and its date; revocation retains the last successful name, type and date. Failed
or expired scans do not create a successful record. No document image, ID number,
date of birth or address is copied into this model. Existing verified accounts
are not backfilled because the temporary scans expire and the previous User
model does not retain the extracted name or ID type.

## Admin dashboard

The ID Verification page has Government ID and Proof of Address tabs:

- Government ID displays only recorded user name, government ID name, ID type,
  verification date, View profile and Revoke verification. Revoked records remain
  visible with the revocation button disabled.
- Proof of Address retains the existing pending-document table, document link,
  approval and rejection actions, rejection reason, and visual styling.

The following endpoints require authenticated staff with `verification.review`:

- `GET /api/admin/government-id-verifications` returns recorded details and only
  the user's ID/role needed to open the profile. Deleted users are excluded.
- `PATCH /api/admin/government-id-verifications/:verificationId/revoke` sets
  `verification.identityVerified` to false and `identityDocument.status` to
  `pending`, records the staff review, marks the record unverified and clears any
  pending ID scan in the same transaction. The admin audit middleware logs the
  action and record ID.

Revocation affects only Government ID verification. Email, phone and Proof of
Address status are preserved. The existing four-check verified seal becomes
ineligible until the user successfully verifies their ID again. Repeated
revocation preserves the original revocation timestamp. Account anonymization
removes both Government ID records and pending scans.

MongoDB must support transactions (replica set or Atlas), as required by the
project's existing payment/hiring flows. The existing server Dockerfile remains
the container workflow; no new dependencies are needed.

## Verification

Run `node --test server/tests/controllers/governmentIdVerification.test.js` for
isolated MongoDB replica-set tests, including both success paths, rejection,
expiry, rollback, replay prevention, revocation, re-verification, address review
and account anonymization. The provider is mocked and no real ID is submitted.
Use the standard web typecheck, locale parity, focused ESLint and production
build checks for the admin UI.
