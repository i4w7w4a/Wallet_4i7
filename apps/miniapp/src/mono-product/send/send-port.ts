import type { BatteryPool, ProductActionRoute } from "@wallet/core";

export type SendRecipient = { address: string; memo?: string };

// Provisional frontend port, not a backend DTO. This flow only permits simulations.
export type SendTerms = {
  decimals: number;
  available: string | null;
  minimum?: string;
  maximum?: string;
};

export type SendRouteData = {
  terms: SendTerms;
  recipient: {
    label: string;
    hint: string;
    placeholder?: string;
    memo?: { label: string; required: boolean; hint?: string };
  };
};

export type SendIssueCode =
  | "unsupported-route" | "invalid-recipient" | "invalid-amount" | "precision"
  | "below-minimum" | "above-maximum" | "insufficient-asset" | "insufficient-fee"
  | "unknown-available" | "unknown-fee" | "expired-quote" | "stale-quote"
  | "invalid-quote" | "unavailable";

export type SendIssue = { code: SendIssueCode };

export type SendRequest = {
  route: ProductActionRoute;
  recipient: SendRecipient;
  amount: string;
};

export type SendQuote = {
  mode: "demo";
  id: string;
  request: SendRequest;
  expiresAt: number;
  terms: SendTerms;
  // Supplied by the provider, including any fee paid in the source asset.
  assetDebit: string;
  networkFee: { status: "unknown" } | { status: "known"; amount: string; symbol: string };
  // A pool's existence is never a substitute for an operation-specific quote.
  feeFunding:
    | { kind: "unknown" }
    | { kind: "balance"; status: "sufficient" | "insufficient" | "unknown" }
    | { kind: "battery"; pool: BatteryPool; charges: number };
};

export type SendQuoteResult =
  | { status: "quoted"; quote: SendQuote }
  | { status: "unavailable"; issue: SendIssue };

export type SendDemoResult =
  | { mode: "demo"; status: "simulated-success" }
  | { mode: "demo"; status: "simulated-failure"; reason: "rejected" | "expired" | "unavailable" };

export type SendCallOptions = { signal: AbortSignal };

export interface SendPort {
  readonly mode: "demo";
  loadRoute(route: ProductActionRoute, options: SendCallOptions): Promise<SendRouteData | null>;
  validateRecipient(route: ProductActionRoute, recipient: SendRecipient, options: SendCallOptions):
    Promise<{ valid: true; recipient: SendRecipient } | { valid: false }>;
  quote(request: SendRequest, options: SendCallOptions): Promise<SendQuoteResult>;
  send(command: { quote: SendQuote; idempotencyKey: string }, options: SendCallOptions): Promise<SendDemoResult>;
}
