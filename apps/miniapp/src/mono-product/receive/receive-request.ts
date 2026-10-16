import type { DemoReceiveReference } from "./receive-types";

export const RECEIVE_REQUEST_AMOUNT_MAX_LENGTH = 128;
export const RECEIVE_REQUEST_MARKER = "ДЕМОНСТРАЦИЯ — НЕ ДЛЯ ОПЛАТЫ";

export type NormalizedReceiveRequestAmount =
  | { status: "empty"; amount: null }
  | { status: "valid"; amount: string }
  | { status: "invalid"; reason: "too-long" | "format" | "non-positive" };

export type ReceiveRequestTextInput = {
  symbol: string;
  networkLabel: string;
  reference: DemoReceiveReference;
  rawAmount: string;
};

/** Text-only normalization: no token precision, arithmetic, rounding, or float conversion. */
export function normalizeReceiveRequestAmount(raw: string): NormalizedReceiveRequestAmount {
  if (raw.length > RECEIVE_REQUEST_AMOUNT_MAX_LENGTH) return { status: "invalid", reason: "too-long" };
  const value = raw.trim().replace(",", ".");
  if (!value) return { status: "empty", amount: null };
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return { status: "invalid", reason: "format" };
  const [integerPart = "", decimalPart = ""] = value.split(".");
  const integer = integerPart.replace(/^0+/, "") || "0";
  const decimal = decimalPart.replace(/0+$/, "");
  if (integer === "0" && !decimal) return { status: "invalid", reason: "non-positive" };
  return { status: "valid", amount: decimal ? `${integer}.${decimal}` : integer };
}

export function buildReceiveRequestText({ symbol, networkLabel, reference, rawAmount }: ReceiveRequestTextInput): string | null {
  const normalized = normalizeReceiveRequestAmount(rawAmount);
  if (normalized.status === "invalid" || !/^DEMO-NON-PAYABLE:\S+$/.test(reference)) return null;
  return [RECEIVE_REQUEST_MARKER, `Актив: ${symbol}`, `Сеть: ${networkLabel}`,
    ...(normalized.amount ? [`Желаемая сумма: ${normalized.amount} ${symbol}`] : []),
    "Реквизиты:", reference,
  ].join("\n");
}
