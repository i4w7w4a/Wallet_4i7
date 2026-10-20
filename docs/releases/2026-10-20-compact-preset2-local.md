# Compact MONO preset 2 — local pilot

20 October 2026, Europe/Moscow. **LOCAL READY; owner visual decision pending.** No publication, push, merge, CI dispatch, SSH or changes to existing public Gold/MONO.

## Exact identity

| Item | Value |
| --- | --- |
| URL | http://127.0.0.1:3201/mono/pilot/2 |
| Branch | `codex/compact-preset2-20261020` |
| Compiled SOURCE | `0ea5225822bde8630018ae04d34c6bf9f6577386` |
| Application changes | `297978e8b558429bd05acd60e4de857d96a7dc47` + `9b1831932bb1f392d049ef0c0580732b6c219688` |
| BUILD_ID | `y5Ua9obKNjjSDW6gqFPDU` |
| Launch | `2759de3243d04d86b75cfccefc32713b`, PID6764 |
| Started | 20.10.2026 10:26:54 Moscow (`07:26:54Z`) |
| Local dist | `apps/miniapp/.next-review/compact-preset2-20261020` |
| Server-only opt-in | `MONO_COMPACT_LOCAL_PREVIEW=1` |
| Appearance | Preset2 «Живая среда», revision5, immutable17.10 archive |

Later docs commits do not change compiled SOURCE/BUILD. The exact appearance archive is not presented as today's freshly fetched live/editor state. The read-only pilot does not save editor preferences or publish a new preset.

## What changed

The existing shared scene now accepts neutral host-only compact Home/History options, separate from Gold paint. Only the new pilot opts in. Home shows a total-balance card, the original four material/artwork actions, one Funds entry into existing Assets ALL, and pending. History reuses date groups, compact rows and explicit noncompleted status with existing filters and inline receipt. No financial controller, command, receipt field or customer/security rule was replaced.

Preset2 palette, type, its own background material and original group-frame actions remain. Gold appearance/liquid settings are not applied to MONO. Promo/chart/home-pin settings remain saved, but those Home controls are not displayed in this read-only pilot. Real editor integration and the remaining six appearances are a later scope after the owner's visual decision.

## Review and tests

- Author actual initial RED:8FAIL/2PASS before production changes. First new test-path error was corrected in the test, not in production.
- Completed affected run: **127PASS/1FAIL** in11files. The observed failure is `mono-published-viewer.test.tsx > renders the published product scene with wallet sections and no editor or storage access`, expecting0getItem while unchanged ordinary visitor preference hooks read viewer-theme and home-pin keys. No fresh baseline execution/name-by-name match to the historical31FAIL was claimed. No unrelated fix or broad rerun.
- Independent review found one Important new-host issue: ordinary standalone preference restoration could migrate/rewrite preexisting home pins. Valid populated v1/v2 tests reproduced it (**2RED**). Pilot-only real controlled in-memory session fixes it without editing ordinary hosts/hooks.
- Final affected fix check: **42/42PASS** in4files, including byte-identical complete populated storage before/after Funds/Profile/History/privacy interactions and0setItem/removeItem/clear. Scoped re-review: finding ADDRESSED, no new Critical/Important. All seven archived byte/canonical/envelope checks pass.
- Source-scoped protection: Gold appearance/viewer/renderer/styles, profile, packages/lockfile, financial controller/persistence and seven snapshots unchanged. Neutral defaults retain ordinary MONO and Gold behavior; current Gold component checks passed.

## ORACLE runtime proof

ORACLE used Node24.21.0/pnpm10.33.2 and435offline reused packages,0downloads/install scripts. One actual TypeScript compiler run and one production build exited0. The first attempted TypeScript path did not exist and failed before the compiler ran; it is retained separately, not counted as a successful check. An initial string/DateTime process-identity comparison was corrected by matching UTC creation ticks; no process restart was needed.

Pilot, ordinary `/mono` and `/gold` returned200;35resource bytes matched the build.16protected files, including all seven appearances, remained byte-identical. Old local ports/outputs were not replaced (no old listeners were present during preparation). No resource limits, public server or proxy changes.

Next generated only two type-import path changes in `apps/miniapp/next-env.d.ts` to the isolated dist. They are retained **uncommitted**, with the original copy preserved. They are not an application patch or a second build. `tsconfig.json` unchanged. Runtime metadata/logs: `.superpowers/runtime/compact-preset2-20261020/` (local, ignored), especially `local-ready.json`, `process-identity.json`, `http-smoke.json` and protected-file records.

## Root actual browser proof

Root used a new local IAB tab, not the user's external browser/account. Confirmed the real running pilot and its supplied archive appearance.

- Home390/320 and spot480: one card/eye, four existing actions, one Funds entry, pending; no Home chart/Promo/inline holdings/last-completed/pins. Document and wallet scrollport widths matched viewport; no horizontal overflow. Visible Home action targets measured at least44px. One material canvas, not a second Gold background renderer.
- Funds opens Assets ALL with three assets. Enter-key activation and Back return focus to Funds with focus-visible. Avatar opens the unchanged Profile and second activation returns to Assets.
- Menu→My Accounts→Основной→pending opens its exact USDC/Ethereum receipt; «К счёту» returns to the same account, pending-trigger focus and visible working context «Все счета». Inspection does not select that account.
- Main History has three UTC date groups and distinct pending/failed text/icons. Existing inline receipt expands/collapses. Search no-match, global reset, status selector pending-only and its reset work. Known pre-existing empty-reset BODY focus is not declared fixed.
- Hidden totals propagate into History row accessible names and receipt amount masking. Amounts were restored visible afterward.
-320History scrolls with native scrollbar hidden; final row bottom643.23 remained above nav top692 at scrollTop153. No width jump. A first screenshot immediately after resize showed a stale capture surface; fresh DOM/next capture agreed at320×760 without code changes.
- Emulated reduced-motion/reduced-transparency: readable layout, `data-mono-motion=static`, near-zero Funds transition; one canvas. Media overrides were cleared. This is not certification of every effects-off/GPU failure mode.
- Bounded local Gold Home/History check retained `presentation=gold`, original Gold viewer and date groups, one canvas/no overflow. No public Gold was interacted with or changed. Ordinary MONO HTTP smoke and source/default-mode tests are not a seven-theme visual certification.
- Pilot and local Gold console logs:0errors/0warnings. Final local GET returned200 with the expected BUILD in HTML. Browser viewport/media overrides reset; temporary Gold tab closed, pilot tab marked deliverable and shown on Home.

Screenshots retained locally in `.superpowers/sdd/2026-10-20-compact-structure-pilot/`: `home-390.jpg`, `home-320.jpg`, `history-390.jpg`, `history-320.jpg`. They are generated evidence, not preset data. Source/review/test reports and ledger remain in that same plan-owned ignored folder.

## Limits and next decision

Not verified here: real phone/Telegram, backend/real payments, FPS/full AA, extreme numeric fixtures in the actual browser, all seven appearances or live editor integration. Historical31baselineFAIL and the separately observed1FAIL remain reported, not silently marked GREEN. Request-time flag default-off was covered in component tests; the running process deliberately enables it, so a separate compiled flag-off process was not launched just for this proof.

Owner should evaluate the card proportions, original action group versus the simplified structure, Funds entry and compact History on this appearance. Acceptance does not automatically authorize rollout to the other six, editor changes or publication. The stable public release remains Gold18.10 and the existing MONO runtime.
