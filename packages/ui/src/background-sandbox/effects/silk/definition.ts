import type { Definition } from "../../contracts";
import { createSilkEffect } from "./adapter";
import { SILK_BASELINE, SILK_VARIANTS, silkSchema, type SilkParams } from "./schema";

export const silkDefinition: Definition<"silk", SilkParams> = {
  id: "silk",
  abiVersion: 1,
  configVersion: 1,
  label: "Silk",
  description: "Три слоя шёлка, проявленные направленным светом. Указатель меняет свет, а не растягивает ткань.",
  schema: silkSchema,
  presets: [
    ...SILK_VARIANTS.map((variant) => ({ ...variant, seed: 0 })),
    { id: "radiant-baseline", label: "Radiant · исходный характер", seed: 0, params: SILK_BASELINE },
  ],
  assetIds: [],
  provenance: {
    id: "radiant-silk-cascade-59e9f48-v1",
    sourceUrl: "https://github.com/pbakaus/radiant/blob/59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40/static/silk-cascade.html",
    revision: "59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40",
    license: "MIT · Copyright (c) 2025 Paul Bakaus",
    changes: [
      "OGL/WebGL2 pass на host context, вывод в собственный RGBA8 target.",
      "Пять параметров, две подготовленные палитры и исходный baseline.",
      "Непрерывная фаза и сглаживание света в секундах; определённый reset(seed).",
      "Demo UI, scheduling и listeners удалены; lifecycle принадлежит host.",
    ],
  },
  fallback: { color: "#14171b", label: "Silk недоступен · статический фон" },
  create: createSilkEffect,
};
