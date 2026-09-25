import type { CreateResult } from "./contracts";
import type { MaterialResourcePlan } from "./material-contract";

export type MaterialSceneBudget = Readonly<{
  materialBytes: number;
  promoReserveBytes: number;
  totalBytes: number;
  passesPerFrame: number;
}>;

export function planMaterialSceneBudget(
  plans: readonly MaterialResourcePlan[], iconMaskBytes: number,
): CreateResult<MaterialSceneBudget> {
  const promoReserveBytes = 4 * 1024 * 1024;
  const nonnegative = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!nonnegative(iconMaskBytes) || plans.some(plan => !nonnegative(plan.attachmentBytes) ||
      !nonnegative(plan.textureBytes) || !Number.isSafeInteger(plan.passesPerFrame) || plan.passesPerFrame < 1)) {
    return { ok: false, error: { code: "invalid-config", message: "План материала содержит некорректный размер или число проходов." } };
  }
  const materialBytes = plans.reduce((bytes, plan) => bytes + plan.attachmentBytes + plan.textureBytes, iconMaskBytes);
  if (!Number.isSafeInteger(materialBytes)) return { ok: false, error: {
    code: "invalid-config", message: "Сумма ресурсов материала некорректна.",
  } };
  if (materialBytes + promoReserveBytes > 32 * 1024 * 1024) return { ok: false, error: {
    code: "budget-exceeded", message: "Материалы, маски и Promo превышают общий GPU-бюджет 32 MiB.",
  } };
  return { ok: true, value: {
    materialBytes, promoReserveBytes, totalBytes: materialBytes + promoReserveBytes,
    passesPerFrame: plans.reduce((passes, plan) => passes + plan.passesPerFrame, 0),
  } };
}
