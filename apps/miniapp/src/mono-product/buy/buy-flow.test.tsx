import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoCommercePorts, type BuyDraft, type BuyPort, type BuyQuoteResult, type BuySimulation,
  type BuySubmitResult, type CommerceSubmitState } from "../commerce";
import { BuyFlow } from "./buy-flow";
import { buyRoute, buySnapshot, deferred, flowProps, realBuyPort } from "./buy-test-utils";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

async function enterAmount(amount = "100") {
  await screen.findByRole("radio", { name: "Демо-оплата" });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByLabelText("Сумма, USD"), { target: { value: amount } });
}

async function review(amount = "100") {
  await enterAmount(amount);
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  await screen.findByRole("button", { name: "Подтвердить симуляцию" });
}

// Break: accepting a second attempt, reporting success before response, or releasing
// the host's accepted snapshot before delivering the validated terminal result.
it("keeps one accepted purchase pending and delivers its immutable result before release", async () => {
  const original = realBuyPort();
  const response = deferred<BuySubmitResult>();
  const commands: Parameters<BuyPort["submit"]>[0][] = [];
  const lifecycle: string[] = [];
  const events: BuySimulation[] = [];
  let busy: CommerceSubmitState | null = null;
  let actual: Promise<BuySubmitResult> | null = null;
  let confirm!: HTMLElement;
  const port: BuyPort = { ...original, submit: (command, options) => {
    expect(busy?.busy).toBe(true);
    commands.push(command);
    // Reenter before the outer click commits pending. A disabled/detached button
    // after rerender would not prove the synchronous attempt guard.
    if (commands.length === 1) fireEvent.click(confirm);
    actual = original.submit(command, options);
    return response.promise;
  } };
  render(<BuyFlow {...flowProps(port, {
    onSubmitBusyChange: state => { busy = state; lifecycle.push(state.busy ? "busy" : "released"); },
    onSimulationResult: event => {
      expect(busy?.busy).toBe(true);
      events.push(event); lifecycle.push("terminal");
    },
  })} />);

  await review();
  expect(screen.getByText("100 USDC")).toBeInTheDocument();
  expect(screen.getByText("101 USD")).toBeInTheDocument();
  expect(screen.getByText("1 USD")).toBeInTheDocument();
  expect(screen.getByText(/демо-курс/i)).toBeInTheDocument();
  expect(events).toEqual([]);

  confirm = screen.getByRole("button", { name: "Подтвердить симуляцию" });
  fireEvent.click(confirm);
  expect(commands).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Симуляция выполняется" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Симуляция завершена" })).toBeNull();
  expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
  expect(events).toEqual([]);

  await act(async () => { response.resolve(await actual!); });
  expect(screen.getByRole("heading", { name: "Симуляция завершена" })).toBeInTheDocument();
  expect(screen.getByText(/средства не списаны/i)).toBeInTheDocument();
  expect(lifecycle).toEqual(["busy", "terminal", "released"]);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ mode: "demo", kind: "buy", quote: {
    payment: { amount: "100", currency: "USD" }, debit: { amount: "101", currency: "USD" },
    credit: { quantity: "100", symbol: "USDC", accountId: "demo-custody", networkId: "ethereum" },
  } });
  expect(Object.isFrozen(events[0])).toBe(true);
  expect(Object.isFrozen(events[0]!.quote.credit)).toBe(true);
  expect(Object.isFrozen(events[0]!.result)).toBe(true);
  expect(busy).toEqual({ busy: false, operationId: events[0]!.simulationId });
});

// Break: Back reuses review authorization or success preserves an old raw draft.
it("restores raw input on back, requires a new quote and clears only the successful draft", async () => {
  const drafts: (BuyDraft | null)[] = [];
  const history = vi.fn();
  render(<BuyFlow {...flowProps(realBuyPort(), { onDraftChange: draft => drafts.push(draft), onViewHistory: history })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  expect(drafts.at(-1)).toMatchObject({ route: buyRoute, fiatAmount: "100", methodId: "demo-payment-usd" });
  fireEvent.change(screen.getByLabelText("Сумма, USD"), { target: { value: "00200,00" } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  fireEvent.click(await screen.findByRole("button", { name: "Подтвердить симуляцию" }));
  await screen.findByRole("heading", { name: "Симуляция завершена" });
  expect(screen.getByText("200 USDC")).toBeInTheDocument();
  expect(screen.getByText("201 USD")).toBeInTheDocument();
  expect(drafts.at(-1)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "В истории" }));
  expect(history).toHaveBeenCalledOnce();
});

// Break: restoring a draft restores a quote/result, or parent appearance renders reset raw input.
it("restores only the exact raw draft and preserves it across equivalent parent renders", async () => {
  const port = realBuyPort();
  const props = flowProps(port, { initialDraft: { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "00100,50" } });
  const rendered = render(<BuyFlow {...props} />);
  await screen.findByRole("radio", { name: "Демо-оплата" });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("00100,50");
  rendered.rerender(<BuyFlow {...props} route={{ ...buyRoute }} initialDraft={{ ...props.initialDraft!, fiatAmount: "900" }} />);
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("00100,50");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("00100,50");
});

// Break: a rejected precision check discards raw input or progresses to confirmation.
it("keeps an invalid raw amount editable without producing a review", async () => {
  render(<BuyFlow {...flowProps(realBuyPort())} />);
  await enterAmount("100.001");
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100.001");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Сумма, USD"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  expect(await screen.findByRole("button", { name: "Подтвердить симуляцию" })).toBeEnabled();
});

// Break: quote responses can install old amounts after a newer request completed.
it("keeps the latest quote when an aborted older amount resolves last", async () => {
  const original = realBuyPort();
  const gates = [deferred<BuyQuoteResult>(), deferred<BuyQuoteResult>()];
  const actual: Promise<BuyQuoteResult>[] = [];
  const port: BuyPort = { ...original, quote: (request, options) => {
    const index = actual.length; actual.push(original.quote(request, options)); return gates[index]!.promise;
  } };
  render(<BuyFlow {...flowProps(port)} />);
  await enterAmount();
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  await act(async () => { await actual[0]; });
  fireEvent.change(screen.getByLabelText("Сумма, USD"), { target: { value: "200" } });
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  await act(async () => gates[1]!.resolve(await actual[1]!));
  expect(screen.getByText("200 USDC")).toBeInTheDocument();
  await act(async () => gates[0]!.resolve(await actual[0]!));
  expect(screen.getByText("200 USDC")).toBeInTheDocument();
  expect(screen.queryByText("100 USDC")).toBeNull();
  expect(screen.getByText("201 USD")).toBeInTheDocument();
});

// Break: matching action/symbol hides a mismatched destination or unknown purchase funding.
it.each(["destination", "funding"] as const)("refuses a quote with invalid %s without losing input", async fault => {
  const original = realBuyPort();
  const port: BuyPort = { ...original, quote: async (request, options) => {
    const result = await original.quote(request, options);
    if (result.status !== "quoted") return result;
    return { status: "quoted", quote: fault === "destination"
      ? { ...result.quote, credit: { ...result.quote.credit, networkId: "solana", networkLabel: "Solana" } }
      : { ...result.quote, funding: { ...result.quote.funding, available: null } } };
  } };
  render(<BuyFlow {...flowProps(port)} />);
  await enterAmount();
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

// Break: expiry is checked only when the quote arrives, not at explicit confirmation.
it("revokes an expired quote at submit and leaves the draft available for correction", async () => {
  render(<BuyFlow {...flowProps(realBuyPort())} />);
  await review();
  const future = Date.now() + 60_001;
  vi.spyOn(Date, "now").mockReturnValue(future);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
  expect(screen.queryByRole("heading", { name: "Симуляция выполняется" })).toBeNull();
});

// Break: an accepted attempt is discarded when its original quote later expires.
it("keeps an accepted operation pending after quote expiry and blocks Escape until completion", async () => {
  const original = realBuyPort();
  const gate = deferred<BuySubmitResult>();
  let actual: Promise<BuySubmitResult> | null = null;
  const close = vi.fn();
  const port: BuyPort = { ...original, submit: (command, options) => { actual = original.submit(command, options); return gate.promise; } };
  render(<BuyFlow {...flowProps(port, { onClose: close })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  const completed = await actual!;
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_001);
  fireEvent.keyDown(screen.getByRole("region", { name: "Демонстрационная покупка" }), { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Симуляция выполняется" })).toBeInTheDocument();
  expect(screen.getByText(/дождитесь результата/i)).toBeInTheDocument();
  await act(async () => gate.resolve(completed));
  expect(screen.getByRole("heading", { name: "Симуляция завершена" })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("region", { name: "Демонстрационная покупка" }), { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
});

// Break: privacy leaves raw input/accessibility copies present or a hidden review submits.
it("removes private input and review values, blocks actions and restores the same draft", async () => {
  const port = realBuyPort();
  const events: BuySimulation[] = [];
  const props = flowProps(port, { onSimulationResult: event => events.push(event) });
  const rendered = render(<BuyFlow {...props} />);
  await enterAmount();
  rendered.rerender(<BuyFlow {...props} privacy />);
  expect(screen.queryByLabelText("Сумма, USD")).toBeNull();
  expect(screen.getByRole("button", { name: "Проверить покупку" })).toBeDisabled();
  expect(rendered.container.innerHTML).not.toMatch(/value="100"/);
  rendered.rerender(<BuyFlow {...props} />);
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
  fireEvent.click(screen.getByRole("button", { name: "Проверить покупку" }));
  await screen.findByRole("button", { name: "Подтвердить симуляцию" });
  rendered.rerender(<BuyFlow {...props} privacy />);
  expect(screen.queryByText("100 USDC")).toBeNull();
  expect(screen.queryByText("101 USD")).toBeNull();
  expect(screen.queryByText("1 USD")).toBeNull();
  expect(screen.getByRole("button", { name: "Подтвердить симуляцию" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(events).toEqual([]);
  for (const element of rendered.container.querySelectorAll("[aria-label], [title]")) {
    expect(`${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""}`).not.toMatch(/100|101/);
  }
  rendered.rerender(<BuyFlow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  await screen.findByRole("heading", { name: "Симуляция завершена" });
  rendered.rerender(<BuyFlow {...props} privacy />);
  expect(screen.queryByText("100 USDC")).toBeNull();
  expect(screen.queryByText("101 USD")).toBeNull();
  expect(events).toHaveLength(1);
});

// Break: transport/pre-acceptance failures are invented as terminal operations or destroy drafts.
it.each(["throw", "unavailable", "error"] as const)("recovers from submit %s without a history event", async fault => {
  const original = realBuyPort();
  const events: BuySimulation[] = [];
  const states: CommerceSubmitState[] = [];
  const port: BuyPort = { ...original, submit: async () => {
    if (fault === "throw") throw new Error("Controlled transport boundary");
    return fault === "unavailable" ? { status: "unavailable", issue: { code: "rejected" } }
      : { status: "error", issue: { code: "unavailable" }, retryable: true };
  } };
  render(<BuyFlow {...flowProps(port, { onSimulationResult: event => events.push(event), onSubmitBusyChange: state => states.push(state) })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
  expect(screen.getByRole("button", { name: "Проверить покупку" })).toBeEnabled();
  expect(screen.queryByRole("heading", { name: "Симуляция завершена" })).toBeNull();
  expect(events).toEqual([]);
  expect(states).toHaveLength(2);
  expect(states[0]!.busy).toBe(true);
  expect(states[1]).toMatchObject({ busy: false });
});

// Break: a terminal operation is accepted without matching its identity and accepted quantities.
it.each(["identity", "credit"] as const)("refuses a terminal %s mismatch and releases the exact attempt", async fault => {
  const original = realBuyPort();
  const events: BuySimulation[] = [];
  const states: CommerceSubmitState[] = [];
  const port: BuyPort = { ...original, submit: async (command, options) => {
    const result = await original.submit(command, options);
    if (result.status !== "simulated") return result;
    return { status: "simulated", simulation: fault === "identity"
      ? { ...result.simulation, simulationId: "foreign-operation" }
      : { ...result.simulation, quote: { ...result.simulation.quote, credit: { ...result.simulation.quote.credit, quantity: "999" } } } };
  } };
  render(<BuyFlow {...flowProps(port, { onSimulationResult: event => events.push(event), onSubmitBusyChange: state => states.push(state) })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
  expect(screen.queryByText("999 USDC")).toBeNull();
  expect(events).toEqual([]);
  const accepted = states[0];
  expect(accepted?.busy).toBe(true);
  if (accepted?.busy) expect(states[1]).toEqual({ busy: false, operationId: accepted.attempt.operationId });
});

// Break: valid terminal failure is treated as transport failure, cleared draft, or replayed on rerender.
it("records a validated simulated failure once and keeps its draft for a fresh quote", async () => {
  const port = createDemoCommercePorts(buySnapshot(), { loadDelayMs: 0, quoteDelayMs: 0, submitDelayMs: 0, outcome: "failure" }).buy;
  const events: BuySimulation[] = [];
  const drafts: (BuyDraft | null)[] = [];
  const props = flowProps(port, { onSimulationResult: event => events.push(event), onDraftChange: draft => drafts.push(draft) });
  const rendered = render(<BuyFlow {...props} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  await screen.findByRole("heading", { name: "Симуляция не выполнена" });
  expect(events).toHaveLength(1);
  expect(events[0]!.result.status).toBe("simulated-failure");
  expect(drafts.at(-1)?.fiatAmount).toBe("100");
  rendered.rerender(<BuyFlow {...props} onSimulationResult={event => events.push(event)} />);
  expect(events).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Изменить сумму" }));
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

// Break: an unsupported/empty destination presents a half-form or a failed load has no recovery.
it.each(["unsupported", "empty", "error"] as const)("shows useful %s route state with back and available retry", async fault => {
  const original = realBuyPort();
  let attempt = 0;
  const back = vi.fn();
  const port: BuyPort = { ...original, loadRoute: async (route, options) => {
    attempt += 1;
    if (fault === "unsupported") return { status: "unavailable", issue: { code: "unsupported-route" } };
    if (fault === "error" && attempt === 1) return { status: "error", issue: { code: "unavailable" }, retryable: true };
    const result = await original.loadRoute(route, options);
    return fault === "empty" && result.status === "ready" ? { status: "ready", data: { ...result.data, methods: [] } } : result;
  } };
  render(<BuyFlow {...flowProps(port, { onBack: back })} />);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Сумма, USD")).toBeNull();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  if (fault === "error") {
    fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
    expect(await screen.findByRole("radio", { name: "Демо-оплата" })).toBeEnabled();
  }
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(back).toHaveBeenCalledWith(buyRoute);
});

// Break: same-route adapter/port replacement inherits previous quote authorization.
it("revokes an old port quote while preserving raw input for the replacement port", async () => {
  const props = flowProps(realBuyPort());
  const rendered = render(<BuyFlow {...props} />);
  await review();
  rendered.rerender(<BuyFlow {...props} port={realBuyPort()} />);
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  await screen.findByRole("radio", { name: "Демо-оплата" });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(screen.getByLabelText("Сумма, USD")).toHaveValue("100");
});

// Break: unmount leaves the host busy or allows a late accepted response to append history.
it("aborts and releases an unmounted attempt without publishing its late terminal result", async () => {
  const original = realBuyPort();
  const gate = deferred<BuySubmitResult>();
  let actual: Promise<BuySubmitResult> | null = null;
  let signal!: AbortSignal;
  const states: CommerceSubmitState[] = [];
  const events: BuySimulation[] = [];
  const port: BuyPort = { ...original, submit: (command, options) => {
    signal = options.signal; actual = original.submit(command, options); return gate.promise;
  } };
  const rendered = render(<BuyFlow {...flowProps(port, { onSubmitBusyChange: state => states.push(state), onSimulationResult: event => events.push(event) })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  const completed = await actual!;
  rendered.unmount();
  expect(signal.aborted).toBe(true);
  const accepted = states[0];
  expect(accepted?.busy).toBe(true);
  if (accepted?.busy) expect(states[1]).toEqual({ busy: false, operationId: accepted.attempt.operationId });
  await act(async () => gate.resolve(completed));
  expect(events).toEqual([]);
  expect(states).toHaveLength(2);
  await waitFor(() => expect(screen.queryByRole("region", { name: "Демонстрационная покупка" })).toBeNull());
});
