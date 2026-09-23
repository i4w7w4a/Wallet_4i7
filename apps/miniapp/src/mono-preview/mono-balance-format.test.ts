import { describe, expect, it } from "vitest";
import { formatMonoMoney, formatMonoPercent } from "./mono-balance-format";

describe("formatMonoMoney", () => {
  it.each([
    ["ru-RU", "USD", 12840.75, "12\u00a0840,75\u00a0$", "75"],
    ["en-US", "USD", -12840.75, "-$12,840.75", "75"],
    ["de-DE", "EUR", 1234.5, "1.234,50\u00a0€", "50"],
    ["ja-JP", "JPY", 12840, "￥12,840", undefined],
    ["en-US", "KWD", 12840.751, "KWD\u00a012,840.751", "751"],
    ["en-IN", "INR", 1234567.89, "₹12,34,567.89", "89"],
  ])("preserves the Intl currency order, grouping and precision for %s/%s", (locale, currency, value, expected, fraction) => {
    const result = formatMonoMoney(value, { locale, currency });
    expect(result.formatted).toBe(expected);
    expect(result.parts.map((part) => part.value).join("")).toBe(expected);
    expect(result.parts.find((part) => part.type === "fraction")?.value).toBe(fraction);
  });

  it("retains an exact integer beyond the safe Number range", () => {
    expect(formatMonoMoney(9007199254740993n, { locale: "en-US", currency: "USD" }).formatted)
      .toBe("$9,007,199,254,740,993.00");
  });

  it("honors supplied display precision without rounding the input first", () => {
    const result = formatMonoMoney(0.123456, {
      locale: "en-US", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 6,
    });
    expect(result.formatted).toBe("$0.123456");
    expect(result.accessibleLabel).toBe("0.123456 US dollars");
  });

  it("keeps the negative-zero sign instead of silently changing the financial value", () => {
    expect(formatMonoMoney(-0, { locale: "en-US", currency: "USD" }).formatted).toBe("-$0.00");
  });

  it.each([NaN, Infinity, -Infinity])("marks non-finite money unavailable, never as a zero balance", (value) => {
    const result = formatMonoMoney(value, { locale: "ru-RU", currency: "USD" });
    expect(result.formatted).toBe("—");
    expect(result.accessibleLabel).toBe("Сумма недоступна");
  });
});

describe("formatMonoPercent", () => {
  it.each([[2.34, "+2,34 %"], [-2.8, "-2,8 %"], [0, "0 %"]])(
    "treats %s as percentage points, with an explicit signed direction", (value, expected) => {
      expect(formatMonoPercent(value, "ru-RU").replaceAll("\u00a0", " ")).toBe(expected);
    },
  );
});
