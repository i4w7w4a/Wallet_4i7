import { addCommerceDecimal, compareCommerceDecimal, multiplyCommerceDecimal, normalizeCommerceAmount, readCommerceDecimal, validateCommerceAmount } from "./decimal";
import type {
  BuyQuote, BuyRequest, BuyRoute, BuyRouteData, CommerceFee, CommerceFeeFunding,
  CommerceIssue, CommerceIssueCode, CommerceQuote, CommerceSimulation, CommerceUnit,
  CryptoPlacement, SwapQuote, SwapRequest, SwapRoute, SwapRouteData,
} from "./types";

const issue = (code: CommerceIssueCode): CommerceIssue => ({ code });
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonblank = (value: unknown): value is string => typeof value === "string" && value.length <= 256 && value.trim().length > 0;
const precision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 36;
const fields = ["accountId", "accountKind", "accountLabel", "assetId", "symbol", "name", "networkId", "networkLabel"] as const;

function placement(value: unknown): value is CryptoPlacement & Record<string, unknown> {
  return record(value) && fields.every(field => nonblank(value[field])) && value.accountId !== "all" &&
    ["custodial", "depositary", "private"].includes(value.accountKind as string);
}
function route(value: unknown, action: "buy" | "swap"): value is BuyRoute | SwapRoute {
  return placement(value) && record(value) && value.action === action;
}
function samePlacement(a: CryptoPlacement, b: CryptoPlacement): boolean {
  return fields.every(field => a[field] === b[field]);
}
function unit(value: unknown): value is CommerceUnit {
  return record(value) && precision(value.decimals) && (value.kind === "fiat" ? nonblank(value.currency) : value.kind === "crypto" && placement(value));
}
function unitId(value: CommerceUnit): string {
  return value.kind === "fiat" ? JSON.stringify([value.kind, value.currency])
    : JSON.stringify([value.kind, value.accountId, value.accountKind, value.assetId, value.networkId]);
}
function sameUnit(a: CommerceUnit, b: CommerceUnit): boolean {
  return a.kind === b.kind && a.decimals === b.decimals &&
    (a.kind === "fiat" && b.kind === "fiat" ? a.currency === b.currency
      : a.kind === "crypto" && b.kind === "crypto" && samePlacement(a, b));
}
function strictAmount(value: unknown, decimals: number, positive = false): string | null {
  const amount = readCommerceDecimal(value);
  return amount !== null && amount === value && (amount.split(".")[1]?.length ?? 0) <= decimals &&
    (!positive || amount !== "0") ? amount : null;
}
function routeBinding(value: BuyRoute | SwapRoute): unknown[] {
  return [value.action, ...fields.map(field => value[field])];
}
function buyRequestKey(value: BuyRequest): string | null {
  if (!record(value) || !route(value.route, "buy") || !nonblank(value.methodId) || !record(value.fiat) || !nonblank(value.fiat.currency)) return null;
  const amount = normalizeCommerceAmount(value.fiat.amount);
  return amount !== null && amount !== "0" ? JSON.stringify([routeBinding(value.route), value.methodId, value.fiat.currency, amount]) : null;
}
function swapRequestKey(value: SwapRequest): string | null {
  if (!record(value) || !route(value.route, "swap") || !nonblank(value.pairId) || !placement(value.destination)) return null;
  const amount = normalizeCommerceAmount(value.sourceAmount);
  return amount !== null && amount !== "0" ? JSON.stringify([routeBinding(value.route), value.pairId, fields.map(field => value.destination[field]), amount]) : null;
}

export function commerceRouteKey(value: BuyRoute | SwapRoute): string {
  return JSON.stringify([value.action, value.accountId, value.accountKind, value.assetId, value.networkId]);
}
export function commerceOperationId(quote: CommerceQuote, idempotencyKey: string): string {
  return record(quote) && nonblank(quote.portId) && nonblank(idempotencyKey)
    ? `demo-commerce:${JSON.stringify([quote.portId, idempotencyKey])}` : "";
}

export function validateBuyRequest(request: BuyRequest, data: BuyRouteData): CommerceIssue | null {
  try {
    if (!record(request) || !route(request.route, "buy") || !record(data) || !route(data.route, "buy") ||
        !samePlacement(request.route, data.route) || !unit(data.destination) || data.destination.kind !== "crypto" ||
        !samePlacement(request.route, data.destination)) return issue("unsupported-route");
    if (!Array.isArray(data.methods) || !nonblank(request.methodId) || !record(request.fiat)) return issue("unsupported-method");
    const methods = data.methods.filter(method => record(method) && method.id === request.methodId);
    const method = methods[0];
    if (methods.length !== 1 || !method || method.currency !== request.fiat.currency || !nonblank(method.label)) return issue("unsupported-method");
    const amount = validateCommerceAmount(request.fiat.amount, method.terms);
    return amount.valid ? null : amount.issue;
  } catch { return issue("unsupported-route"); }
}
export function validateSwapRequest(request: SwapRequest, data: SwapRouteData): CommerceIssue | null {
  try {
    if (!record(request) || !route(request.route, "swap") || !record(data) || !route(data.route, "swap") ||
        !samePlacement(request.route, data.route) || !unit(data.source) || data.source.kind !== "crypto" ||
        !samePlacement(request.route, data.source)) return issue("unsupported-route");
    if (!Array.isArray(data.pairs) || !nonblank(request.pairId) || !placement(request.destination)) return issue("unsupported-pair");
    const pairs = data.pairs.filter(pair => record(pair) && pair.id === request.pairId);
    const pair = pairs[0];
    if (pairs.length !== 1 || !pair || !unit(pair.destination) || pair.destination.kind !== "crypto" ||
        !samePlacement(request.destination, pair.destination) || request.route.assetId === request.destination.assetId ||
        request.route.networkId !== request.destination.networkId) return issue("unsupported-pair");
    const amount = validateCommerceAmount(request.sourceAmount, data.terms);
    return amount.valid ? null : amount.issue;
  } catch { return issue("unsupported-route"); }
}

function baseQuote(quote: CommerceQuote, kind: "buy" | "swap", now: number, expectedPortId: string): CommerceIssue | null {
  if (!record(quote) || quote.mode !== "demo" || quote.kind !== kind || !nonblank(quote.id) || !nonblank(quote.portId) ||
      !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(quote.expiresAt) || quote.expiresAt <= 0) return issue("invalid-quote");
  if (!nonblank(expectedPortId) || quote.portId !== expectedPortId) return issue("stale-quote");
  return quote.expiresAt <= now ? issue("expired-quote") : null;
}

function debitWithFee(input: CommerceUnit, principal: string, debit: string, fee: CommerceFee, funding: CommerceFeeFunding): CommerceIssue | null {
  if (!record(fee) || fee.status !== "known") return issue("unknown-fee");
  if (!unit(fee.unit) || strictAmount(fee.amount, fee.unit.decimals) === null) return issue("invalid-quote");
  if (!record(funding) || funding.kind === "unknown") return issue("unknown-funding");
  if (unitId(fee.unit) === unitId(input)) {
    return sameUnit(fee.unit, input) && funding.kind === "source" && debit === addCommerceDecimal(principal, fee.amount)
      ? null : issue("invalid-quote");
  }
  if (funding.kind !== "balance" || !unit(funding.unit) || !sameUnit(funding.unit, fee.unit) || debit !== principal) return issue("invalid-quote");
  const available = readCommerceDecimal(funding.available);
  if (available === null) return issue("unknown-funding");
  if (strictAmount(available, funding.unit.decimals) === null) return issue("invalid-quote");
  return compareCommerceDecimal(available, fee.amount) < 0 ? issue("insufficient-fee") : null;
}
function creditMatches(quote: CommerceQuote, principal: string, destination: CryptoPlacement): boolean {
  const credit = quote.credit;
  if (!unit(credit) || credit.kind !== "crypto" || !samePlacement(credit, destination) ||
      strictAmount(credit.quantity, credit.decimals, true) === null || !record(quote.rate) || !nonblank(quote.rate.label)) return false;
  const rate = readCommerceDecimal(quote.rate.outputPerInput);
  return rate !== null && rate !== "0" && rate === quote.rate.outputPerInput &&
    credit.quantity === multiplyCommerceDecimal(principal, rate, credit.decimals);
}

export function validateBuyQuote(request: BuyRequest, quote: BuyQuote, now: number, expectedPortId: string): CommerceIssue | null {
  try {
    const base = baseQuote(quote, "buy", now, expectedPortId);
    if (base) return base;
    const key = buyRequestKey(request);
    if (key === null) return issue("invalid-amount");
    if (key !== buyRequestKey(quote.request)) return issue("stale-quote");
    const amount = validateCommerceAmount(request.fiat.amount, quote.terms);
    if (!amount.valid) return amount.issue;
    if (quote.request.fiat.amount !== amount.amount || !unit(quote.payment) || quote.payment.kind !== "fiat" ||
        quote.payment.currency !== request.fiat.currency || quote.payment.decimals !== quote.terms.decimals ||
        quote.payment.amount !== amount.amount || !unit(quote.debit) || quote.debit.kind !== "fiat" ||
        !sameUnit(quote.payment, quote.debit) || strictAmount(quote.debit.amount, quote.debit.decimals, true) === null ||
        !creditMatches(quote, amount.amount, request.route)) return issue("invalid-quote");
    const fee = debitWithFee(quote.payment, amount.amount, quote.debit.amount, quote.fee, quote.feeFunding);
    if (fee) return fee;
    if (!record(quote.funding) || quote.funding.kind !== "external-demo" || quote.funding.methodId !== request.methodId ||
        quote.funding.currency !== request.fiat.currency) return issue("invalid-quote");
    const available = readCommerceDecimal(quote.funding.available);
    if (available === null) return issue("unknown-funding");
    if (strictAmount(available, quote.terms.decimals) === null) return issue("invalid-quote");
    return compareCommerceDecimal(available, quote.debit.amount) < 0 ? issue("insufficient-funding") : null;
  } catch { return issue("invalid-quote"); }
}
export function validateSwapQuote(request: SwapRequest, quote: SwapQuote, now: number, expectedPortId: string): CommerceIssue | null {
  try {
    const base = baseQuote(quote, "swap", now, expectedPortId);
    if (base) return base;
    const key = swapRequestKey(request);
    if (key === null) return issue("invalid-amount");
    if (key !== swapRequestKey(quote.request)) return issue("stale-quote");
    if (request.route.assetId === request.destination.assetId || request.route.networkId !== request.destination.networkId) return issue("unsupported-pair");
    const amount = validateCommerceAmount(request.sourceAmount, quote.terms);
    if (!amount.valid) return amount.issue;
    if (quote.request.sourceAmount !== amount.amount || !unit(quote.source) || quote.source.kind !== "crypto" ||
        !samePlacement(quote.source, request.route) || quote.source.decimals !== quote.terms.decimals || quote.source.quantity !== amount.amount ||
        !unit(quote.debit) || quote.debit.kind !== "crypto" || !sameUnit(quote.source, quote.debit) ||
        strictAmount(quote.debit.quantity, quote.debit.decimals, true) === null || !creditMatches(quote, amount.amount, request.destination)) return issue("invalid-quote");
    const available = readCommerceDecimal(quote.terms.available);
    if (available === null) return issue("unknown-available");
    if (strictAmount(available, quote.terms.decimals) === null) return issue("invalid-quote");
    if (compareCommerceDecimal(available, amount.amount) < 0) return issue("insufficient-asset");
    const fee = debitWithFee(quote.source, amount.amount, quote.debit.quantity, quote.fee, quote.feeFunding);
    if (fee) return fee;
    return compareCommerceDecimal(available, quote.debit.quantity) < 0 ? issue("insufficient-fee") : null;
  } catch { return issue("invalid-quote"); }
}

/** Bounded structural comparison ignores property order, never monetary fields. */
export function sameCommerceData(a: unknown, b: unknown, depth = 0): boolean {
  if (Object.is(a, b)) return true;
  if (depth > 12 || !record(a) || !record(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameCommerceData(a[key], b[key], depth + 1));
}
export function validateCommerceSimulation(acceptedQuote: CommerceQuote, simulation: CommerceSimulation, idempotencyKey: string): CommerceIssue | null {
  try {
    if (!record(acceptedQuote) || !record(simulation) || simulation.mode !== "demo" || simulation.kind !== acceptedQuote.kind ||
        !nonblank(idempotencyKey) || simulation.idempotencyKey !== idempotencyKey ||
        simulation.simulationId !== commerceOperationId(acceptedQuote, idempotencyKey) || !sameCommerceData(acceptedQuote, simulation.quote) ||
        !record(simulation.result) || simulation.result.mode !== "demo") return issue("invalid-result");
    const acceptedIssue = acceptedQuote.kind === "buy"
      ? validateBuyQuote(acceptedQuote.request, acceptedQuote, acceptedQuote.expiresAt - 1, acceptedQuote.portId)
      : acceptedQuote.kind === "swap" ? validateSwapQuote(acceptedQuote.request, acceptedQuote, acceptedQuote.expiresAt - 1, acceptedQuote.portId) : issue("invalid-quote");
    if (acceptedIssue) return issue("invalid-result");
    return simulation.result.status === "simulated-success" ||
      (simulation.result.status === "simulated-failure" && ["rejected", "expired", "unavailable"].includes(simulation.result.reason))
      ? null : issue("invalid-result");
  } catch { return issue("invalid-result"); }
}

export function commerceIssueMessage(value: CommerceIssue): string {
  const messages: Record<CommerceIssueCode, string> = {
    "unsupported-route": "Этот счёт, актив или сеть недоступны для симуляции.",
    "unsupported-method": "Демо-способ оплаты недоступен. Выберите предложенный способ.",
    "unsupported-pair": "Эта пара недоступна. Выберите предложенное направление обмена.",
    "invalid-amount": "Введите положительную сумму без разделителей тысяч.",
    "precision": "Для этой суммы слишком много знаков после запятой.",
    "below-minimum": "Сумма меньше демонстрационного минимума.",
    "above-maximum": "Сумма превышает демонстрационный лимит.",
    "unknown-available": "Доступный остаток неизвестен. Подтверждение недоступно.",
    "insufficient-asset": "Доступного остатка не хватает для этой суммы.",
    "unknown-funding": "Средства для оплаты или комиссии неизвестны. Нужен новый расчёт.",
    "insufficient-funding": "Демонстрационного лимита оплаты не хватает на сумму и комиссию.",
    "unknown-fee": "Комиссия неизвестна. Нужен новый расчёт.",
    "insufficient-fee": "Остатка не хватает на сумму вместе с комиссией.",
    "stale-quote": "Данные изменились. Получите новый расчёт.",
    "expired-quote": "Срок расчёта истёк. Получите новый расчёт.",
    "invalid-quote": "Расчёт нельзя подтвердить. Попробуйте получить его заново.",
    "invalid-result": "Ответ не совпал с принятой симуляцией. Результат не сохранён.",
    "unavailable": "Не удалось получить данные. Попробуйте ещё раз.",
    "rejected": "Симуляция отклонена. Получите новый расчёт для новой попытки.",
  };
  return messages[value.code] ?? messages.unavailable;
}
