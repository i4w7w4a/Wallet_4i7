import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductActionRoute } from "@wallet/core";
import { SendFlow } from "./send-flow";
import type { SendSimulationResult } from "./send-form";
import type { SendDemoResult, SendPort, SendQuote, SendRequest } from "./send-port";

afterEach(cleanup);
const route: ProductActionRoute = { action: "send", accountId: "source", accountLabel: "Основной", accountKind: "custodial",
  assetId: "usdc", name: "USD Coin", symbol: "USDC", networkId: "ethereum", networkLabel: "Ethereum" };

function quoteFor(request: SendRequest): SendQuote {
  return { mode: "demo", id: "accepted-quote", request, expiresAt: Date.now() + 60_000,
    terms: { decimals: 6, available: "100" }, assetDebit: "12.35",
    networkFee: { status: "known", amount: "0.001", symbol: "ETH" },
    feeFunding: { kind: "battery", charges: 1, pool: { id: "shared-pool", networkId: "ethereum", networkLabel: "Ethereum",
      action: "send", eligibleAccountIds: ["source", "private-sibling"], remainingTransfers: 3 } }, estimatedCompletionSeconds: 90 };
}

function portWith(overrides: Partial<SendPort>): SendPort {
  return { mode: "demo", loadRoute: async () => ({ terms: { decimals: 6, available: "100" },
    recipient: { label: "Получатель", hint: "Неплатёжный пример" } }),
    validateRecipient: async (_route, recipient) => ({ valid: true, recipient }),
    quote: async request => ({ status: "quoted", quote: quoteFor(request) }),
    send: async () => ({ mode: "demo", status: "simulated-success" }), ...overrides };
}

async function confirm() {
  fireEvent.change(await screen.findByLabelText("Получатель"), { target: { value: "demo:private-recipient" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByLabelText("Сумма, USDC"), { target: { value: "12.34" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" })); });
}

describe("accepted quote receipt", () => {
  it.each(["success", "failure", "throw"] as const)("retains the pre-send snapshot after a mutating port returns %s", async outcome => {
    let finish!: (result: SendDemoResult) => void;
    const pending = new Promise<SendDemoResult>(resolve => { finish = resolve; });
    const onSimulationResult = vi.fn<(event: SendSimulationResult) => void>();
    const port = portWith({ send: async ({ quote }) => {
      // Mutations start synchronously inside send: capturing after invocation is already too late.
      quote.assetDebit = "80";
      if (quote.networkFee.status === "known") { quote.networkFee.amount = "9"; quote.networkFee.symbol = "MUTATED"; }
      if (quote.feeFunding.kind === "battery") {
        quote.feeFunding.pool.id = "changed-pool"; quote.feeFunding.pool.networkLabel = "Changed"; quote.feeFunding.charges = 2;
      }
      quote.estimatedCompletionSeconds = 999;
      const result = await pending;
      if (outcome === "throw") throw new Error("provider failure");
      return result;
    } });
    const props = { route, port, onBack() {}, onClose() {}, onSimulationResult };
    const rendered = render(<SendFlow {...props} />);
    await confirm();
    expect(onSimulationResult).not.toHaveBeenCalled();
    await act(async () => finish(outcome === "success" ? { mode: "demo", status: "simulated-success" }
      : { mode: "demo", status: "simulated-failure", reason: "rejected" }));
    expect(onSimulationResult).toHaveBeenCalledTimes(1);
    const event = onSimulationResult.mock.calls[0]![0];
    expect(event.quantity).toBe("12.34");
    expect(event.result.status).toBe(outcome === "success" ? "simulated-success" : "simulated-failure");
    expect(event.receipt).toEqual({ assetDebit: "12.35", networkFee: { status: "known", amount: "0.001", symbol: "ETH" },
      feeFunding: { kind: "battery", poolId: "shared-pool", networkLabel: "Ethereum", charges: 1 }, estimatedCompletionSeconds: 90 });
    expect(JSON.stringify(event.receipt)).not.toMatch(/private|available|recipient|memo|request|expiresAt|accepted-quote/);
    rendered.rerender(<SendFlow {...props} />);
    expect(onSimulationResult).toHaveBeenCalledTimes(1);
  });

  it("opens history on failure while keeping retry an explicit new quote", async () => {
    const onViewHistory = vi.fn();
    const send = vi.fn<SendPort["send"]>(async () => ({ mode: "demo", status: "simulated-failure", reason: "rejected" }));
    render(<SendFlow route={route} port={portWith({ send })} onBack={() => {}} onClose={() => {}} onViewHistory={onViewHistory} />);
    await confirm();
    fireEvent.click(await screen.findByRole("button", { name: "В истории" }));
    expect(onViewHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Пересчитать и повторить" })).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Пересчитать и повторить" }));
    expect(await screen.findByRole("button", { name: "Проверить перевод" })).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
