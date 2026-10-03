import { describe, expect, it } from "vitest";
import { normalizeOperationReceipt } from "./operation-receipt";

describe("operation receipt normalization", () => {
  it("copies only the receipt allowlist, retaining exact decimals without private quote data", () => {
    const source = {
      assetDebit: "9007199254740993.000000000000000001",
      networkFee: { status: "known", amount: "0.000000000000000001", symbol: "ETH", available: "private-fee-balance" },
      feeFunding: { kind: "battery", poolId: "network-pool", networkLabel: "Ethereum", charges: 1,
        pool: { eligibleAccountIds: ["private-account"], remainingTransfers: 3 } },
      estimatedCompletionSeconds: 90, recipient: "private-address", memo: "private-memo",
      request: { recipient: "private-address" }, terms: { available: "private-balance" }, id: "quote-id", expiresAt: 4000,
    };
    const receipt = normalizeOperationReceipt(source);
    expect(receipt).toEqual({
      assetDebit: "9007199254740993.000000000000000001",
      networkFee: { status: "known", amount: "0.000000000000000001", symbol: "ETH" },
      feeFunding: { kind: "battery", poolId: "network-pool", networkLabel: "Ethereum", charges: 1 },
      estimatedCompletionSeconds: 90,
    });
    source.assetDebit = "7"; source.networkFee.amount = "2"; source.feeFunding.charges = 9;
    expect(receipt?.assetDebit).toBe("9007199254740993.000000000000000001");
    expect(receipt?.networkFee).toEqual({ status: "known", amount: "0.000000000000000001", symbol: "ETH" });
    expect(receipt?.feeFunding).toEqual({ kind: "battery", poolId: "network-pool", networkLabel: "Ethereum", charges: 1 });
  });

  it("keeps unknown fee and funding unknown, without manufacturing a zero", () => {
    expect(normalizeOperationReceipt({ assetDebit: "0", networkFee: { status: "unknown", amount: "0" },
      feeFunding: { kind: "unknown", charges: 1 } })).toEqual({ assetDebit: "0", networkFee: { status: "unknown" }, feeFunding: { kind: "unknown" } });
    expect(normalizeOperationReceipt({ assetDebit: "001.2300", networkFee: { status: "known", amount: "0", symbol: "ETH" },
      feeFunding: { kind: "balance", status: "sufficient", available: "private" } })).toEqual({ assetDebit: "001.2300",
      networkFee: { status: "known", amount: "0", symbol: "ETH" }, feeFunding: { kind: "balance" } });
  });

  it("rejects invalid monetary strings and incomplete discriminated fields", () => {
    const base = { assetDebit: "10", networkFee: { status: "known", amount: "0.1", symbol: "ETH" }, feeFunding: { kind: "balance" } };
    for (const amount of [-1, 1, "-1", "+1", "1e3", "1,5", " 1", "1 ", "1\n", "1\r", "1.", ".1", "NaN", ""]) {
      expect(normalizeOperationReceipt({ ...base, assetDebit: amount })).toBeUndefined();
      expect(normalizeOperationReceipt({ ...base, networkFee: { ...base.networkFee, amount } })).toBeUndefined();
    }
    for (const source of [null, [], {}, "receipt", { ...base, networkFee: { status: "known", amount: "1" } },
      { ...base, networkFee: { status: "known", amount: "1", symbol: " " } }, { ...base, feeFunding: { kind: "other" } }]) {
      expect(normalizeOperationReceipt(source)).toBeUndefined();
    }
  });

  it("requires positive safe integer battery charges and explicit public pool identity", () => {
    const base = { assetDebit: "10", networkFee: { status: "unknown" },
      feeFunding: { kind: "battery", poolId: "pool", networkLabel: "Ethereum", charges: 1 } };
    for (const charges of [0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, "1"]) {
      expect(normalizeOperationReceipt({ ...base, feeFunding: { ...base.feeFunding, charges } })).toBeUndefined();
    }
    expect(normalizeOperationReceipt({ ...base, feeFunding: { kind: "battery", pool: { id: "pool", networkLabel: "Ethereum" }, charges: 1 } })).toBeUndefined();
    expect(normalizeOperationReceipt({ ...base, feeFunding: { ...base.feeFunding, poolId: "" } })).toBeUndefined();
  });

  it("turns invalid estimates into unknown and preserves explicit zero without a status", () => {
    const base = { assetDebit: "10", networkFee: { status: "unknown" }, feeFunding: { kind: "unknown" } };
    for (const eta of [-1, Infinity, NaN, "60", {}]) {
      expect(normalizeOperationReceipt({ ...base, estimatedCompletionSeconds: eta })).toEqual({ ...base, estimatedCompletionSeconds: null });
    }
    expect(normalizeOperationReceipt({ ...base, estimatedCompletionSeconds: 0 })).toEqual({ ...base, estimatedCompletionSeconds: 0 });
    expect(normalizeOperationReceipt({ ...base, estimatedCompletionSeconds: 0.5 })).toEqual({ ...base, estimatedCompletionSeconds: 0.5 });
    expect(normalizeOperationReceipt(base)).not.toHaveProperty("estimatedCompletionSeconds");
  });
});
