import type { ControlFeedbackPreset } from "../../design-lab/control-feedback-model";

/** The lab's material depth and return also govern the real wallet card; magnetic travel stays on quick actions. */
export function cardMotionVariables(preset: Pick<ControlFeedbackPreset, "effectId" | "config">): Record<string, string> {
  const material = preset.effectId === "material";
  return { "--motion-linked-card": `${preset.effectId === "baseline" ? 0 : preset.config.settleMs}ms`,
    "--motion-card-press": material ? String(preset.config.pressDepth / 30) : "0",
    "--motion-card-edge-opacity": material ? "1" : "0" };
}
