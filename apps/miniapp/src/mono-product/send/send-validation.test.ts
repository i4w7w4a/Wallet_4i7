import { describe, expect, it } from "vitest";
import type { ProductActionRoute } from "@wallet/core";
import type { SendQuote, SendRequest } from "./send-port";
import { validateAmount, validateQuote } from "./send-validation";

const route: ProductActionRoute = {
  action: "send", accountId: "account-a", accountLabel: "Основной", accountKind: "custodial",
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
};
const request: SendRequest = { route, recipient: { address: "demo:recipient" }, amount: "10" };
const quote: SendQuote = {
  mode: "demo", id: "fixture-quote", request, expiresAt: 2000,
  terms: { decimals: 6, available: "100" }, assetDebit: "10",
  networkFee: { status: "known", amount: "0.0001", symbol: "ETH" },
  feeFunding: { kind: "balance", status: "sufficient" },
};

describe("exact decimal validation", () => {
  it("preserves an amount beyond binary floating point precision", () => {
    expect(validateAmount("9007199254740993.000000000000000001", {
      decimals: 18, available: "9007199254740993.000000000000000001",
    })).toEqual({ valid: true, amount: "9007199254740993.000000000000000001" });
  });

  it("rejects one atomic unit above available instead of rounding it away", () => {
    expect(validateAmount("9007199254740993.000000000000000002", {
      decimals: 18, available: "9007199254740993.000000000000000001",
    })).toEqual({ valid: false, issue: { code: "insufficient-asset" } });
  });

  it.each(["0", "-1", "1e3", "1,234.56", ".", "NaN"])("rejects ambiguous or nonpositive input %s", input => {
    expect(validateAmount(input, { decimals: 6, available: "100" }).valid).toBe(false);
  });

  it("normalizes the decimal separator and respects provider precision and limits", () => {
    expect(validateAmount(" 001,2300 ", { decimals: 4, available: "100" })).toEqual({ valid: true, amount: "1.23" });
    expect(validateAmount("1.00001", { decimals: 4, available: "100" })).toEqual({ valid: false, issue: { code: "precision" } });
    expect(validateAmount("0.5", { decimals: 6, available: "100", minimum: "1" })).toEqual({ valid: false, issue: { code: "below-minimum" } });
    expect(validateAmount("11", { decimals: 6, available: "100", maximum: "10" })).toEqual({ valid: false, issue: { code: "above-maximum" } });
  });
});

describe("quote authorization", () => {
  it("distinguishes missing source funds from missing fee funds", () => {
    expect(validateQuote(request, { ...quote, terms: { decimals: 6, available: "9" } }, 1000)).toEqual({ code: "insufficient-asset" });
    expect(validateQuote(request, { ...quote, feeFunding: { kind: "balance", status: "insufficient" } }, 1000)).toEqual({ code: "insufficient-fee" });
    expect(validateQuote(request, { ...quote, assetDebit: "101" }, 1000)).toEqual({ code: "insufficient-fee" });
  });

  it("requires known funding, a known fee, and an unexpired quote", () => {
    expect(validateQuote(request, { ...quote, networkFee: { status: "unknown" } }, 1000)).toEqual({ code: "unknown-fee" });
    expect(validateQuote(request, { ...quote, feeFunding: { kind: "unknown" } }, 1000)).toEqual({ code: "unknown-fee" });
    expect(validateQuote(request, { ...quote, terms: { decimals: 6, available: null } }, 1000)).toEqual({ code: "unknown-available" });
    expect(validateQuote(request, quote, 2000)).toEqual({ code: "expired-quote" });
    expect(validateQuote(request, quote, 1000)).toBeNull();
  });

  it.each([
    { ...request, amount: "11" },
    { ...request, recipient: { address: "demo:other" } },
    { ...request, recipient: { address: "demo:recipient", memo: "different" } },
    { ...request, route: { ...route, accountId: "account-b" } },
    { ...request, route: { ...route, networkId: "solana" } },
    { ...request, route: { ...route, assetId: "eth" } },
  ])("rejects a quote for a different request", changed => {
    expect(validateQuote(changed, quote, 1000)).toEqual({ code: "stale-quote" });
  });

  it("only accepts battery coverage explicitly quoted for an eligible account and network", () => {
    const pool = { id: "shared-network-pool", networkId: "ethereum", networkLabel: "Ethereum",
      eligibleAccountIds: ["account-a", "account-b"], action: "send" as const, remainingTransfers: 3 };
    const covered: SendQuote = { ...quote, feeFunding: { kind: "battery", pool, charges: 1 } };
    expect(validateQuote(request, covered, 1000)).toBeNull();
    expect(validateQuote(request, { ...covered, networkFee: { status: "unknown" } }, 1000)).toEqual({ code: "unknown-fee" });
    expect(validateQuote(request, { ...covered, feeFunding: { kind: "battery", pool: { ...pool, networkId: "solana" }, charges: 1 } }, 1000)).toEqual({ code: "invalid-quote" });
    expect(validateQuote(request, { ...covered, feeFunding: { kind: "battery", pool: { ...pool, eligibleAccountIds: ["account-b"] }, charges: 1 } }, 1000)).toEqual({ code: "invalid-quote" });
    expect(validateQuote(request, { ...covered, feeFunding: { kind: "battery", pool: { ...pool, remainingTransfers: "unknown" }, charges: 1 } }, 1000)).toEqual({ code: "unknown-fee" });
  });
});
