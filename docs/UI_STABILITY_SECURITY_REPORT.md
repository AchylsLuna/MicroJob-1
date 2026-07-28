# UI Stability and Security Register

This register records the repository-wide web/mobile UI review. A finding is `Verified` only when its implementation and relevant automated evidence pass. Native assistive-technology and physical-device checks remain `Runtime review`.

| ID | Priority | Surface | Finding and root cause | Resolution | Status |
| --- | --- | --- | --- | --- | --- |
| UIS-001 | P0 | Mobile authentication | JWTs were stored directly in unencrypted AsyncStorage and read independently by screens. | Added a SecureStore-backed adapter, one-time legacy migration, secure removal, and a static bypass check. | Implemented; native migration is Runtime review |
| UIS-002 | P0 | Payment navigation | Checkout URLs from API responses were opened without protocol/provider validation. | Added purpose-aware URL validation and PayMongo/Xendit host allowlisting before browser handoff. | Implemented; real provider handoff is Runtime review |
| UIS-003 | P1 | Resume/download navigation | API-provided resume paths and URLs could reach anchors or native Linking without a same-origin upload-path contract. | Require HTTPS/local development origin, trusted API origin, and `/uploads/` paths. | Implemented |
| UIS-004 | P1 | Web dialogs | Shared dialogs reused static ARIA IDs and lacked a focus trap, focus return, and pending/error behavior. | Added unique IDs, trapped Tab navigation, Escape/backdrop guards, focus restoration, and pending/error states. | Implemented; browser regression covered |
| UIS-005 | P1 | Admin UI | An unused account-deletion handler retained `window.confirm`; action menus and the user-details overlay used non-semantic click interception. | Removed the dead native-confirm path and corrected menu/modal semantics. | Implemented |
| UIS-006 | P1 | Mobile payment methods | Destructive removal used an unthemed native alert without recoverable inline failure state. | Added a themed accessible confirmation modal with busy, disabled, and error states. | Implemented; VoiceOver/TalkBack Runtime review |
| UIS-007 | P1 | Web forms | Dozens of visible labels were not programmatically associated with their controls. | Added stable IDs, `htmlFor`, group labels, and descriptive accessible names; enabled JSX accessibility linting. | Verified by lint and axe |
| UIS-008 | P1 | Keyboard UI | Autofocus attributes and clickable non-interactive containers produced inconsistent focus behavior. | Replaced autofocus with controlled refs and converted/remodeled interactive elements semantically. | Verified by lint; expanded dialog test added |
| UIS-009 | P2 | Responsive coverage | Existing browser evidence covered only a small route sample. | Added public-route five-width overflow and axe matrix alongside authenticated role tests. | Automated coverage expanded |
| UIS-010 | P2 | Visual consistency | Thousands of historical one-off color values remain, although core repaired surfaces use established blue/slate tokens. | Continue token replacement only when an equivalent token exists; avoid high-risk blind rewrites. | Ongoing P2; no P0/P1 impact found |
| UIS-011 | P2 | Web dependencies | `npm audit --omit=dev` reports two high findings inherited from React Router's RSC action handling. This application uses client-side SPA routes and does not enable React Server Components or server actions. | Retained the safest compatible 7.x release; npm's proposed 7.11 downgrade is not a remediation. Track a compatible patched release. | Documented; not exploitable in the current SPA architecture |
| UIS-012 | P2 | Mobile toolchain | The Expo 55 / React Native 0.83 production tree reports 18 high advisories through CLI, Babel, Jest/codegen, glob, and browser-launcher tooling. npm offers only major Expo/React Native upgrades. | Do not use `--force`; schedule a tested SDK migration and rerun native builds, exports, and device checks afterward. | Documented upgrade debt; no runtime UI exploit reproduced |

## Route families reviewed

- Web public/auth/legal, worker, employer, admin, shared profile/settings, legacy redirects, and unknown-route fallback.
- Mobile onboarding/auth, worker dashboard/jobs/applications/saved jobs/messages/profile/settings/wallet/support, employer dashboard/jobs/applications/messages/profile/notifications/wallet/payment methods.

## Runtime review gates

- VoiceOver and TalkBack reading/focus order.
- Physical Android and iOS safe areas, keyboard avoidance, large text, and 44px target verification.
- SecureStore migration from a previously installed build.
- Real PayMongo/Xendit browser handoff and return flow.

## Automated evidence

- `npm run verify`: UI security scan, ESLint, web/mobile TypeScript, 29 server tests, and production web build passed.
- `npx playwright test`: four browser suites passed, including all public routes at 320, 375, 768, 1024, and 1440px, axe checks, dialog focus return, authenticated role routes, and controlled HTTP 503 recovery.
- `npx expo export --platform web`: passed.
- `git diff --check`: passed.
- Dependency review: zero critical findings; accepted toolchain/advisory limitations are recorded as UIS-011 and UIS-012 rather than reported as resolved.
