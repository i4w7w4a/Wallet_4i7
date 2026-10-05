import { describe, expect, it } from "vitest";
import type { BuyQuote, BuyRouteData, CommerceSimulation, SwapQuote, SwapRouteData } from "./types";
import { buyQuote, swapQuote } from "./test-fixtures";
import { commerceOperationId, commerceRouteKey, validateBuyQuote, validateBuyRequest, validateCommerceSimulation, validateSwapQuote, validateSwapRequest } from "./validation";

describe("loaded commerce request boundary", () => {
  it("requires the exact loaded buy method, route and fiat unit", () => {
    const quote = buyQuote();
    const data: BuyRouteData = { route: quote.request.route, destination: quote.credit, methods: [{ id: "demo-payment-usd", label: "Демо-оплата",
      currency: "USD", terms: quote.terms, funding: quote.funding, rate: quote.rate }] };
    expect(validateBuyRequest(quote.request, data)).toBeNull();
    expect(validateBuyRequest({ ...quote.request, methodId: "bank" }, data)).toEqual({ code: "unsupported-method" });
    expect(validateBuyRequest({ ...quote.request, fiat: { currency: "EUR", amount: "100" } }, data)).toEqual({ code: "unsupported-method" });
    expect(validateBuyRequest({ ...quote.request, route: { ...quote.request.route, accountId: "all" } }, data)).toEqual({ code: "unsupported-route" });
    expect(validateBuyRequest({ ...quote.request, fiat: { currency: "USD", amount: "10.001" } }, data)).toEqual({ code: "precision" });
  });
  it("requires the offered full swap destination and denies an unoffered reverse pair", () => {
    const quote = swapQuote();
    const data: SwapRouteData = { route: quote.request.route, source: quote.source, terms: quote.terms,
      pairs: [{ id: quote.request.pairId, destination: quote.credit, rate: quote.rate }] };
    expect(validateSwapRequest(quote.request, data)).toBeNull();
    expect(validateSwapRequest({ ...quote.request, pairId: "reverse" }, data)).toEqual({ code: "unsupported-pair" });
    expect(validateSwapRequest({ ...quote.request, destination: { ...quote.request.destination, networkId: "solana" } }, data)).toEqual({ code: "unsupported-pair" });
    expect(validateSwapRequest(quote.request, { ...data, pairs: [] })).toEqual({ code: "unsupported-pair" });
    expect(validateSwapRequest(quote.request, {} as SwapRouteData)).toEqual({ code: "unsupported-route" });
  });
});

describe("commerce quote boundary", () => {
  it("refuses unknown source availability instead of deriving it from holdings value", () => {
    const quote = swapQuote(); quote.terms.available = null;
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toEqual({ code: "unknown-available" });
  });
  it("includes the same-unit fee in debit before checking available", () => {
    const quote = swapQuote(); quote.terms.available = "100";
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toEqual({ code: "insufficient-fee" });
    quote.terms.available = "101";
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toBeNull();
    quote.debit.quantity = "100";
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toEqual({ code: "invalid-quote" });
  });
  it("requires explicit external demo funding for fiat payment", () => {
    const quote = buyQuote(); quote.funding.available = null;
    expect(validateBuyQuote(quote.request, quote, 1000, "buy-port")).toEqual({ code: "unknown-funding" });
    quote.funding.available = "100";
    expect(validateBuyQuote(quote.request, quote, 1000, "buy-port")).toEqual({ code: "insufficient-funding" });
    quote.funding.available = "101";
    expect(validateBuyQuote(quote.request, quote, 1000, "buy-port")).toBeNull();
  });
  it("requires a separate matching known balance for a fee in a third unit", () => {
    const quote = swapQuote();
    const unit = { kind: "fiat" as const, currency: "USD", decimals: 2 };
    quote.fee = { status: "known", amount: "2", unit }; quote.debit.quantity = "100";
    const fiatFundingUnit = { ...unit };
    quote.feeFunding = { kind: "balance", unit: fiatFundingUnit, available: null };
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toEqual({ code: "unknown-funding" });
    quote.feeFunding.available = "1.99";
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toEqual({ code: "insufficient-fee" });
    quote.feeFunding.available = "2";
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toBeNull();
    fiatFundingUnit.currency = "EUR";
    expect(validateSwapQuote(quote.request, quote, 1000, "swap-port")).toEqual({ code: "invalid-quote" });
  });
  it("rejects missing fees and malformed monetary legs", () => {
    const buy = buyQuote(); buy.fee = { status: "unknown" };
    expect(validateBuyQuote(buy.request, buy, 1000, "buy-port")).toEqual({ code: "unknown-fee" });
    const swap = swapQuote(); swap.credit.quantity = "0.041";
    expect(validateSwapQuote(swap.request, swap, 1000, "swap-port")).toEqual({ code: "invalid-quote" });
    swap.credit.quantity = "0.04"; swap.credit.assetId = "usdc";
    expect(validateSwapQuote(swap.request, swap, 1000, "swap-port")).toEqual({ code: "invalid-quote" });
    expect(validateBuyQuote(buyQuote().request, {} as BuyQuote, 1000, "buy-port")).toEqual({ code: "invalid-quote" });
  });
  it("binds quote to full route, fiat currency, method and normalized amount", () => {
    const quote = buyQuote();
    const changes = [
      { ...quote.request, route: { ...quote.request.route, accountKind: "depositary" as const } },
      { ...quote.request, route: { ...quote.request.route, networkId: "solana" } },
      { ...quote.request, methodId: "different-method" },
      { ...quote.request, fiat: { currency: "EUR", amount: "100" } },
      { ...quote.request, fiat: { currency: "USD", amount: "99" } },
    ];
    for (const request of changes) expect(validateBuyQuote(request, quote, 1000, "buy-port")).toEqual({ code: "stale-quote" });
    expect(validateBuyQuote({ ...quote.request, fiat: { currency: "USD", amount: " 0100,00 " } }, quote, 1000, "buy-port")).toBeNull();
  });
  it("binds both swap legs and pair without allowing a stale destination", () => {
    const quote = swapQuote();
    const request = { ...quote.request, destination: { ...quote.request.destination, accountId: "demo-depositary" } };
    expect(validateSwapQuote(request, quote, 1000, "swap-port")).toEqual({ code: "stale-quote" });
    expect(validateSwapQuote({ ...quote.request, pairId: "reverse" }, quote, 1000, "swap-port")).toEqual({ code: "stale-quote" });
    expect(validateSwapQuote({ ...quote.request, sourceAmount: "99" }, quote, 1000, "swap-port")).toEqual({ code: "stale-quote" });
  });
  it("invalidates a port replacement and the exact expiry boundary", () => {
    const quote = swapQuote();
    expect(validateSwapQuote(quote.request, quote, 1000, "replacement-port")).toEqual({ code: "stale-quote" });
    expect(validateSwapQuote(quote.request, quote, 61000, "swap-port")).toEqual({ code: "expired-quote" });
    expect(validateSwapQuote(quote.request, quote, 60999, "swap-port")).toBeNull();
  });
  it("keeps drafts isolated by action, account kind and network", () => {
    const route = swapQuote().request.route;
    expect(commerceRouteKey(route)).not.toBe(commerceRouteKey({ ...route, action: "buy" }));
    expect(commerceRouteKey(route)).not.toBe(commerceRouteKey({ ...route, accountKind: "depositary" }));
    expect(commerceRouteKey(route)).not.toBe(commerceRouteKey({ ...route, networkId: "solana" }));
  });
});

describe("accepted commerce result boundary", () => {
  it("rejects incomplete or mismatched terminal data before a history callback", () => {
    const quote = swapQuote(), key = "attempt-1";
    const simulation: CommerceSimulation = { mode: "demo", kind: "swap", idempotencyKey: key,
      simulationId: commerceOperationId(quote, key), quote: swapQuote(), result: { mode: "demo", status: "simulated-success" } };
    expect(validateCommerceSimulation(quote, simulation, key)).toBeNull();
    simulation.quote.credit.quantity = "1";
    expect(validateCommerceSimulation(quote, simulation, key)).toEqual({ code: "invalid-result" });
    simulation.quote = swapQuote(); simulation.idempotencyKey = "older-attempt";
    expect(validateCommerceSimulation(quote, simulation, key)).toEqual({ code: "invalid-result" });
    expect(validateCommerceSimulation(quote, {} as CommerceSimulation, key)).toEqual({ code: "invalid-result" });
  });
  it("preserves the accepted operation identity and snapshot after quote expiry", () => {
    const quote = buyQuote(), key = "accepted-before-expiry";
    const simulation: CommerceSimulation = { mode: "demo", kind: "buy", idempotencyKey: key,
      simulationId: commerceOperationId(quote, key), quote: buyQuote(), result: { mode: "demo", status: "simulated-failure", reason: "rejected" } };
    expect(validateCommerceSimulation(quote, simulation, key)).toBeNull();
    simulation.simulationId = commerceOperationId(quote, "other-attempt");
    expect(validateCommerceSimulation(quote, simulation, key)).toEqual({ code: "invalid-result" });
    simulation.simulationId = commerceOperationId(quote, key);
    simulation.quote = { ...simulation.quote, mode: "live" } as unknown as BuyQuote;
    expect(validateCommerceSimulation(quote, simulation, key)).toEqual({ code: "invalid-result" });
  });
});
