import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import type { ProductSnapshot } from "@wallet/core";
import { useMonoProductController } from "./product-controller";

afterEach(() => { cleanup(); localStorage.clear(); });

it("changes home display without changing the total, privacy, account context or holdings", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  const overview = result.current.view.overview;
  act(() => result.current.commands.setHomeTotalOnly(true));
  expect(result.current.view.homeTotalOnly).toBe(true);
  expect(result.current.view.homePinnedKinds).toEqual(["custodial", "depositary"]);
  act(() => result.current.commands.toggleHomePin("depositary"));
  act(() => result.current.commands.toggleHomePin("depositary"));
  expect(result.current.view.homeTotalOnly).toBe(false);
  expect(result.current.view.balanceHidden).toBe(false);
  expect(result.current.view.overview).toEqual(overview);
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("rejects current and retained pin commands while a sheet is open or their snapshot is stale", () => {
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER };
  const { result, rerender, unmount } = renderHook(({ snapshot }) => {
    adapter.snapshot = snapshot;
    return useMonoProductController(adapter, { initialHidden: false });
  }, { initialProps: { snapshot: adapter.snapshot } });
  const retainedToggle = result.current.commands.toggleHomePin;
  const retainedTotal = result.current.commands.setHomeTotalOnly;
  act(() => result.current.commands.openAccounts());
  let accepted: boolean | undefined;
  act(() => { accepted = retainedToggle("custodial"); });
  expect(accepted).toBe(false);
  act(() => { accepted = retainedTotal(true); });
  expect(accepted).toBe(false);
  expect(result.current.commands.setHomeTotalOnly(true)).toBe(false);
  expect(result.current.view.homePinnedKinds).toEqual(["custodial", "depositary"]);
  expect(result.current.view.homeTotalOnly).toBe(false);
  act(() => result.current.commands.closeSheet());
  rerender({ snapshot: { ...adapter.snapshot, accounts: [] } });
  expect(retainedTotal(true)).toBe(false);
  const afterUnmount = result.current.commands.setHomeTotalOnly;
  unmount();
  expect(afterUnmount(true)).toBe(false);
});

it("resolves a home intent across all accounts without changing the working context", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  act(() => result.current.commands.openIntent("receive", { kind: "all" }));
  expect(result.current.view.intent?.routes.map(route => route.accountId)).toEqual([
    "demo-custody", "demo-custody", "demo-custody", "demo-custody", "demo-depositary",
  ]);
  const solana = result.current.view.intent!.routes.find(route => route.networkId === "solana")!;
  act(() => result.current.commands.selectRoute(solana));
  expect(result.current.view.sheet).toMatchObject({ kind: "intent", route: { accountId: "demo-custody", networkId: "solana" } });
  act(() => result.current.commands.backToRoutes(solana));
  expect(result.current.view.intent?.routes).toHaveLength(5);
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it.each([
  { action: "send", routes: 4 }, { action: "buy", routes: 1 }, { action: "swap", routes: 1 },
] as const)("keeps $action available on the home even when the working account has no matching capability", ({ action, routes }) => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  act(() => result.current.commands.openIntent(action, { kind: "all" }));
  expect(result.current.view.intent?.routes).toHaveLength(routes);
  expect(result.current.view.intent?.routes.every(route => route.accountId === "demo-custody" && route.action === action)).toBe(true);
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("rejects stale and current group actions after an account moves to a different kind", () => {
  const adapter: { kind: "demo"; snapshot: Readonly<ProductSnapshot> } = { kind: "demo", snapshot: MONO_PRODUCT_DEMO_ADAPTER.snapshot };
  const { result, rerender } = renderHook(({ snapshot }) => {
    adapter.snapshot = snapshot;
    return useMonoProductController(adapter, { initialHidden: false });
  }, { initialProps: { snapshot: adapter.snapshot } });
  act(() => result.current.commands.openAccountsWorkspace("custodial"));
  act(() => result.current.commands.inspectAccount("demo-custody"));
  const previousUse = result.current.commands.useAccount;
  rerender({ snapshot: { ...adapter.snapshot, accounts: adapter.snapshot.accounts.map(account =>
    account.id === "demo-custody" ? { ...account, kind: "depositary" } : account) } });
  let stale: boolean | undefined, current: boolean | undefined;
  act(() => { stale = previousUse("demo-custody"); current = result.current.commands.useAccount("demo-custody"); });
  expect(stale).toBe(false); expect(current).toBe(false);
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(result.current.view.sheet).toBeNull();
});

it("keeps group membership and the working context through account inspection and Back", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-custody" }));
  act(() => result.current.commands.openAccountsWorkspace("depositary"));
  let outside: boolean | undefined;
  act(() => { outside = result.current.commands.inspectAccount("demo-custody"); });
  expect(outside).toBe(false);
  act(() => result.current.commands.inspectAccount("demo-depositary"));
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-depositary", groupKind: "depositary" });
  act(() => result.current.commands.backAccountsWorkspace());
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: null, groupKind: "depositary" });
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-custody" });
});

it("opens a home asset outside the working account and retains its all-account inspection scope", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  act(() => result.current.commands.openAsset("usdc", { kind: "all" }));
  expect(result.current.view.assetWorkspace).toMatchObject({ assetId: "usdc", holdingId: null, scope: { kind: "all" } });
  act(() => result.current.commands.selectAssetHolding("demo-usdc-sol"));
  expect(result.current.view.assetWorkspace?.holdingId).toBe("demo-usdc-sol");
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  act(() => result.current.commands.openPlacementAction("demo-usdc-sol", "send"));
  expect(result.current.view.sheet).toMatchObject({ route: { accountId: "demo-custody", assetId: "usdc", networkId: "solana", action: "send" } });
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  act(() => result.current.commands.closeSheet());
  act(() => result.current.commands.closeAsset());
  expect(result.current.view.holdings).toHaveLength(0);
});
