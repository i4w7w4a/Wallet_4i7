import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as demo from "./demo-adapter";
import { receiveRequestAmountKey, sendDraftKey, useMonoProductController } from "./product-controller";
import { ProductOverlay } from "./product-sheet";
import { ReceiveFlow } from "./receive";
import type { InternalTransferRequest, InternalTransferResult, InternalTransferSimulation } from "./internal-transfer";

const adapter = demo.MONO_PRODUCT_DEMO_ADAPTER;
const snapshot = adapter.snapshot;
const routes = resolveActionRoutes(snapshot, { kind: "all" }, "send").routes;
const source = routes.find(route => route.accountId === "demo-custody" && route.assetId === "usdc" && route.networkId === "ethereum")!;
const target = resolveActionRoutes(snapshot, { kind: "all" }, "receive").routes.find(route =>
  route.action === "receive" && route.receiveMode === "internal-transfer" && route.accountId === "demo-depositary")!;
const holdingId = snapshot.holdings.find(holding => holding.accountId === source.accountId &&
  holding.assetId === source.assetId && holding.networkId === source.networkId)!.id;
const createPorts = demo.createMonoDemoFlowPorts;
let quoted: InternalTransferRequest[];
let submitted: number;
let deferSubmit: boolean;
let finishSubmit: ((result: InternalTransferResult) => void) | undefined;
let submitSignal: AbortSignal | undefined;
let deferExternalSend: boolean;
let finishExternalSend: ((result: InternalTransferResult) => void) | undefined;
let externalSignal: AbortSignal | undefined;

beforeEach(() => {
  quoted = []; submitted = 0; deferSubmit = false; finishSubmit = undefined; submitSignal = undefined;
  deferExternalSend = false; finishExternalSend = undefined; externalSignal = undefined;
  vi.spyOn(demo, "createMonoDemoFlowPorts").mockImplementation(current => {
    const ports = createPorts(current);
    const internal = ports.internalTransfer;
    return { ...ports, send: { ...ports.send, send(command, options) {
      externalSignal = options.signal;
      return deferExternalSend ? new Promise(resolve => { finishExternalSend = resolve; }) : ports.send.send(command, options);
    } }, internalTransfer: { ...internal,
      quote(request, options) { quoted.push({ ...request }); return internal.quote(request, options); },
      submit(request, options) {
        submitted += 1; submitSignal = options.signal;
        return deferSubmit ? new Promise(resolve => { finishSubmit = resolve; }) : internal.submit(request, options);
      },
    } };
  });
  vi.stubGlobal("matchMedia", () => ({ matches: true, media: "", onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 780);
    if (this.hasAttribute("data-mono-product-send-trigger")) return new DOMRect(115, 250, 56, 56);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Harness({ productAdapter = adapter }: { productAdapter?: demo.MonoProductAdapter }) {
  const { view, commands } = useMonoProductController(productAdapter, { initialHidden: false });
  return <div data-mono-preview>
    <button data-mono-product-send-trigger onClick={() => commands.openIntent("send")}>Отправить</button>
    <button data-mono-product-receive-trigger onClick={() => commands.openIntent("receive")}>Получить</button>
    <button onClick={() => commands.openAsset("usdc", { kind: "all" })}>Размещение USDC</button>
    <button onClick={() => commands.selectAssetHolding(holdingId)}>Выбрать источник</button>
    <button onClick={() => commands.openPlacementAction(holdingId, "send")}>Отправить из размещения</button>
    <button onClick={() => commands.selectContext({ kind: "account", accountId: "demo-private" })}>Сменить контекст</button>
    <output data-testid="context">{JSON.stringify(view.context)}</output>
    <output data-testid="activities">{view.activities.filter(activity => activity.internalTransfer).length}</output>
    <ProductOverlay view={view} commands={commands} />
  </div>;
}
function chooser() { return screen.getByRole("dialog", { name: "Отправить" }); }
function sourceButton(network = "Ethereum") {
  return within(chooser()).getByRole("button", { name: new RegExp(`(?=.*USDC)(?=.*${network})(?=.*Основной)`) });
}
async function enterInternal() {
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  fireEvent.click(within(chooser()).getByRole("button", { name: "На свой счёт" }));
  fireEvent.click(sourceButton());
  return screen.findByRole("textbox", { name: "Сумма перевода" });
}
async function reviewInternal() {
  const amount = await enterInternal();
  fireEvent.change(amount, { target: { value: "0012,50" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать пример" }));
  await screen.findByRole("button", { name: "Подтвердить симуляцию" });
}

it("starts from an exact source, loads only the supplied target and restores chooser focus without automatic quote", async () => {
  render(<Harness />);
  const amount = await enterInternal();
  expect(amount).toHaveValue("");
  const direction = screen.getByRole("group", { name: "Направление перевода" });
  expect(direction).toHaveTextContent("ОткудаОсновной");
  expect(direction).toHaveTextContent("КудаХранилище");
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.getByTestId("context")).toHaveTextContent('{"kind":"all"}');
  expect(quoted).toEqual([]); expect(submitted).toBe(0);
  fireEvent.change(amount, { target: { value: "12," } });
  fireEvent.click(screen.getByRole("button", { name: "Назад к выбору отправки" }));
  await waitFor(() => expect(sourceButton()).toHaveFocus());
  expect(within(chooser()).getByRole("button", { name: "На свой счёт" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(sourceButton());
  expect(await screen.findByRole("textbox", { name: "Сумма перевода" })).toHaveValue("12,");
});

it("keeps an unsupported source and offers external Send instead of silently selecting the supplied source", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  fireEvent.click(within(chooser()).getByRole("button", { name: "На свой счёт" }));
  fireEvent.click(sourceButton("Solana"));
  expect(screen.getByRole("status", { name: "Внутренний перевод недоступен" })).toHaveTextContent("USDC · Solana · Основной");
  expect(screen.queryByRole("button", { name: "Рассчитать пример" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "На внешний адрес" }));
  expect(await screen.findByRole("textbox", { name: "Получатель" })).toBeVisible();
  expect(screen.getByRole("button", { name: "О валюте USDC в сети Solana" })).toBeVisible();
  expect(quoted).toEqual([]); expect(submitted).toBe(0);
});

it("preserves raw external amount and recipient across the handoff and ordinary Receive Back", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  fireEvent.click(sourceButton());
  fireEvent.change(await screen.findByRole("textbox", { name: "Получатель" }), { target: { value: "demo:recipient" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Сумма, USDC" }), { target: { value: "0012,50" } });
  fireEvent.click(screen.getByRole("button", { name: "На свой счёт" }));
  expect(await screen.findByRole("textbox", { name: "Сумма перевода" })).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "На внешний адрес" }));
  expect(await screen.findByRole("textbox", { name: "Получатель" })).toHaveValue("demo:recipient");
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByRole("textbox", { name: "Сумма, USDC" })).toHaveValue("0012,50");
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  fireEvent.click(screen.getByRole("button", { name: "Хранилище" }));
  fireEvent.click(screen.getByRole("button", { name: /USDC.*Ethereum.*Хранилище.*Между счетами/ }));
  await screen.findByRole("textbox", { name: "Сумма пополнения" });
  fireEvent.click(screen.getByRole("button", { name: "Назад к выбору маршрута" }));
  expect(screen.getByRole("dialog", { name: "Получить" })).not.toHaveAttribute("aria-modal", "true");
});

it("keeps an asset placement and All context through direct handoff Back", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Размещение USDC" }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать источник" }));
  fireEvent.click(screen.getByRole("button", { name: "Отправить из размещения" }));
  await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.click(screen.getByRole("button", { name: "На свой счёт" }));
  await screen.findByRole("textbox", { name: "Сумма перевода" });
  fireEvent.click(screen.getByRole("button", { name: "Назад к выбору отправки" }));
  await screen.findByRole("textbox", { name: "Получатель" });
  await waitFor(() => expect(screen.getByRole("button", { name: "На свой счёт" })).toHaveFocus());
  expect(screen.getByTestId("context")).toHaveTextContent('{"kind":"all"}');
});

it("rejects the new internal mode switch in the same event that external Send is accepted", async () => {
  deferExternalSend = true;
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  fireEvent.click(sourceButton());
  fireEvent.change(await screen.findByRole("textbox", { name: "Получатель" }), { target: { value: "demo:recipient" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Сумма, USDC" }), { target: { value: "12.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  const confirm = screen.getByRole("button", { name: "Подтвердить симуляцию" });
  const internal = screen.getByRole("button", { name: "На свой счёт" });
  act(() => { confirm.click(); internal.click(); });
  expect(externalSignal?.aborted).toBe(false);
  expect(screen.getByRole("heading", { name: "Перевод в обработке" })).toBeVisible();
  expect(screen.queryByRole("textbox", { name: "Сумма перевода" })).toBeNull();
  await act(async () => finishExternalSend?.({ mode: "demo", status: "simulated-success" }));
  expect(await screen.findByRole("heading", { name: "Симуляция завершена" })).toBeVisible();
});

it("blocks same-event Close, Back, mode and context changes before cancelling an accepted submit, then records once", async () => {
  deferSubmit = true;
  render(<Harness />);
  await reviewInternal();
  const confirm = screen.getByRole("button", { name: "Подтвердить симуляцию" });
  const close = screen.getByRole("button", { name: "Закрыть" });
  const back = screen.getByRole("button", { name: "Назад к выбору отправки" });
  const external = screen.getByRole("button", { name: "На внешний адрес" });
  act(() => { confirm.click(); close.click(); back.click(); external.click(); screen.getByRole("button", { name: "Сменить контекст" }).click(); });
  expect(submitted).toBe(1); expect(submitSignal?.aborted).toBe(false);
  expect(screen.getByRole("heading", { name: "Выполняем симуляцию" })).toBeVisible();
  expect(screen.getByTestId("context")).toHaveTextContent('{"kind":"all"}');
  expect(screen.getByRole("status", { name: "Состояние симуляции" })).toHaveTextContent("Дождитесь результата");
  await act(async () => finishSubmit?.({ mode: "demo", status: "simulated-success" }));
  expect(await screen.findByRole("heading", { name: "Симуляция завершена" })).toBeVisible();
  expect(screen.getByTestId("activities")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Готово" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each(["adapter", "snapshot"] as const)("invalidates a pending handoff on %s replacement and ignores its late result", async boundary => {
  deferSubmit = true;
  const { rerender } = render(<Harness />);
  await reviewInternal();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  const replacement = { ...adapter, snapshot: boundary === "snapshot" ? { ...snapshot } : snapshot };
  rerender(<Harness productAdapter={replacement} />);
  expect(submitSignal?.aborted).toBe(true);
  expect(screen.queryByRole("heading", { name: "Выполняем симуляцию" })).toBeNull();
  await act(async () => finishSubmit?.({ mode: "demo", status: "simulated-success" }));
  expect(screen.getByTestId("activities")).toHaveTextContent("0");
});

it("keeps Send resolution source-oriented and invalidates captured controller handoff callbacks", () => {
  const { result, rerender } = renderHook(({ current }) => useMonoProductController(current, { initialHidden: false }),
    { initialProps: { current: adapter } });
  act(() => result.current.commands.openIntent("send"));
  act(() => result.current.commands.setSendMode("internal"));
  act(() => result.current.commands.selectRoute(source));
  expect(result.current.view.sheet).toMatchObject({ action: "send", route: { accountId: "demo-custody", action: "send" },
    internalSend: { destination: { accountId: "demo-depositary", action: "receive" } } });
  expect(result.current.view.intent?.routes.every(route => route.action === "send")).toBe(true);
  const stale = result.current.commands;
  const event: InternalTransferSimulation = { simulationId: "late", quote: { mode: "demo", id: "q",
    request: { sourceAccountId: "demo-custody", destinationAccountId: "demo-depositary", assetId: "usdc", networkId: "ethereum", amount: "12.5" },
    sourceAccountLabel: "Основной", destinationAccountLabel: "Хранилище", symbol: "USDC", networkLabel: "Ethereum",
    available: "500", assetDebit: "12.5", fee: { amount: "0", symbol: "USDC" }, expiresAt: Date.now() + 10000 },
    result: { mode: "demo", status: "simulated-success" } };
  act(() => stale.setSendInternalSubmitState({ busy: true, quote: event.quote }));
  rerender({ current: { ...adapter } });
  act(() => {
    stale.saveSendInternalDraft({ sourceAccountId: "demo-custody", amount: "99" });
    expect(stale.recordSendInternalSimulation(event)).toBeNull();
    stale.setSendInternalSubmitState({ busy: false });
  });
  expect(result.current.view.internalTransferDrafts[receiveRequestAmountKey(target)]).toBeUndefined();
  expect(result.current.view.activities.some(activity => activity.id === "internal-simulation:late")).toBe(false);
  expect(result.current.view.sendDrafts[sendDraftKey(source)]).toBeUndefined();
});

it("does not substitute another source when the locked source is missing from supplied Receive data", async () => {
  const ports = createPorts(snapshot);
  render(<ReceiveFlow route={target} privacy={false} dataPort={{ load: async () => ({ status: "ready", data: {
    mode: "internal-transfer", accountId: "demo-depositary", assetId: "usdc", networkId: "ethereum",
    sources: [{ accountId: "demo-private", accountLabel: "Другой", assetId: "usdc", networkId: "ethereum", status: "available" }],
  } }) }} internalTransferPort={ports.internalTransfer} lockedInternalSourceAccountId="demo-custody"
    initialInternalDraft={{ sourceAccountId: "demo-private", amount: "12," }} onBack={() => {}} onClose={() => {}} />);
  expect(await screen.findByRole("textbox", { name: "Сумма перевода" })).toHaveValue("12,");
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.getByRole("button", { name: "Рассчитать пример" })).toBeDisabled();
  expect(screen.getByRole("group", { name: "Направление перевода" })).not.toHaveTextContent("Другой");
});

it("returns account-origin handoff Back to the source choice while external Back still returns to its account", () => {
  const { result } = renderHook(() => useMonoProductController(adapter, { initialHidden: false }));
  act(() => result.current.commands.openAccountsWorkspace());
  act(() => result.current.commands.inspectAccount("demo-custody"));
  act(() => result.current.commands.openAccountRoute(source));
  act(() => result.current.commands.setSendMode("internal"));
  act(() => result.current.commands.backToSendSources());
  expect(result.current.view.sheet).toMatchObject({ action: "send", route: source, sendMode: "external", returnToAccountId: "demo-custody" });
  expect(result.current.view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  act(() => result.current.commands.backToRoutes(source));
  expect(result.current.view.sheet).toBeNull();
  expect(result.current.view.accountsWorkspace?.accountId).toBe("demo-custody");
});
