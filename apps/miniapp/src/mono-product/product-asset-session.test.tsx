import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import { useMonoProductController } from "./product-controller";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("requires a scoped placement selection and preserves the workspace through send/receive close", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAsset("usdc"));
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: null });
  act(() => result.current.commands.selectAssetHolding("demo-btc"));
  act(() => result.current.commands.openPlacementAction("demo-usdc-sol", "send"));
  expect(result.current.view.sheet).toBeNull();
  act(() => result.current.commands.selectAssetHolding("demo-usdc-sol"));
  for (const action of ["send", "receive"] as const) {
    act(() => result.current.commands.openPlacementAction("demo-usdc-sol", action));
    expect(result.current.view.context).toEqual({ kind: "all" });
    expect(result.current.view.sheet).toMatchObject({ kind: "intent", action,
      route: { accountId: "demo-custody", assetId: "usdc", networkId: "solana" } });
    expect(result.current.view.intent?.routes).toHaveLength(1);
    act(() => result.current.commands.closeSheet());
    expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: "demo-usdc-sol" });
  }
});

it("auto-selects only a single placement, closes on account changes, and rejects assets outside scope", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAsset("btc"));
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "btc", holdingId: "demo-btc" });
  act(() => result.current.commands.selectContext({ kind: "account", accountId: "demo-inactive" }));
  expect(result.current.view.assetWorkspace).toBeNull();
  act(() => result.current.commands.openAsset("btc"));
  expect(result.current.view.assetWorkspace).toBeNull();
  act(() => result.current.commands.openAsset("usdc"));
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: "demo-inactive-usdc" });
  act(() => result.current.commands.selectAssetHolding("demo-usdc-sol"));
  expect(result.current.view.assetWorkspace?.holdingId).toBe("demo-inactive-usdc");
  act(() => result.current.commands.openPlacementAction("demo-inactive-usdc", "send"));
  expect(result.current.view.intent?.routes).toHaveLength(0);
  act(() => result.current.commands.closeAsset());
  expect(result.current.view.assetWorkspace).toBeNull();
});

it("forgets a removed source and never revives an invalid workspace when the snapshot changes", () => {
  const initialProps: { snapshot: ProductSnapshot } = { snapshot: MULTI_ACCOUNT_DEMO };
  const { result, rerender } = renderHook(({ snapshot }: { snapshot: ProductSnapshot }) => useMonoProductController(
    { kind: "demo", snapshot }, { initialHidden: false }), { initialProps });
  act(() => result.current.commands.openAsset("usdc"));
  act(() => result.current.commands.selectAssetHolding("demo-usdc-sol"));
  act(() => result.current.commands.openPlacementAction("demo-usdc-sol", "send"));
  rerender({ snapshot: { ...MULTI_ACCOUNT_DEMO,
    holdings: MULTI_ACCOUNT_DEMO.holdings.filter(holding => holding.id !== "demo-usdc-sol") } });
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: null });
  expect(result.current.view.sheet).toBeNull();
  rerender({ snapshot: MULTI_ACCOUNT_DEMO });
  expect(result.current.view.assetWorkspace?.holdingId).toBeNull();
  rerender({ snapshot: { ...MULTI_ACCOUNT_DEMO,
    holdings: MULTI_ACCOUNT_DEMO.holdings.filter(holding => holding.assetId !== "usdc") } });
  expect(result.current.view.assetWorkspace).toBeNull();
  rerender({ snapshot: MULTI_ACCOUNT_DEMO });
  expect(result.current.view.assetWorkspace).toBeNull();
});

it("replaces home contents, preserves source through an appearance change and flow, then returns focus to the asset", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const rendered = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  fireEvent.click(screen.getByRole("button", { name: /Мои средства/ }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" }));
  expect(screen.getByRole("heading", { name: "USD Coin" })).toHaveFocus();
  expect(rendered.container.querySelector(".mono-product-section [data-mono-product-asset-workspace]")).not.toBeNull();
  expect(rendered.container.querySelector(".mono-hero, .mono-actions, .mono-product-funds, .mono-promo-frame")).toBeNull();
  expect(screen.queryByRole("button", { name: /Отправить USDC/ })).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" }));
  const frost = createMonoAppearanceEnvelope("frost");
  rendered.rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={frost.material} />);
  expect(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" })).toBeChecked();
  const action = () => screen.getByRole("button", { name: "Отправить USDC · Основной · Ethereum" });
  fireEvent.click(action());
  await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.click(screen.getByRole("button", { name: "Вставить пример" }));
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByLabelText(/Сумма.*USDC/), { target: { value: "12.5" } });
  fireEvent.click(screen.getByRole("button", { name: "О валюте USDC в сети Ethereum" }));
  fireEvent.click(screen.getByRole("button", { name: /Назад к операции/ }));
  expect(screen.getByLabelText(/Сумма.*USDC/)).toHaveValue("12.5");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Отправить" })).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(action()).toHaveFocus());
  expect(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" })).toBeChecked();
  expect(screen.getByRole("button", { name: /Выбрать счёт: Все счета/ })).toBeInTheDocument();
  fireEvent.click(action());
  expect(await screen.findByRole("textbox", { name: "Получатель" })).toHaveValue("demo:recipient");
  fireEvent.click(screen.getByRole("button", { name: /Назад$/ }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  expect(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" })).toHaveFocus();
  expect(rendered.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
});

it("returns to the assets list and closes the subview on section navigation", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const { container } = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" }));
  expect(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Bitcoin" })).toBeChecked();
  expect(screen.queryByRole("heading", { name: "Все активы" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toHaveFocus();
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "assets");
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" }));
  fireEvent.click(screen.getByRole("button", { name: "Профиль" }));
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  expect(container.querySelector("[data-mono-product-asset-workspace]")).toBeNull();
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
});
