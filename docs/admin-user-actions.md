# User Management actions

The desktop User Management table has an **Actions** column. Select a user's
three-dot **Open user actions** button to open that account's menu. The menu is
available on Users, Admins, and Flagged tabs where the viewer has access to those
tabs. Existing phone cards retain their action buttons, with Suspend/Activate
and Ban available to authorized viewers.

## Actions and permissions

| Action | Availability |
| --- | --- |
| View Profile | All staff who can open User Management; opens account details. |
| View Full Profile | Marketplace accounts; opens the worker or employer profile. |
| Message User | All staff who can open User Management; opens Messages for the selected account. |
| Flag as Suspicious / Clear Suspicious Flag | Admin Team, Moderator, Finance, Support, and Superadmin; marketplace accounts only. A new flag requires a reason. |
| Suspend User / Activate User | Admin Team, Moderator, and Superadmin; existing self/privileged-account protections apply. |
| Ban | Admin Team, Moderator, and Superadmin; marketplace accounts only, excluding self, deleted accounts, and accounts already banned. Requires a reason and explicit submission. |
| Edit User, Approve User, Delete User | Existing user-management authority and target protections apply; Approve appears for pending accounts. Delete opens the existing confirmation and blocker checks. |
| Send Password Reset / Unlock Account | Support and Superadmin; eligible marketplace accounts. Unlock appears only for login-locked accounts. |

Analytics has no User Management access. Finance and Support cannot suspend or
ban. Staff accounts cannot be banned through this screen. Non-superadmin users
cannot edit or suspend privileged accounts through User Management.

## Suspension and bans

Suspension uses the existing status endpoint and sets `status: disabled`.
Ban uses `PATCH /api/admin/users/:userId/ban` with the required reason, persists
`status: banned` and the actor/time/reason, and terminates active sessions.
Existing authentication enforcement rejects banned accounts. Activate uses the
existing status endpoint to restore access to suspended or banned accounts.
Client and server permission matrices both grant `users.ban` to Admin Team;
Moderator and Superadmin retain their existing ban authority.

## Menu behavior and restoration

The menu renders outside the table's scrolling container so long menus remain
visible. It stays within the viewport, follows scrolling, supports arrow keys
and Home/End, closes on outside clicks or Escape, and returns focus to the
trigger on Escape. Changing a filter, tab, or page closes an open menu.

Commit `d8c217c7` removed the desktop menu and Actions column. The restoration
retains the ten-row page size, staff OTP column, existing profile/flag/message
handlers, and existing role/tab visibility.

## Verification

`tests/e2e/admin-user-actions.spec.ts` exercises profile links, messaging links,
flag/clear requests, role restrictions, suspension/reactivation/ban requests,
required ban reasons, staff/self protection, OTP-column preservation, keyboard
navigation, viewport bounds, and phone actions using mocked API data.
Server permission and critical-flow tests cover authorization, persisted ban
details, and session termination. No actual user accounts are modified by the
browser checks.
