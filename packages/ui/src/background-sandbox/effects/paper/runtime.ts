import type { CreateResult } from "../../contracts";
import type { MaterialResourcePlan } from "../../material-contract";

export function toPaperRgba(hex: string): [number, number, number, number] {
  if (!/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(hex)) throw new RangeError("Invalid Paper color.");
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
    hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  ];
}

/** Host active time is consumed incrementally; changing speed leaves the phase continuous. */
export function advancePaperClock(
  currentSeconds: number, dt: number, speed: number, nextPhaseMs: number, previousPhaseMs: number,
): number {
  return currentSeconds + Math.max(0, dt) * speed + (nextPhaseMs - previousPhaseMs) / 1000;
}

export function planPaperPass(input: Readonly<{
  width: number; height: number; textureBytes: number;
  maxTextureSize: number; maxRenderTargetBytes: number;
}>): CreateResult<MaterialResourcePlan> {
  const { width, height, textureBytes, maxTextureSize, maxRenderTargetBytes } = input;
  const attachmentBytes = width * height * 4;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width > maxTextureSize || height > maxTextureSize || !Number.isSafeInteger(textureBytes) || textureBytes < 0 ||
      !Number.isSafeInteger(attachmentBytes) || attachmentBytes > maxRenderTargetBytes) {
    return { ok: false, error: { code: "budget-exceeded", message: "Paper pass exceeds its RGBA8 target or texture budget." } };
  }
  return { ok: true, value: {
    attachmentBytes, textureBytes, passesPerFrame: 1,
    quality: "Paper GLSL300 · single RGBA8 pass",
  } };
}
