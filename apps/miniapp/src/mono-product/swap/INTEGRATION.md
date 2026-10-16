# SwapFlow — bounded demo

Import `SwapFlow` / `SwapFlowProps` from `./swap`. Props are the actual shared commerce alias, with required `onSimulationResult` and identity-bearing `onSubmitBusyChange`; no separate swap contract or default port.

The host supplies its memoized demo `SwapPort`, exact narrowed source route, privacy, route-scoped draft, Back/Close, and optional history/close-button callbacks. Keep the flow mounted across appearance/privacy/equivalent-route renders. Full action/account kind/account/asset/network changes start a new local session. Port replacement invalidates quotes/results and aborts old work; the host also guards adapter/port generation as specified by the commerce manifest.

One offered destination is preselected; a restored unoffered pair cannot calculate until the visitor chooses an offered destination. Reverse is absent. Input/source, fee, total debit and net credit remain separate: demo 100 USDC → 0.04 ETH costs 101 USDC. This UI uses only the shared request/quote/result guards and never calculates an exchange rate from portfolio values.

Busy is raised synchronously with an accepted quote/key/operation identity before calling submit. Terminal ingestion runs before the matching release. Back/Escape/local close are blocked during pending with explanatory copy. Close/context controls outside the flow remain the host's responsibility. The UI aborts and releases the exact accepted identity on unmount, suppresses late terminal callbacks, and never writes history or snapshot balances. Submit unavailable/error/throw/mismatched result recovers to a new calculation without a terminal callback. Simulated success alone emits a matching draft clear; a valid simulated failure is a terminal journal result and retains its draft.

Both accepted legs and fee/total are masked while private; input DOM values are empty and form/confirmation are disabled. Raw draft remains in memory. No hidden numeric title/aria copies, financial count-up, loop, new dependency/material host, fake ETA or transaction hash. Local CSS uses MONO tokens, 44px controls, 21px heading, 30px tabular amounts and finite 220ms/4px step entry only in a motion-ready scene; static/reduced motion settles immediately.

Verification belongs to `swap-flow.test.tsx`. Shared commerce suites are Task1's responsibility; root handles the cross-contract/browser review and ORACLE the common typecheck/build. This module has no visual approval or deployment claim.
