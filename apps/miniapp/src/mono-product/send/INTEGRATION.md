# SendFlow — task #41

Отдельный React-модуль для существующего detail отправки. В `/mono` ещё не подключён. Нового route, material host, canvas, runtime или зависимости нет. Все денежные действия — симуляция.

## Exports

Из `./send`:

- `SendFlow`, `SendFlowProps`, `SendBatteryActivity`, `SendOperationStatus`.
- `createMockSendPort(snapshot?: ProductSnapshot): SendPort`, `mockSendPort`.
- Типы: `SendPort`, `SendCallOptions`, `SendRouteData`, `SendTerms`, `SendRecipient`, `SendRequest`, `SendQuote`, `SendQuoteResult`, `SendDemoResult`, `SendIssue`, `SendIssueCode`.

```ts
type SendFlowProps = {
  route: ProductActionRoute;
  port?: SendPort;       // default: mockSendPort, MULTI_ACCOUNT_DEMO only
  privacy?: boolean;    // default false; masks money, recipient and memo
  onBack(): void;       // recipient/result -> existing route chooser
  onClose(): void;      // Escape, success Done, failure Close
  onAssetDetails?(): void;
  onBatteryActivityChange?(activity: SendBatteryActivity | null): void;
  onOperationChange?(operation: SendOperationStatus | null): void;
};

type SendBatteryActivity = { poolId: string; phase: "using" };
type SendOperationStatus = {
  status: "preparing" | "pending" | "completed" | "failed";
  estimatedRemainingSeconds: number | null;
};
```

Back within the flow moves review -> amount -> recipient. Changing account/asset/network/action remounts the session and aborts outstanding work. Equivalent route objects and privacy changes retain the draft. Keep the component mounted across appearance changes; do not key it by preset. A different port instance reloads its route and resets the session, so memoize ports.

## Minimum integration

The current chooser/detail lives in `product-sheet.tsx` (`ProductOverlay` / `RouteDetail`). Replace only its selected `send` branch with the following body component. Retain the enclosing `ProductSheet` for dialog semantics, its close button, focus trap, focus return and scrolling/safe-area. `SendFlow` is a section, not a second dialog.

```tsx
import { useMemo } from "react";
import type { ProductActionRoute } from "@wallet/core";
import { SendFlow, createMockSendPort } from "./send";
import type { MonoProductCommands, MonoProductView } from "./product-controller";

function SendRouteDetail({ route, view, commands }: {
  route: ProductActionRoute;
  view: MonoProductView;
  commands: MonoProductCommands;
}) {
  const port = useMemo(() => createMockSendPort(view.snapshot), [view.snapshot]);
  return <SendFlow
    route={route}
    port={port}
    privacy={view.balanceHidden}
    onBack={() => commands.openIntent("send")}
    onClose={commands.closeSheet}
  />;
}
```

No hook should be inserted below `ProductOverlay`'s conditional returns. This wrapper avoids that problem. Use `route.action === "send"` before rendering it. An unsupported route fails closed inside the module as well.

### Asset details and operation estimate

`onAssetDetails` turns the existing asset/network header into a 44px-minimum button, labelled e.g. `О валюте USDC в сети Ethereum`. Without the callback it stays a static display. The button remains available during pending because the host detail is read-only. The callback itself changes no form state and performs no send/quote call.

Keep SendFlow mounted with a stable port and route identity while the host shows asset details. Hide/inert its body as appropriate for host focus management; on return restore focus to the header button. Recipient, amount and quote remain in the same session (normal quote expiry still applies). Send remains inside the existing popup. This module does not render another asset-detail route or dialog.

Optional `SendQuote.estimatedCompletionSeconds?: number | null` is a provider-supplied estimate for the current operation. Only finite nonnegative numbers are used; absent/null/invalid values show `Время уточняется` during pending. A positive estimate is formatted as an approximate duration without an interval or countdown. Zero explicitly says that confirmation is still awaited. Only `send()`'s result moves the flow to success/failure. The default mock provides no estimate.

Forward `onOperationChange={handleOperationChange}` to the host's asset detail as the same presentation snapshot shape:

- Route ready and recipient/amount/quote/review: `preparing`, estimate `null`.
- Pending: `pending`, estimate from the current quote or `null`.
- Result: `completed` / `failed`, estimate `null`.
- Loading/reset/unmount: `null`; a new ready route subsequently emits `preparing`.

Callback identity changes do not re-emit; cleanup uses the latest committed handler. These statuses describe the **demo simulation**, not an on-chain confirmation. The host must preserve its demo label. ETA belongs to this operation, never the BatteryPool. No recovery/recharge estimate, charge percentage calculation or new event bus is introduced. When no operation exists, host detail can say `Ожидание появится при отправке`.

### Battery activity callback

Pass `onBatteryActivityChange={handleBatteryActivityChange}` to connect the common battery UI. It emits `{ poolId, phase: "using" }` only during pending after successful quote validation and only for the quoted battery pool. Eligible routes, recipient/amount entry, quoting and review stay `null`. Result/failure/reset clears activity; route-session unmount also emits `null`. Initial mount emits `null`. Back before submission is idle; Back during pending is disabled.

Handler identity changes do not replay the event. Notifications and cleanup use the latest committed handler; the existing request generation guard prevents late results of a previous route from changing the new route's activity. Preserve the component instance across ordinary parent/appearance renders. An accepted quote expiring after submission does not end a pending hold: result or reset ends it.

The pending explanation contains a small green battery glyph. Only its fill breathes, only while the document is visible and `prefers-reduced-motion: no-preference`. It is static for hidden/reduced states, and its visibility listener is removed on unmount. Visibility does not change the semantic activity callback. No common scene/controller changes, fake recharge/debit, extra runtime or delay were added; the mock port already has an abortable 700ms send delay.

## Port boundary

`SendPort.mode` and all quotes/results require the literal `"demo"`. This is a provisional frontend contract, not a verified backend DTO. It cannot truthfully present a live send result without a separate contract change.

1. `loadRoute(route, { signal })` supplies precision, available quantity (or `null`), optional minimum/maximum and recipient field metadata. `null` route data means unsupported. Missing limits mean no local limit check was supplied, not a promise about real limits.
2. `validateRecipient(route, { address, memo? }, { signal })` owns network validation and canonicalization. Required memo is also checked before progression. The owner confirmed on 2026-10-03 that address/internal-ID rules remain unknown and belong to the backend.
3. `quote(request, { signal })` returns `quoted` or `unavailable` with a typed issue. A quote binds account, asset, network, recipient, memo and canonical decimal amount. It supplies current terms, full debit from the source asset, network fee and explicit funding for this operation. `feeFunding.balance.status` is the provider's funding decision; the UI does not invent network-specific fee accounting.
4. `send({ quote, idempotencyKey }, { signal })` runs only after explicit confirmation. Results are `simulated-success` or `simulated-failure`; there is no transaction-hash field. Failure requires a fresh quote and a new deliberate confirmation before retry.

Monetary comparisons use normalized strings. Only the isolated mock's native-asset fee addition uses integer `BigInt` units. Amounts never pass through floating-point conversion. Quotes with unknown fee/funding/available quantity, expired timestamps, mismatched inputs, insufficient assets or insufficient fees cannot be confirmed. Battery funding also checks the pool's network, action, eligible accounts and known capacity. Pool presence alone grants no coverage.

Requests use abort signals plus a generation guard, so ignored aborts cannot revive an old quote. A synchronous ref lock prevents duplicate submit before React disables the control. Quote expiry has a finite timeout with cleanup and is checked again on review/submit. Pending and result skip quote expiry because submission has already started.

## Explicit mock assumptions

- Only routes supplied by the passed demo snapshot and the local fixture map are supported. The default port uses `MULTI_ACCOUNT_DEMO`; pass a port created from the current snapshot for single-account fixtures.
- Recipient is `demo:recipient` or `demo:` followed by 1–40 Latin letters/digits/underscores/hyphens. It is not a real destination. Default memo is absent.
- BTC/Bitcoin, ETH/Ethereum, USDC/Ethereum and USDC/Solana each have a synthetic fee scenario. Values are UI fixtures, not network tariffs. Quote lifetime is a demo 60 seconds.
- Available quantity comes only from the snapshot's `availableQuantity`. In the current multi-account fixture ETH remains unknown, so confirmation is unavailable; total holding quantity is not substituted.
- USDC/Ethereum can demonstrate one charge from the eligible shared network pool when explicitly quoted. Other supported scenarios use synthetic sufficient fee funding. These scenarios do not imply actual funding or mutate a holding/pool.
- Battery copy describes pending hold and debit after success. Demo values never change. Real reservation/release rules, fees and backend DTOs remain unknown.

## Verification and handoff boundary

Focused RED/GREEN only:

```powershell
pnpm --filter @wallet/miniapp exec vitest run src/mono-product/send/send-validation.test.ts src/mono-product/send/send-flow.test.tsx --reporter=dot
```

Result: **2 files, 30 tests passed**. Coverage includes large exact decimals and atomic boundaries, limits/precision, recipient delegation, route/input invalidation, quote races, expired/unknown quote, separate insufficient asset/fee, battery scope, duplicate submit, pending/success/failure/retry, privacy and navigation. One self-read completed.

Battery follow-up: one focused lifecycle RED/GREEN, **1 passed / 12 skipped** (the prior 30-test suite was not rerun):

```powershell
pnpm --filter @wallet/miniapp exec vitest run src/mono-product/send/send-flow.test.tsx -t "reports battery activity only" --reporter=dot
```

It covers idle/review/back, pending, parent rerenders with a replaced callback identity, hidden/visible icon gating, success/failure, route replacement with an old result arriving during the new send, retry and unmount cleanup.

Asset-details / operation-ETA follow-up: **4 passed / 13 skipped**, covering callback/draft/quote preservation across host rerender, static fallback, read-only details during pending, and absent/positive/zero operation estimates. Neither the 30-test suite nor the battery lifecycle test was rerun:

```powershell
pnpm --filter @wallet/miniapp exec vitest run src/mono-product/send/send-flow.test.tsx -t "opens asset details without|shows only supplied operation ETA" --reporter=dot
```

CSS is local, uses existing MONO tokens, 44px controls, tabular digits, finite 220ms/4px stage motion and immediate reduced-motion states. No financial number count-up/blur. The orchestrator/ORACLE still owns overall typecheck/build and the browser review at 320/390/430/480 widths in light/dark and all seven presets. This module has not been visually approved or deployed.
