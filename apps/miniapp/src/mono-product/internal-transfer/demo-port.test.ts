import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductSnapshot } from "@wallet/core";
import type { DemoInternalReceiveBinding } from "../receive/receive-types";
import { createDemoInternalTransferPort } from "./demo-port";
import type { InternalTransferPort, InternalTransferQuote, InternalTransferRequest } from "./types";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const asset = { assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum" };
const request: InternalTransferRequest = { sourceAccountId: "source", destinationAccountId: "destination",
  assetId: "usdc", networkId: "ethereum", amount: "12.34" };
const binding: DemoInternalReceiveBinding = { sourceAccountId: "source", destinationAccountId: "destination", assetId: "usdc", networkId: "ethereum" };
const options = { now: () => 1000, quoteDelayMs: 0, submitDelayMs: 0 };
const call = () => ({ signal: new AbortController().signal });

function snapshot(): ProductSnapshot {
  return { fiatCurrency: "USD", accounts: [
    { id: "source", kind: "custodial", label: "Основной", status: "active", capabilities: [{ ...asset, action: "send" }] },
    { id: "destination", kind: "depositary", label: "Хранилище", status: "active", capabilities: [{ ...asset, action: "receive", receiveMode: "internal-transfer" }] },
  ], holdings: [{ ...asset, id: "placement", accountId: "source", quantity: "500", availableQuantity: "100", fiatMinor: 50000 }],
  batteryPools: [{ id: "unchanged-pool", networkId: "ethereum", networkLabel: "Ethereum", eligibleAccountIds: ["source"], action: "send", remainingTransfers: 3 }] };
}

async function issued(port: InternalTransferPort, input = request): Promise<InternalTransferQuote> {
  const result = await port.quote(input, call());
  expect(result.status).toBe("quoted");
  if (result.status !== "quoted") throw new Error("expected fixture quote");
  return result.quote;
}

function copy(quote: InternalTransferQuote): InternalTransferQuote {
  return { ...quote, request: { ...quote.request }, fee: { ...quote.fee } };
}

describe("internal transfer demo port", () => {
  it("quotes the exact binding from current source availability without mutating balances or battery", async () => {
    const data = snapshot(), before = JSON.stringify(data);
    const port = createDemoInternalTransferPort(data, [binding], options);
    const quote = await issued(port, { ...request, amount: " 0012,3400 " });
    expect(quote).toMatchObject({ mode: "demo", request, sourceAccountLabel: "Основной", destinationAccountLabel: "Хранилище",
      symbol: "USDC", networkLabel: "Ethereum", available: "100", assetDebit: "12.34", fee: { amount: "0", symbol: "USDC" }, expiresAt: 61000 });
    expect(await port.submit({ quote, idempotencyKey: "accepted" }, call())).toEqual({ mode: "demo", status: "simulated-success" });
    expect(JSON.stringify(data)).toBe(before);
  });

  it("denies missing bindings, self/cross-network routes, inactive accounts and missing capabilities", async () => {
    const cases: { input?: InternalTransferRequest; bindings?: DemoInternalReceiveBinding[]; mutate?: (data: ProductSnapshot) => void }[] = [
      { bindings: [] },
      { input: { ...request, destinationAccountId: "source" }, bindings: [{ ...binding, destinationAccountId: "source" }] },
      { input: { ...request, networkId: "solana" } },
      { input: { ...request, assetId: "eth" } },
      { mutate: data => { data.accounts[0]!.status = "inactive"; } },
      { mutate: data => { data.accounts[1]!.status = "unavailable"; } },
      { mutate: data => { data.accounts[0]!.capabilities = []; } },
      { mutate: data => { data.accounts[1]!.capabilities = [{ ...asset, action: "receive", receiveMode: "external-address" }]; } },
    ];
    for (const item of cases) {
      const data = snapshot(); item.mutate?.(data);
      const port = createDemoInternalTransferPort(data, item.bindings ?? [binding], options);
      expect(await port.quote(item.input ?? request, call())).toEqual({ status: "unavailable", issue: "unsupported-route" });
    }
  });

  it("keeps unknown and ambiguous available distinct from a known insufficient balance", async () => {
    const data = snapshot();
    const port = createDemoInternalTransferPort(data, [binding], options);
    data.holdings[0]!.availableQuantity = undefined;
    expect(await port.quote(request, call())).toEqual({ status: "unavailable", issue: "unknown-available" });
    data.holdings[0]!.availableQuantity = "0";
    expect(await port.quote(request, call())).toEqual({ status: "unavailable", issue: "insufficient-asset" });
    data.holdings[0]!.availableQuantity = "100";
    data.holdings = [...data.holdings, { ...data.holdings[0]!, id: "duplicate" }];
    expect(await port.quote(request, call())).toEqual({ status: "unavailable", issue: "unknown-available" });
  });

  it("compares high precision amounts exactly and imposes no invented token decimal limit", async () => {
    const data = snapshot(); data.holdings[0]!.availableQuantity = "9007199254740993.000000000000000001";
    const port = createDemoInternalTransferPort(data, [binding], options);
    expect((await issued(port, { ...request, amount: "9007199254740993.000000000000000001" })).assetDebit).toBe("9007199254740993.000000000000000001");
    expect(await port.quote({ ...request, amount: "9007199254740993.000000000000000002" }, call())).toEqual({ status: "unavailable", issue: "insufficient-asset" });
    expect(await port.quote({ ...request, amount: "1e2" }, call())).toEqual({ status: "unavailable", issue: "invalid-amount" });
    expect(await port.quote({ ...request, amount: "1".repeat(129) }, call())).toEqual({ status: "unavailable", issue: "invalid-amount" });
  });

  it("rejects tampered and foreign quotes instead of trusting their money, labels or expiry", async () => {
    const port = createDemoInternalTransferPort(snapshot(), [binding], options);
    const quote = await issued(port);
    const changes: ((value: InternalTransferQuote) => void)[] = [
      value => { value.request.amount = "1"; value.assetDebit = "1"; },
      value => { value.fee.amount = "1"; }, value => { value.fee.symbol = "ETH"; },
      value => { value.sourceAccountLabel = "Someone else"; }, value => { value.destinationAccountLabel = "Another"; },
      value => { value.available = "999999"; }, value => { value.expiresAt += 1000; },
      value => { value.request.destinationAccountId = "source"; }, value => { value.networkLabel = "Solana"; },
      value => { value.id = "invented"; },
    ];
    for (const change of changes) {
      const forged = copy(quote); change(forged);
      expect(await port.submit({ quote: forged, idempotencyKey: "not-accepted" }, call())).toMatchObject({ status: "simulated-failure", reason: "rejected" });
    }
    const other = createDemoInternalTransferPort(snapshot(), [binding], options);
    expect(await other.submit({ quote, idempotencyKey: "foreign" }, call())).toMatchObject({ status: "simulated-failure", reason: "rejected" });
    expect(await port.submit({ quote, idempotencyKey: "not-accepted" }, call())).toMatchObject({ status: "simulated-success" });
  });

  it("rechecks expiry, current capability and current availability at submit", async () => {
    let now = 1000;
    const data = snapshot();
    const port = createDemoInternalTransferPort(data, [binding], { ...options, now: () => now });
    const quote = await issued(port);
    now = quote.expiresAt;
    expect(await port.submit({ quote, idempotencyKey: "expired" }, call())).toMatchObject({ status: "simulated-failure", reason: "expired" });
    now = 1000;
    data.holdings[0]!.availableQuantity = "1";
    expect(await port.submit({ quote, idempotencyKey: "insufficient" }, call())).toMatchObject({ status: "simulated-failure", reason: "rejected" });
    data.holdings[0]!.availableQuantity = "100";
    data.accounts[0]!.status = "inactive";
    expect(await port.submit({ quote, idempotencyKey: "inactive" }, call())).toMatchObject({ status: "simulated-failure", reason: "rejected" });
  });

  it("coalesces duplicate pending submissions and replays the same result without a second timer", async () => {
    vi.useFakeTimers();
    let now = 1000;
    const port = createDemoInternalTransferPort(snapshot(), [binding], { ...options, now: () => now, submitDelayMs: 450 });
    const quote = await issued(port);
    const first = port.submit({ quote, idempotencyKey: "once" }, call());
    const duplicate = port.submit({ quote: copy(quote), idempotencyKey: "once" }, call());
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(450);
    const result = await first;
    expect(await duplicate).toEqual({ mode: "demo", status: "simulated-success" });
    Object.assign(result, { status: "simulated-failure", reason: "rejected" });
    now = quote.expiresAt + 1;
    expect(await port.submit({ quote, idempotencyKey: "once" }, call())).toEqual({ mode: "demo", status: "simulated-success" });
    expect(vi.getTimerCount()).toBe(0);
    now = 1000;
    const secondQuote = await issued(port);
    expect(await port.submit({ quote: secondQuote, idempotencyKey: "once" }, call())).toMatchObject({ status: "simulated-failure", reason: "rejected" });
    expect(await port.submit({ quote, idempotencyKey: "different-key" }, call())).toMatchObject({ status: "simulated-failure", reason: "rejected" });
    expect(await port.submit({ quote: secondQuote, idempotencyKey: " " }, call())).toMatchObject({ status: "simulated-failure", reason: "rejected" });
  });

  it("aborts quote and submit timers, and never resumes a cancelled attempt on duplicate submit", async () => {
    vi.useFakeTimers();
    const data = snapshot(), before = JSON.stringify(data);
    const port = createDemoInternalTransferPort(data, [binding]);
    const quoteAbort = new AbortController();
    const stoppedQuote = expect(port.quote(request, { signal: quoteAbort.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(1);
    quoteAbort.abort(); await stoppedQuote;
    expect(vi.getTimerCount()).toBe(0);
    const pendingQuote = port.quote(request, call());
    await vi.advanceTimersByTimeAsync(150);
    const loaded = await pendingQuote;
    expect(loaded.status).toBe("quoted");
    if (loaded.status !== "quoted") throw new Error("quote required");
    const submitAbort = new AbortController();
    const stoppedSubmit = expect(port.submit({ quote: loaded.quote, idempotencyKey: "cancelled" }, { signal: submitAbort.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(1);
    submitAbort.abort(); await stoppedSubmit;
    expect(vi.getTimerCount()).toBe(0);
    await expect(port.submit({ quote: loaded.quote, idempotencyKey: "cancelled" }, call())).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
    expect(JSON.stringify(data)).toBe(before);
  });

  it("allows explicit failed demo outcomes without mutation and has no construction clock side effects", async () => {
    const now = vi.fn(() => 1000), data = snapshot(), before = JSON.stringify(data);
    const port = createDemoInternalTransferPort(data, [binding], { ...options, now, outcome: "failure" });
    expect(now).not.toHaveBeenCalled();
    const quote = await issued(port);
    expect(await port.submit({ quote, idempotencyKey: "failed-example" }, call())).toEqual({ mode: "demo", status: "simulated-failure", reason: "rejected" });
    expect(JSON.stringify(data)).toBe(before);
  });
});
