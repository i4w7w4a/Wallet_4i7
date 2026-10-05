import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { CommerceSubmitState, SwapQuoteResult, SwapRequest, SwapSimulation, SwapSubmitResult } from "../commerce";
import { SwapFlow } from "./swap-flow";
import { deferred, destination, flowProps, pairId, quoted, routeData, source, sourceRoute, terminal, testPort } from "./swap-test-fixtures";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

async function amount(value = "100") {
  fireEvent.change(await screen.findByRole("textbox", { name: "Отдаю, USDC" }), { target: { value } });
}

async function review(value = "100") {
  await amount(value);
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  await screen.findByRole("button", { name: "Подтвердить симуляцию" });
}

it("binds the offered pair and shows literal source, net credit and fee-added total debit", async () => {
  const requests: SwapRequest[] = [];
  const port = testPort({ quote: async request => { requests.push(request); return quoted(request); } });
  render(<SwapFlow {...flowProps(port)} />);
  expect(await screen.findByText("После расчёта")).toBeInTheDocument();
  expect(screen.getByText(/доступно: 500 USDC/i)).toBeInTheDocument();
  await review();
  expect(requests).toEqual([{ route: sourceRoute, pairId, destination, sourceAmount: "100" }]);
  expect(within(screen.getByRole("region", { name: "Отдаю" })).getByText("100 USDC")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Получаю" })).getByText("0,04 ETH")).toBeInTheDocument();
  expect(screen.getByText("101 USDC")).toBeInTheDocument();
  expect(screen.getByText("1 USDC")).toBeInTheDocument();
  expect(screen.getAllByText("Основной")).toHaveLength(2);
  expect(screen.getAllByText("Ethereum")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: /поменять|reverse/i })).toBeNull();
});

it.each([
  { label: "unknown source available", changes: { terms: { ...routeData.terms, available: null } } },
  { label: "unknown fee", changes: { fee: { status: "unknown" as const } } },
  { label: "unknown fee funding", changes: { feeFunding: { kind: "unknown" as const } } },
  { label: "unfunded third-unit fee", changes: {
    debit: { ...source, quantity: "100" }, fee: { status: "known" as const, amount: "0.001", unit: destination },
    feeFunding: { kind: "balance" as const, unit: destination, available: null },
  } },
])("does not confirm a quote with $label", async ({ changes }) => {
  const submit = vi.fn(testPort().submit);
  render(<SwapFlow {...flowProps(testPort({ quote: async request => quoted(request, changes), submit }))} />);
  await amount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it("preserves literal precision rather than deriving output from a fiat portfolio estimate", async () => {
  render(<SwapFlow {...flowProps()} />);
  await review("1,000001");
  expect(within(screen.getByRole("region", { name: "Отдаю" })).getByText("1,000001 USDC")).toBeInTheDocument();
  expect(screen.getByText("2,000001 USDC")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Получаю" })).getByText("0,0004000004 ETH")).toBeInTheDocument();
});

it("invalidates edited quotes and ignores a response whose request generation was replaced", async () => {
  const first = deferred<SwapQuoteResult>();
  const second = deferred<SwapQuoteResult>();
  const requests: SwapRequest[] = [];
  const port = testPort({ quote: request => {
    requests.push(request); return requests.length === 1 ? first.promise : second.promise;
  } });
  render(<SwapFlow {...flowProps(port)} />);
  await amount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  await amount("200");
  expect(screen.getByText("После расчёта")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  await act(async () => second.resolve(quoted(requests[1]!)));
  await act(async () => first.resolve(quoted(requests[0]!)));
  expect(screen.getByText("0,08 ETH")).toBeInTheDocument();
  expect(screen.queryByText("0,04 ETH")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  await amount("100");
  expect(screen.getByText("После расчёта")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

it("invalidates a quote when its destination choice is cleared", async () => {
  const pending = deferred<SwapQuoteResult>();
  let request!: SwapRequest;
  render(<SwapFlow {...flowProps(testPort({ quote: value => { request = value; return pending.promise; } }))} />);
  await amount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Актив получения" }), { target: { value: "" } });
  await act(async () => pending.resolve(quoted(request)));
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  expect(screen.queryByText("0,04 ETH")).toBeNull();
});

it.each(["pair", "destination", "port"] as const)("refuses a quote bound to a different %s", async changed => {
  render(<SwapFlow {...flowProps(testPort({ quote: async request => {
    const result = quoted(request);
    if (result.status !== "quoted") throw new Error("Expected quoted fixture");
    if (changed === "pair") result.quote.request.pairId = "unoffered";
    if (changed === "destination") result.quote.request.destination.networkId = "solana";
    if (changed === "port") result.quote.portId = "old-port";
    return result;
  } }))} />);
  await amount();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

it("rechecks expiry immediately before accepting submit", async () => {
  const submit = vi.fn(testPort().submit);
  render(<SwapFlow {...flowProps(testPort({ submit }))} />);
  await review();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_001);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/ист[её]к|устарел|обнов/i);
  expect(submit).not.toHaveBeenCalled();
});

it("keeps its original request binding if a port mutates the argument it receives", async () => {
  render(<SwapFlow {...flowProps(testPort({ quote: async request => {
    request.sourceAmount = "200";
    return quoted(request);
  } }))} />);
  await amount("100");
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/изменились|новый расч[её]т/i);
  expect(screen.queryByText("0,08 ETH")).toBeNull();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
});

it("owns one pending attempt before await and reports both accepted legs before releasing busy", async () => {
  const response = deferred<SwapSubmitResult>();
  const events: string[] = [];
  const busy: CommerceSubmitState[] = [];
  const results: SwapSimulation[] = [];
  const close = vi.fn();
  const back = vi.fn();
  const viewHistory = vi.fn();
  const submit = vi.fn<ReturnType<typeof testPort>["submit"]>(() => {
    expect(busy[0]?.busy).toBe(true); events.push("port-submit"); return response.promise;
  });
  render(<SwapFlow {...flowProps(testPort({ submit }), {
    onClose: close, onBack: back, onViewHistory: viewHistory, showCloseButton: true,
    onSubmitBusyChange: state => { busy.push(state); events.push(state.busy ? "busy" : "release"); },
    onSimulationResult: result => { results.push(result); events.push("terminal"); },
  })} />);
  await review();
  const confirm = screen.getByRole("button", { name: "Подтвердить симуляцию" });
  act(() => { confirm.click(); confirm.click(); });
  expect(submit).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Закрыть" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("region", { name: "Демонстрационный обмен" }), { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  expect(back).not.toHaveBeenCalled();
  expect(screen.queryByText(/\d+\s?%|секунд|0x[0-9a-f]{20}/i)).toBeNull();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_001);
  await act(async () => response.resolve(terminal(busy[0]!)));
  expect(screen.getByRole("heading", { name: "Симуляция завершена" })).toBeInTheDocument();
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ quote: {
    request: { route: sourceRoute, pairId, destination, sourceAmount: "100" },
    source: { assetId: "usdc", quantity: "100", networkId: "ethereum", accountId: "demo-custody" },
    debit: { assetId: "usdc", quantity: "101" },
    credit: { assetId: "eth", quantity: "0.04", networkId: "ethereum", accountId: "demo-custody" },
  } });
  expect(events).toEqual(["busy", "port-submit", "terminal", "release"]);
  expect(busy[1]).toEqual({ busy: false, operationId: results[0]!.simulationId });
  fireEvent.click(screen.getByRole("button", { name: "В истории" }));
  expect(viewHistory).toHaveBeenCalledOnce();
});

it.each(["unavailable", "error", "throw", "mismatched-result"] as const)("recovers from %s without reporting a terminal operation", async outcome => {
  const result = vi.fn();
  const busy: CommerceSubmitState[] = [];
  const submit = vi.fn<ReturnType<typeof testPort>["submit"]>(async () => {
    if (outcome === "throw") throw new Error("demo submission failed");
    if (outcome === "unavailable") return { status: "unavailable", issue: { code: "rejected" } };
    if (outcome === "error") return { status: "error", issue: { code: "unavailable" }, retryable: true };
    const accepted = terminal(busy[0]!);
    if (accepted.status !== "simulated") throw new Error("Expected simulated fixture");
    accepted.simulation.quote.credit.quantity = "0.05";
    return accepted;
  });
  render(<SwapFlow {...flowProps(testPort({ submit }), {
    onSimulationResult: result, onSubmitBusyChange: state => busy.push(state),
  })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(result).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Назад" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Рассчитать обмен" })).toBeEnabled();
  expect(busy).toHaveLength(2);
  expect(busy[1]).toMatchObject({ busy: false });
});

it("records a valid simulated failure with both legs and keeps the raw draft", async () => {
  const busy: CommerceSubmitState[] = [];
  const results: SwapSimulation[] = [];
  const draft = vi.fn();
  render(<SwapFlow {...flowProps(testPort({ submit: async () => terminal(busy[0]!, "simulated-failure") }), {
    onDraftChange: draft, onSubmitBusyChange: state => busy.push(state), onSimulationResult: value => results.push(value),
  })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  expect(await screen.findByRole("heading", { name: "Симуляция не выполнена" })).toBeInTheDocument();
  expect(results[0]).toMatchObject({ result: { status: "simulated-failure" }, quote: {
    source: { quantity: "100", assetId: "usdc" }, credit: { quantity: "0.04", assetId: "eth" },
  } });
  expect(draft).not.toHaveBeenCalledWith(null);
});

it("keeps raw draft across equivalent route objects and back, but restores no quote", async () => {
  const drafts: unknown[] = [];
  const close = vi.fn();
  const props = flowProps(testPort(), {
    initialDraft: { route: sourceRoute, pairId, sourceAmount: "0100,000000" },
    onDraftChange: draft => drafts.push(draft), onClose: close,
  });
  const rendered = render(<SwapFlow {...props} />);
  expect(await screen.findByRole("textbox", { name: "Отдаю, USDC" })).toHaveValue("0100,000000");
  expect(screen.getByText("После расчёта")).toBeInTheDocument();
  rendered.rerender(<SwapFlow {...props} route={{ ...sourceRoute }} />);
  expect(screen.getByRole("textbox", { name: "Отдаю, USDC" })).toHaveValue("0100,000000");
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  await amount("0200,");
  fireEvent.keyDown(screen.getByRole("region", { name: "Демонстрационный обмен" }), { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  expect(drafts.at(-1)).toEqual({ route: sourceRoute, pairId, sourceAmount: "0200," });
});

it("does not restore a draft from a different account or accept a late result after port replacement", async () => {
  const pending = deferred<SwapSubmitResult>();
  const busy: CommerceSubmitState[] = [];
  const result = vi.fn();
  const props = flowProps(testPort({ submit: () => pending.promise }), {
    initialDraft: { route: { ...sourceRoute, accountId: "another-account" }, pairId, sourceAmount: "200" },
    onSimulationResult: result, onSubmitBusyChange: state => busy.push(state),
  });
  const rendered = render(<SwapFlow {...props} />);
  expect(await screen.findByRole("textbox", { name: "Отдаю, USDC" })).toHaveValue("");
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  rendered.rerender(<SwapFlow {...props} port={testPort({ id: "replacement-port", loadRoute: async () => ({
    status: "error", issue: { code: "unavailable" }, retryable: true,
  }) })} />);
  await screen.findByRole("button", { name: "Повторить загрузку" });
  await act(async () => pending.resolve(terminal(busy[0]!)));
  expect(result).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Симуляция завершена" })).toBeNull();
  expect(busy).toHaveLength(2);
});

it("aborts accepted work on unmount and suppresses late terminal updates", async () => {
  const pending = deferred<SwapSubmitResult>();
  const busy: CommerceSubmitState[] = [];
  const result = vi.fn();
  let signal!: AbortSignal;
  const rendered = render(<SwapFlow {...flowProps(testPort({ submit: (_command, options) => {
    signal = options.signal; return pending.promise;
  } }), { onSimulationResult: result, onSubmitBusyChange: state => busy.push(state) })} />);
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  rendered.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(terminal(busy[0]!)));
  expect(result).not.toHaveBeenCalled();
  expect(busy).toHaveLength(2);
  expect(busy[1]).toMatchObject({ busy: false });
});

it("masks review, accepted receipt and input DOM values during privacy without losing the draft", async () => {
  const pending = deferred<SwapSubmitResult>();
  const busy: CommerceSubmitState[] = [];
  const props = flowProps(testPort({ submit: () => pending.promise }), { onSubmitBusyChange: state => busy.push(state) });
  const rendered = render(<SwapFlow {...props} />);
  await review();
  rendered.rerender(<SwapFlow {...props} privacy />);
  expect(screen.queryByText("100 USDC")).toBeNull();
  expect(screen.queryByText("101 USDC")).toBeNull();
  expect(screen.queryByText("0,04 ETH")).toBeNull();
  expect(screen.queryByText("1 USDC")).toBeNull();
  expect(screen.getByRole("button", { name: "Подтвердить симуляцию" })).toBeDisabled();
  rendered.rerender(<SwapFlow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  rendered.rerender(<SwapFlow {...props} privacy />);
  await act(async () => pending.resolve(terminal(busy[0]!)));
  expect(screen.queryByText("101 USDC")).toBeNull();
  expect(screen.queryByText("0,04 ETH")).toBeNull();
  rendered.rerender(<SwapFlow {...props} />);
  expect(screen.getByText("0,04 ETH")).toBeInTheDocument();
  rendered.unmount();
  const inputProps = flowProps(testPort(), { initialDraft: { route: sourceRoute, pairId, sourceAmount: "100" } });
  const input = render(<SwapFlow {...inputProps} privacy />);
  const field = await screen.findByRole("textbox", { name: "Отдаю, USDC" });
  expect(field).toHaveValue("");
  expect(field).toBeDisabled();
  expect(screen.getByRole("button", { name: "Рассчитать обмен" })).toBeDisabled();
  input.rerender(<SwapFlow {...inputProps} />);
  expect(field).toHaveValue("100");
});

it("offers local load recovery and explains an empty pair list without fabricating a result", async () => {
  let loads = 0;
  const result = vi.fn();
  render(<SwapFlow {...flowProps(testPort({ loadRoute: async () => {
    loads += 1;
    return loads === 1 ? { status: "error", issue: { code: "unavailable" }, retryable: true }
      : { status: "ready", data: { ...routeData, pairs: [] } };
  } }), { onSimulationResult: result })} />);
  fireEvent.click(await screen.findByRole("button", { name: "Повторить загрузку" }));
  await waitFor(() => expect(loads).toBe(2));
  expect(await screen.findByText(/нет доступных пар/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  expect(result).not.toHaveBeenCalled();
});

it.each([
  { value: "499", confirm: true },
  { value: "500", confirm: false },
])("uses fee-inclusive debit against available for input $value", async ({ value, confirm }) => {
  render(<SwapFlow {...flowProps()} />);
  await amount(value);
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать обмен" }));
  if (confirm) {
    expect(await screen.findByRole("button", { name: "Подтвердить симуляцию" })).toBeEnabled();
    expect(screen.getByText("500 USDC")).toBeInTheDocument();
    expect(screen.getByText("0,1996 ETH")).toBeInTheDocument();
  } else {
    expect(await screen.findByRole("alert")).toHaveTextContent(/не хватает.*комисси/i);
    expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  }
});
