import { resolveActionRoutes, type ProductActionRoute, type ProductSnapshot } from "@wallet/core";
import { addCommerceDecimal, multiplyCommerceDecimal, normalizeCommerceAmount, readCommerceDecimal } from "./decimal";
import { DEMO_BUY_METHOD, DEMO_BUY_ROUTES, DEMO_COMMERCE_QUOTE_TTL_MS, DEMO_SWAP_PAIRS } from "./fixtures";
import { commerceOperationId, sameCommerceData, validateBuyQuote, validateBuyRequest, validateSwapQuote, validateSwapRequest } from "./validation";
import type {
  BuyLoadResult, BuyPort, BuyQuote, BuyQuoteResult, BuyRequest, BuyRoute, BuySimulation,
  CommerceCallOptions, CommerceIssue, CommerceIssueCode, CommerceQuote, CommerceSimulation,
  CommerceSubmitResult, CryptoPlacement, DemoCommerceOptions, SwapLoadResult, SwapPort,
  SwapQuote, SwapQuoteResult, SwapRequest, SwapRoute, SwapSimulation,
} from "./types";

type PlacementId = Pick<CryptoPlacement, "accountId" | "accountKind" | "assetId" | "networkId">;
type Issued<Q> = { quote: Q; acceptedKey?: string };
type Attempt<Q, S> = { quote: Q; promise: Promise<CommerceSubmitResult<S>> };
const CACHE_LIMIT = 64;
let portSequence = 0;
const issue = (code: CommerceIssueCode): CommerceIssue => ({ code });
const unavailable = (code: CommerceIssueCode) => ({ status: "unavailable" as const, issue: issue(code) });
const errorResult = () => ({ status: "error" as const, issue: issue("unavailable"), retryable: true });
const nonblank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 256;

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function immutable<T>(value: T): T { return freeze(copy(value)); }
function placement(route: CryptoPlacement): CryptoPlacement {
  return { accountId: route.accountId, accountKind: route.accountKind, accountLabel: route.accountLabel,
    assetId: route.assetId, symbol: route.symbol, name: route.name, networkId: route.networkId, networkLabel: route.networkLabel };
}
function matches(a: PlacementId, b: PlacementId): boolean {
  return a.accountId === b.accountId && a.accountKind === b.accountKind && a.assetId === b.assetId && a.networkId === b.networkId;
}
function fullPlacement(a: CryptoPlacement, b: CryptoPlacement): boolean {
  return sameCommerceData(placement(a), placement(b));
}
function offered(snapshot: Readonly<ProductSnapshot>, target: PlacementId, action: "buy" | "swap" | "receive"): ProductActionRoute | null {
  const accounts = snapshot.accounts.filter(account => account.id === target.accountId);
  if (accounts.length !== 1 || accounts[0]!.status !== "active" || accounts[0]!.kind !== target.accountKind) return null;
  const routes = resolveActionRoutes(snapshot, { kind: "account", accountId: target.accountId }, action).routes
    .filter(route => matches(route, target) && (action !== "receive" || (route.action === "receive" && route.receiveMode === "external-address")));
  const route = routes[0];
  return routes.length === 1 && route && Object.values(placement(route)).every(nonblank) ? route : null;
}
function readAvailable(snapshot: Readonly<ProductSnapshot>, route: CryptoPlacement, decimals: number): string | null {
  const holdings = snapshot.holdings.filter(holding => holding.accountId === route.accountId && holding.assetId === route.assetId && holding.networkId === route.networkId);
  const amount = holdings.length === 1 ? readCommerceDecimal(holdings[0]!.availableQuantity) : null;
  return amount !== null && (amount.split(".")[1]?.length ?? 0) <= decimals ? amount : null;
}
function readTime(now: () => number): number | null {
  try { const value = now(); return Number.isSafeInteger(value) && value >= 0 && Number.isSafeInteger(value + DEMO_COMMERCE_QUOTE_TTL_MS) ? value : null; }
  catch { return null; }
}
function boundedDelay(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, 5000) : fallback;
}
function aborted(): DOMException { return new DOMException("Commerce simulation aborted", "AbortError"); }
function throwIfAborted(signal: AbortSignal): void { if (signal.aborted) throw aborted(); }
function isAbort(error: unknown): boolean { return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"; }
function delay(ms: number, signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); reject(aborted()); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
function observe<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => { signal.removeEventListener("abort", onAbort); reject(aborted()); };
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(value => { signal.removeEventListener("abort", onAbort); resolve(value); },
      error => { signal.removeEventListener("abort", onAbort); reject(error); });
  });
}
function remember<Q extends CommerceQuote>(issued: Map<string, Issued<Q>>, quote: Q, time: number): Q {
  for (const [id, record] of issued) if (record.quote.expiresAt <= time) issued.delete(id);
  if (issued.size >= CACHE_LIMIT) {
    const oldest = issued.keys().next().value;
    if (oldest !== undefined) issued.delete(oldest);
  }
  const snapshot = immutable(quote);
  issued.set(snapshot.id, { quote: snapshot });
  return snapshot;
}

function submitter<Q extends CommerceQuote, S extends CommerceSimulation>(
  issued: Map<string, Issued<Q>>, now: () => number, submitDelay: number, fail: boolean,
  validate: (quote: Q, time: number) => CommerceIssue | null,
  checkCurrent: (quote: Q) => CommerceIssue | null,
  simulation: (quote: Q, key: string, reason: "rejected" | "unavailable" | null) => S,
): (command: { quote: Q; idempotencyKey: string }, options: CommerceCallOptions) => Promise<CommerceSubmitResult<S>> {
  // Accepted keys never evict or restart. A bounded port declines new attempts at capacity.
  const attempts = new Map<string, Attempt<Q, S>>();
  return async (command, { signal }) => {
    throwIfAborted(signal);
    const key = command?.idempotencyKey, supplied = command?.quote;
    if (!nonblank(key) || !supplied) return unavailable("rejected");
    try {
      const captured = copy(supplied);
      const previous = attempts.get(key);
      if (previous) return sameCommerceData(captured, previous.quote) ? observe(previous.promise, signal) : unavailable("rejected");
      const record = issued.get(captured.id);
      if (!record || !sameCommerceData(captured, record.quote) || record.acceptedKey !== undefined) return unavailable("rejected");
      const time = readTime(now);
      if (time === null) return errorResult();
      const invalid = validate(record.quote, time) ?? checkCurrent(record.quote);
      if (invalid) return { status: "unavailable", issue: invalid };
      if (attempts.size >= CACHE_LIMIT) return errorResult();
      const accepted = record.quote;
      record.acceptedKey = key;
      const promise: Promise<CommerceSubmitResult<S>> = (async () => {
        await delay(submitDelay, signal);
        throwIfAborted(signal);
        let unavailableNow = false;
        try { unavailableNow = checkCurrent(accepted) !== null; } catch { unavailableNow = true; }
        const terminal = simulation(accepted, key, unavailableNow ? "unavailable" : fail ? "rejected" : null);
        return immutable({ status: "simulated" as const, simulation: terminal });
      })();
      attempts.set(key, { quote: accepted, promise });
      // Cancellation is retained too; attach rejection handling before any caller can abort.
      void promise.catch(() => {});
      return observe(promise, signal);
    } catch (error) {
      if (isAbort(error)) throw error;
      return errorResult();
    }
  };
}

/** Local synthetic allowlists only; no provider, network, storage or balance writes. */
export function createDemoCommercePorts(snapshot: Readonly<ProductSnapshot>, options: DemoCommerceOptions = {}): { buy: BuyPort; swap: SwapPort } {
  const now = options.now ?? Date.now;
  const loadDelay = boundedDelay(options.loadDelayMs, 80), quoteDelay = boundedDelay(options.quoteDelayMs, 120);
  const submitDelay = boundedDelay(options.submitDelayMs, 350), fail = options.outcome === "failure";
  const buyId = `demo-buy-port:${++portSequence}`, swapId = `demo-swap-port:${++portSequence}`;
  const issuedBuy = new Map<string, Issued<BuyQuote>>(), issuedSwap = new Map<string, Issued<SwapQuote>>();
  let quoteSequence = 0;

  function loadBuy(input: BuyRoute): BuyLoadResult {
    const fixture = DEMO_BUY_ROUTES.find(value => input?.action === "buy" && matches(input, value));
    const canonical = fixture ? offered(snapshot, fixture, "buy") : null;
    if (!fixture || !canonical || !fullPlacement(input, canonical)) return unavailable("unsupported-route");
    const { feeAmount: _fee, ...method } = DEMO_BUY_METHOD;
    return { status: "ready", data: {
      route: { ...placement(canonical), action: "buy" },
      destination: { ...placement(canonical), kind: "crypto", decimals: fixture.decimals }, methods: [copy(method)],
    } };
  }
  function loadSwap(input: SwapRoute): SwapLoadResult {
    const fixture = DEMO_SWAP_PAIRS.find(value => input?.action === "swap" && matches(input, value.source));
    const canonical = fixture ? offered(snapshot, fixture.source, "swap") : null;
    if (!fixture || !canonical || !fullPlacement(input, canonical)) return unavailable("unsupported-route");
    const destination = offered(snapshot, fixture.destination, "receive");
    if (!destination) return unavailable("unsupported-pair");
    return { status: "ready", data: {
      route: { ...placement(canonical), action: "swap" },
      source: { ...placement(canonical), kind: "crypto", decimals: fixture.source.decimals },
      terms: { ...fixture.terms, available: readAvailable(snapshot, canonical, fixture.source.decimals) },
      pairs: [{ id: fixture.id, destination: { ...placement(destination), kind: "crypto", decimals: fixture.destination.decimals }, rate: copy(fixture.rate) }],
    } };
  }
  function currentBuy(quote: BuyQuote): CommerceIssue | null {
    const loaded = loadBuy(quote.request.route);
    if (loaded.status !== "ready") return loaded.issue;
    const requestIssue = validateBuyRequest(quote.request, loaded.data);
    if (requestIssue) return requestIssue;
    const method = loaded.data.methods.find(value => value.id === quote.request.methodId)!;
    return validateBuyQuote(quote.request, { ...quote, terms: method.terms, funding: method.funding }, quote.expiresAt - 1, buyId);
  }
  function currentSwap(quote: SwapQuote): CommerceIssue | null {
    const loaded = loadSwap(quote.request.route);
    if (loaded.status !== "ready") return loaded.issue;
    const requestIssue = validateSwapRequest(quote.request, loaded.data);
    return requestIssue ?? validateSwapQuote(quote.request, { ...quote, terms: loaded.data.terms }, quote.expiresAt - 1, swapId);
  }
  const submitBuy = submitter(issuedBuy, now, submitDelay, fail, (quote, time) => validateBuyQuote(quote.request, quote, time, buyId), currentBuy,
    (quote, key, reason): BuySimulation => ({ mode: "demo", kind: "buy", simulationId: commerceOperationId(quote, key), idempotencyKey: key, quote,
      result: reason ? { mode: "demo", status: "simulated-failure", reason } : { mode: "demo", status: "simulated-success" } }));
  const submitSwap = submitter(issuedSwap, now, submitDelay, fail, (quote, time) => validateSwapQuote(quote.request, quote, time, swapId), currentSwap,
    (quote, key, reason): SwapSimulation => ({ mode: "demo", kind: "swap", simulationId: commerceOperationId(quote, key), idempotencyKey: key, quote,
      result: reason ? { mode: "demo", status: "simulated-failure", reason } : { mode: "demo", status: "simulated-success" } }));

  const buy: BuyPort = {
    mode: "demo", id: buyId,
    async loadRoute(route, { signal }) {
      throwIfAborted(signal);
      try { const captured = copy(route); await delay(loadDelay, signal); throwIfAborted(signal); return immutable(loadBuy(captured)); }
      catch (error) { if (isAbort(error)) throw error; return errorResult(); }
    },
    async quote(request, { signal }): Promise<BuyQuoteResult> {
      throwIfAborted(signal);
      try {
        const captured: BuyRequest = copy(request);
        await delay(quoteDelay, signal); throwIfAborted(signal);
        const loaded = loadBuy(captured.route);
        if (loaded.status !== "ready") return loaded;
        const invalidRequest = validateBuyRequest(captured, loaded.data);
        if (invalidRequest) return { status: "unavailable", issue: invalidRequest };
        const method = loaded.data.methods.find(value => value.id === captured.methodId)!;
        const amount = normalizeCommerceAmount(captured.fiat.amount)!;
        const time = readTime(now);
        if (time === null) return errorResult();
        const fiat = { kind: "fiat" as const, currency: method.currency, decimals: method.terms.decimals };
        const quote: BuyQuote = {
          mode: "demo", kind: "buy", id: `${buyId}:quote:${++quoteSequence}`, portId: buyId, expiresAt: time + DEMO_COMMERCE_QUOTE_TTL_MS,
          request: { route: loaded.data.route, methodId: method.id, fiat: { currency: method.currency, amount } },
          terms: method.terms, funding: method.funding, payment: { ...fiat, amount },
          debit: { ...fiat, amount: addCommerceDecimal(amount, DEMO_BUY_METHOD.feeAmount) },
          credit: { ...loaded.data.destination, quantity: multiplyCommerceDecimal(amount, method.rate.outputPerInput, loaded.data.destination.decimals) },
          rate: method.rate, fee: { status: "known", amount: DEMO_BUY_METHOD.feeAmount, unit: fiat }, feeFunding: { kind: "source" },
        };
        const invalidQuote = validateBuyQuote(captured, quote, time, buyId);
        return invalidQuote ? { status: "unavailable", issue: invalidQuote } : { status: "quoted", quote: remember(issuedBuy, quote, time) };
      } catch (error) { if (isAbort(error)) throw error; return errorResult(); }
    },
    submit: submitBuy,
  };
  const swap: SwapPort = {
    mode: "demo", id: swapId,
    async loadRoute(route, { signal }) {
      throwIfAborted(signal);
      try { const captured = copy(route); await delay(loadDelay, signal); throwIfAborted(signal); return immutable(loadSwap(captured)); }
      catch (error) { if (isAbort(error)) throw error; return errorResult(); }
    },
    async quote(request, { signal }): Promise<SwapQuoteResult> {
      throwIfAborted(signal);
      try {
        const captured: SwapRequest = copy(request);
        await delay(quoteDelay, signal); throwIfAborted(signal);
        const loaded = loadSwap(captured.route);
        if (loaded.status !== "ready") return loaded;
        const invalidRequest = validateSwapRequest(captured, loaded.data);
        if (invalidRequest) return { status: "unavailable", issue: invalidRequest };
        const pair = loaded.data.pairs.find(value => value.id === captured.pairId)!;
        const fixture = DEMO_SWAP_PAIRS.find(value => value.id === pair.id)!;
        const amount = normalizeCommerceAmount(captured.sourceAmount)!;
        const time = readTime(now);
        if (time === null) return errorResult();
        const quote: SwapQuote = {
          mode: "demo", kind: "swap", id: `${swapId}:quote:${++quoteSequence}`, portId: swapId, expiresAt: time + DEMO_COMMERCE_QUOTE_TTL_MS,
          request: { route: loaded.data.route, pairId: pair.id, destination: placement(pair.destination), sourceAmount: amount },
          terms: loaded.data.terms, source: { ...loaded.data.source, quantity: amount },
          debit: { ...loaded.data.source, quantity: addCommerceDecimal(amount, fixture.feeAmount) },
          credit: { ...pair.destination, quantity: multiplyCommerceDecimal(amount, pair.rate.outputPerInput, pair.destination.decimals) },
          rate: pair.rate, fee: { status: "known", amount: fixture.feeAmount, unit: loaded.data.source }, feeFunding: { kind: "source" },
        };
        const invalidQuote = validateSwapQuote(captured, quote, time, swapId);
        return invalidQuote ? { status: "unavailable", issue: invalidQuote } : { status: "quoted", quote: remember(issuedSwap, quote, time) };
      } catch (error) { if (isAbort(error)) throw error; return errorResult(); }
    },
    submit: submitSwap,
  };
  return { buy, swap };
}
