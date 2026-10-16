import type { ProductActionRoute } from "@wallet/core";
import type { SendIssue, SendIssueCode, SendQuote, SendRequest, SendTerms } from "./send-port";

// Monetary values never pass through Number or parseFloat.
export function normalizeDecimal(input: string): string | null {
  const text = input.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const [whole = "", fraction = ""] = text.split(".");
  const integer = whole.replace(/^0+/, "") || "0";
  const decimals = fraction.replace(/0+$/, "");
  return decimals ? `${integer}.${decimals}` : integer;
}

function compareDecimal(left: string, right: string): number {
  const [a, af = ""] = left.split("."), [b, bf = ""] = right.split(".");
  if (a!.length !== b!.length) return a!.length > b!.length ? 1 : -1;
  if (a !== b) return a! > b! ? 1 : -1;
  const width = Math.max(af.length, bf.length);
  const ac = af.padEnd(width, "0"), bc = bf.padEnd(width, "0");
  return ac === bc ? 0 : ac > bc ? 1 : -1;
}

export function sendRouteKey(route: ProductActionRoute): string {
  return JSON.stringify([route.action, route.accountId, route.accountKind, route.assetId, route.networkId]);
}

function requestKey(request: SendRequest): string {
  return JSON.stringify([sendRouteKey(request.route), request.recipient.address, request.recipient.memo ?? "", request.amount]);
}

export function validateAmount(input: string, terms: SendTerms):
  { valid: true; amount: string } | { valid: false; issue: SendIssue } {
  const fail = (code: SendIssueCode) => ({ valid: false as const, issue: { code } });
  const amount = normalizeDecimal(input);
  if (!amount || amount === "0") return fail("invalid-amount");
  if (!Number.isSafeInteger(terms.decimals) || terms.decimals < 0) return fail("unavailable");
  if ((amount.split(".")[1]?.length ?? 0) > terms.decimals) return fail("precision");
  const available = terms.available === null ? null : normalizeDecimal(terms.available);
  const minimum = terms.minimum === undefined ? null : normalizeDecimal(terms.minimum);
  const maximum = terms.maximum === undefined ? null : normalizeDecimal(terms.maximum);
  if ((terms.available !== null && available === null) ||
      (terms.minimum !== undefined && minimum === null) ||
      (terms.maximum !== undefined && maximum === null) ||
      (minimum !== null && maximum !== null && compareDecimal(minimum, maximum) > 0)) return fail("unavailable");
  if (minimum !== null && compareDecimal(amount, minimum) < 0) return fail("below-minimum");
  if (maximum !== null && compareDecimal(amount, maximum) > 0) return fail("above-maximum");
  if (available !== null && compareDecimal(amount, available) > 0) return fail("insufficient-asset");
  return { valid: true, amount };
}

export function validateQuote(request: SendRequest, quote: SendQuote, now: number): SendIssue | null {
  if (request.route.action !== "send") return { code: "unsupported-route" };
  if (quote.mode !== "demo" || !quote.id || !Number.isFinite(quote.expiresAt)) return { code: "invalid-quote" };
  if (requestKey(request) !== requestKey(quote.request)) return { code: "stale-quote" };
  if (quote.expiresAt <= now) return { code: "expired-quote" };
  const amount = validateAmount(request.amount, quote.terms);
  if (!amount.valid) return amount.issue;
  if (quote.terms.available === null) return { code: "unknown-available" };
  const debit = normalizeDecimal(quote.assetDebit);
  if (debit === null || compareDecimal(debit, amount.amount) < 0 ||
      (debit.split(".")[1]?.length ?? 0) > quote.terms.decimals) return { code: "invalid-quote" };
  if (compareDecimal(debit, normalizeDecimal(quote.terms.available)!) > 0) return { code: "insufficient-fee" };
  if (quote.networkFee.status !== "known") return { code: "unknown-fee" };
  if (!quote.networkFee.symbol || normalizeDecimal(quote.networkFee.amount) === null) return { code: "invalid-quote" };
  const funding = quote.feeFunding;
  if (funding.kind === "unknown") return { code: "unknown-fee" };
  if (funding.kind === "balance") return funding.status === "sufficient" ? null
    : { code: funding.status === "insufficient" ? "insufficient-fee" : "unknown-fee" };
  const { pool, charges } = funding;
  if (pool.action !== "send" || pool.networkId !== request.route.networkId ||
      !pool.eligibleAccountIds.includes(request.route.accountId) ||
      !Number.isSafeInteger(charges) || charges <= 0) return { code: "invalid-quote" };
  if (pool.remainingTransfers === "unknown") return { code: "unknown-fee" };
  if (!Number.isSafeInteger(pool.remainingTransfers) || pool.remainingTransfers < 0) return { code: "invalid-quote" };
  return pool.remainingTransfers < charges ? { code: "insufficient-fee" } : null;
}

export function sendIssueMessage(issue: SendIssue): string {
  const messages: Record<SendIssueCode, string> = {
    "unsupported-route": "Маршрут недоступен. Выберите другой счёт, актив или сеть.",
    "invalid-recipient": "Проверьте получателя и дополнительные реквизиты для этой сети.",
    "invalid-amount": "Введите положительную сумму без пробелов и разделителей тысяч.",
    "precision": "В сумме слишком много знаков после запятой для этого маршрута.",
    "below-minimum": "Сумма меньше минимальной для этого маршрута.",
    "above-maximum": "Сумма превышает лимит этого маршрута.",
    "insufficient-asset": "Недостаточно актива для выбранной суммы.",
    "insufficient-fee": "Недостаточно средств для комиссии. Выберите другую сумму или маршрут.",
    "unknown-available": "Доступный остаток неизвестен. Подтверждение пока недоступно.",
    "unknown-fee": "Комиссия неизвестна. Получите новый расчёт перед подтверждением.",
    "expired-quote": "Срок расчёта истёк. Рассчитайте комиссию заново.",
    "stale-quote": "Данные перевода изменились. Нужен новый расчёт.",
    "invalid-quote": "Расчёт нельзя подтвердить. Запросите его заново.",
    "unavailable": "Не удалось получить данные. Попробуйте ещё раз.",
  };
  return messages[issue.code];
}
