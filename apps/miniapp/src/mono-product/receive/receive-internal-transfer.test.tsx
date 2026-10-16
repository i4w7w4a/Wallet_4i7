import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { InternalTransferPort, InternalTransferQuote, InternalTransferQuoteResult, InternalTransferRequest,
  InternalTransferResult } from "../internal-transfer";
import { ReceiveFlow } from "./receive-flow";
import type { InternalReceiveDestination, ReceiveDataPort, ReceiveFlowProps, ReceiveRoute } from "./receive-types";

const route: ReceiveRoute = { action: "receive", receiveMode: "internal-transfer", accountId: "demo-vault",
  accountLabel: "Хранилище", accountKind: "depositary", assetId: "usdc", symbol: "USDC", name: "USD Coin",
  networkId: "ethereum", networkLabel: "Ethereum" };
const destination: InternalReceiveDestination = { mode: "internal-transfer", accountId: route.accountId,
  assetId: route.assetId, networkId: route.networkId, sources: [
    { accountId: "demo-main", accountLabel: "Основной", assetId: "usdc", networkId: "ethereum", status: "available" },
  ] };
const success: InternalTransferResult = { mode: "demo", status: "simulated-success" };
function quoteFor(request: InternalTransferRequest): InternalTransferQuote {
  return { mode: "demo", id: `quote-${request.sourceAccountId}`, request: { ...request }, sourceAccountLabel: "Основной",
    destinationAccountLabel: "Хранилище", symbol: "USDC", networkLabel: "Ethereum", available: "100",
    assetDebit: request.amount, fee: { amount: "0", symbol: "USDC" }, expiresAt: Date.now() + 60_000 };
}
function port(): InternalTransferPort {
  return { mode: "demo", quote: vi.fn<InternalTransferPort["quote"]>(async request => ({ status: "quoted", quote: quoteFor(request) })),
    submit: vi.fn<InternalTransferPort["submit"]>(async () => success) };
}
function setup(overrides: Partial<ReceiveFlowProps> = {}, data = destination) {
  const dataPort: ReceiveDataPort = { load: vi.fn(async () => ({ status: "ready" as const, data })) };
  const props: ReceiveFlowProps = { route, dataPort, privacy: false, internalTransferPort: port(),
    initialInternalDraft: { sourceAccountId: "demo-main", amount: "0012,3400" },
    onInternalDraftChange: vi.fn(), onInternalSimulationResult: vi.fn(), onViewInternalHistory: vi.fn(),
    onBack: vi.fn(), onClose: vi.fn(), ...overrides };
  return { ...render(<ReceiveFlow {...props} />), props };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function calculate() { fireEvent.click(await screen.findByRole("button", { name: "Рассчитать пример" }));
  return screen.findByRole("button", { name: "Подтвердить симуляцию" }); }
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("runs an explicit demo quote/review/pending/result with one submit and one history callback", async () => {
  const pending = deferred<InternalTransferResult>();
  const internalTransferPort = port();
  vi.mocked(internalTransferPort.submit).mockImplementation(() => pending.promise);
  const { props, rerender } = setup({ internalTransferPort });
  const confirm = await calculate();
  expect(internalTransferPort.quote).toHaveBeenCalledWith({ sourceAccountId: "demo-main", destinationAccountId: "demo-vault",
    assetId: "usdc", networkId: "ethereum", amount: "12.34" }, { signal: expect.any(AbortSignal) });
  expect(screen.getByText("Комиссия примера")).toBeVisible();
  expect(screen.getByText("0 USDC")).toBeVisible();
  expect(screen.getByText("Доступно на счёте")).toBeVisible();
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(internalTransferPort.submit).toHaveBeenCalledOnce();
  expect(screen.getByText("Выполняем симуляцию")).toBeVisible();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(props.onInternalSimulationResult).not.toHaveBeenCalled();
  await act(async () => pending.resolve(success));
  expect(screen.getByText("Симуляция завершена")).toBeVisible();
  expect(screen.getByText("Средства между счетами не перемещены.")).toBeVisible();
  const command = vi.mocked(internalTransferPort.submit).mock.calls[0]![0];
  expect(props.onInternalSimulationResult).toHaveBeenCalledExactlyOnceWith({ simulationId: command.idempotencyKey,
    quote: expect.objectContaining({ request: expect.objectContaining({ amount: "12.34" }) }), result: success });
  expect(props.onInternalDraftChange).toHaveBeenCalledExactlyOnceWith(null);
  rerender(<ReceiveFlow {...props} />);
  expect(props.onInternalSimulationResult).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "В истории" }));
  expect(props.onViewInternalHistory).toHaveBeenCalledOnce();
});

it("auto-selects one eligible source without emitting a seed, and retains raw draft through privacy", async () => {
  const { props, rerender, container } = setup({ initialInternalDraft: { sourceAccountId: null, amount: "" } });
  const input = await screen.findByRole("textbox", { name: "Сумма пополнения" });
  expect(props.onInternalDraftChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.getByText("Основной")).toBeVisible();
  expect(screen.getAllByText("Хранилище")).toHaveLength(1);
  fireEvent.change(input, { target: { value: "037,4567001" } });
  expect(props.onInternalDraftChange).toHaveBeenCalledExactlyOnceWith({ sourceAccountId: "demo-main", amount: "037,4567001" });
  rerender(<ReceiveFlow {...props} privacy initialInternalDraft={{ sourceAccountId: null, amount: "999" }} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("radio")).toBeNull();
  expect(container.innerHTML).not.toContain("37,4567001");
  expect(screen.getByRole("button", { name: "Рассчитать пример" })).toBeDisabled();
  rerender(<ReceiveFlow {...props} privacy={false} />);
  expect(screen.getByRole("textbox", { name: "Сумма пополнения" })).toHaveValue("037,4567001");
  expect(props.onInternalDraftChange).toHaveBeenCalledOnce();
});

it("redacts review and result money while privacy blocks confirmation without losing the draft", async () => {
  const { props, rerender, container } = setup();
  await calculate();
  rerender(<ReceiveFlow {...props} privacy />);
  expect(screen.getByRole("button", { name: "Подтвердить симуляцию" })).toBeDisabled();
  expect(container.innerHTML).not.toContain("12.34");
  expect(screen.queryByText("Комиссия примера")).toBeNull();
  expect(screen.queryByText("Доступно на счёте")).toBeNull();
  rerender(<ReceiveFlow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  await screen.findByText("Симуляция завершена");
  rerender(<ReceiveFlow {...props} privacy />);
  expect(container.innerHTML).not.toContain("12.34");
  expect(screen.queryByText("0 USDC")).toBeNull();
});

it("invalidates quotes on source/amount changes and ignores the aborted response", async () => {
  const first = deferred<InternalTransferQuoteResult>();
  const internalTransferPort = port();
  vi.mocked(internalTransferPort.quote).mockImplementationOnce(() => first.promise);
  const data: InternalReceiveDestination = { ...destination, sources: [...destination.sources,
    { ...destination.sources[0]!, accountId: "demo-second", accountLabel: "Резервный" }] };
  const { props } = setup({ internalTransferPort }, data);
  fireEvent.click(await screen.findByRole("button", { name: "Рассчитать пример" }));
  const firstCall = vi.mocked(internalTransferPort.quote).mock.calls[0]!;
  fireEvent.click(screen.getByRole("radio", { name: /Резервный/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Сумма пополнения" }), { target: { value: "8" } });
  expect(firstCall[1].signal.aborted).toBe(true);
  await calculate();
  await act(async () => first.resolve({ status: "quoted", quote: quoteFor(firstCall[0]) }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  await screen.findByText("Симуляция завершена");
  expect(vi.mocked(internalTransferPort.submit).mock.calls[0]![0].quote.request)
    .toMatchObject({ sourceAccountId: "demo-second", amount: "8" });
  expect(props.onInternalSimulationResult).toHaveBeenCalledOnce();
});

it("requires a fresh quote after edit and revalidates expiration immediately before submit", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
  const { props } = setup();
  await calculate();
  fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  await calculate();
  now.mockReturnValue(100_000);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Расчёт устарел");
  expect(props.internalTransferPort!.submit).not.toHaveBeenCalled();
  expect(props.onInternalSimulationResult).not.toHaveBeenCalled();
});

it.each([
  ["unknown-available", "Доступный остаток неизвестен"],
  ["insufficient-asset", "Недостаточно доступных средств"],
  ["unsupported-route", "Эта пара счетов недоступна"],
] as const)("explains %s next to the form without publishing a result", async (issue, message) => {
  const internalTransferPort = port();
  vi.mocked(internalTransferPort.quote).mockResolvedValue({ status: "unavailable", issue });
  const { props } = setup({ internalTransferPort });
  fireEvent.click(await screen.findByRole("button", { name: "Рассчитать пример" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("textbox", { name: "Сумма пополнения" })).toHaveValue("0012,3400");
  expect(props.onInternalSimulationResult).not.toHaveBeenCalled();
});

it("copies the accepted quote before submit so port mutation cannot rewrite the result", async () => {
  const internalTransferPort = port();
  vi.mocked(internalTransferPort.submit).mockImplementation(async ({ quote }) => {
    quote.request.amount = "999"; quote.fee.amount = "99"; return success;
  });
  const { props } = setup({ internalTransferPort });
  fireEvent.click(await calculate());
  await screen.findByText("Симуляция завершена");
  expect(props.onInternalSimulationResult).toHaveBeenCalledWith(expect.objectContaining({ quote: expect.objectContaining({
    request: expect.objectContaining({ amount: "12.34" }), fee: { amount: "0", symbol: "USDC" },
  }) }));
  expect(screen.queryByText(/999|99 USDC/)).toBeNull();
});

it("keeps a failed draft and uses a new stable attempt ID after edit/requote", async () => {
  const internalTransferPort = port();
  vi.mocked(internalTransferPort.submit).mockResolvedValueOnce({ mode: "demo", status: "simulated-failure", reason: "rejected" });
  const { props } = setup({ internalTransferPort });
  fireEvent.click(await calculate());
  await screen.findByText("Симуляция не выполнена");
  expect(props.onInternalDraftChange).not.toHaveBeenCalled();
  expect(props.onInternalSimulationResult).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
  expect(screen.getByRole("textbox", { name: "Сумма пополнения" })).toHaveValue("0012,3400");
  fireEvent.click(await calculate());
  await screen.findByText("Симуляция завершена");
  const calls = vi.mocked(internalTransferPort.submit).mock.calls;
  expect(calls[0]![0].idempotencyKey).toMatch(/:1$/);
  expect(calls[1]![0].idempotencyKey).toMatch(/:2$/);
  expect(props.onInternalSimulationResult).toHaveBeenCalledTimes(2);
  expect(props.onInternalDraftChange).toHaveBeenCalledExactlyOnceWith(null);
});

it("invalidates pending work when the port changes and retains the raw draft", async () => {
  const pending = deferred<InternalTransferResult>();
  const internalTransferPort = port();
  vi.mocked(internalTransferPort.submit).mockImplementation(() => pending.promise);
  const { props, rerender } = setup({ internalTransferPort });
  fireEvent.click(await calculate());
  const signal = vi.mocked(internalTransferPort.submit).mock.calls[0]![1].signal;
  rerender(<ReceiveFlow {...props} internalTransferPort={port()} />);
  expect(signal.aborted).toBe(true);
  expect(screen.getByRole("textbox", { name: "Сумма пополнения" })).toHaveValue("0012,3400");
  await act(async () => pending.resolve(success));
  expect(props.onInternalSimulationResult).not.toHaveBeenCalled();
  expect(props.onInternalDraftChange).not.toHaveBeenCalled();
});

it.each(["close", "unmount"])("aborts %s and prevents a late result from writing history", async action => {
  const pending = deferred<InternalTransferResult>();
  const internalTransferPort = port();
  vi.mocked(internalTransferPort.submit).mockImplementation(() => pending.promise);
  const { props, unmount } = setup({ internalTransferPort });
  fireEvent.click(await calculate());
  const signal = vi.mocked(internalTransferPort.submit).mock.calls[0]![1].signal;
  if (action === "close") fireEvent.click(screen.getByRole("button", { name: "Закрыть получение" }));
  else unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(success));
  expect(props.onInternalSimulationResult).not.toHaveBeenCalled();
  expect(props.onInternalDraftChange).not.toHaveBeenCalled();
});

it("leaves the route-only internal flow intact when the optional port is absent", async () => {
  setup({ internalTransferPort: undefined });
  expect(await screen.findByRole("button", { name: "Проверить маршрут" })).toBeVisible();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});
