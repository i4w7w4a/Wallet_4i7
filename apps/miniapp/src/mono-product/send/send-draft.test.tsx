import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActionRoute } from "@wallet/core";
import { SendFlow } from "./send-flow";
import type { SendDraft, SendSimulationResult } from "./send-form";
import type { SendDemoResult, SendPort, SendQuoteResult, SendRequest } from "./send-port";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const route: ProductActionRoute = { action: "send", accountId: "source", accountLabel: "Основной", accountKind: "custodial",
  assetId: "usdc", name: "USD Coin", symbol: "USDC", networkId: "ethereum", networkLabel: "Ethereum" };
const draft: SendDraft = { route: { accountId: "source", assetId: "usdc", networkId: "ethereum" },
  recipient: { address: "demo:saved", memo: "saved memo" }, amount: "0012,3400" };

function quoteFor(request: SendRequest): SendQuoteResult {
  return { status: "quoted", quote: { mode: "demo", id: "draft-quote", request, expiresAt: Date.now() + 60_000,
    terms: { decimals: 6, available: "100" }, assetDebit: request.amount,
    networkFee: { status: "known", amount: "0.0001", symbol: "ETH" }, feeFunding: { kind: "balance", status: "sufficient" } } };
}

function portWith(overrides: Partial<SendPort> = {}): SendPort {
  return { mode: "demo", loadRoute: async () => ({ terms: { decimals: 6, available: "100" },
    recipient: { label: "Получатель", hint: "Неплатёжный пример", memo: { label: "Memo", required: false } } }),
  validateRecipient: async (_route, recipient) => recipient.address.startsWith("demo:") ? { valid: true, recipient } : { valid: false },
  quote: async request => quoteFor(request), send: async () => ({ mode: "demo", status: "simulated-success" }), ...overrides };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function toAmount() {
  fireEvent.click(await screen.findByRole("button", { name: "Продолжить" }));
  return screen.findByLabelText("Сумма, USDC");
}

async function toReview() {
  await toAmount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
}

it("restores only route-bound form fields and requires fresh recipient validation and quote", async () => {
  const validateRecipient = vi.fn<SendPort["validateRecipient"]>(async (_route, recipient) => ({ valid: true, recipient }));
  const quote = vi.fn<SendPort["quote"]>(async request => quoteFor(request));
  const send = vi.fn<SendPort["send"]>(async () => ({ mode: "demo", status: "simulated-success" }));
  const props = { route, port: portWith({ validateRecipient, quote, send }), initialDraft: draft, onBack() {}, onClose() {} };
  const rendered = render(<SendFlow {...props} />);
  expect(await screen.findByLabelText("Получатель")).toHaveValue("demo:saved");
  expect(screen.getByLabelText("Memo · необязательно")).toHaveValue("saved memo");
  expect(screen.getByText("Черновик")).toBeInTheDocument();
  expect(validateRecipient).not.toHaveBeenCalled();
  expect(quote).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  expect(await toAmount()).toHaveValue("0012,3400");
  expect(validateRecipient.mock.calls[0]![1]).toEqual({ address: "demo:saved", memo: "saved memo" });
  rendered.rerender(<SendFlow {...props} initialDraft={{ ...draft, amount: "99" }} />);
  expect(screen.getByLabelText("Сумма, USDC")).toHaveValue("0012,3400");
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  expect(await screen.findByRole("button", { name: "Проверить перевод" })).toBeInTheDocument();
  expect(quote.mock.calls[0]![0].amount).toBe("12.34");
  expect(send).not.toHaveBeenCalled();
});

it("reports raw form edits without an echo loop or erasing the host draft on unmount", async () => {
  const port = portWith();
  const changes: (SendDraft | null)[] = [];
  function Host() {
    const [saved, setSaved] = useState<SendDraft | null>(draft);
    return <SendFlow route={{ ...route }} port={port} initialDraft={saved} onBack={() => {}} onClose={() => {}}
      onDraftChange={next => { changes.push(next); setSaved(next); }} />;
  }
  const rendered = render(<Host />);
  fireEvent.change(await screen.findByLabelText("Получатель"), { target: { value: "demo:edited" } });
  expect(changes).toHaveLength(1);
  expect(changes[0]).toEqual({ ...draft, recipient: { address: "demo:edited", memo: "saved memo" } });
  await toAmount();
  fireEvent.change(screen.getByLabelText("Сумма, USDC"), { target: { value: "12," } });
  expect(changes.at(-1)).toEqual({ ...draft, recipient: { address: "demo:edited", memo: "saved memo" }, amount: "12," });
  const beforeUnmount = changes.length;
  rendered.unmount();
  expect(changes).toHaveLength(beforeUnmount);
});

it("drops a draft belonging to another account or network when the route changes", async () => {
  const props = { route, port: portWith(), initialDraft: draft, onBack() {}, onClose() {} };
  const rendered = render(<SendFlow {...props} />);
  expect(await screen.findByLabelText("Получатель")).toHaveValue("demo:saved");
  rendered.rerender(<SendFlow {...props} route={{ ...route, accountId: "other", networkId: "solana" }} />);
  expect(await screen.findByLabelText("Получатель")).toHaveValue("");
  expect(screen.queryByText("Черновик")).toBeNull();
  fireEvent.change(screen.getByLabelText("Получатель"), { target: { value: "demo:new" } });
  expect(await toAmount()).toHaveValue("");
});

it("preserves input but discards the previous validation and quote when the port changes", async () => {
  const props = { route, initialDraft: draft, onBack() {}, onClose() {} };
  const rendered = render(<SendFlow {...props} port={portWith()} />);
  await toReview();
  const validateRecipient = vi.fn<SendPort["validateRecipient"]>(async () => ({ valid: false }));
  rendered.rerender(<SendFlow {...props} port={portWith({ validateRecipient })} />);
  expect(await screen.findByLabelText("Получатель")).toHaveValue("demo:saved");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/получателя/i);
  expect(validateRecipient).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("Сумма, USDC")).toBeNull();
});

it("starts again with an empty draft and ignores the old pending quote", async () => {
  const oldQuote = deferred<SendQuoteResult>();
  let request!: SendRequest;
  const onDraftChange = vi.fn();
  render(<SendFlow route={route} initialDraft={draft} onDraftChange={onDraftChange} onBack={() => {}} onClose={() => {}}
    port={portWith({ quote: next => { request = next; return oldQuote.promise; } })} />);
  await screen.findByLabelText("Получатель");
  await toAmount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(screen.getByRole("button", { name: "Начать заново" }));
  expect(onDraftChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByLabelText("Получатель")).toHaveValue("");
  await act(async () => oldQuote.resolve(quoteFor(request)));
  expect(screen.queryByRole("button", { name: "Проверить перевод" })).toBeNull();
  expect(screen.queryByText("Черновик")).toBeNull();
});

it("inserts only a synthetic sample, focuses its field and leaves continuation explicit", async () => {
  const validateRecipient = vi.fn<SendPort["validateRecipient"]>(async (_route, recipient) => ({ valid: true, recipient }));
  const onDraftChange = vi.fn();
  render(<SendFlow route={route} port={portWith({ validateRecipient })} onDraftChange={onDraftChange} onBack={() => {}} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Вставить пример" }));
  expect(screen.getByLabelText("Получатель")).toHaveValue("demo:recipient");
  expect(screen.getByLabelText("Получатель")).toHaveFocus();
  expect(onDraftChange).toHaveBeenLastCalledWith({ route: draft.route, recipient: { address: "demo:recipient" }, amount: "" });
  expect(validateRecipient).not.toHaveBeenCalled();
});

it.each(["simulated-success", "simulated-failure"] as const)("reports one %s result with canonical quantity and ignores rerenders", async status => {
  const pending = deferred<SendDemoResult>();
  const send = vi.fn<SendPort["send"]>(() => pending.promise);
  const events: SendSimulationResult[] = [];
  const props = { route, port: portWith({ send }), initialDraft: draft, onBack() {}, onClose() {} };
  function Host() {
    const [, setLast] = useState<SendSimulationResult | null>(null);
    return <SendFlow {...props} onSimulationResult={event => { events.push(event); setLast(event); }} />;
  }
  const rendered = render(<Host />);
  await screen.findByLabelText("Получатель");
  await toReview();
  const confirm = screen.getByRole("button", { name: "Подтвердить симуляцию" });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(events).toHaveLength(0);
  const result: SendDemoResult = status === "simulated-success" ? { mode: "demo", status }
    : { mode: "demo", status, reason: "rejected" };
  await act(async () => pending.resolve(result));
  expect(events).toEqual([{ simulationId: send.mock.calls[0]![0].idempotencyKey, route, quantity: "12.34", result }]);
  expect(send).toHaveBeenCalledTimes(1);
  rendered.rerender(<Host />);
  expect(events).toHaveLength(1);
});

it("does not report a send result after its route session was replaced", async () => {
  const pending = deferred<SendDemoResult>();
  const onSimulationResult = vi.fn();
  const props = { route, port: portWith({ send: () => pending.promise }), initialDraft: draft, onSimulationResult, onBack() {}, onClose() {} };
  const rendered = render(<SendFlow {...props} />);
  await screen.findByLabelText("Получатель");
  await toReview();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  rendered.rerender(<SendFlow {...props} route={{ ...route, accountId: "other" }} />);
  await act(async () => pending.resolve({ mode: "demo", status: "simulated-success" }));
  expect(onSimulationResult).not.toHaveBeenCalled();
});

it("hides a previous result when the replacement port fails to load", async () => {
  const props = { route, initialDraft: draft, onBack() {}, onClose() {} };
  const rendered = render(<SendFlow {...props} port={portWith()} />);
  await toReview();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("heading", { name: "Симуляция завершена" })).toBeInTheDocument();
  rendered.rerender(<SendFlow {...props} port={portWith({ loadRoute: async () => { throw new Error("unavailable"); } })} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/получить данные/i);
  expect(screen.queryByRole("button", { name: "Готово" })).toBeNull();
  expect(screen.queryByText("Средства не отправлены.")).toBeNull();
});

it("opens the host journal only from a successful result with an explicit callback", async () => {
  const onViewHistory = vi.fn();
  const props = { route, initialDraft: draft, port: portWith(), onBack() {}, onClose() {}, onViewHistory };
  const rendered = render(<SendFlow {...props} />);
  await toReview();
  expect(screen.queryByRole("button", { name: "В истории" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  fireEvent.click(await screen.findByRole("button", { name: "В истории" }));
  expect(onViewHistory).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Готово" })).toBeInTheDocument();
  rendered.rerender(<SendFlow {...props} onViewHistory={undefined} />);
  expect(screen.queryByRole("button", { name: "В истории" })).toBeNull();
});
