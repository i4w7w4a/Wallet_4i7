import type { ProductAccountKind, ProductActionRoute } from "@wallet/core";

export type BuyRoute = ProductActionRoute & { action: "buy" };
export type SwapRoute = ProductActionRoute & { action: "swap" };

/** A concrete placement; All and a fiat portfolio value are never funding. */
export type CryptoPlacement = {
  accountId: string;
  accountKind: ProductAccountKind;
  accountLabel: string;
  assetId: string;
  symbol: string;
  name: string;
  networkId: string;
  networkLabel: string;
};
export type FiatUnit = { kind: "fiat"; currency: string; decimals: number };
export type CryptoUnit = CryptoPlacement & { kind: "crypto"; decimals: number };
export type CommerceUnit = FiatUnit | CryptoUnit;
export type FiatAmount = FiatUnit & { amount: string };
export type CryptoAmount = CryptoUnit & { quantity: string };
export type AmountTerms = { decimals: number; minimum: string; maximum: string };
export type SpendTerms = AmountTerms & { available: string | null };
export type CommerceRate = { outputPerInput: string; label: string };
export type ExternalDemoFunding = {
  kind: "external-demo";
  methodId: string;
  currency: string;
  available: string | null;
};
export type CommerceFee =
  | { status: "unknown" }
  | { status: "known"; amount: string; unit: CommerceUnit };
export type CommerceFeeFunding =
  | { kind: "unknown" }
  | { kind: "source" }
  | { kind: "balance"; unit: CommerceUnit; available: string | null };

export type BuyMethod = {
  id: string;
  label: string;
  currency: string;
  terms: AmountTerms;
  funding: ExternalDemoFunding;
  rate: CommerceRate;
};
export type SwapPair = { id: string; destination: CryptoUnit; rate: CommerceRate };
export type BuyRouteData = { route: BuyRoute; destination: CryptoUnit; methods: readonly BuyMethod[] };
export type SwapRouteData = { route: SwapRoute; source: CryptoUnit; terms: SpendTerms; pairs: readonly SwapPair[] };

export type BuyDraft = { route: BuyRoute; methodId: string | null; fiatAmount: string };
export type SwapDraft = { route: SwapRoute; pairId: string | null; sourceAmount: string };
export type BuyRequest = { route: BuyRoute; methodId: string; fiat: { currency: string; amount: string } };
export type SwapRequest = { route: SwapRoute; pairId: string; destination: CryptoPlacement; sourceAmount: string };

type QuoteBase = {
  mode: "demo";
  id: string;
  portId: string;
  expiresAt: number;
  rate: CommerceRate;
  fee: CommerceFee;
  feeFunding: CommerceFeeFunding;
};
export type BuyQuote = QuoteBase & {
  kind: "buy";
  request: BuyRequest;
  terms: AmountTerms;
  funding: ExternalDemoFunding;
  payment: FiatAmount;
  debit: FiatAmount;
  credit: CryptoAmount;
};
export type SwapQuote = QuoteBase & {
  kind: "swap";
  request: SwapRequest;
  terms: SpendTerms;
  source: CryptoAmount;
  debit: CryptoAmount;
  credit: CryptoAmount;
};
export type CommerceQuote = BuyQuote | SwapQuote;
export type CommerceAcceptedSubmit =
  | { kind: "buy"; operationId: string; idempotencyKey: string; quote: BuyQuote }
  | { kind: "swap"; operationId: string; idempotencyKey: string; quote: SwapQuote };
export type CommerceSubmitState =
  | { busy: true; attempt: CommerceAcceptedSubmit }
  | { busy: false; operationId: string };

export type CommerceIssueCode =
  | "unsupported-route" | "unsupported-method" | "unsupported-pair"
  | "invalid-amount" | "precision" | "below-minimum" | "above-maximum"
  | "unknown-available" | "insufficient-asset" | "unknown-funding" | "insufficient-funding"
  | "unknown-fee" | "insufficient-fee" | "stale-quote" | "expired-quote"
  | "invalid-quote" | "invalid-result" | "unavailable" | "rejected";
export type CommerceIssue = { code: CommerceIssueCode };
export type CommerceLoadResult<Data> =
  | { status: "ready"; data: Data }
  | { status: "unavailable"; issue: CommerceIssue }
  | { status: "error"; issue: CommerceIssue; retryable: boolean };
export type CommerceQuoteResult<Quote> =
  | { status: "quoted"; quote: Quote }
  | { status: "unavailable"; issue: CommerceIssue }
  | { status: "error"; issue: CommerceIssue; retryable: boolean };
export type CommerceResult =
  | { mode: "demo"; status: "simulated-success" }
  | { mode: "demo"; status: "simulated-failure"; reason: "rejected" | "expired" | "unavailable" };
type Simulation<Kind, Quote> = {
  mode: "demo";
  kind: Kind;
  simulationId: string;
  idempotencyKey: string;
  quote: Quote;
  result: CommerceResult;
};
export type BuySimulation = Simulation<"buy", BuyQuote>;
export type SwapSimulation = Simulation<"swap", SwapQuote>;
export type CommerceSimulation = BuySimulation | SwapSimulation;
export type CommerceSubmitResult<Sim> =
  | { status: "simulated"; simulation: Sim }
  | { status: "unavailable"; issue: CommerceIssue }
  | { status: "error"; issue: CommerceIssue; retryable: boolean };
export type BuyLoadResult = CommerceLoadResult<BuyRouteData>;
export type SwapLoadResult = CommerceLoadResult<SwapRouteData>;
export type BuyQuoteResult = CommerceQuoteResult<BuyQuote>;
export type SwapQuoteResult = CommerceQuoteResult<SwapQuote>;
export type BuySubmitResult = CommerceSubmitResult<BuySimulation>;
export type SwapSubmitResult = CommerceSubmitResult<SwapSimulation>;
export type CommerceCallOptions = { signal: AbortSignal };

export interface BuyPort {
  readonly mode: "demo";
  readonly id: string;
  loadRoute(route: BuyRoute, options: CommerceCallOptions): Promise<BuyLoadResult>;
  quote(request: BuyRequest, options: CommerceCallOptions): Promise<BuyQuoteResult>;
  submit(command: { quote: BuyQuote; idempotencyKey: string }, options: CommerceCallOptions): Promise<BuySubmitResult>;
}
export interface SwapPort {
  readonly mode: "demo";
  readonly id: string;
  loadRoute(route: SwapRoute, options: CommerceCallOptions): Promise<SwapLoadResult>;
  quote(request: SwapRequest, options: CommerceCallOptions): Promise<SwapQuoteResult>;
  submit(command: { quote: SwapQuote; idempotencyKey: string }, options: CommerceCallOptions): Promise<SwapSubmitResult>;
}
export type DemoCommerceOptions = {
  now?: () => number;
  loadDelayMs?: number;
  quoteDelayMs?: number;
  submitDelayMs?: number;
  outcome?: "success" | "failure";
};

export type CommerceFlowProps<Route, Draft, Port, Sim> = {
  route: Route;
  port: Port;
  privacy: boolean;
  initialDraft?: Draft | null;
  onDraftChange?: (draft: Draft | null) => void;
  onSimulationResult: (simulation: Sim) => void;
  onSubmitBusyChange: (state: CommerceSubmitState) => void;
  onViewHistory?: () => void;
  onBack: (route: Route) => void;
  onClose: () => void;
  showCloseButton?: boolean;
};
export type BuyFlowProps = CommerceFlowProps<BuyRoute, BuyDraft, BuyPort, BuySimulation>;
export type SwapFlowProps = CommerceFlowProps<SwapRoute, SwapDraft, SwapPort, SwapSimulation>;
