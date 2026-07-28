# Week 1–3 runtime verification

Verified on July 28, 2026 against an isolated in-memory backend and an authenticated worker account.

## Evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Web screenshots at 320, 375, 768, 1024, and 1440px | Verified for the representative worker Find Jobs route | `find-jobs-320px.png`, `find-jobs-375px.png`, `find-jobs-768px.png`, `find-jobs-1024px.png`, `find-jobs-1440px.png` |
| Horizontal overflow at the five target widths | Passed | Each measured document width equals its viewport width in `runtime-report.json` |
| Keyboard focus order | Verified for the worker Find Jobs route and mobile navigation drawer | All sampled controls were visible and named; the drawer opens with Enter, traps focus, closes with Escape, and returns focus to its trigger |
| Automated accessibility scan | Passed on the representative worker Find Jobs route | 33 axe rules passed and zero violations remained after fixes |
| Screen-reader testing | Runtime review | An automated semantics scan is not a substitute for an actual screen reader |
| VoiceOver and TalkBack | Runtime review | No usable iOS/Android simulator or physical device was available |
| Authenticated worker happy path | Partial runtime review | OTP sign-in and authenticated job discovery passed; open/save/apply/message requires representative seeded jobs and conversations |
| API failure path | Verified on web | A controlled HTTP 503 produced the themed error state and a visible Try again control; see `find-jobs-api-failure-375px.png` |
| Android and iOS device verification | Runtime review | Mobile TypeScript passes, but no actual device/simulator evidence exists yet |

## Defects found and corrected

- The account initials used blue text that did not meet minimum contrast on the light-blue avatar. The foreground is now `#1D4ED8`.
- Navbar content was outside a semantic landmark. The shell now uses a `header` landmark.
- The mobile navigation did not manage focus. It now receives initial focus, traps Tab/Shift+Tab, closes with Escape, and returns focus to the menu trigger.

## Reproducible checks

- Web production build: passed.
- Mobile TypeScript (`tsc --noEmit`): passed.
- Detailed machine-readable output: `runtime-report.json`.

The remaining runtime-review gates must not be marked complete until a human tester records the device, OS/browser or assistive technology version, route, expected result, actual result, and screenshot/video where applicable.
