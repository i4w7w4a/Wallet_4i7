import type { AmountTerms, CommerceIssue } from "./types";

const MAX_DECIMAL_LENGTH = 128;

function canonicalDecimal(value: string): string {
  const [integer = "", fraction = ""] = value.split(".");
  const whole = integer.replace(/^0+/, "") || "0";
  const significantFraction = fraction.replace(/0+$/, "");
  return significantFraction ? `${whole}.${significantFraction}` : whole;
}

export function normalizeCommerceAmount(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > MAX_DECIMAL_LENGTH) return null;
  const value = raw.trim().replace(",", ".");
  if (!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/u.test(value)) return null;
  return canonicalDecimal(value);
}

export function readCommerceDecimal(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_DECIMAL_LENGTH) return null;
  // Comparing the full match also rejects final line breaks accepted by JS's $ anchor.
  if (/^[0-9]+(?:\.[0-9]+)?$/u.exec(value)?.[0] !== value) return null;
  return canonicalDecimal(value);
}

function isCommercePrecision(decimals: number): boolean {
  return Number.isSafeInteger(decimals) && decimals >= 0 && decimals <= 36;
}

function decimalParts(value: string): { units: bigint; scale: number } {
  const canonical = readCommerceDecimal(value);
  if (canonical === null || canonical !== value) throw new RangeError("Expected a canonical commerce decimal");
  return { units: BigInt(value.replace(".", "")), scale: (value.split(".")[1] ?? "").length };
}

function alignedDecimals(left: string, right: string): { left: bigint; right: bigint; scale: number } {
  const a = decimalParts(left);
  const b = decimalParts(right);
  const scale = Math.max(a.scale, b.scale);
  return {
    left: a.units * 10n ** BigInt(scale - a.scale),
    right: b.units * 10n ** BigInt(scale - b.scale),
    scale,
  };
}

function decimalFromUnits(units: bigint, scale: number): string {
  const digits = units.toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  return canonicalDecimal(`${digits.slice(0, -scale)}.${digits.slice(-scale)}`);
}

export function compareCommerceDecimal(left: string, right: string): -1 | 0 | 1 {
  const aligned = alignedDecimals(left, right);
  return aligned.left < aligned.right ? -1 : aligned.left > aligned.right ? 1 : 0;
}

export function addCommerceDecimal(left: string, right: string): string {
  const aligned = alignedDecimals(left, right);
  return decimalFromUnits(aligned.left + aligned.right, aligned.scale);
}

export function multiplyCommerceDecimal(left: string, right: string, decimals: number): string {
  if (!isCommercePrecision(decimals)) throw new RangeError("Expected commerce precision from 0 to 36");
  const a = decimalParts(left);
  const b = decimalParts(right);
  const sourceScale = a.scale + b.scale;
  const outputScale = Math.min(sourceScale, decimals);
  const units = a.units * b.units / 10n ** BigInt(sourceScale - outputScale);
  return decimalFromUnits(units, outputScale);
}

export function validateCommerceAmount(
  raw: string,
  terms: AmountTerms,
): { valid: true; amount: string } | { valid: false; issue: CommerceIssue } {
  if (typeof terms !== "object" || terms === null || !isCommercePrecision(terms.decimals)) {
    return { valid: false, issue: { code: "unavailable" } };
  }
  const minimum = readCommerceDecimal(terms.minimum);
  const maximum = readCommerceDecimal(terms.maximum);
  if (minimum === null || maximum === null || maximum === "0"
    || (minimum.split(".")[1] ?? "").length > terms.decimals
    || (maximum.split(".")[1] ?? "").length > terms.decimals
    || compareCommerceDecimal(minimum, maximum) > 0) {
    return { valid: false, issue: { code: "unavailable" } };
  }

  const amount = normalizeCommerceAmount(raw);
  if (amount === null || amount === "0") return { valid: false, issue: { code: "invalid-amount" } };
  if ((amount.split(".")[1] ?? "").length > terms.decimals) {
    return { valid: false, issue: { code: "precision" } };
  }
  if (compareCommerceDecimal(amount, minimum) < 0) return { valid: false, issue: { code: "below-minimum" } };
  if (compareCommerceDecimal(amount, maximum) > 0) return { valid: false, issue: { code: "above-maximum" } };
  return { valid: true, amount };
}
