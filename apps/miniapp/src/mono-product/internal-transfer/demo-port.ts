import { resolveActionRoutes, type ProductSnapshot } from "@wallet/core";
import type { DemoInternalReceiveBinding } from "../receive/receive-types";
import type {
  InternalTransferIssue, InternalTransferPort, InternalTransferQuote,
  InternalTransferRequest, InternalTransferResult,
} from "./types";
import {
  compareDecimal, normalizeInternalTransferAmount, readNonNegativeDecimal,
  validateInternalTransferQuote,
} from "./validation";

type DemoOptions = {
  now?: () => number;
  quoteDelayMs?: number;
  submitDelayMs?: number;
  outcome?: "success" | "failure";
};
type ReadyTransfer = Pick<InternalTransferQuote,
  "request" | "sourceAccountLabel" | "destinationAccountLabel" | "symbol" | "networkLabel" | "available">;
type Resolution = { status: "ready"; value: ReadyTransfer } | { status: "unavailable"; issue: InternalTransferIssue };
type IssuedQuote = { quote: InternalTransferQuote; submissionKey?: string };
type Attempt = { quote: InternalTransferQuote; promise: Promise<InternalTransferResult>; settled: boolean };

const CACHE_LIMIT = 64;
const QUOTE_TTL_MS = 60_000;
let quoteSequence = 0;

/** Explicit demo bindings only. This port never writes balances, battery or storage. */
export function createDemoInternalTransferPort(
  snapshot: Readonly<ProductSnapshot>,
  bindings: readonly DemoInternalReceiveBinding[],
  options: DemoOptions = {},
): InternalTransferPort {
  const now = options.now ?? Date.now;
  const quoteDelay = boundedDelay(options.quoteDelayMs, 150);
  const submitDelay = boundedDelay(options.submitDelayMs, 450);
  const failDemo = options.outcome === "failure";
  const issued = new Map<string, IssuedQuote>();
  const attempts = new Map<string, Attempt>();

  function resolve(request: InternalTransferRequest): Resolution {
    if (![request.sourceAccountId, request.destinationAccountId, request.assetId, request.networkId].every(nonblank) ||
        request.sourceAccountId === request.destinationAccountId || !bindings.some(binding =>
          binding.sourceAccountId === request.sourceAccountId && binding.destinationAccountId === request.destinationAccountId &&
          binding.assetId === request.assetId && binding.networkId === request.networkId)) {
      return { status: "unavailable", issue: "unsupported-route" };
    }
    // Reuse core capabilities, never derive permissions from the account kind.
    if (snapshot.accounts.filter(account => account.id === request.sourceAccountId).length !== 1 ||
        snapshot.accounts.filter(account => account.id === request.destinationAccountId).length !== 1) {
      return { status: "unavailable", issue: "unsupported-route" };
    }
    const sources = resolveActionRoutes(snapshot, { kind: "account", accountId: request.sourceAccountId }, "send").routes
      .filter(route => route.assetId === request.assetId && route.networkId === request.networkId);
    const destinations = resolveActionRoutes(snapshot, { kind: "account", accountId: request.destinationAccountId }, "receive").routes
      .filter(route => route.action === "receive" && route.receiveMode === "internal-transfer" &&
        route.assetId === request.assetId && route.networkId === request.networkId);
    const source = sources[0], destination = destinations[0];
    if (sources.length !== 1 || destinations.length !== 1 || !source || !destination ||
        ![source.accountLabel, destination.accountLabel, source.symbol, source.networkLabel].every(nonblank)) {
      return { status: "unavailable", issue: "unsupported-route" };
    }
    const amount = normalizeInternalTransferAmount(request.amount);
    if (amount === null) return { status: "unavailable", issue: "invalid-amount" };
    const holdings = snapshot.holdings.filter(holding => holding.accountId === source.accountId &&
      holding.assetId === source.assetId && holding.networkId === source.networkId);
    const available = holdings.length === 1 ? readNonNegativeDecimal(holdings[0]!.availableQuantity) : null;
    if (available === null) return { status: "unavailable", issue: "unknown-available" };
    if (compareDecimal(amount, available) > 0) return { status: "unavailable", issue: "insufficient-asset" };
    return { status: "ready", value: {
      request: { sourceAccountId: source.accountId, destinationAccountId: destination.accountId,
        assetId: source.assetId, networkId: source.networkId, amount },
      sourceAccountLabel: source.accountLabel, destinationAccountLabel: destination.accountLabel,
      symbol: source.symbol, networkLabel: source.networkLabel, available,
    } };
  }

  async function simulate(quote: InternalTransferQuote, signal: AbortSignal): Promise<InternalTransferResult> {
    await delay(submitDelay, signal);
    throwIfAborted(signal);
    // Expiry was checked at acceptance; permissions and funds must still be valid at completion.
    const current = resolve(quote.request);
    if (current.status === "unavailable") return issueResult(current.issue);
    return failDemo ? failure("rejected") : { mode: "demo", status: "simulated-success" };
  }

  return {
    mode: "demo",
    async quote(request, { signal }) {
      throwIfAborted(signal);
      const captured = { ...request };
      await delay(quoteDelay, signal);
      throwIfAborted(signal);
      const resolution = resolve(captured);
      if (resolution.status === "unavailable") return resolution;
      const time = readTime(now);
      if (time === null || !Number.isFinite(time + QUOTE_TTL_MS) || time + QUOTE_TTL_MS <= time) {
        return { status: "unavailable", issue: "unavailable" };
      }
      const value = resolution.value;
      const quote: InternalTransferQuote = { ...value, mode: "demo", id: `demo-internal-quote:${++quoteSequence}`,
        assetDebit: value.request.amount, fee: { amount: "0", symbol: value.symbol }, expiresAt: time + QUOTE_TTL_MS };
      for (const [id, record] of issued) {
        if (record.quote.expiresAt <= time) issued.delete(id);
      }
      if (issued.size >= CACHE_LIMIT) issued.delete(issued.keys().next().value!);
      issued.set(quote.id, { quote });
      return { status: "quoted", quote: cloneQuote(quote) };
    },
    async submit(command, { signal }) {
      throwIfAborted(signal);
      const key = command?.idempotencyKey, supplied = command?.quote;
      if (!nonblank(key) || !supplied) return failure("rejected");
      const previous = attempts.get(key);
      if (previous) {
        if (!sameQuote(supplied, previous.quote)) return failure("rejected");
        return observe(previous.promise, signal);
      }
      const record = issued.get(supplied.id);
      if (!record || !sameQuote(supplied, record.quote) || record.submissionKey !== undefined) return failure("rejected");
      const time = readTime(now);
      if (time === null) return failure("unavailable");
      const issue = validateInternalTransferQuote(record.quote.request, supplied, time);
      if (issue) return issueResult(issue);
      const current = resolve(record.quote.request);
      if (current.status === "unavailable") return issueResult(current.issue);

      if (attempts.size >= CACHE_LIMIT) {
        const oldestSettled = [...attempts].find(([, attempt]) => attempt.settled);
        if (!oldestSettled) return failure("unavailable");
        attempts.delete(oldestSettled[0]);
      }
      record.submissionKey = key;
      const attempt: Attempt = { quote: record.quote, promise: simulate(record.quote, signal), settled: false };
      attempts.set(key, attempt);
      // Cache cancellation too: a repeated command cannot restart an aborted simulation.
      void attempt.promise.then(() => { attempt.settled = true; }, () => { attempt.settled = true; });
      return observe(attempt.promise, signal);
    },
  };
}

function nonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readTime(now: () => number): number | null {
  try { const value = now(); return Number.isFinite(value) ? value : null; } catch { return null; }
}

function boundedDelay(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, 5_000) : fallback;
}

function cloneQuote(quote: InternalTransferQuote): InternalTransferQuote {
  return { ...quote, request: { ...quote.request }, fee: { ...quote.fee } };
}

function sameQuote(a: InternalTransferQuote, b: InternalTransferQuote): boolean {
  return a.mode === b.mode && a.id === b.id &&
    a.request?.sourceAccountId === b.request.sourceAccountId && a.request?.destinationAccountId === b.request.destinationAccountId &&
    a.request?.assetId === b.request.assetId && a.request?.networkId === b.request.networkId && a.request?.amount === b.request.amount &&
    a.sourceAccountLabel === b.sourceAccountLabel && a.destinationAccountLabel === b.destinationAccountLabel &&
    a.symbol === b.symbol && a.networkLabel === b.networkLabel && a.available === b.available && a.assetDebit === b.assetDebit &&
    a.fee?.amount === b.fee.amount && a.fee?.symbol === b.fee.symbol && a.expiresAt === b.expiresAt;
}

function failure(reason: "rejected" | "expired" | "unavailable"): InternalTransferResult {
  return { mode: "demo", status: "simulated-failure", reason };
}

function issueResult(issue: InternalTransferIssue): InternalTransferResult {
  return failure(issue === "expired-quote" ? "expired" :
    issue === "unknown-available" || issue === "unavailable" ? "unavailable" : "rejected");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Demo transfer aborted", "AbortError");
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Demo transfer aborted", "AbortError"));
    };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// A duplicate caller may cancel its wait without starting or cancelling another timer.
function observe(promise: Promise<InternalTransferResult>, signal: AbortSignal): Promise<InternalTransferResult> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => { signal.removeEventListener("abort", onAbort); reject(new DOMException("Demo transfer aborted", "AbortError")); };
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(result => {
      signal.removeEventListener("abort", onAbort);
      resolve({ ...result });
    }, error => { signal.removeEventListener("abort", onAbort); reject(error); });
  });
}
