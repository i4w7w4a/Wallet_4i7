import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProductActionRoute } from "@wallet/core";
import { SendFlow, type SendBatteryActivity } from "./send-flow";
import type { SendDemoResult, SendPort, SendQuote, SendQuoteResult, SendRequest } from "./send-port";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const route: ProductActionRoute = {
  action: "send", accountId: "account-a", accountLabel: "Основной", accountKind: "custodial",
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
};

function makeQuote(request: SendRequest, extra: Partial<SendQuote> = {}): SendQuoteResult {
  return { status: "quoted", quote: { mode: "demo", id: "test-quote", request,
    expiresAt: Date.now() + 60_000, terms: { decimals: 6, available: "100" }, assetDebit: request.amount,
    networkFee: { status: "known", amount: "0.0001", symbol: "ETH" },
    feeFunding: { kind: "balance", status: "sufficient" }, ...extra } };
}

function makePort(extra: Partial<SendPort> = {}): SendPort {
  return {
    mode: "demo",
    loadRoute: async () => ({ terms: { decimals: 6, available: "100" }, recipient: {
      label: "Получатель", hint: "Только тестовый получатель", placeholder: "demo:recipient",
    } }),
    validateRecipient: async (_route, recipient) => recipient.address.startsWith("demo:")
      ? { valid: true, recipient } : { valid: false },
    quote: async request => makeQuote(request),
    send: async () => ({ mode: "demo", status: "simulated-success" }),
    ...extra,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function mount(port = makePort(), extra: Partial<React.ComponentProps<typeof SendFlow>> = {}) {
  return render(<SendFlow route={route} port={port} onBack={vi.fn()} onClose={vi.fn()} {...extra} />);
}

async function enterAmount(amount = "10") {
  fireEvent.change(await screen.findByLabelText("Получатель"), { target: { value: "demo:recipient" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByLabelText("Сумма, USDC"), { target: { value: amount } });
}

async function review() {
  await enterAmount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
}

it("shows pending and a literal simulation result, and synchronously blocks duplicate submission", async () => {
  const pending = deferred<SendDemoResult>();
  const send = vi.fn<SendPort["send"]>(() => pending.promise);
  mount(makePort({ send }));
  await review();
  const confirm = screen.getByRole("button", { name: "Подтвердить симуляцию" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]![0]).toMatchObject({ quote: { request: { amount: "10", recipient: { address: "demo:recipient" } } }, idempotencyKey: expect.any(String) });
  expect(screen.getByRole("status")).toHaveTextContent(/выполняется симуляция/i);
  await act(async () => pending.resolve({ mode: "demo", status: "simulated-success" }));
  expect(screen.getByRole("heading", { name: "Симуляция завершена" })).toBeInTheDocument();
  expect(screen.getByText(/средства не отправлены/i)).toBeInTheDocument();
  expect(screen.queryByText(/0x[a-f0-9]{32}/i)).toBeNull();
});

it("keeps the latest quote when an older request resolves last", async () => {
  const first = deferred<SendQuoteResult>();
  const second = deferred<SendQuoteResult>();
  const requests: SendRequest[] = [];
  const quote: SendPort["quote"] = request => {
    requests.push(request);
    return requests.length === 1 ? first.promise : second.promise;
  };
  mount(makePort({ quote }));
  await enterAmount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  expect(screen.getByRole("status")).toHaveTextContent(/рассчитываем комиссию/i);
  fireEvent.change(screen.getByLabelText("Сумма, USDC"), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  await act(async () => second.resolve(makeQuote(requests[1]!, { networkFee: { status: "known", amount: "0.002", symbol: "ETH" } })));
  await act(async () => first.resolve(makeQuote(requests[0]!, { networkFee: { status: "known", amount: "0.001", symbol: "ETH" } })));
  expect(screen.getByText("0.002 ETH")).toBeInTheDocument();
  expect(screen.queryByText("0.001 ETH")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Проверить перевод" }));
  expect(screen.getByText("20 USDC")).toBeInTheDocument();
});

it("invalidates the quote after recipient editing and after route changes", async () => {
  const port = makePort();
  const props = { route, port, onBack: vi.fn(), onClose: vi.fn() };
  const rendered = render(<SendFlow {...props} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  fireEvent.click(screen.getByRole("button", { name: "Изменить получателя" }));
  fireEvent.change(screen.getByLabelText("Получатель"), { target: { value: "demo:other" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByLabelText("Сумма, USDC")).toHaveValue("10");
  expect(screen.queryByRole("button", { name: "Проверить перевод" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  expect(await screen.findByRole("button", { name: "Проверить перевод" })).toBeInTheDocument();
  rendered.rerender(<SendFlow {...props} route={{ ...route, accountId: "account-b", networkId: "solana", networkLabel: "Solana" }} />);
  expect(await screen.findByLabelText("Получатель")).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Проверить перевод" })).toBeNull();
  expect(screen.getByText("Solana")).toBeInTheDocument();
});

it("does not accept an old quote after a route change, even if its provider ignores abort", async () => {
  const pending = deferred<SendQuoteResult>();
  let oldRequest!: SendRequest;
  const port = makePort({ quote: request => { oldRequest = request; return pending.promise; } });
  const props = { route, port, onBack: vi.fn(), onClose: vi.fn() };
  const rendered = render(<SendFlow {...props} />);
  await enterAmount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  rendered.rerender(<SendFlow {...props} route={{ ...route, networkId: "solana" }} />);
  await act(async () => pending.resolve(makeQuote(oldRequest)));
  expect(await screen.findByLabelText("Получатель")).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Проверить перевод" })).toBeNull();
});

it.each([
  ["unknown", { networkFee: { status: "unknown" } }, /комиссия неизвестна/i],
  ["fee", { feeFunding: { kind: "balance", status: "insufficient" } }, /недостаточно средств для комиссии/i],
  ["asset", { terms: { decimals: 6, available: "9" } }, /недостаточно актива/i],
] as const)("blocks confirmation for %s instead of displaying a free operation", async (_name, extra, message) => {
  mount(makePort({ quote: async request => makeQuote(request, extra) }));
  await enterAmount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.queryByRole("button", { name: "Проверить перевод" })).toBeNull();
  expect(screen.queryByText("0 ETH")).toBeNull();
});

it("expires an open review and requires a fresh quote before submission", async () => {
  const send = vi.fn<SendPort["send"]>(async () => ({ mode: "demo", status: "simulated-success" }));
  mount(makePort({ send, quote: async request => makeQuote(request, { expiresAt: Date.now() + 5_000 }) }));
  await review();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10_000);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/срок расчёта истёк/i);
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

it("requires a new quote after failure and then permits a deliberate retry", async () => {
  let attempts = 0;
  let quotes = 0;
  mount(makePort({
    quote: async request => { quotes += 1; return makeQuote(request, { id: `quote-${quotes}` }); },
    send: async () => ++attempts === 1
      ? { mode: "demo", status: "simulated-failure", reason: "rejected" }
      : { mode: "demo", status: "simulated-success" },
  }));
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("heading", { name: "Симуляция не выполнена" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Пересчитать и повторить" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("heading", { name: "Симуляция завершена" })).toBeInTheDocument();
  expect(quotes).toBe(2);
});

it("masks amounts, fees and recipient in review when privacy changes without losing the draft", async () => {
  const props = { route, port: makePort(), onBack: vi.fn(), onClose: vi.fn() };
  const rendered = render(<SendFlow {...props} />);
  await review();
  rendered.rerender(<SendFlow {...props} privacy />);
  expect(screen.queryByText("10 USDC")).toBeNull();
  expect(screen.queryByText("0.0001 ETH")).toBeNull();
  expect(screen.queryByText("demo:recipient")).toBeNull();
  expect(screen.getByRole("button", { name: "Подтвердить симуляцию" })).toBeInTheDocument();
  rendered.rerender(<SendFlow {...props} />);
  expect(screen.getByText("10 USDC")).toBeInTheDocument();
});

it("validates recipient through the port and returns to the parent chooser or closes", async () => {
  const onBack = vi.fn(), onClose = vi.fn();
  mount(makePort(), { onBack, onClose });
  fireEvent.change(await screen.findByLabelText("Получатель"), { target: { value: "invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/проверьте получателя/i);
  expect(screen.queryByLabelText("Сумма, USDC")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(screen.getByRole("region", { name: "Демонстрационная отправка" }), { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("fails closed when a route is unsupported", async () => {
  mount(makePort({ loadRoute: async () => null }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/маршрут недоступен/i));
  expect(screen.queryByLabelText("Получатель")).toBeNull();
});

it("reports battery activity only while the current pending send owns the pool", async () => {
  const attempts = Array.from({ length: 4 }, () => deferred<SendDemoResult>());
  let attempt = 0;
  const changes: (SendBatteryActivity | null)[] = [];
  const port = makePort({
    quote: async request => makeQuote(request, { feeFunding: { kind: "battery", charges: 1, pool: {
      id: `${request.route.networkId}-pool`, networkId: request.route.networkId,
      networkLabel: request.route.networkLabel, eligibleAccountIds: ["account-a", "account-b"],
      action: "send", remainingTransfers: 3,
    } } }),
    send: () => attempts[attempt++]!.promise,
  });
  function Host({ selectedRoute }: { selectedRoute: ProductActionRoute }) {
    const [activity, setActivity] = useState<SendBatteryActivity | null>(null);
    return <>
      <output aria-label="Активный пул">{activity?.poolId ?? "idle"}</output>
      <SendFlow route={selectedRoute} port={port} onBack={() => {}} onClose={() => {}}
        onBatteryActivityChange={next => { changes.push(next); setActivity(next); }} />
    </>;
  }
  const rendered = render(<Host selectedRoute={route} />);
  await review();
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("idle");
  expect(changes).toEqual([null]);
  expect(screen.queryByRole("img", { name: "Батарейка используется" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  fireEvent.click(screen.getByRole("button", { name: "Проверить перевод" }));
  expect(changes).toEqual([null]);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(changes).toEqual([null, { poolId: "ethereum-pool", phase: "using" }]);
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("ethereum-pool");
  rendered.rerender(<Host selectedRoute={{ ...route }} />);
  expect(changes).toHaveLength(2); // Parent renders/handler identity must not re-emit using.

  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("img", { name: "Батарейка используется" })).toHaveAttribute("data-visible", "false");
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("ethereum-pool");
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByRole("img", { name: "Батарейка используется" })).toHaveAttribute("data-visible", "true");
  await act(async () => attempts[0]!.resolve({ mode: "demo", status: "simulated-success" }));
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("idle");
  expect(changes.at(-1)).toBeNull();

  rendered.rerender(<Host selectedRoute={{ ...route, networkId: "solana", networkLabel: "Solana" }} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("solana-pool");
  rendered.rerender(<Host selectedRoute={{ ...route, accountId: "account-b" }} />);
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("idle");
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  const beforeOldResult = changes.length;
  await act(async () => attempts[1]!.resolve({ mode: "demo", status: "simulated-success" }));
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("ethereum-pool");
  expect(changes).toHaveLength(beforeOldResult); // Old route cannot clear the new pending activity.
  await act(async () => attempts[2]!.resolve({ mode: "demo", status: "simulated-failure", reason: "rejected" }));
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("idle");
  expect(changes.at(-1)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Пересчитать и повторить" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(screen.getByLabelText("Активный пул")).toHaveTextContent("ethereum-pool");
  rendered.unmount();
  expect(changes.at(-1)).toBeNull();
  const afterUnmount = changes.length;
  await act(async () => attempts[3]!.resolve({ mode: "demo", status: "simulated-success" }));
  expect(changes).toHaveLength(afterUnmount);
});
