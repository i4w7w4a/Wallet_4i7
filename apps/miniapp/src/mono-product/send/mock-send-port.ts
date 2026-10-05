import { MULTI_ACCOUNT_DEMO, resolveActionRoutes, resolveBatteryCoverage, type ProductSnapshot } from "@wallet/core";
import type { SendCallOptions, SendPort, SendRequest, SendRouteData } from "./send-port";
import { normalizeDecimal, sendRouteKey, validateAmount, validateQuote } from "./send-validation";

// Synthetic UI scenarios only. These numbers are neither tariffs nor universal network rules.
const scenarios: Record<string, { decimals: number; fee: string; feeSymbol: string; sourceFee: boolean; battery: boolean }> = {
  "btc:bitcoin": { decimals: 8, fee: "0.00001", feeSymbol: "BTC", sourceFee: true, battery: false },
  "eth:ethereum": { decimals: 18, fee: "0.0001", feeSymbol: "ETH", sourceFee: true, battery: false },
  "usdc:ethereum": { decimals: 6, fee: "0.0001", feeSymbol: "ETH", sourceFee: false, battery: true },
  "usdc:solana": { decimals: 6, fee: "0.000005", feeSymbol: "SOL", sourceFee: false, battery: false },
};

function pause(milliseconds: number, { signal }: SendCallOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function addMockFee(amount: string, fee: string, decimals: number): string {
  const units = (input: string) => {
    const [whole, fraction = ""] = input.split(".");
    return BigInt(`${whole}${fraction.padEnd(decimals, "0")}`);
  };
  const sum = (units(amount) + units(fee)).toString().padStart(decimals + 1, "0");
  return normalizeDecimal(decimals ? `${sum.slice(0, -decimals)}.${sum.slice(-decimals)}` : sum)!;
}

function validDemoRecipient(request: Pick<SendRequest, "recipient">): boolean {
  return /^demo:[a-z0-9_-]{1,40}$/i.test(request.recipient.address) && !request.recipient.memo;
}

export function createMockSendPort(snapshot: ProductSnapshot = MULTI_ACCOUNT_DEMO): SendPort {
  let quoteSequence = 0;
  const routeData: SendPort["loadRoute"] = async (route, { signal }) => {
    if (signal.aborted || route.action !== "send") return null;
    const supported = resolveActionRoutes(snapshot, { kind: "account", accountId: route.accountId }, "send")
      .routes.some(candidate => sendRouteKey(candidate) === sendRouteKey(route));
    const scenario = scenarios[`${route.assetId}:${route.networkId}`];
    if (!supported || !scenario) return null;
    const holding = snapshot.holdings.find(item => item.accountId === route.accountId &&
      item.assetId === route.assetId && item.networkId === route.networkId);
    const data: SendRouteData = {
      terms: { decimals: scenario.decimals, available: holding?.availableQuantity ?? null },
      recipient: { label: "Получатель", placeholder: "demo:recipient",
        hint: "Неплатёжный пример. Реальные адреса здесь не используются." },
    };
    return data;
  };

  return {
    mode: "demo",
    loadRoute: routeData,
    async validateRecipient(_route, recipient, { signal }) {
      const clean = { address: recipient.address.trim(), ...(recipient.memo ? { memo: recipient.memo.trim() } : {}) };
      return !signal.aborted && validDemoRecipient({ recipient: clean })
        ? { valid: true, recipient: clean } : { valid: false };
    },
    async quote(request, options) {
      await pause(240, options);
      const data = await routeData(request.route, options);
      if (!data) return { status: "unavailable", issue: { code: "unsupported-route" } };
      if (!validDemoRecipient(request)) return { status: "unavailable", issue: { code: "invalid-recipient" } };
      const amount = validateAmount(request.amount, data.terms);
      if (!amount.valid) return { status: "unavailable", issue: amount.issue };
      if (data.terms.available === null) return { status: "unavailable", issue: { code: "unknown-available" } };
      const scenario = scenarios[`${request.route.assetId}:${request.route.networkId}`]!;
      const coverage = resolveBatteryCoverage(snapshot.batteryPools, request.route);
      const pool = scenario.battery && coverage.status === "covered" ? coverage.pool : null;
      const quote = {
        mode: "demo" as const, id: `demo-quote-${++quoteSequence}`, request, expiresAt: Date.now() + 60_000,
        terms: data.terms,
        assetDebit: scenario.sourceFee && !pool ? addMockFee(amount.amount, scenario.fee, scenario.decimals) : amount.amount,
        networkFee: { status: "known" as const, amount: scenario.fee, symbol: scenario.feeSymbol },
        feeFunding: pool ? { kind: "battery" as const, pool, charges: 1 }
          : { kind: "balance" as const, status: "sufficient" as const },
      };
      const issue = validateQuote(request, quote, Date.now());
      return issue ? { status: "unavailable", issue } : { status: "quoted", quote };
    },
    async send({ quote }, options) {
      const issue = validateQuote(quote.request, quote, Date.now());
      if (issue) return { mode: "demo", status: "simulated-failure", reason: issue.code === "expired-quote" ? "expired" : "rejected" };
      await pause(700, options);
      // No network call, signing, account mutation, or transaction hash.
      return { mode: "demo", status: "simulated-success" };
    },
  };
}

export const mockSendPort: SendPort = createMockSendPort();
