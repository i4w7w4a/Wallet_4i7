# Task 2 — BuyFlow handoff

## Status and ownership

`DONE` — compact demo purchase flow implemented; targeted behavioral RED/GREEN complete. No blockers in the owned component.

Canonical checkout: `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`.
Branch: `codex/product-ux-20261003`. Contract v1: `20f2a39`; runtime handoff: `e48a801`.
Ownership: `apps/miniapp/src/mono-product/buy/**` and this report only.
No helpers were spawned. No shared guards, types, ports, controller, history, Send/Receive, theme settings, presets, published snapshots, server or public site were edited. Foreign `apps/miniapp/next-env.d.ts` is preserved.

The owned commit contains only the six Buy files below and this report; its exact SHA is supplied in the DONE message to the coordinator.

| File | Responsibility |
| --- | --- |
| `buy/index.ts` | Public `BuyFlow` and matching shared `BuyFlowProps` alias |
| `buy/buy-flow.tsx` | Method, raw amount, review, pending, result, errors and navigation content |
| `buy/use-buy-flow.ts` | Async ownership, raw draft, shared guards, immutable acceptance, callbacks and cleanup |
| `buy/buy-flow.module.css` | Isolated presentation using existing mono variables and agreed Buy/Swap spacing |
| `buy/buy-flow.test.tsx` | 21 targeted component/async lifecycle cases |
| `buy/buy-test-utils.ts` | Test-only real demo port, exact fixture capability and deferred async boundary |

## Result and integration

Public entry: `../buy`. `BuyFlowProps` is re-exported from the actual commerce contract without a parallel definition. Supply stable route/port and the required `onSubmitBusyChange` / `onSimulationResult` callbacks. Inside the existing ProductSheet pass `showCloseButton={false}`. Host retains modal/focus trap/safe-area/context ownership.

Flow: exact destination load → available demo payment method → raw fiat amount → review with payment, full debit, net credit, fee, destination account/network, demo rate and notice → explicit `Подтвердить симуляцию` → pending → validated demo success/failure or recoverable error → optional `В истории` callback. Unsupported route, no method and load error show a compact explanation and Back; retry is present only for a retryable load error.

The explicit fixture displays input 100 USD, full debit 101 USD, fee 1 USD and net credit 100 USDC. Values remain decimal strings. No UI money arithmetic, card fields, provider, redirect, real API, transaction hash, progress percentage, invented ETA or balance mutation was added.

Raw input, including invalid values, survives Back, errors, privacy and equivalent appearance renders. Initial draft restores only raw method/amount for the complete matching action/account/kind/asset/network route. Quote/result/stage do not restore. Returning from review revokes authorization; changing method, amount, route or port aborts/invalidates earlier quote ownership. Only a validated simulated success clears this flow's draft through its scoped callback; a validated failure retains input and requires a fresh quote.

Shared `validateCommerceAmount`, `validateBuyRequest`, `validateBuyQuote` and `validateCommerceSimulation` own financial validation. Route loading also uses the shared request guard against supplied method minimums to reject an unusable/mismatched ready payload. No financial guard or synthetic contract was invented in Buy.

A ref locks submit before React can disable the button. Acceptance fixes one quote snapshot, idempotency key and `commerceOperationId`; the quote is copied and deeply frozen before review/acceptance. Busy=true is reported synchronously before calling the port. Validated immutable terminal event is reported once BEFORE busy=false releases that exact operation ID. Transport/unavailable/malformed/mismatched responses return to editable amount without a history event. Observer failure cannot replay an attempt or prevent release. Abort plus generation ownership rejects obsolete responses; unmount aborts and releases the accepted identity without publishing a late result. Quote expiry before acceptance revokes confirmation; expiry after acceptance leaves pending intact.

Pending Back/Close/Escape are blocked by the local accepted ref and explain waiting for the result. Host additionally owns its identity-based close/context guard. UI adds no fake delay or pending timer; the supplied demo port's bounded completion policy owns resolution.

## Privacy, presentation and motion

Privacy removes the amount input from DOM, masks payment/debit/credit/fee/rate on review and receipt, leaves no copies in aria/title, disables method edits/quote/confirmation, and preserves the raw draft in memory. A privacy render updates current content immediately without an exit clone retaining old values.

Own CSS Module continues the agreed existing Send grammar: route icon 36px/gap10; heading21/margin14; amount30/tabular numerals; form gap8; detail rows gap10; controls ≥44px; full-width CTA with current radius and theme/font/focus variables. Existing sheet supplies the shared material surface. No new shader, canvas, dependency, global motion setting or design system.

Step entry is finite 220ms/4px/current easing/zero overshoot, only under `data-mono-motion="ready"` with system no-preference. Static/system reduced modes remove motion and present final content immediately. Financial values themselves have no number/count-up/blur animation, and there is no persistent loop/RAF.

## Targeted verification

Read TDD and `writing-good-tests.md` before tests, motion-design for local motion, our-skills for canonical skill discovery, local Next client-boundary guide, and systematic-debugging for the test fixture clash.

Behavioral RED used the existing null-rendering component seam after real runtime exports were available: **21 failed** for missing UI states, not missing imports. Tests use the actual demo factory and shared guards; only async port boundaries are deferred. Financial expectations are independent literals. The duplicate case reenters submit synchronously from the port before the outer click commits pending, then observes one pending operation and one immutable terminal event.

An initial GREEN attempt exposed duplicate buy capabilities in the test utility after Task4 added the exact capability to the base snapshot. The real port correctly refused that ambiguity. Only `buy-test-utils.ts` was corrected to extend an absent capability, matching Task1's current fixture discipline; no production guard was relaxed.

Final targeted command:

```powershell
pnpm --filter @wallet/miniapp exec vitest run src/mono-product/buy/buy-flow.test.tsx --reporter=dot
```

Final result: **1 file, 21 passed**, about 5.25s; no warnings/errors. Covers explicit review/pending/terminal, same-event duplicate, result-before-release, immutable accepted quantities, draft/back/restoration, invalid precision correction, stale quote race, quote destination/funding mismatch, expiry before/after acceptance, privacy DOM/action/receipt policy, submit throw/unavailable/error, terminal identity/credit mismatch, valid failure deduplication, unsupported/empty/load error/retry, port replacement and unmount/late completion.

Task1 guard/decimal/port suites were not repeated. No full suite, lint, common typecheck, build, browser, server, publication, push or merge was run. Root owns one cross-contract/browser pass; ORACLE owns the common typecheck/build.

## Remaining acceptance boundary

No known component blocker. Visual acceptance at 320px and across the seven themes, and shared host/controller integration, remain with the agreed root/ORACLE pass. Technical component GREEN is not visual approval by the owner. Build/typecheck are unverified here by explicit task scope.
