import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoCommercePorts } from "./demo-ports";
import { buyQuote, buyRoute, commerceSnapshot, eth, swapQuote, swapRoute } from "./test-fixtures";
import { validateCommerceSimulation } from "./validation";
import type { BuyPort, BuyQuote, SwapPort, SwapQuote } from "./types";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const call = () => ({ signal: new AbortController().signal });
const immediate = { now: () => 1000, loadDelayMs: 0, quoteDelayMs: 0, submitDelayMs: 0 };
const buyRequest = buyQuote().request;
const swapRequest = swapQuote().request;
async function issuedBuy(port: BuyPort): Promise<BuyQuote> {
  const response = await port.quote(buyRequest, call());
  expect(response.status).toBe("quoted");
  if (response.status !== "quoted") throw new Error("fixture buy quote unavailable");
  return response.quote;
}
async function issuedSwap(port: SwapPort): Promise<SwapQuote> {
  const response = await port.quote(swapRequest, call());
  expect(response.status).toBe("quoted");
  if (response.status !== "quoted") throw new Error("fixture swap quote unavailable");
  return response.quote;
}

describe("bounded commerce demo ports", () => {
  it("offers only the configured method and same-network pair without changing snapshot", async () => {
    const snapshot = commerceSnapshot(), before = JSON.stringify(snapshot);
    const { buy, swap } = createDemoCommercePorts(snapshot, immediate);
    expect(await buy.loadRoute(buyRoute, call())).toMatchObject({ status: "ready", data: {
      route: buyRoute, destination: { assetId: "usdc", decimals: 6 },
      methods: [{ id: "demo-payment-usd", label: "Демо-оплата", currency: "USD" }],
    } });
    expect(await swap.loadRoute(swapRoute, call())).toMatchObject({ status: "ready", data: {
      source: { assetId: "usdc", decimals: 6 }, terms: { available: "500" },
      pairs: [{ id: "demo-usdc-eth-ethereum", destination: { ...eth, decimals: 18 } }],
    } });
    const quote = await issuedSwap(swap);
    expect(quote).toMatchObject({ source: { quantity: "100" }, debit: { quantity: "101" }, credit: { quantity: "0.04" }, expiresAt: 61000 });
    const terminal = await swap.submit({ quote, idempotencyKey: "explicit-swap" }, call());
    expect(terminal).toMatchObject({ status: "simulated", simulation: { kind: "swap", result: { status: "simulated-success" } } });
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it("checks purchase funding independently from the receiving crypto balance", async () => {
    const snapshot = commerceSnapshot();
    snapshot.holdings = snapshot.holdings.map(holding => ({ ...holding, availableQuantity: undefined }));
    const { buy } = createDemoCommercePorts(snapshot, immediate);
    const quote = await issuedBuy(buy);
    expect(quote).toMatchObject({ payment: { currency: "USD", amount: "100" }, debit: { amount: "101" }, credit: { quantity: "100", symbol: "USDC" } });
    const terminal = await buy.submit({ quote, idempotencyKey: "external-funded" }, call());
    expect(terminal).toMatchObject({ status: "simulated", simulation: { result: { status: "simulated-success" } } });
  });
  it("does not grant permissions from an active account or an unconfigured route", async () => {
    const unextended = commerceSnapshot();
    unextended.accounts = unextended.accounts.map(account => ({ ...account,
      capabilities: account.capabilities.filter(value => value.action !== "buy" && value.action !== "swap") }));
    const base = createDemoCommercePorts(unextended, immediate);
    expect(await base.buy.loadRoute(buyRoute, call())).toEqual({ status: "unavailable", issue: { code: "unsupported-route" } });
    expect(await base.swap.loadRoute(swapRoute, call())).toEqual({ status: "unavailable", issue: { code: "unsupported-route" } });
    const snapshot = commerceSnapshot();
    const ports = createDemoCommercePorts(snapshot, immediate);
    expect(await ports.buy.loadRoute({ ...buyRoute, networkId: "solana" }, call())).toEqual({ status: "unavailable", issue: { code: "unsupported-route" } });
    snapshot.accounts[0]!.status = "inactive";
    expect(await ports.buy.loadRoute(buyRoute, call())).toEqual({ status: "unavailable", issue: { code: "unsupported-route" } });
  });
  it("rejects unoffered methods, pair changes and missing destination capability", async () => {
    const snapshot = commerceSnapshot(), ports = createDemoCommercePorts(snapshot, immediate);
    expect(await ports.buy.quote({ ...buyRequest, methodId: "real-bank" }, call())).toEqual({ status: "unavailable", issue: { code: "unsupported-method" } });
    expect(await ports.swap.quote({ ...swapRequest, destination: { ...eth, networkId: "solana" } }, call())).toEqual({ status: "unavailable", issue: { code: "unsupported-pair" } });
    snapshot.accounts[0]!.capabilities = snapshot.accounts[0]!.capabilities.filter(capability => !(capability.action === "receive" && capability.assetId === "eth"));
    expect(await ports.swap.loadRoute(swapRoute, call())).toEqual({ status: "unavailable", issue: { code: "unsupported-pair" } });
  });
  it("refuses unknown and ambiguous availability and insufficient total debit", async () => {
    const snapshot = commerceSnapshot(), { swap } = createDemoCommercePorts(snapshot, immediate);
    const holding = snapshot.holdings.find(value => value.id === "demo-usdc-eth")!;
    holding.availableQuantity = undefined;
    expect(await swap.quote(swapRequest, call())).toEqual({ status: "unavailable", issue: { code: "unknown-available" } });
    holding.availableQuantity = "100";
    expect(await swap.quote(swapRequest, call())).toEqual({ status: "unavailable", issue: { code: "insufficient-fee" } });
    holding.availableQuantity = "101";
    await issuedSwap(swap);
    snapshot.holdings = [...snapshot.holdings, { ...holding, id: "ambiguous" }];
    expect(await swap.quote(swapRequest, call())).toEqual({ status: "unavailable", issue: { code: "unknown-available" } });
  });
  it("refuses a tampered or foreign quote without accepting an attempt", async () => {
    const { buy } = createDemoCommercePorts(commerceSnapshot(), immediate);
    const quote = await issuedBuy(buy);
    const forged: BuyQuote = JSON.parse(JSON.stringify(quote)); forged.debit.amount = "100";
    expect(await buy.submit({ quote: forged, idempotencyKey: "safe-key" }, call())).toEqual({ status: "unavailable", issue: { code: "rejected" } });
    const other = createDemoCommercePorts(commerceSnapshot(), immediate).buy;
    expect(other.id).not.toBe(buy.id);
    expect(await other.submit({ quote, idempotencyKey: "safe-key" }, call())).toEqual({ status: "unavailable", issue: { code: "rejected" } });
    expect(await buy.submit({ quote, idempotencyKey: "safe-key" }, call())).toMatchObject({ status: "simulated" });
  });
  it("replays one accepted identity and denies the same key with a different quote", async () => {
    const { swap } = createDemoCommercePorts(commerceSnapshot(), immediate);
    const quote = await issuedSwap(swap), secondQuote = await issuedSwap(swap);
    const first = await swap.submit({ quote, idempotencyKey: "one-attempt" }, call());
    const duplicate = await swap.submit({ quote, idempotencyKey: "one-attempt" }, call());
    expect(duplicate).toEqual(first);
    if (first.status !== "simulated") throw new Error("accepted operation missing");
    expect(validateCommerceSimulation(quote, first.simulation, "one-attempt")).toBeNull();
    expect(await swap.submit({ quote: secondQuote, idempotencyKey: "one-attempt" }, call())).toEqual({ status: "unavailable", issue: { code: "rejected" } });
    expect(await swap.submit({ quote, idempotencyKey: "another-attempt" }, call())).toEqual({ status: "unavailable", issue: { code: "rejected" } });
    const original = first.simulation.quote.credit.quantity;
    expect(() => { first.simulation.quote.credit.quantity = "999"; }).toThrow();
    expect(first.simulation.quote.credit.quantity).toBe(original);
  });
  it("checks expiry before acceptance but preserves pending identity after expiry", async () => {
    vi.useFakeTimers();
    let now = 1000;
    const { buy } = createDemoCommercePorts(commerceSnapshot(), { ...immediate, now: () => now, submitDelayMs: 20 });
    const quote = await issuedBuy(buy);
    const pending = buy.submit({ quote, idempotencyKey: "before-expiry" }, call());
    now = 61000;
    await vi.advanceTimersByTimeAsync(20);
    const completed = await pending;
    expect(completed).toMatchObject({ status: "simulated", simulation: { result: { status: "simulated-success" } } });
    expect(await buy.submit({ quote, idempotencyKey: "before-expiry" }, call())).toEqual(completed);
    const { buy: other } = createDemoCommercePorts(commerceSnapshot(), { ...immediate, now: () => now });
    const expiringResponse = await other.quote(buyRequest, call());
    if (expiringResponse.status !== "quoted") throw new Error("expected expiring quote");
    const expiring = expiringResponse.quote; now = expiring.expiresAt;
    expect(await other.submit({ quote: expiring, idempotencyKey: "too-late" }, call())).toEqual({ status: "unavailable", issue: { code: "expired-quote" } });
  });
  it("aborts reads and caches an aborted accepted attempt instead of restarting it", async () => {
    vi.useFakeTimers();
    const { buy } = createDemoCommercePorts(commerceSnapshot(), { ...immediate, loadDelayMs: 20, submitDelayMs: 20 });
    const readAbort = new AbortController();
    const reading = buy.loadRoute(buyRoute, { signal: readAbort.signal }).catch(error => error);
    readAbort.abort();
    expect(await reading).toMatchObject({ name: "AbortError" });
    const quote = await issuedBuy(buy), owner = new AbortController();
    const pending = buy.submit({ quote, idempotencyKey: "cancelled" }, { signal: owner.signal }).catch(error => error);
    owner.abort();
    expect(await pending).toMatchObject({ name: "AbortError" });
    await expect(buy.submit({ quote, idempotencyKey: "cancelled" }, call())).rejects.toMatchObject({ name: "AbortError" });
  });
  it("lets a duplicate observer stop waiting without cancelling the accepted owner", async () => {
    vi.useFakeTimers();
    const { swap } = createDemoCommercePorts(commerceSnapshot(), { ...immediate, submitDelayMs: 20 });
    const quote = await issuedSwap(swap), observer = new AbortController();
    const pending = swap.submit({ quote, idempotencyKey: "owner" }, call());
    const duplicate = swap.submit({ quote, idempotencyKey: "owner" }, { signal: observer.signal }).catch(error => error);
    observer.abort();
    expect(await duplicate).toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toMatchObject({ status: "simulated", simulation: { result: { status: "simulated-success" } } });
  });
  it("keeps explicit demo failure distinct from quote errors and rechecks current permission", async () => {
    const { buy } = createDemoCommercePorts(commerceSnapshot(), { ...immediate, outcome: "failure" });
    const quote = await issuedBuy(buy);
    expect(await buy.submit({ quote, idempotencyKey: "demo-rejected" }, call())).toMatchObject({ status: "simulated", simulation: { result: { status: "simulated-failure", reason: "rejected" } } });
    vi.useFakeTimers();
    const snapshot = commerceSnapshot(), { swap } = createDemoCommercePorts(snapshot, { ...immediate, submitDelayMs: 20 });
    const swapQuote = await issuedSwap(swap), pending = swap.submit({ quote: swapQuote, idempotencyKey: "permission-changed" }, call());
    snapshot.accounts[0]!.status = "inactive";
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toMatchObject({ status: "simulated", simulation: { quote: { debit: { quantity: "101" } }, result: { status: "simulated-failure", reason: "unavailable" } } });
  });
});
