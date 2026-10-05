import { act, cleanup, renderHook } from "@testing-library/react";
import { MULTI_ACCOUNT_DEMO, SINGLE_ACCOUNT_DEMO, type ProductActionRoute, type ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import { useMonoProductController } from "./product-controller";
import { buyQuote, buyRoute } from "./commerce/test-fixtures";
import { commerceOperationId } from "./commerce/validation";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const sendSolana: ProductActionRoute = {
  action: "send", accountId: "demo-custody", accountLabel: "Основной", accountKind: "custodial",
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "solana", networkLabel: "Solana",
};
const internalReceive: ProductActionRoute = {
  action: "receive", receiveMode: "internal-transfer", accountId: "demo-depositary", accountLabel: "Хранилище",
  accountKind: "depositary", assetId: "usdc", symbol: "USDC", name: "USD Coin",
  networkId: "ethereum", networkLabel: "Ethereum",
};

it.each([
  { label: "zero", snapshot: { fiatCurrency: "USD", accounts: [], holdings: [] } as ProductSnapshot, chooser: false },
  { label: "one", snapshot: SINGLE_ACCOUNT_DEMO, chooser: false },
  { label: "many", snapshot: MULTI_ACCOUNT_DEMO, chooser: true },
])("opens the $label-account workspace independently of the quick context chooser", ({ snapshot, chooser }) => {
  const adapter: MonoProductAdapter = { kind: "demo", snapshot };
  const { result } = renderHook(() => useMonoProductController(adapter, { initialHidden: false }));
  const context = result.current.view.context;
  act(() => result.current.commands.openAccounts());
  expect(result.current.view.sheet).toEqual(chooser ? { kind: "accounts" } : null);
  act(() => result.current.commands.closeSheet());
  act(() => result.current.commands.openAccountsWorkspace?.());
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: null });
  expect(result.current.view.context).toEqual(context);
  expect(result.current.view.sheet).toBeNull();
  act(() => result.current.commands.backAccountsWorkspace?.());
  expect(result.current.view.accountsWorkspace).toBeNull();
});

it("inspects and backs without changing the active context or raw drafts, including a privacy rerender", () => {
  const { result, rerender } = renderHook(({ hidden }) => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER,
    { initialHidden: false, hidden }), { initialProps: { hidden: false } });
  act(() => result.current.commands.saveSendDraft(sendSolana, {
    route: sendSolana, recipient: { address: "demo:recipient" }, amount: "001,",
  }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-depositary"));
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-depositary" });
  expect(result.current.view.context).toEqual({ kind: "all" });
  rerender({ hidden: true });
  expect(result.current.view.balanceHidden).toBe(true);
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-depositary" });
  expect(Object.values(result.current.view.sendDrafts)[0]?.amount).toBe("001,");
  act(() => result.current.commands.backAccountsWorkspace?.());
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: null });
  expect(result.current.view.context).toEqual({ kind: "all" });
});

it("uses only the current inspected account and closes parent and child workspaces on explicit success", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  act(() => result.current.commands.openAccountHolding?.("demo-custody", "demo-usdc-sol"));
  let wrong: boolean | undefined, used: boolean | undefined;
  act(() => { wrong = result.current.commands.useAccount?.("demo-depositary"); });
  expect(wrong).toBe(false);
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: "demo-usdc-sol" });
  act(() => { used = result.current.commands.useAccount?.("demo-custody"); });
  expect(used).toBe(true);
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(result.current.view.accountsWorkspace).toBeNull();
  expect(result.current.view.assetWorkspace).toBeNull();
  expect(result.current.view.sheet).toBeNull();
});

it("opens the exact selected network atomically and replaces stale labels with the current canonical route", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  let opened: boolean | undefined;
  act(() => { opened = result.current.commands.openAccountRoute?.({ ...sendSolana, accountLabel: "stale", networkLabel: "stale" }); });
  expect(opened).toBe(true);
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(result.current.view.sheet).toEqual({ kind: "intent", action: "send", route: sendSolana });
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
  act(() => result.current.commands.closeSheet());
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
});

it("fails closed on a wrong receive mode or unimplemented action and opens the exact internal receive route", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-depositary"));
  let wrongMode: boolean | undefined, unsupported: boolean | undefined, opened: boolean | undefined;
  act(() => {
    wrongMode = result.current.commands.openAccountRoute?.({ ...internalReceive, action: "receive", receiveMode: "external-address" });
    unsupported = result.current.commands.openAccountRoute?.({ ...sendSolana, action: "withdraw", accountId: "demo-depositary" });
  });
  expect(wrongMode).toBe(false);
  expect(unsupported).toBe(false);
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(result.current.view.sheet).toBeNull();
  act(() => { opened = result.current.commands.openAccountRoute?.(internalReceive); });
  expect(opened).toBe(true);
  expect(result.current.view.sheet).toEqual({ kind: "intent", action: "receive", route: internalReceive });
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it.each(["demo-inactive", "demo-private"])("can inspect %s while refusing its unavailable financial route", accountId => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.(accountId));
  expect(result.current.view.accountsWorkspace).toEqual({ accountId });
  let opened: boolean | undefined;
  act(() => { opened = result.current.commands.openAccountRoute?.({ ...internalReceive, accountId }); });
  expect(opened).toBe(false);
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(result.current.view.sheet).toBeNull();
});

it("rejects a foreign holding and returns from the exact asset child to its account parent", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-depositary"));
  let foreign: boolean | undefined;
  act(() => { foreign = result.current.commands.openAccountHolding?.("demo-depositary", "demo-usdc-sol"); });
  expect(foreign).toBe(false);
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(result.current.view.assetWorkspace).toBeNull();
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  act(() => result.current.commands.openAccountHolding?.("demo-custody", "demo-usdc-sol"));
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: "demo-usdc-sol" });
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  act(() => result.current.commands.closeAsset());
  expect(result.current.view.assetWorkspace).toBeNull();
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
});

it("retains a removed inspected ID as missing and denies old snapshot callbacks without selecting a replacement", () => {
  let snapshot: Readonly<ProductSnapshot> = MULTI_ACCOUNT_DEMO;
  const adapter: MonoProductAdapter = { kind: "demo", get snapshot() { return snapshot; } };
  const { result, rerender } = renderHook(({ hidden }) => useMonoProductController(adapter,
    { initialHidden: false, hidden }), { initialProps: { hidden: false } });
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  const old = result.current.commands;
  snapshot = { ...MULTI_ACCOUNT_DEMO, accounts: MULTI_ACCOUNT_DEMO.accounts.filter(account => account.id !== "demo-custody"),
    holdings: MULTI_ACCOUNT_DEMO.holdings.filter(holding => holding.accountId !== "demo-custody") };
  rerender({ hidden: true });
  let currentUse: boolean | undefined, oldUse: boolean | undefined, oldRoute: boolean | undefined;
  act(() => {
    currentUse = result.current.commands.useAccount?.("demo-custody");
    oldUse = old.useAccount?.("demo-custody");
    oldRoute = old.openAccountRoute?.(sendSolana);
  });
  expect([currentUse, oldUse, oldRoute]).toEqual([false, false, false]);
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(result.current.view.sheet).toBeNull();
  act(() => result.current.commands.backAccountsWorkspace?.());
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: null });
});

it("closes accounts and its flow on adapter replacement and rejects callbacks from the replaced session", () => {
  const first: MonoProductAdapter = { kind: "demo", snapshot: MULTI_ACCOUNT_DEMO };
  const { result, rerender } = renderHook(({ adapter }) => useMonoProductController(adapter,
    { initialHidden: false }), { initialProps: { adapter: first } });
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  act(() => result.current.commands.openAccountRoute?.(sendSolana));
  const old = result.current.commands;
  rerender({ adapter: { kind: "demo", snapshot: MULTI_ACCOUNT_DEMO } });
  expect(result.current.view.accountsWorkspace).toBeNull();
  expect(result.current.view.sheet).toBeNull();
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  let stale: boolean | undefined;
  act(() => { stale = old.openAccountRoute?.(sendSolana); });
  expect(stale).toBe(false);
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
  expect(result.current.view.sheet).toBeNull();
});

it("refuses duplicate account, route and holding IDs instead of authorizing the first match", () => {
  const snapshot: ProductSnapshot = structuredClone(MULTI_ACCOUNT_DEMO);
  const custody = snapshot.accounts.find(account => account.id === "demo-custody")!;
  custody.capabilities = [...custody.capabilities, { action: "send", assetId: "usdc", symbol: "USDC",
    name: "USD Coin", networkId: "solana", networkLabel: "Solana" }];
  snapshot.holdings = [...snapshot.holdings, snapshot.holdings.find(holding => holding.id === "demo-usdc-sol")!];
  snapshot.accounts = [...snapshot.accounts, { ...snapshot.accounts.find(account => account.id === "demo-depositary")! }];
  const adapter: MonoProductAdapter = { kind: "demo", snapshot };
  const { result } = renderHook(() => useMonoProductController(adapter, { initialHidden: false }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  let duplicateAccount: boolean | undefined, duplicateRoute: boolean | undefined, duplicateHolding: boolean | undefined;
  act(() => { duplicateAccount = result.current.commands.inspectAccount?.("demo-depositary"); });
  expect(duplicateAccount).toBe(false);
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: null });
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  act(() => {
    duplicateRoute = result.current.commands.openAccountRoute?.(sendSolana);
    duplicateHolding = result.current.commands.openAccountHolding?.("demo-custody", "demo-usdc-sol");
  });
  expect([duplicateRoute, duplicateHolding]).toEqual([false, false]);
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(result.current.view.assetWorkspace).toBeNull();
  expect(result.current.view.sheet).toBeNull();
});

it("preserves the accepted commerce lease and raw draft when account navigation is attempted during pending", () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  act(() => result.current.commands.openAccountRoute?.(buyRoute));
  act(() => result.current.commands.saveBuyDraft(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "23," }));
  const quote = buyQuote();
  quote.portId = result.current.view.flowPorts.buy.id;
  const key = "accounts-pending";
  const operationId = commerceOperationId(quote, key);
  act(() => result.current.commands.setCommerceSubmitState(buyRoute, {
    busy: true, attempt: { kind: "buy", quote, idempotencyKey: key, operationId },
  }));
  expect(result.current.view.commerceBusy).toBe(true);
  const sheet = result.current.view.sheet;
  const denied: (boolean | undefined)[] = [];
  act(() => {
    denied.push(result.current.commands.openAccountsWorkspace?.());
    denied.push(result.current.commands.inspectAccount?.("demo-depositary"));
    denied.push(result.current.commands.backAccountsWorkspace?.());
    denied.push(result.current.commands.closeAccountsWorkspace?.());
    denied.push(result.current.commands.useAccount?.("demo-custody"));
    denied.push(result.current.commands.openAccountRoute?.(sendSolana));
    denied.push(result.current.commands.openAccountHolding?.("demo-custody", "demo-usdc-sol"));
    result.current.commands.setBalanceHidden(true);
  });
  expect(denied).toEqual([false, false, false, false, false, false, false]);
  expect(result.current.view.sheet).toBe(sheet);
  expect(result.current.view.commerceBusy).toBe(true);
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(Object.values(result.current.view.buyDrafts)[0]?.fiatAmount).toBe("23,");
  expect(result.current.view.balanceHidden).toBe(true);
  act(() => result.current.commands.setCommerceSubmitState(buyRoute, { busy: false, operationId }));
  act(() => result.current.commands.closeSheet());
  expect(result.current.view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
});

it("clears the account parent on explicit quick context selection while preserving drafts", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.saveSendDraft(sendSolana, {
    route: sendSolana, recipient: { address: "demo:recipient" }, amount: "8,",
  }));
  act(() => result.current.commands.openAccountsWorkspace?.());
  act(() => result.current.commands.inspectAccount?.("demo-custody"));
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  expect(result.current.view.accountsWorkspace).toBeNull();
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(Object.values(result.current.view.sendDrafts)[0]?.amount).toBe("8,");
});
