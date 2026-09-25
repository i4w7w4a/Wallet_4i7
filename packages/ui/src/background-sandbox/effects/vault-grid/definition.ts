import type { MaterialDefinition } from "../../material-contract";
import { createVaultGridMaterial } from "./adapter";
import { VAULT_GRID_PRESETS, vaultGridSchema, type VaultGridParams } from "./schema";
import { planVaultGridMaterial } from "./target";

export const vaultGridDefinition: MaterialDefinition<"vault-grid", VaultGridParams, null> = {
  id: "vault-grid",
  abiVersion: 2,
  effectVersion: 1,
  label: "Vault Grid",
  description: "Квадратные плиты, ортогональные рёбра и гравированная сетка с настоящим процедурным рельефом.",
  capabilities: ["background", "button-fill"],
  schema: vaultGridSchema,
  presets: VAULT_GRID_PRESETS.map((preset) => ({ ...preset, seed: 0 })),
  assetIds: [],
  provenance: {
    id: "novex-vault-grid-original-v1",
    sourceUrl: "local:packages/ui/src/background-sandbox/effects/vault-grid/shaders.ts",
    revision: "original-wave2-2026-09-25",
    license: "Original Novex Wallet code; no borrowed shader or visual asset",
    changes: [
      "Оригинальные профили плит, рёбер и гравировки в одном GLSL300 pass.",
      "Геометрия в CSS-пикселях; нормаль из высоты, направленный свет и шероховатость.",
      "Непрозрачный RGBA8 output для общего host; canvas, RAF и target clipping принадлежат host.",
    ],
  },
  fallback: { color: "#111820", label: "Vault Grid недоступен · статическая поверхность" },
  plan: planVaultGridMaterial,
  create: createVaultGridMaterial,
};
