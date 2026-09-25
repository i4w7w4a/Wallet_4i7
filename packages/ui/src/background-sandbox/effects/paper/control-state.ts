import type { MaterialCapability } from "../../material-contract";
import type { GemSmokeParams, HeatmapParams, LiquidMetalParams, PulsingBorderParams } from "./schema";

/** Parameter dependencies from pinned Paper shader branches. The UI can mark these inactive. */
export function disabledPaperControls(kind: "liquid-metal", params: LiquidMetalParams, capability?: MaterialCapability): readonly string[];
export function disabledPaperControls(kind: "pulsing-border", params: PulsingBorderParams, capability?: MaterialCapability): readonly string[];
export function disabledPaperControls(kind: "gem-smoke", params: GemSmokeParams, capability?: MaterialCapability): readonly string[];
export function disabledPaperControls(kind: "heatmap", params: HeatmapParams, capability?: MaterialCapability): readonly string[];
export function disabledPaperControls(kind: "liquid-metal" | "pulsing-border" | "gem-smoke" | "heatmap",
  params: LiquidMetalParams | PulsingBorderParams | GemSmokeParams | HeatmapParams,
  capability?: MaterialCapability): readonly string[];
export function disabledPaperControls(
  kind: "liquid-metal" | "pulsing-border" | "gem-smoke" | "heatmap",
  params: LiquidMetalParams | PulsingBorderParams | GemSmokeParams | HeatmapParams,
  capability?: MaterialCapability,
): readonly string[] {
  const target = capability === "button-icon" && (kind === "liquid-metal" || kind === "gem-smoke") ? ["shape"] : [];
  if (kind === "pulsing-border") return (params as PulsingBorderParams).smoke === 0 ? ["smokeSize"] : [];
  if (kind === "gem-smoke") {
    const p = params as GemSmokeParams;
    return [
      ...target,
      ...(p.innerGlow === 0 ? ["innerDistortion", "offset"] : []),
      ...(p.outerGlow === 0 ? ["outerDistortion"] : []),
    ];
  }
  if (kind === "heatmap") {
    const p = params as HeatmapParams;
    return p.innerGlow === 0 && p.outerGlow === 0 ? ["angle"] : [];
  }
  return target;
}
