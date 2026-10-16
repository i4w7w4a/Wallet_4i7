import { act, cleanup, renderHook } from "@testing-library/react";
import { MULTI_ACCOUNT_DEMO, resolveActionRoutes } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import { useMonoProductController } from "./product-controller";
import type { BuyDraft, BuyRoute, SwapDraft, SwapRoute, CommerceAcceptedSubmit, CommerceSimulation } from "./commerce";
import { buyQuote, swapQuote } from "./commerce/test-fixtures";
import { commerceOperationId } from "./commerce/validation";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const buyRoute = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, "buy").routes[0] as BuyRoute;
const swapRoute = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, "swap").routes[0] as SwapRoute;

it("keeps raw Buy and Swap drafts separately through close and privacy, without persisting quote data", () => {
  const { result, rerender } = renderHook(({ hidden }) => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER,
    { initialHidden: false, hidden }), { initialProps: { hidden: false } });
  const buy: BuyDraft & { quote?: string } = { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "00100,", quote: "discard" };
  const swap: SwapDraft = { route: swapRoute, pairId: "demo-usdc-eth-ethereum", sourceAmount: "12," };
  act(() => result.current.commands.openIntent("buy"));
  act(() => result.current.commands.saveBuyDraft?.(buyRoute, buy));
  act(() => result.current.commands.closeSheet());
  act(() => result.current.commands.openIntent("swap"));
  act(() => result.current.commands.saveSwapDraft?.(swapRoute, swap));
  act(() => result.current.commands.closeSheet());
  rerender({ hidden: true });
  expect(Object.values(result.current.view.buyDrafts ?? {})).toEqual([
    { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "00100," },
  ]);
  expect(Object.values(result.current.view.swapDrafts ?? {})).toEqual([swap]);
  buy.fiatAmount = "999";
  expect(Object.values(result.current.view.buyDrafts)[0]?.fiatAmount).toBe("00100,");
});

it("keeps flow ports during an ordinary render and replaces them on adapter identity even with the same snapshot", () => {
  const first: MonoProductAdapter = { kind: "demo", snapshot: MULTI_ACCOUNT_DEMO };
  const { result, rerender } = renderHook(({ adapter, hidden }) => useMonoProductController(adapter,
    { initialHidden: false, hidden }), { initialProps: { adapter: first, hidden: false } });
  const ports = result.current.view.flowPorts;
  expect(ports?.buy.mode).toBe("demo");
  rerender({ adapter: first, hidden: true });
  expect(result.current.view.flowPorts).toBe(ports);
  rerender({ adapter: { kind: "demo", snapshot: MULTI_ACCOUNT_DEMO }, hidden: true });
  expect(result.current.view.flowPorts).not.toBe(ports);
  expect(result.current.view.flowPorts.buy.id).not.toBe(ports.buy.id);
});

function acceptance(portId = "buy-port", key = "accepted-one"): CommerceAcceptedSubmit & { kind: "buy" } {
  const quote = buyQuote();
  quote.portId = portId;
  quote.expiresAt = 61_000;
  return { kind: "buy", quote, idempotencyKey: key, operationId: commerceOperationId(quote, key) };
}
function terminal(attempt: CommerceAcceptedSubmit & { kind: "buy" }): CommerceSimulation {
  return { mode: "demo", kind: "buy", quote: structuredClone(attempt.quote),
    idempotencyKey: attempt.idempotencyKey, simulationId: attempt.operationId,
    result: { mode: "demo", status: "simulated-success" } };
}

it("blocks close and context changes only for accepted pending, records once after expiry, then releases", () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openIntent("buy"));
  const attempt = acceptance(result.current.view.flowPorts?.buy.id);
  act(() => result.current.commands.setCommerceSubmitState?.(buyRoute, { busy: true, attempt }));
  act(() => {
    result.current.commands.closeSheet();
    result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" });
    result.current.commands.openIntent("swap");
    result.current.commands.openAsset("eth");
  });
  expect(result.current.view.commerceBusy).toBe(true);
  expect(result.current.view.sheet).toMatchObject({ kind: "intent", action: "buy", route: buyRoute });
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(result.current.view.commerceGuardMessage).toBeTruthy();
  now.mockReturnValue(100_000);
  const event = terminal(attempt);
  let first: string | null = null, repeat: string | null = null;
  act(() => {
    first = result.current.commands.recordCommerceSimulation?.(event) ?? null;
    repeat = result.current.commands.recordCommerceSimulation?.(event) ?? null;
  });
  expect(first).not.toBeNull();
  expect(repeat).toBe(first);
  const entries = result.current.view.activities.filter(entry => entry.commerce);
  expect(entries).toHaveLength(1);
  expect(entries[0]?.commerce?.quote).toMatchObject({ kind: "buy", debit: { amount: "101", currency: "USD" },
    credit: { quantity: "100", symbol: "USDC" } });
  event.quote.credit.quantity = "999";
  expect(entries[0]?.commerce?.quote.credit.quantity).toBe("100");
  act(() => result.current.commands.setCommerceSubmitState?.(buyRoute, { busy: false, operationId: attempt.operationId }));
  act(() => result.current.commands.closeSheet());
  expect(result.current.view.commerceBusy).toBe(false);
  expect(result.current.view.sheet).toBeNull();
  expect(result.current.view.commerceGuardMessage).toBeNull();
});

it("rejects a mismatched terminal and an unrelated release while preserving the pending draft", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openIntent("buy"));
  act(() => result.current.commands.saveBuyDraft?.(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "100" }));
  const attempt = acceptance(result.current.view.flowPorts?.buy.id);
  act(() => result.current.commands.setCommerceSubmitState?.(buyRoute, { busy: true, attempt }));
  const forged = terminal(attempt);
  forged.quote.credit.quantity = "999";
  let id: string | null = null;
  act(() => {
    id = result.current.commands.recordCommerceSimulation?.(forged) ?? null;
    result.current.commands.setCommerceSubmitState?.(buyRoute, { busy: false, operationId: "old-operation" });
  });
  expect(id).toBeNull();
  expect(result.current.view.activities.filter(entry => entry.commerce)).toEqual([]);
  expect(result.current.view.commerceBusy).toBe(true);
  expect(Object.values(result.current.view.buyDrafts ?? {})).toMatchObject([{ fiatAmount: "100" }]);
});

it("rejects old adapter draft/terminal/release callbacks without unlocking the new accepted attempt", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const first: MonoProductAdapter = { kind: "demo", snapshot: MULTI_ACCOUNT_DEMO };
  const { result, rerender } = renderHook(({ adapter }) => useMonoProductController(adapter,
    { initialHidden: false }), { initialProps: { adapter: first } });
  act(() => result.current.commands.openIntent("buy"));
  const oldCommands = result.current.commands;
  const oldAttempt = acceptance(result.current.view.flowPorts?.buy.id, "old");
  act(() => oldCommands.setCommerceSubmitState?.(buyRoute, { busy: true, attempt: oldAttempt }));
  rerender({ adapter: { kind: "demo", snapshot: MULTI_ACCOUNT_DEMO } });
  act(() => result.current.commands.saveBuyDraft?.(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "200" }));
  const current = acceptance(result.current.view.flowPorts?.buy.id, "current");
  act(() => result.current.commands.setCommerceSubmitState?.(buyRoute, { busy: true, attempt: current }));
  let late: string | null = null;
  act(() => {
    oldCommands.saveBuyDraft?.(buyRoute, null);
    late = oldCommands.recordCommerceSimulation?.(terminal(oldAttempt)) ?? null;
    oldCommands.setCommerceSubmitState?.(buyRoute, { busy: false, operationId: oldAttempt.operationId });
  });
  expect(late).toBeNull();
  expect(Object.values(result.current.view.buyDrafts ?? {})).toMatchObject([{ fiatAmount: "200" }]);
  expect(result.current.view.commerceBusy).toBe(true);
  expect(result.current.view.activities.filter(entry => entry.commerce)).toEqual([]);
});

it("rejects an old flow draft callback after closing and reopening the same route", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openIntent("buy"));
  const old = result.current.commands;
  act(() => result.current.commands.closeSheet());
  act(() => result.current.commands.openIntent("buy"));
  act(() => result.current.commands.saveBuyDraft?.(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "200" }));
  act(() => old.saveBuyDraft?.(buyRoute, null));
  expect(Object.values(result.current.view.buyDrafts ?? {})).toMatchObject([{ fiatAmount: "200" }]);
});

it("invalidates accepted ownership when the exact capability is removed", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const { result, rerender } = renderHook(({ adapter }) => useMonoProductController(adapter,
    { initialHidden: false }), { initialProps: { adapter: MONO_PRODUCT_DEMO_ADAPTER as MonoProductAdapter } });
  act(() => result.current.commands.openIntent("buy"));
  const old = result.current.commands;
  const attempt = acceptance(result.current.view.flowPorts?.buy.id);
  act(() => old.setCommerceSubmitState?.(buyRoute, { busy: true, attempt }));
  const removed = { ...MULTI_ACCOUNT_DEMO, accounts: MULTI_ACCOUNT_DEMO.accounts.map(account => ({ ...account,
    capabilities: account.capabilities.filter(capability => capability.action !== "buy") })) };
  rerender({ adapter: { kind: "demo", snapshot: removed } });
  let late: string | null = null;
  act(() => { late = old.recordCommerceSimulation?.(terminal(attempt)) ?? null; });
  expect(late).toBeNull();
  expect(result.current.view.sheet).toMatchObject({ kind: "intent", action: "buy", route: null });
  expect(result.current.view.commerceBusy).toBe(false);
});

it("records both accepted Swap legs and clears only that draft without changing balances or battery", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const original = JSON.stringify(result.current.view.snapshot);
  act(() => result.current.commands.openIntent("buy"));
  act(() => result.current.commands.saveBuyDraft?.(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "200" }));
  act(() => result.current.commands.openIntent("swap"));
  act(() => result.current.commands.saveSwapDraft?.(swapRoute, { route: swapRoute, pairId: "demo-usdc-eth-ethereum", sourceAmount: "100" }));
  const quote = swapQuote();
  quote.portId = result.current.view.flowPorts?.swap.id ?? quote.portId;
  const attempt: CommerceAcceptedSubmit = { kind: "swap", quote, idempotencyKey: "swap-one",
    operationId: commerceOperationId(quote, "swap-one") };
  const event: CommerceSimulation = { mode: "demo", kind: "swap", quote: structuredClone(quote),
    simulationId: attempt.operationId, idempotencyKey: "swap-one", result: { mode: "demo", status: "simulated-success" } };
  act(() => result.current.commands.setCommerceSubmitState?.(swapRoute, { busy: true, attempt }));
  quote.credit.quantity = "999";
  act(() => result.current.commands.recordCommerceSimulation?.(event));
  const entries = result.current.view.activities.filter(entry => entry.commerce);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ direction: "exchange", status: "completed", commerce: { kind: "swap",
    quote: { debit: { quantity: "101", symbol: "USDC" }, credit: { quantity: "0.04", symbol: "ETH" } } } });
  expect(Object.values(result.current.view.swapDrafts ?? {})).toEqual([]);
  expect(Object.values(result.current.view.buyDrafts ?? {})).toMatchObject([{ fiatAmount: "200" }]);
  expect(JSON.stringify(result.current.view.snapshot)).toBe(original);
  expect(result.current.view.batteryActivity).toBeNull();
});

it("ignores incomplete accepted callbacks without throwing or locking the host", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openIntent("buy"));
  const attempt = acceptance(result.current.view.flowPorts.buy.id);
  const malformed = { ...attempt, quote: { ...attempt.quote, request: undefined } } as unknown as CommerceAcceptedSubmit;
  expect(() => act(() => result.current.commands.setCommerceSubmitState(buyRoute, { busy: true, attempt: malformed }))).not.toThrow();
  act(() => result.current.commands.setCommerceSubmitState(buyRoute, { busy: true,
    attempt: { ...attempt, operationId: "", idempotencyKey: "" } }));
  expect(result.current.view.commerceBusy).toBe(false);
  act(() => result.current.commands.closeSheet());
  expect(result.current.view.sheet).toBeNull();
});
