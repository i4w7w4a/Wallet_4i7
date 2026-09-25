import type { CreateResult, GpuLimits } from "../../contracts";
import type { MaterialInit, MaterialResourcePlan, MaterialTargetGeometry } from "../../material-contract";
import { parseVaultGridParams, type VaultGridParams } from "./schema";

export function resolveVaultGridTarget(geometry: MaterialTargetGeometry, limits: GpuLimits): {
  width: number; height: number; bytes: number;
} | null {
  const width = geometry.pixelWidth;
  const height = geometry.pixelHeight;
  const bytes = width * height * 4;
  if (![width, height].every((size) => Number.isSafeInteger(size) && size > 0)
    || ![geometry.width, geometry.height, geometry.dpr].every((size) => Number.isFinite(size) && size > 0)
    || ![geometry.x, geometry.y].every(Number.isFinite)
    || !Number.isFinite(limits.maxTextureSize) || !Number.isFinite(limits.maxRenderTargetBytes)
    || width > limits.maxTextureSize || height > limits.maxTextureSize
    || !Number.isSafeInteger(bytes) || bytes > limits.maxRenderTargetBytes) return null;
  return { width, height, bytes };
}

export function planVaultGridMaterial(init: MaterialInit<VaultGridParams, null>): CreateResult<MaterialResourcePlan> {
  if (!parseVaultGridParams(init.params) || !Number.isSafeInteger(init.seed) || init.seed < 0 || init.seed > 0xffffffff
    || init.prepared !== null || !["background", "button-fill"].includes(init.geometry.capability)
    || init.geometry.mask.kind !== "rounded-rect") {
    return { ok: false, error: { code: "invalid-config", message: "Некорректная конфигурация или цель vault-grid." } };
  }
  const target = resolveVaultGridTarget(init.geometry, init.limits);
  if (!target) {
    return { ok: false, error: { code: "budget-exceeded", message: "Vault-grid не помещается в выделенный GPU-бюджет." } };
  }
  return { ok: true, value: {
    attachmentBytes: target.bytes,
    textureBytes: 0,
    passesPerFrame: 1,
    quality: "RGBA8 · one pass",
  } };
}
