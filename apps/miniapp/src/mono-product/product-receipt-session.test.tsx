import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as adapters from "./demo-adapter";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { useMonoProductController } from "./product-controller";
import type { SendSimulationResult } from "./send";
import type { SendPort } from "./send/send-port";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const route = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "account", accountId: "demo-custody" }, "send")
  .routes.find(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")!;

function quoteReceipt() {
  return { assetDebit: "12.5", networkFee: { status: "known" as const, amount: "0.0001", symbol: "ETH" },
    feeFunding: { kind: "battery" as const, poolId: "demo-ethereum-transfer-pool", networkLabel: "Ethereum", charges: 1 },
    estimatedCompletionSeconds: 30 };
}

it.each(["simulated-success", "simulated-failure"] as const)("records an independent %s receipt once without changing balances or pools", status => {
  const { result } = renderHook(() => useMonoProductController(adapters.MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const snapshotBefore = JSON.stringify(result.current.view.snapshot);
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const receipt = { ...quoteReceipt(), recipient: { address: "demo:private" }, quoteId: "discard-this-id" };
  const event = { simulationId: "receipt-attempt-1", route, quantity: "12.5", receipt,
    result: status === "simulated-success" ? { mode: "demo" as const, status }
      : { mode: "demo" as const, status, reason: "rejected" as const } };
  let id: string | null = null;
  act(() => { id = result.current.commands.recordSendSimulation(event); });
  receipt.assetDebit = "999";
  receipt.networkFee.amount = "42";
  receipt.feeFunding.charges = 9;
  act(() => { expect(result.current.commands.recordSendSimulation(event)).toBe(id); });
  const entries = result.current.view.activities.filter(activity => activity.mode === "simulation");
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ id, accountId: "demo-custody", assetId: "usdc", networkId: "ethereum", quantity: "12.5",
    status: status === "simulated-success" ? "completed" : "failed", receipt: quoteReceipt() });
  expect(entries[0]!.receipt).toEqual(quoteReceipt());
  expect(entries[0]!.receipt).not.toBe(receipt);
  expect(entries[0]!.failureReason).toBe(status === "simulated-failure" ? "rejected" : undefined);
  expect(JSON.stringify(result.current.view.snapshot)).toBe(snapshotBefore);
  expect(storage).not.toHaveBeenCalled();
});

it("keeps legacy events compatible and excludes unrecognized failure reasons", () => {
  const { result } = renderHook(() => useMonoProductController(adapters.MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const legacy: SendSimulationResult = { simulationId: "legacy-failure", route, quantity: "1",
    result: { mode: "demo", status: "simulated-failure", reason: "unavailable" } };
  act(() => { result.current.commands.recordSendSimulation(legacy); });
  expect(result.current.view.activities[0]).toMatchObject({ id: "simulation:legacy-failure", failureReason: "unavailable" });
  expect(result.current.view.activities[0]!.receipt).toBeUndefined();
  const invalid = { ...legacy, simulationId: "invalid-reason", result: { ...legacy.result, reason: "raw provider secret" } };
  act(() => { result.current.commands.recordSendSimulation(invalid as unknown as SendSimulationResult); });
  expect(result.current.view.activities[0]!.failureReason).toBeUndefined();
  expect(JSON.stringify(result.current.view.activities)).not.toContain("raw provider secret");
});

it("opens the exact failed retry in history and removes the previous history action while recalculating", async () => {
  const ports = adapters.createMonoDemoFlowPorts(MULTI_ACCOUNT_DEMO);
  const send = vi.fn<SendPort["send"]>()
    .mockResolvedValueOnce({ mode: "demo", status: "simulated-failure", reason: "rejected" })
    .mockResolvedValueOnce({ mode: "demo", status: "simulated-failure", reason: "expired" });
  vi.spyOn(adapters, "createMonoDemoFlowPorts").mockReturnValue({ ...ports, send: { ...ports.send, send } });
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const { container, rerender } = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  fireEvent.click(screen.getByRole("button", { name: /Выбрать счёт: Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" })).getByRole("button", { name: /Основной/ }));
  fireEvent.click(screen.getByRole("button", { name: /Мои средства/ }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" }));
  fireEvent.click(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" }));
  fireEvent.click(screen.getByRole("button", { name: "Отправить USDC · Основной · Ethereum" }));
  await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.click(screen.getByRole("button", { name: "Вставить пример" }));
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByLabelText(/Сумма.*USDC/), { target: { value: "12.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("button", { name: "В истории" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Пересчитать и повторить" }));
  expect(screen.queryByRole("button", { name: "В истории" })).toBeNull();
  fireEvent.change(await screen.findByLabelText(/Сумма.*USDC/), { target: { value: "7.25" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  fireEvent.click(await screen.findByRole("button", { name: "В истории" }));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0]![0].idempotencyKey).not.toBe(send.mock.calls[1]![0].idempotencyKey);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "history");
  expect(container.querySelector("[data-mono-product-asset-workspace]")).toBeNull();
  expect(screen.getByRole("button", { name: /Выбрать счёт: Основной/ })).toBeInTheDocument();
  const rows = [...container.querySelectorAll<HTMLButtonElement>("[data-product-activity-id]")];
  const secondRow = rows.find(row => row.dataset.productActivityId === `simulation:${send.mock.calls[1]![0].idempotencyKey}`)!;
  const firstRow = rows.find(row => row.dataset.productActivityId === `simulation:${send.mock.calls[0]![0].idempotencyKey}`)!;
  expect(secondRow).toHaveAttribute("aria-expanded", "true");
  expect(firstRow).toHaveAttribute("aria-expanded", "false");
  const receipt = within(screen.getByRole("region", { name: "Квитанция операции" }));
  expect(receipt.getByText("Расчёт комиссии")).toBeInTheDocument();
  expect(receipt.getByText("0,0001 ETH")).toBeInTheDocument();
  expect(receipt.getByText("Батарейка · Ethereum")).toBeInTheDocument();
  expect(receipt.getByText("Срок действия расчёта истёк.")).toBeInTheDocument();
  await waitFor(() => expect(secondRow).toHaveFocus());
  const incomingFilter = screen.getByRole("button", { name: "Получения" });
  incomingFilter.focus();
  fireEvent.click(incomingFilter);
  expect(incomingFilter).toHaveFocus();
  const accountSelector = screen.getByRole("button", { name: /Выбрать счёт: Основной/ });
  accountSelector.focus();
  rerender(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  await act(async () => { await Promise.resolve(); });
  expect(accountSelector).toHaveFocus();
});
