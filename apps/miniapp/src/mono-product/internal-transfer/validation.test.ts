import { describe, expect, it } from "vitest";
import type { InternalTransferQuote, InternalTransferRequest } from "./types";
import {
  compareDecimal,
  normalizeInternalTransferAmount,
  readNonNegativeDecimal,
  validateInternalTransferQuote,
} from "./validation";

const request: InternalTransferRequest = Object.freeze({
  sourceAccountId: "custody",
  destinationAccountId: "depositary",
  assetId: "usdc",
  networkId: "ethereum",
  amount: "10",
});
const quote: InternalTransferQuote = Object.freeze({
  mode: "demo",
  id: "demo-internal-quote-1",
  request,
  sourceAccountLabel: "Основной",
  destinationAccountLabel: "Хранилище",
  symbol: "USDC",
  networkLabel: "Ethereum",
  available: "100",
  assetDebit: "10",
  fee: Object.freeze({ amount: "0", symbol: "USDC" }),
  expiresAt: 2000,
});

describe("internal transfer amount input", () => {
  it.each([
    [" 001,2300 ", "1.23"],
    ["000010.000", "10"],
    [".5", "0.5"],
    [",5", "0.5"],
    ["1.", "1"],
    ["1,", "1"],
    ["0.000000000000000000001", "0.000000000000000000001"],
    ["9007199254740993.000000000000000001", "9007199254740993.000000000000000001"],
  ])("normalizes %s without rounding or assuming token precision", (raw, expected) => {
    expect(normalizeInternalTransferAmount(raw)).toBe(expected);
  });

  it.each(["", " ", "0", "000.000", "-1", "+1", "1e3", "1 000", "1,234.56", "1,2,3", ".", "NaN", "１２"])(
    "rejects nonpositive or ambiguous input %s", raw => {
      expect(normalizeInternalTransferAmount(raw)).toBeNull();
    },
  );

  it("applies the 128-character limit before trimming", () => {
    expect(normalizeInternalTransferAmount(`${" ".repeat(127)}1`)).toBe("1");
    expect(normalizeInternalTransferAmount(`${" ".repeat(128)}1`)).toBeNull();
  });

  it.each([null, undefined, 10, false, {}, []])("rejects malformed runtime amount %s without throwing", raw => {
    expect(normalizeInternalTransferAmount(raw as unknown as string)).toBeNull();
  });
});

describe("strict snapshot decimal reader", () => {
  it.each([
    ["000.000", "0"],
    ["0010.02000", "10.02"],
    ["0.000000000000000001", "0.000000000000000001"],
    ["9007199254740993.000000000000000001", "9007199254740993.000000000000000001"],
  ])("reads %s exactly", (raw, expected) => {
    expect(readNonNegativeDecimal(raw)).toBe(expected);
  });

  it.each([null, undefined, 0, false, {}, [], "", " 1", "1 ", "1\n", ".5", "1.", "1,5", "-0", "+1", "1e3", "1 000"])(
    "rejects noncanonical decimal syntax %s", raw => {
      expect(readNonNegativeDecimal(raw)).toBeNull();
    },
  );

  it("does not impose the UI input length limit on snapshot availability", () => {
    expect(readNonNegativeDecimal(`${"0".repeat(140)}1.0000`)).toBe("1");
  });
});

describe("exact normalized decimal comparison", () => {
  it.each([
    ["0", "0", 0],
    ["9", "10", -1],
    ["10", "9", 1],
    ["1000", "999.999", 1],
    ["0.001", "0.01", -1],
    ["0.1", "0.100000000000000001", -1],
    ["0.000000000000000001", "0", 1],
    ["9007199254740992", "9007199254740993", -1],
    ["9007199254740993.000000000000000001", "9007199254740993.000000000000000002", -1],
    ["9007199254740993.000000000000000002", "9007199254740993.000000000000000001", 1],
    ["9007199254740993.000000000000000001", "9007199254740993.000000000000000001", 0],
  ] as const)("compares %s with %s exactly", (left, right, expected) => {
    expect(compareDecimal(left, right)).toBe(expected);
  });
});

describe("internal transfer quote guard", () => {
  it("accepts an unexpired complete quote without mutating frozen inputs", () => {
    expect(validateInternalTransferQuote(request, quote, 1000)).toBeNull();
  });

  it("matches the normalized user amount to a canonical quoted amount", () => {
    expect(validateInternalTransferQuote({ ...request, amount: " 0010,000 " }, quote, 1000)).toBeNull();
    expect(validateInternalTransferQuote({ ...request, amount: ".5" }, {
      ...quote, request: { ...request, amount: "0.5" }, assetDebit: "0.5",
    }, 1000)).toBeNull();
  });

  it.each(["sourceAccountId", "destinationAccountId", "assetId", "networkId"] as const)(
    "requires a nonblank request %s", field => {
      expect(validateInternalTransferQuote({ ...request, [field]: " \t " }, quote, 1000)).toBe("unsupported-route");
    },
  );

  it("rejects transfers between the same account", () => {
    expect(validateInternalTransferQuote({ ...request, destinationAccountId: "custody" }, quote, 1000)).toBe("unsupported-route");
  });

  it.each([null, undefined, [], 3, {}, { sourceAccountId: null }])("rejects malformed request %s without throwing", raw => {
    expect(validateInternalTransferQuote(raw as unknown as InternalTransferRequest, quote, 1000)).toBe("unsupported-route");
  });

  it.each(["0", "-1", "1e2", `${" ".repeat(128)}10`, null, 10])("rejects invalid request amount %s", amount => {
    expect(validateInternalTransferQuote({ ...request, amount } as InternalTransferRequest, quote, 1000)).toBe("invalid-amount");
  });

  it.each([
    { sourceAccountId: "another-source" },
    { destinationAccountId: "another-destination" },
    { assetId: "eth" },
    { networkId: "solana" },
    { sourceAccountId: " custody" },
    { destinationAccountId: "depositary " },
    { amount: "11" },
    { amount: "010.00" },
    { amount: "10,0" },
  ])("rejects mismatched or noncanonical quote request %s", change => {
    expect(validateInternalTransferQuote(request, { ...quote, request: { ...request, ...change } }, 1000)).toBe("invalid-quote");
  });

  it.each(["id", "sourceAccountLabel", "destinationAccountLabel", "symbol", "networkLabel"] as const)(
    "requires a nonblank quote %s", field => {
      expect(validateInternalTransferQuote(request, { ...quote, [field]: " \t " }, 1000)).toBe("invalid-quote");
    },
  );

  it("requires the explicit demo marker", () => {
    expect(validateInternalTransferQuote(request, { ...quote, mode: "real" } as unknown as InternalTransferQuote, 1000)).toBe("invalid-quote");
  });

  it.each([null, undefined, [], 3, {}])("rejects malformed quote %s without throwing", raw => {
    expect(validateInternalTransferQuote(request, raw as unknown as InternalTransferQuote, 1000)).toBe("invalid-quote");
  });

  it.each([null, undefined, []])("rejects malformed nested quote records %s without throwing", raw => {
    expect(validateInternalTransferQuote(request, { ...quote, request: raw } as unknown as InternalTransferQuote, 1000)).toBe("invalid-quote");
    expect(validateInternalTransferQuote(request, { ...quote, fee: raw } as unknown as InternalTransferQuote, 1000)).toBe("invalid-quote");
  });

  it("contains unreadable runtime quote fields at the boundary", () => {
    const unreadable = { ...quote, get mode(): "demo" { throw new Error("unreadable"); } };
    expect(validateInternalTransferQuote(request, unreadable, 1000)).toBe("invalid-quote");
  });

  it.each([undefined, null, 100, "", "unknown", " 100", "100\n", "100,0", "-1", "1e3", ".5", "100."])(
    "keeps malformed or missing available %s unknown", available => {
      expect(validateInternalTransferQuote(request, { ...quote, available } as InternalTransferQuote, 1000)).toBe("unknown-available");
    },
  );

  it("distinguishes a known zero balance from an unknown balance", () => {
    expect(validateInternalTransferQuote(request, { ...quote, available: "000.000" }, 1000)).toBe("insufficient-asset");
  });

  it("accepts availability beyond the UI input bound", () => {
    expect(validateInternalTransferQuote(request, { ...quote, available: `1${"0".repeat(140)}` }, 1000)).toBeNull();
  });

  it("accepts an exact large amount and rejects one atomic unit above availability", () => {
    const exactRequest = { ...request, amount: "9007199254740993.000000000000000001" };
    const exactQuote = {
      ...quote, request: exactRequest,
      available: "9007199254740993.000000000000000001",
      assetDebit: "9007199254740993.000000000000000001",
    };
    expect(validateInternalTransferQuote(exactRequest, exactQuote, 1000)).toBeNull();
    expect(validateInternalTransferQuote({ ...request, amount: "9007199254740993.000000000000000002" }, {
      ...exactQuote,
      request: { ...request, amount: "9007199254740993.000000000000000002" },
      assetDebit: "9007199254740993.000000000000000002",
    }, 1000)).toBe("insufficient-asset");
  });

  it.each(["9", "11", "010", "10.0", "10,0", null, 10])("requires a canonical exact asset debit %s", assetDebit => {
    expect(validateInternalTransferQuote(request, { ...quote, assetDebit } as InternalTransferQuote, 1000)).toBe("invalid-quote");
  });

  it.each(["0", "000.000"])("accepts the explicit zero demo fee %s", amount => {
    expect(validateInternalTransferQuote(request, { ...quote, fee: { amount, symbol: "USDC" } }, 1000)).toBeNull();
  });

  it.each(["0.000000000000000001", "1", "-0", "0,0", " 0", "0.", null, 0])("rejects a nonzero or malformed demo fee %s", amount => {
    expect(validateInternalTransferQuote(request, { ...quote, fee: { amount, symbol: "USDC" } } as InternalTransferQuote, 1000)).toBe("invalid-quote");
  });

  it.each(["ETH", "usdc", "USDC ", ""])("requires the fee symbol to match the asset exactly: %s", symbol => {
    expect(validateInternalTransferQuote(request, { ...quote, fee: { amount: "0", symbol } }, 1000)).toBe("invalid-quote");
  });

  it.each([NaN, Infinity, -Infinity, "1000", null])("rejects invalid current time %s", now => {
    expect(validateInternalTransferQuote(request, quote, now as number)).toBe("invalid-quote");
  });

  it.each([NaN, Infinity, -Infinity, "2000", null])("rejects invalid expiry %s", expiresAt => {
    expect(validateInternalTransferQuote(request, { ...quote, expiresAt } as InternalTransferQuote, 1000)).toBe("invalid-quote");
  });

  it("expires at the exact boundary and after it", () => {
    expect(validateInternalTransferQuote(request, quote, 1999)).toBeNull();
    expect(validateInternalTransferQuote(request, quote, 2000)).toBe("expired-quote");
    expect(validateInternalTransferQuote(request, quote, 2001)).toBe("expired-quote");
  });
});
