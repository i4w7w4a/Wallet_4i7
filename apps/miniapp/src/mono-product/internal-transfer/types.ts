export type InternalTransferDraft = { sourceAccountId: string | null; amount: string };

export type InternalTransferRequest = {
  sourceAccountId: string;
  destinationAccountId: string;
  assetId: string;
  networkId: string;
  amount: string;
};

export type InternalTransferQuote = {
  mode: "demo";
  id: string;
  request: InternalTransferRequest;
  sourceAccountLabel: string;
  destinationAccountLabel: string;
  symbol: string;
  networkLabel: string;
  available: string;
  assetDebit: string;
  fee: { amount: string; symbol: string };
  expiresAt: number;
};

export type InternalTransferIssue =
  | "unsupported-route" | "invalid-amount" | "unknown-available" | "insufficient-asset"
  | "expired-quote" | "invalid-quote" | "unavailable";

export type InternalTransferQuoteResult =
  | { status: "quoted"; quote: InternalTransferQuote }
  | { status: "unavailable"; issue: InternalTransferIssue };

export type InternalTransferResult =
  | { mode: "demo"; status: "simulated-success" }
  | { mode: "demo"; status: "simulated-failure"; reason: "rejected" | "expired" | "unavailable" };

export type InternalTransferSimulation = {
  simulationId: string;
  quote: InternalTransferQuote;
  result: InternalTransferResult;
};

export interface InternalTransferPort {
  readonly mode: "demo";
  quote(request: InternalTransferRequest, options: { signal: AbortSignal }): Promise<InternalTransferQuoteResult>;
  submit(command: { quote: InternalTransferQuote; idempotencyKey: string }, options: { signal: AbortSignal }): Promise<InternalTransferResult>;
}
