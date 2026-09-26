import type { ButtonTargetId, MaterialTargetBinding } from "@wallet/ui";

export type MonoActionFrameMode = "group" | "separate" | "icons";

/** The saved document remains complete; visibility is decided only for the active renderer. */
export function visibleActionBindings(mode: MonoActionFrameMode, bindings: readonly MaterialTargetBinding[]): readonly MaterialTargetBinding[] {
  return mode === "icons" ? bindings.filter(binding => binding.layer === "icon") : bindings;
}

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
