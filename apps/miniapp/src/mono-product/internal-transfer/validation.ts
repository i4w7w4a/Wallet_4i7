import type { InternalTransferIssue, InternalTransferQuote, InternalTransferRequest } from "./types";

function normalizeDecimalParts(text: string): string {
  const [whole = "", fraction = ""] = text.split(".");
  const integer = whole.replace(/^0+/, "") || "0";
  const decimals = fraction.replace(/0+$/, "");
  return decimals ? `${integer}.${decimals}` : integer;
}

export function normalizeInternalTransferAmount(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 128) return null;
  const text = raw.trim().replace(",", ".");
  if (!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text)) return null;
  const amount = normalizeDecimalParts(text);
  return amount === "0" ? null : amount;
}

// Snapshot decimals use strict dot syntax and have no UI input length limit.
export function readNonNegativeDecimal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^[0-9]+(?:\.[0-9]+)?$/.exec(value);
  // JS's $ anchor also matches before a final newline; require the whole string.
  if (match?.[0] !== value) return null;
  return normalizeDecimalParts(value);
}

// Both inputs are normalized nonnegative decimal strings; no float conversion.
export function compareDecimal(left: string, right: string): -1 | 0 | 1 {
  const [leftWhole = "0", leftFraction = ""] = left.split(".");
  const [rightWhole = "0", rightFraction = ""] = right.split(".");
  if (leftWhole.length !== rightWhole.length) return leftWhole.length > rightWhole.length ? 1 : -1;
  if (leftWhole !== rightWhole) return leftWhole > rightWhole ? 1 : -1;
  const width = Math.max(leftFraction.length, rightFraction.length);
  const leftPadded = leftFraction.padEnd(width, "0");
  const rightPadded = rightFraction.padEnd(width, "0");
  return leftPadded === rightPadded ? 0 : leftPadded > rightPadded ? 1 : -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateInternalTransferQuote(
  request: InternalTransferRequest,
  quote: InternalTransferQuote,
  now: number,
): InternalTransferIssue | null {
  try {
    if (!isRecord(request) || ![
      request.sourceAccountId, request.destinationAccountId, request.assetId, request.networkId,
    ].every(isNonblank) || request.sourceAccountId === request.destinationAccountId) {
      return "unsupported-route";
    }
    const amount = normalizeInternalTransferAmount(request.amount);
    if (amount === null) return "invalid-amount";

    if (!isRecord(quote) || quote.mode !== "demo" || ![
      quote.id, quote.sourceAccountLabel, quote.destinationAccountLabel, quote.symbol, quote.networkLabel,
    ].every(isNonblank) || !isRecord(quote.request) || !isRecord(quote.fee)) {
      return "invalid-quote";
    }
    if (quote.request.sourceAccountId !== request.sourceAccountId ||
        quote.request.destinationAccountId !== request.destinationAccountId ||
        quote.request.assetId !== request.assetId || quote.request.networkId !== request.networkId ||
        quote.request.amount !== amount) {
      return "invalid-quote";
    }
    if (!Number.isFinite(now) || !Number.isFinite(quote.expiresAt)) return "invalid-quote";
    if (quote.expiresAt <= now) return "expired-quote";

    const available = readNonNegativeDecimal(quote.available);
    if (available === null) return "unknown-available";
    if (quote.assetDebit !== amount || readNonNegativeDecimal(quote.fee.amount) !== "0" ||
        quote.fee.symbol !== quote.symbol) {
      return "invalid-quote";
    }
    return compareDecimal(amount, available) > 0 ? "insufficient-asset" : null;
  } catch {
    return "invalid-quote";
  }
}
