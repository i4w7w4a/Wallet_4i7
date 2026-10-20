# Compact MONO workbench — local integration

20 October 2026, Europe/Moscow. **LOCAL READY; owner visual acceptance pending.** No push, merge, PR, CI dispatch, SSH or publication. Public Gold/MONO remain their existing builds.

## Exact runtime

| Item | Value |
| --- | --- |
| Main editor | http://127.0.0.1:3202/mono |
| Branch | `codex/compact-workbench-20261020` |
| Compiled SOURCE | `7dbf2b80086abe7ccb25b9df9d989d36e04230a1` |
| BUILD_ID | `HmJCvH9_hvuQkGWzY7BM3` |
| App adoption | `b0ac6a74e6394f2e5404539f1a983176d722769c` |
| Test-only compiler fix | `9c345c79d54adbde01778ca4e4a8e2a00714dc11` |
| CSS-only browser fix | compiled SOURCE above |
| Runtime | PID33480, launch `0ca4f715806546248f35dd9e3ad91c40` |
| Started | 20.10.2026 12:01:24 Moscow (`09:01:24.6079443Z`) |
| Output | `apps/miniapp/.next-review/compact-workbench-scrollfix-20261020` |

Later documentation commits are not a new compiled SOURCE or BUILD. ORACLE's original technical record is retained as `TECHNICAL_READY_VISUAL_PENDING`; this release records the subsequent root UI result, without rewriting producer evidence.

## Delivered and preserved

Real editor, portable viewer and published-viewer **source hosts** now opt into existing neutral compact Home/History. This does not update any running public binary. The editor still edits its seven local working documents; archived appearances are not imported or used to replace those documents.

Home has one total-balance card/eye, four existing actions with original frames/materials/artwork, one «Мои средства» entry into existing Assets ALL and pending. Account tabs/pins, chart, Promo, inline holdings and recent-completed duplication are absent. History reuses UTC date groups, compact rows and visible pending/error; existing search, filter, privacy, receipt and Back behavior remain.

Chart controls are disabled with a retention explanation. Balance controls remain functional. Assets controls identify their actual screen and use the existing guarded Funds entry. Optics applicability follows the existing actual shared-host predicate, not raw binding count; absent hosts show retained values but no misleading Apply. Dock keyboard entry remains available after a selected tool becomes disabled.

Only five production files changed: three MONO hosts, tool dock and two scoped root scrollbar CSS rules. Four focused test files changed. No Gold appearance/code, profile, scene/controller/financial commands, receipt content, presets/checkpoints, schema/storage keys, materials/artwork/renderer, packages/lockfiles or dependencies changed. Ordinary viewer preference semantics remain unchanged; the isolated pilot's zero-storage-read promise does not apply to ordinary viewers.

## Verification — exact chronology, not an all-green suite

- Expected TDD RED: workbench4FAIL/1PASS, then hosts16FAIL/0PASS after separately correcting invalid fixture metadata; no app edits before those expected failures. New focused cases21PASS.
- Affected13files:82PASS/4FAIL. Two stale structural expectations were adapted to compact behavior: focused follow-up26PASS/1FAIL, then exact current-DOM case1PASS/19SKIP. These are separate observed runs, not a combined green suite.
- Two ordinary-viewer zero-getItem expectations remain unresolved (`mono-published-viewer.test.tsx`, `mono-viewer-page.test.tsx`): unchanged preference hooks read theme/pins. No fresh historical-baseline reproduction was performed; do not equate them with historical31 failures. Existing old-scenario `act` warnings are retained. New compact cases had no new `act` warning in the affected run.
- One scoped SOL MAX spec/quality review approved with zero findings. Actual compiler then found TS2540 in a new test fixture;9c345c7 reconstructs readonly buttons immutably. Focused1PASS/4SKIP and scoped fix review passed; actual second tsc exited0. Original compiler failure is preserved.
- First private codec invocation:7/7 strict archive encode/decode canonical equality, revisions2/5/3/3/2/2/2, including materials. First isolated build9c exited0; BUILD `r7wMn7RizyS6pi7gYcVzt`.
- Actual root browser then found a native root scrollbar on no-material slot3 History: viewport390/client375 versus Home390/390. CSS-only7db hides native scrollbar only for neutral compact root, without changing overflow/height/scroll root/handlers. Scoped fix review approved; one affected CSS rebuild exited0. No separate tsc/codec/app-suite repetition for that CSS-only delta.
- Final ORACLE proof: `/mono`, `/mono/view`, `/gold` HTTP200 with final BUILD;35 assets match static output/disk byte-for-byte;16 protected files unchanged. Publication APIs503 «Публикация не настроена», all publishing environment unset. Only owned prior3202 process49280 replaced after candidate validation; its output retained, no rollback performed.

Historical1704PASS/31FAIL and prior pilot127PASS/1FAIL remain distinct records. No all-tests-GREEN assertion is made.

## Actual root browser checks

| Archived appearance | Home/History390 | Narrow320 |
| --- | --- | --- |
| 1 Графит rev2 — dark/Plex Sans/group | PASS | PASS |
| 2 Живая среда rev5 — dark/Onest/fluid | PASS | Reduced-motion/transparency Menu sample |
| 3 Светлый rev3 — light/Golos | PASS | PASS + natural keyboard scroll/focus |
| 4 Терминал rev3 — dark/Plex Sans/4px actions | PASS | Not run |
| 5 Минимал rev2 — light/Onest/frameless | PASS | PASS |
| 6 Мягкое стекло rev2 — Frost/Golos/volume | PASS | PASS, settled artwork capture |
| 7 Фирменный rev2 — dark/Manrope/contour/separate | PASS | PASS;480 Home spot also PASS |

All seven actual390 Home/History viewport/client/scrollWidth remain390/390/390; narrow samples320/320/320. Fonts ready, dark/light tokens and original frame/artwork distinctions retained. Canvas counts1/1/0/0/0/0/0; no second renderer. Home action targets at390 were83–87×79; narrow minimum69.5×74, all at least44.

Actual main workbench: slots1–7 switch, usable Balance trial/Cancel/Apply/restore, Assets target note, conditional optics/readable disabled controls/no Apply, dock Tab/End focus. Those functional checks ran on9c;7db changes only scrollbar CSS. Shared demo paths: Funds→Assets ALL→Back focus; Menu→My Accounts→Main→pending receipt→same account/pending focus, working ALL context preserved; privacy masks visible and ARIA values, receipt close restores row focus; no-match search/reset and pending filter/reset. No financial transaction submitted.

After final CSS: slot3 History320 naturally scrolls by native End, document exceeds viewport, last row remains reachable above navigation; Enter opens/closes failed receipt and restores focus to the same row. Root scrollbar remains hidden without loss of scrolling. Reduced-motion/transparency sample remains readable/static; media overrides cleared. Gold Home/History spot explicitly has no neutral-compact root attribute, original presentation/style and automatic root scrollbar rule preserved.

Console error/warning samples: none in workbench, portable or Gold tabs; final fresh workbench also none. Temporary device-size tabs closed and replaced by ordinary-size deliverable tabs, old3201 retained. This is bounded IAB QA, not real device/touch, FPS/GPU performance, full accessibility/contrast certification, backend/security, every receipt or all browsers. Browsers without `:has` retain prior scrollbar behavior and were not tested.

## Evidence and handoff

Private local evidence is retained, not committed as public project material:

- `.superpowers/sdd/2026-10-20-compact-workbench-integration/`: actual `qa-report.md`, seven link list, final390/narrow metrics, RED/GREEN scrollbar evidence, scroll/focus proof and screenshots.
- `.superpowers/runtime/compact-workbench-scrollfix-20261020/`: producer technical record, static/HTTP/protected/swap evidence.
- `.superpowers/runtime/compact-workbench-20261020/portable-links.json`: original codec proof generated at9c; renderer is7db, unchanged payload/codec bytes. These are portable local previews, not new `/p/N` publications.

End check20.10 at12:14 Moscow:3202 `/mono`200/final BUILD present/PID33480 and preserved3201 `/mono/pilot/2`200/BUILD `y5Ua9obKNjjSDW6gqFPDU`/PID6764. Generated `next-env.d.ts` remains dirty and uncommitted; old outputs/ports and evidence retained. No public runtime or remote repository changed.

Owner should compare the seven archived looks via the retained local link list, then try Funds/History in the real workbench. Appearance character and compact structure are the visual decision; publication/merge require a separate instruction. Do not repeat implementation/review/build/QA merely because a later docs commit changed HEAD.
