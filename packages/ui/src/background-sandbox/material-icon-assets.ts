import type { ButtonTargetId, MaterialAssetId } from "./material-contract";
import { BUTTON_MASK_ASSETS } from "./target-binding";

/** The four existing MONO action strokes are the entire material icon allowlist. */
export const MATERIAL_ICON_PATHS: Readonly<Record<MaterialAssetId, string>> = Object.freeze({
  "mono.quick.send": "M5 18 19 4M8 4h11v11",
  "mono.quick.receive": "M19 6 5 20M16 20H5V9",
  "mono.quick.swap": "M4 8h16m0 0-4-4m4 4-4 4M20 16H4m0 0 4-4m-4 4 4 4",
  "mono.quick.buy": "M12 4v16M4 12h16",
});

export function monoActionIconPath(targetId: ButtonTargetId): string {
  return MATERIAL_ICON_PATHS[BUTTON_MASK_ASSETS[targetId]];
}
