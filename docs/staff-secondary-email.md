# Staff secondary email, sign-in OTP and password changes

Applies to the web Settings page for `superadmin` and every `admin` account, including legacy admins without a sub-role and `admin_team`, `moderator`, `support_staff`, `analytics_team`, and `finance_team`. Marketplace workers, employers, and dual-role accounts do not have this setting.

## Staff procedure

1. Open **Settings → Account → Personal information**, enter **Secondary Email** (different from the sign-in address), and confirm the current password.
2. Select **Send verification OTP**, open that mailbox, enter the six-digit code, and select **Verify secondary email**. Codes expire after five minutes.
3. Open **Security & Privacy → Security → Change Password**, enter the current password, and select **Send OTP**. The page identifies the verified secondary address receiving the code.
4. Enter the password-change OTP, enter and confirm the new password, and select **Save New Password**. Other active sessions are revoked; the current session remains signed in.

Staff password changes are blocked until a secondary email has been verified. To replace the address, edit the field and repeat verification. The previously verified address stays active until the replacement succeeds. Verification invalidates all outstanding password-change and login codes for that account, including when reverifying the same address. Enrollment is independent of the general profile Save action.

## Staff sign-in and OTP status

Staff enter their **Primary Email** and password on **Admin Sign In**. A secondary email is a code-delivery address, never a sign-in identifier; staff username and phone-number sign-in are rejected. A verified secondary email automatically turns on sign-in OTP for every staff role, including superadmin. There is no independent switch that can bypass this rule.

After valid primary credentials, enrolled staff receive a six-digit code at their verified secondary address. The existing email-code dialog identifies that address, supports resend/cancel/retry, and creates no session until the code is accepted. Login codes expire after five minutes, are single-use and have a five-failure limit; resend invalidates the earlier code while preserving failures. Staff must enter a code at every fresh sign-in. Staff Google sign-in, trusted-device sign-in, and legacy authenticator/method-choice tokens cannot bypass primary credentials or secondary-email OTP. Active sessions and refresh remain subject to the existing session policy.

Staff without a verified secondary email can sign in directly. A warning pop-up on the destination page asks them to set up a secondary email and enable OTP. **Set up secondary email** opens Settings; **Remind me next sign-in**, Close and Escape dismiss the prompt for that sign-in. It appears again after a fresh sign-in, rather than after every page navigation or reload. For newly provisioned accounts, the mandatory initial password change is completed before the prompt appears.

**User Management → Admins** displays an **OTP** column with **On** for a verified secondary address and **Off** for absent/unverified enrollment. Phone cards show the same tags. The Users and Flagged views retain their existing columns, and existing role-based visibility of the Admins tab remains intact. Only the derived boolean is returned to listing viewers; secondary addresses and verification timestamps remain private.

The public forgotten-password flow and one-time temporary-password change retain their existing behavior. Worker/employer sign-in and password-change OTPs still go to their primary email; mobile UI is unchanged.

## API and storage

| Endpoint | Contract |
| --- | --- |
| `GET /api/auth/secondary-email` | Owner's `{ email, verified }` status. |
| `POST /api/auth/secondary-email/request` | `{ email, currentPassword }`; sends the enrollment code. |
| `POST /api/auth/secondary-email/confirm` | `{ email, code }`; verifies and saves the address. |
| `POST /api/auth/password-change/request` | Existing contract; staff codes target the verified secondary email. |
| `POST /api/auth/password-change/confirm` | Existing contract; staff codes must match the current secondary-email revision. |

`POST /api/auth/login` retains `{ emailOrUsername, password }`; Admin Sign In also sends `staffOnly: true` to reject marketplace credentials before a session or challenge is issued. This flag only restricts login and cannot disable OTP. Enrolled staff receive `{ otpRequired, otpToken, deliveryEmail, staffLogin }`, then use the existing `/api/auth/login/otp/verify` and `/api/auth/login/otp/resend` contracts. Primary email stays separate from the displayed delivery address. Authenticated staff payloads and authorized staff listings expose `otpEnabled`, never the stored secondary fields.

Secondary-email routes require an authenticated active staff account, without a feature-permission restriction, so every staff sub-role can manage its own security. Persisted roles are checked again in the controller. Send and confirm limits are account-scoped (five sends and fifteen confirmations per ten minutes), independent of candidate email or source IP. OTP challenges allow five failed guesses; resending preserves the previous active challenge's failed attempts.

`User.secondaryEmail` and `User.secondaryEmailVerifiedAt` default to null and use `select: false`; general profile, user-management and login reads do not expose them. Profile updates cannot set these fields. No migration or backfill is needed; existing staff enroll through Settings. Account anonymization clears both fields and all user-bound OTP challenges.

Enrollment uses the persisted `secondary-email-verification` purpose; staff password changes use `password-change` and sign-in uses `login`. Challenge subjects bind to the staff user ID, so staff using a shared mailbox do not overwrite one another's codes. Candidate email, previous verified-email revision, and challenge owner are checked before an atomic enrollment update. Password changes also condition their database update on the original password hash and secondary-email revision. Login verification/resend recheck account status, primary email, secondary email and verification revision; a marketplace challenge issued before promotion cannot authenticate a staff account. Codes are hashed at rest, single-use, and never returned by these APIs. Successful enrollment records `staff_secondary_email_verified` in the security audit log.

## Mail configuration and verification

Reuse the existing `RESEND_API_KEY` / `MAIL_FROM` or SMTP host, port, user and password configuration. Real mail transport is required outside the isolated test environment; staff enrollment never logs an OTP or offers a development-code bypass. Both frontend and API changes must be deployed together.

Focused server tests cover all staff roles, primary-only credentials, login delivery and session creation, OTP-off login, bypass protection, resend/expiry/replay/concurrency, private status serialization, email replacement, profile-edit protection, password changes and unchanged marketplace behavior. Playwright covers sign-in, setup warnings, OTP status tags, enrollment, blocked password changes, role interfaces, failure handling, persistence, replacement and phone layout. Mail-provider requests are intercepted in tests; no real mailbox delivery is tested.

```powershell
node --test server/tests/controllers/staffLoginOtp.test.js server/tests/controllers/staffSecondaryEmail.test.js server/tests/controllers/paymentMethods.test.js server/tests/lib/otpChallenges.test.js
npm run test:e2e -- tests/e2e/staff-login-otp.spec.ts tests/e2e/staff-secondary-email.spec.ts --project=app
```
