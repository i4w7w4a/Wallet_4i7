import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, resolveActionRoutes, type ProductActionRoute, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { receiveRequestAmountKey, useMonoProductController } from "./product-controller";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const snapshot: ProductSnapshot = { ...MULTI_ACCOUNT_DEMO,
  accounts: [...MULTI_ACCOUNT_DEMO.accounts, { ...MULTI_ACCOUNT_DEMO.accounts[0], id: "another-custody", label: "Другой" }] };
const routes = resolveActionRoutes(snapshot, { kind: "all" }, "receive").routes;
const external = routes.find(route => route.accountId === "demo-custody" && route.assetId === "usdc" &&
  route.networkId === "ethereum" && route.action === "receive" && route.receiveMode === "external-address")!;
const solana = routes.find(route => route.accountId === "demo-custody" && route.assetId === "usdc" && route.networkId === "solana")!;
const another = routes.find(route => route.accountId === "another-custody" && route.assetId === "usdc" && route.networkId === "ethereum")!;
const internal = routes.find(route => route.action === "receive" && route.receiveMode === "internal-transfer")!;

it("keeps partial receive input by exact external route through close/privacy and never writes storage", () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const { result, rerender, unmount } = renderHook(({ hidden }) => useMonoProductController(
    { kind: "demo", snapshot }, { initialHidden: false, hidden }), { initialProps: { hidden: false } });
  const save = result.current.commands.saveReceiveRequestAmount;
  act(() => { save(external, "12,"); save(solana, "7.25"); save(another, "99"); });
  act(() => result.current.commands.closeSheet());
  rerender({ hidden: true });
  expect(result.current.view.receiveRequestAmounts).toEqual({
    [receiveRequestAmountKey(external)]: "12,", [receiveRequestAmountKey(solana)]: "7.25",
    [receiveRequestAmountKey(another)]: "99",
  });
  expect(result.current.commands.saveReceiveRequestAmount).toBe(save);
  act(() => save(external, ""));
  expect(result.current.view.receiveRequestAmounts[receiveRequestAmountKey(external)]).toBeUndefined();
  expect(result.current.view.receiveRequestAmounts[receiveRequestAmountKey(solana)]).toBe("7.25");
  expect(storage).not.toHaveBeenCalled();
  unmount();
  const fresh = renderHook(() => useMonoProductController({ kind: "demo", snapshot }, { initialHidden: false }));
  expect(fresh.result.current.view.receiveRequestAmounts).toEqual({});
});

it("rejects internal, unavailable or forged receive routes and overlong input without replacing a draft", () => {
  const { result } = renderHook(() => useMonoProductController({ kind: "demo", snapshot }, { initialHidden: false }));
  const save = result.current.commands.saveReceiveRequestAmount;
  act(() => {
    save(external, "123");
    save(external, "1".repeat(129));
    save(internal, "50");
    save({ ...external, receiveMode: "internal-transfer" } as ProductActionRoute, "60");
    save({ ...external, accountId: "missing" }, "70");
    save({ ...external, assetId: "missing" }, "80");
    save({ ...external, accountId: "demo-inactive" }, "90");
  });
  expect(result.current.view.receiveRequestAmounts).toEqual({ [receiveRequestAmountKey(external)]: "123" });
  act(() => save(external, "1".repeat(128)));
  expect(result.current.view.receiveRequestAmounts[receiveRequestAmountKey(external)]).toHaveLength(128);
});

it("restores receive request amounts after close, network changes, skin and privacy remounts", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const ledger = createMonoAppearanceEnvelope("ledger");
  const session = { balanceHidden: false, onBalanceHiddenChange: vi.fn(), period: "1D" as const, onPeriodChange: vi.fn() };
  const rendered = render(<MonoProductScene snapshot={wallet} appearance={ledger.appearance} material={ledger.material} session={session} />);
  fireEvent.click(screen.getByRole("button", { name: /Мои средства/ }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" }));
  const open = (network: string) => {
    fireEvent.click(screen.getByRole("radio", { name: `Выбрать размещение: Основной · ${network}` }));
    fireEvent.click(screen.getByRole("button", { name: `Получить USDC · Основной · ${network}` }));
  };
  const close = () => fireEvent.click(within(screen.getByRole("dialog", { name: "Получить" })).getByRole("button", { name: "Закрыть" }));
  open("Ethereum");
  fireEvent.change(await screen.findByRole("textbox", { name: /Желаемая сумма/ }), { target: { value: "0012,50" } });
  close();
  open("Solana");
  expect(await screen.findByRole("textbox", { name: /Желаемая сумма/ })).toHaveValue("");
  fireEvent.change(screen.getByRole("textbox", { name: /Желаемая сумма/ }), { target: { value: "7.25" } });
  close();
  open("Ethereum");
  expect(await screen.findByRole("textbox", { name: /Желаемая сумма/ })).toHaveValue("0012,50");
  fireEvent.click(screen.getByRole("button", { name: "Подробнее об активе USDC в сети Ethereum" }));
  fireEvent.click(screen.getByRole("button", { name: /Назад к операции/ }));
  expect(screen.getByRole("textbox", { name: /Желаемая сумма/ })).toHaveValue("0012,50");
  const frost = createMonoAppearanceEnvelope("frost");
  rendered.rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={frost.material}
    session={{ ...session, balanceHidden: true }} />);
  expect(screen.queryByRole("textbox", { name: /Желаемая сумма/ })).toBeNull();
  expect(screen.queryByDisplayValue("0012,50")).toBeNull();
  expect(rendered.container.textContent).not.toContain("0012,50");
  rendered.rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={frost.material} session={session} />);
  expect(await screen.findByRole("textbox", { name: /Желаемая сумма/ })).toHaveValue("0012,50");
});
