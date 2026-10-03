import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { MULTI_ACCOUNT_DEMO, resolveActionRoutes } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import { receiveRequestAmountKey, useMonoProductController } from "./product-controller";
import { scopeProductActivities } from "./product-activity-scope";
import { selectAssetActivities } from "./asset-workspace/asset-workspace-data";
import type { InternalTransferSimulation } from "./internal-transfer";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const routes = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, "receive").routes;
const target = routes.find(route => route.action === "receive" && route.receiveMode === "internal-transfer")!;
const external = routes.find(route => route.accountId === "demo-custody" && route.assetId === "usdc" && route.networkId === "ethereum")!;

function simulation(status: "simulated-success" | "simulated-failure" = "simulated-success"): InternalTransferSimulation {
  return { simulationId: "internal-attempt", quote: {
    mode: "demo", id: "quote-internal", request: { sourceAccountId: "demo-custody", destinationAccountId: "demo-depositary",
      assetId: "usdc", networkId: "ethereum", amount: "12.5" },
    sourceAccountLabel: "Основной", destinationAccountLabel: "Хранилище", symbol: "USDC", networkLabel: "Ethereum",
    available: "500", assetDebit: "12.5", fee: { amount: "0", symbol: "USDC" },
    // The terminal response can arrive after the quote expired. Submit owns freshness.
    expiresAt: 1,
  }, result: status === "simulated-success" ? { mode: "demo", status } : { mode: "demo", status, reason: "expired" } };
}

it("keeps only route-bound raw internal drafts, including an unselected source, through close/privacy", () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const { result, rerender } = renderHook(({ hidden }) => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER,
    { initialHidden: false, hidden }), { initialProps: { hidden: false } });
  const save = result.current.commands.saveInternalTransferDraft;
  act(() => {
    save(target, { sourceAccountId: null, amount: "12," });
    result.current.commands.saveReceiveRequestAmount(external, "001.50");
    result.current.commands.closeSheet();
  });
  rerender({ hidden: true });
  expect(result.current.commands.saveInternalTransferDraft).toBe(save);
  expect(result.current.view.internalTransferDrafts[receiveRequestAmountKey(target)]).toEqual({ sourceAccountId: null, amount: "12," });
  const draft = { sourceAccountId: "demo-custody", amount: "0012,50", quote: "must-not-persist" };
  act(() => save(target, draft));
  draft.amount = "999";
  act(() => {
    save(target, { sourceAccountId: "demo-private", amount: "10" });
    save(target, { sourceAccountId: "demo-custody", amount: "1".repeat(129) });
    save(external, { sourceAccountId: "demo-custody", amount: "10" });
    save({ ...target, networkId: "solana" }, { sourceAccountId: null, amount: "10" });
  });
  expect(result.current.view.internalTransferDrafts).toEqual({ [receiveRequestAmountKey(target)]: { sourceAccountId: "demo-custody", amount: "0012,50" } });
  act(() => save(target, null));
  expect(result.current.view.internalTransferDrafts).toEqual({});
  expect(result.current.view.receiveRequestAmounts[receiveRequestAmountKey(external)]).toBe("001.50");
  expect(storage).not.toHaveBeenCalled();
});

it.each(["simulated-success", "simulated-failure"] as const)("records one immutable %s entry with two account views, even after quote expiry", status => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const before = JSON.stringify(result.current.view.snapshot);
  const event = simulation(status);
  let id: string | null = null;
  act(() => {
    result.current.commands.saveInternalTransferDraft(target, { sourceAccountId: "demo-custody", amount: "12,50" });
    id = result.current.commands.recordInternalTransferSimulation(event);
    expect(result.current.commands.recordInternalTransferSimulation(event)).toBe(id);
  });
  expect(id).toBe("internal-simulation:internal-attempt");
  event.quote.assetDebit = "999";
  event.quote.fee.amount = "42";
  event.quote.sourceAccountLabel = "Changed";
  const entries = result.current.view.activities.filter(activity => activity.internalTransfer);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ id, accountId: "demo-custody", direction: "outgoing", quantity: "12.5",
    internalTransfer: { sourceAccountId: "demo-custody", sourceAccountLabel: "Основной",
      destinationAccountId: "demo-depositary", destinationAccountLabel: "Хранилище" },
    receipt: { assetDebit: "12.5", networkFee: { status: "known", amount: "0", symbol: "USDC" } },
    status: status === "simulated-success" ? "completed" : "failed" });
  expect(scopeProductActivities(entries, ["demo-custody"])[0]).toMatchObject({ id, direction: "outgoing" });
  expect(scopeProductActivities(entries, ["demo-depositary"])[0]).toMatchObject({ id, accountId: "demo-depositary", direction: "incoming" });
  expect(selectAssetActivities(entries, "usdc", ["demo-depositary"], { accountId: "demo-depositary", networkId: "ethereum" })[0])
    .toMatchObject({ id, direction: "incoming" });
  expect(selectAssetActivities(entries, "usdc", ["demo-custody"], { accountId: "demo-custody", networkId: "solana" })).toEqual([]);
  expect(selectAssetActivities(entries, "usdc", ["demo-custody"], { accountId: "demo-depositary", networkId: "ethereum" })).toEqual([]);
  expect(result.current.view.internalTransferDrafts[receiveRequestAmountKey(target)]).toEqual(status === "simulated-success"
    ? undefined : { sourceAccountId: "demo-custody", amount: "12,50" });
  expect(JSON.stringify(result.current.view.snapshot)).toBe(before);
});

it("rejects unsupported bindings, stale balances, wrong networks and invalid amounts before history", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const forged: InternalTransferSimulation[] = [simulation(), simulation(), simulation(), simulation(), simulation()];
  forged[0]!.quote.request.sourceAccountId = "demo-private";
  forged[1]!.quote.request.networkId = "solana";
  forged[2]!.quote.available = "600";
  forged[3]!.quote.request.amount = forged[3]!.quote.assetDebit = "501";
  forged[4]!.quote.fee.symbol = forged[4]!.quote.symbol = "BTC";
  for (const event of forged) act(() => expect(result.current.commands.recordInternalTransferSimulation(event)).toBeNull());
  expect(result.current.view.activities.some(activity => activity.internalTransfer)).toBe(false);
});

it("opens one exact route directly and closes Back without a loop; All picker preserves context", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  act(() => result.current.commands.openIntent("receive"));
  expect(result.current.view.sheet).toMatchObject({ kind: "intent", route: target });
  act(() => result.current.commands.backToRoutes(target));
  expect(result.current.view.sheet).toBeNull();
  act(() => result.current.commands.backToRoutes(target));
  expect(result.current.view.sheet).toBeNull();
  act(() => result.current.commands.selectContext({ kind: "all" }));
  act(() => result.current.commands.openIntent("receive"));
  act(() => result.current.commands.selectRoute(target));
  expect(result.current.view.context).toEqual({ kind: "all" });
  act(() => result.current.commands.backToRoutes(target));
  expect(result.current.view.sheet).toMatchObject({ kind: "intent", route: null });
  expect(result.current.view.context).toEqual({ kind: "all" });
});
