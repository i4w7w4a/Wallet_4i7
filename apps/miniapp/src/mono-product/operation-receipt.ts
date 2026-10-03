export type SendQuoteReceipt = {
  assetDebit: string;
  networkFee: { status: "unknown" } | { status: "known"; amount: string; symbol: string };
  feeFunding: { kind: "unknown" } | { kind: "balance" }
    | { kind: "battery"; poolId: string; networkLabel: string; charges: number };
  estimatedCompletionSeconds?: number | null;
};

/** Public receipt data only; never spread a quote, a request, or a whole pool. */
export function normalizeOperationReceipt(input: unknown): SendQuoteReceipt | undefined {
  if (!isRecord(input) || !isPlainDecimal(input.assetDebit) ||
      !isRecord(input.networkFee) || !isRecord(input.feeFunding)) return undefined;

  const fee = input.networkFee;
  let networkFee: SendQuoteReceipt["networkFee"];
  if (fee.status === "unknown") networkFee = { status: "unknown" };
  else if (fee.status === "known" && isPlainDecimal(fee.amount) && isNonblankText(fee.symbol)) {
    networkFee = { status: "known", amount: fee.amount, symbol: fee.symbol };
  } else return undefined;

  const funding = input.feeFunding;
  let feeFunding: SendQuoteReceipt["feeFunding"];
  if (funding.kind === "unknown" || funding.kind === "balance") feeFunding = { kind: funding.kind };
  else if (funding.kind === "battery" && isNonblankText(funding.poolId) && isNonblankText(funding.networkLabel) &&
      typeof funding.charges === "number" && Number.isSafeInteger(funding.charges) && funding.charges > 0) {
    feeFunding = { kind: "battery", poolId: funding.poolId, networkLabel: funding.networkLabel, charges: funding.charges };
  } else return undefined;

  const receipt: SendQuoteReceipt = { assetDebit: input.assetDebit, networkFee, feeFunding };
  const eta = input.estimatedCompletionSeconds;
  if (eta !== undefined) receipt.estimatedCompletionSeconds =
    typeof eta === "number" && Number.isFinite(eta) && eta >= 0 ? eta : null;
  return receipt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainDecimal(value: unknown): value is string {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
}

function isNonblankText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
