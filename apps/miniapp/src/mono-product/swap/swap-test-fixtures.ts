import type {
  CommerceSubmitState, CryptoUnit, SwapFlowProps, SwapPort, SwapQuote, SwapQuoteResult,
  SwapRequest, SwapRoute, SwapRouteData, SwapSubmitResult,
} from "../commerce";

export const sourceRoute: SwapRoute = {
  action: "swap", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
};
export const source: CryptoUnit = { ...sourceRoute, kind: "crypto", decimals: 6 };
export const destination: CryptoUnit = {
  kind: "crypto", accountId: "demo-custody", accountKind: "custodial", accountLabel: "Основной",
  assetId: "eth", symbol: "ETH", name: "Ethereum", networkId: "ethereum", networkLabel: "Ethereum", decimals: 18,
};
export const pairId = "demo-usdc-eth-ethereum";
export const routeData: SwapRouteData = {
  route: sourceRoute, source, terms: { decimals: 6, minimum: "1", maximum: "500", available: "500" },
  pairs: [{ id: pairId, destination, rate: { outputPerInput: "0.0004", label: "Демо-курс: 2500 USDC = 1 ETH" } }],
};

// Hand-checked fixture values; no production decimal/quote helper derives expectations.
const amounts: Readonly<Record<string, { debit: string; credit: string }>> = {
  "100": { debit: "101", credit: "0.04" },
  "200": { debit: "201", credit: "0.08" },
  "499": { debit: "500", credit: "0.1996" },
  "500": { debit: "501", credit: "0.2" },
  "1.000001": { debit: "2.000001", credit: "0.0004000004" },
};

export function quoted(request: SwapRequest, changes: Partial<SwapQuote> = {}): SwapQuoteResult {
  const expected = amounts[request.sourceAmount];
  if (!expected) throw new Error(`Missing literal test quantity: ${request.sourceAmount}`);
  return { status: "quoted", quote: {
    kind: "swap", mode: "demo", id: `quote-${request.sourceAmount}`, portId: "test-swap-port",
    request: structuredClone(request), expiresAt: Date.now() + 60_000, terms: { ...routeData.terms },
    source: { ...source, quantity: request.sourceAmount },
    debit: { ...source, quantity: expected.debit }, credit: { ...destination, quantity: expected.credit },
    rate: { ...routeData.pairs[0]!.rate }, fee: { status: "known", amount: "1", unit: source },
    feeFunding: { kind: "source" }, ...changes,
  } };
}

export function testPort(changes: Partial<SwapPort> = {}): SwapPort {
  return {
    mode: "demo", id: "test-swap-port",
    loadRoute: async () => ({ status: "ready", data: structuredClone(routeData) }),
    quote: async request => quoted(request),
    submit: async () => ({ status: "unavailable", issue: { code: "rejected" } }),
    ...changes,
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

export function terminal(state: CommerceSubmitState, status: "simulated-success" | "simulated-failure" = "simulated-success"): SwapSubmitResult {
  if (!state.busy || state.attempt.kind !== "swap") throw new Error("Expected accepted swap identity");
  return { status: "simulated", simulation: {
    mode: "demo", kind: "swap", simulationId: state.attempt.operationId,
    idempotencyKey: state.attempt.idempotencyKey, quote: structuredClone(state.attempt.quote),
    result: status === "simulated-success" ? { mode: "demo", status } : { mode: "demo", status, reason: "rejected" },
  } };
}

export function flowProps(port = testPort(), changes: Partial<SwapFlowProps> = {}): SwapFlowProps {
  return {
    route: sourceRoute, port, privacy: false, onBack: () => {}, onClose: () => {},
    onSimulationResult: () => {}, onSubmitBusyChange: () => {}, ...changes,
  };
}
