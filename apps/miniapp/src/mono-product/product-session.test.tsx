import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import { useMonoProductController } from "./product-controller";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const sendRoute = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "account", accountId: "demo-custody" }, "send")
  .routes.find(route => route.assetId === "usdc" && route.networkId === "ethereum")!;
const draft = { route: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum" },
  recipient: { address: "demo:preview" }, amount: "12.5" };

it("opens exactly the holding account/asset/network and fails closed for unavailable placements", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openPlacementAction("demo-usdc-sol", "send"));
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(result.current.view.sheet).toMatchObject({ kind: "intent", route: { accountId: "demo-custody", assetId: "usdc", networkId: "solana" } });
  expect(result.current.view.intent?.routes).toHaveLength(1);
  act(() => result.current.commands.closeSheet());
  act(() => result.current.commands.openPlacementAction("demo-inactive-usdc", "send"));
  expect(result.current.view.sheet).toMatchObject({ kind: "intent", route: null });
  expect(result.current.view.intent?.routes).toHaveLength(0);
});

it("keeps only allowlisted same-route drafts in memory across close, and clear never writes storage", () => {
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const { result, unmount } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.saveSendDraft(sendRoute, draft));
  act(() => result.current.commands.closeSheet());
  expect(Object.values(result.current.view.sendDrafts)).toEqual([draft]);
  act(() => result.current.commands.saveSendDraft(sendRoute, { ...draft, route: { ...draft.route, networkId: "solana" } }));
  expect(Object.values(result.current.view.sendDrafts)).toEqual([draft]);
  act(() => result.current.commands.saveSendDraft(sendRoute, null));
  expect(Object.values(result.current.view.sendDrafts)).toEqual([]);
  expect(storage).not.toHaveBeenCalled();
  unmount();
  const fresh = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  expect(Object.values(fresh.result.current.view.sendDrafts)).toEqual([]);
});

it.each(["simulated-success", "simulated-failure"] as const)("journals a %s once without debiting balance or battery", status => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const balance = result.current.view.balanceMinor;
  const pool = result.current.view.batteryPools[0]!.remainingTransfers;
  act(() => result.current.commands.saveSendDraft(sendRoute, draft));
  const event = { simulationId: "session-attempt-1", route: sendRoute, quantity: "12.5",
    result: status === "simulated-success" ? { mode: "demo" as const, status }
      : { mode: "demo" as const, status, reason: "rejected" as const } };
  act(() => { result.current.commands.recordSendSimulation(event); result.current.commands.recordSendSimulation(event); });
  const entries = result.current.view.activities.filter(entry => entry.mode === "simulation");
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ id: "simulation:session-attempt-1", mode: "simulation", direction: "outgoing",
    status: status === "simulated-success" ? "completed" : "failed", accountId: "demo-custody", assetSymbol: "USDC",
    networkLabel: "Ethereum", quantity: "12.5" });
  expect(Date.parse(entries[0]!.occurredAt)).not.toBeNaN();
  expect(result.current.view.balanceMinor).toBe(balance);
  expect(result.current.view.batteryPools[0]!.remainingTransfers).toBe(pool);
  expect(Object.values(result.current.view.sendDrafts)).toHaveLength(status === "simulated-success" ? 0 : 1);
});

it("does not expose the legacy chart to a custom product adapter without a series", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const rendered = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  expect(screen.getByRole("region", { name: "График баланса" })).toBeInTheDocument();
  rendered.rerender(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material}
    productAdapter={{ kind: "demo", snapshot: MULTI_ACCOUNT_DEMO }} />);
  expect(screen.queryByRole("region", { name: "График баланса" })).toBeNull();
});

it("restores a placement draft without its quote and opens the exact simulation history record", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  fireEvent.click(screen.getByRole("button", { name: /Мои средства/ }));
  fireEvent.click(screen.getByRole("button", { name: /USD Coin/ }));
  const openPlacement = () => fireEvent.click(screen.getByRole("button", { name: "Отправить USDC · Основной · Ethereum" }));
  openPlacement();
  await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.click(screen.getByRole("button", { name: "Вставить пример" }));
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByLabelText(/Сумма.*USDC/), { target: { value: "12.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  await screen.findByRole("button", { name: "Проверить перевод" });
  fireEvent.click(within(screen.getByRole("dialog", { name: "Отправить" })).getByRole("button", { name: "Закрыть" }));

  openPlacement();
  expect(await screen.findByRole("textbox", { name: "Получатель" })).toHaveValue("demo:recipient");
  fireEvent.click(screen.getByRole("button", { name: /Назад$/ }));
  expect(screen.queryByRole("dialog")).toBeNull();
  openPlacement();
  await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByLabelText(/Сумма.*USDC/)).toHaveValue("12.5");
  expect(screen.queryByRole("button", { name: "Проверить перевод" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "О валюте USDC в сети Ethereum" }));
  fireEvent.click(screen.getByRole("button", { name: /Назад к операции/ }));
  expect(screen.getByLabelText(/Сумма.*USDC/)).toHaveValue("12.5");
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  fireEvent.click(await screen.findByRole("button", { name: "В истории" }, { timeout: 2500 }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Демо-отправка · USDC.*Симуляция завершена/ })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: /Выбрать счёт: Основной/ })).toBeInTheDocument();
});
