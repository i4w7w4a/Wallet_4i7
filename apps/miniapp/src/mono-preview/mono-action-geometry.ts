import type { ButtonTargetId, MaterialTargetBinding } from "@wallet/ui";

/** Match the fallback DOM silhouette to the outermost enabled material layer. */
export function actionButtonRadii(bindings: readonly MaterialTargetBinding[]): Partial<Record<ButtonTargetId, number>> {
  const radii: Partial<Record<ButtonTargetId, number>> = {};
  for (const layer of ["fill", "border"] as const) {
    for (const binding of bindings) {
      if (binding.enabled && binding.layer === layer && binding.mask.kind === "rounded-rect")
        radii[binding.targetId] = binding.radiusCss;
    }
  }
  return radii;
}
