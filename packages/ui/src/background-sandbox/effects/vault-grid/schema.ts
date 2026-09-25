import type { ParameterSchema } from "../../contracts";

export type VaultGridPattern = "tile" | "rib" | "engraved";

export interface VaultGridParams {
  pattern: VaultGridPattern;
  cellSize: number;
  lineWidth: number;
  bevel: number;
  depth: number;
  roughness: number;
  lightAngle: number;
  lightElevation: number;
  lightStrength: number;
  baseColor: string;
  metalColor: string;
  drift: number;
}

export const VAULT_GRID_BOUNDS = Object.freeze({
  cellSize: Object.freeze({ min: 36, max: 128, step: 2 }),
  lineWidth: Object.freeze({ min: 1, max: 10, step: 0.5 }),
  bevel: Object.freeze({ min: 0.5, max: 12, step: 0.5 }),
  depth: Object.freeze({ min: 0.1, max: 2, step: 0.05 }),
  roughness: Object.freeze({ min: 0.08, max: 1, step: 0.01 }),
  lightAngle: Object.freeze({ min: -180, max: 180, step: 1 }),
  lightElevation: Object.freeze({ min: 15, max: 80, step: 1 }),
  lightStrength: Object.freeze({ min: 0.2, max: 2, step: 0.05 }),
  drift: Object.freeze({ min: -0.05, max: 0.05, step: 0.001 }),
});

export const VAULT_GRID_PATTERNS = Object.freeze([
  { value: "tile", label: "Плиты с фаской" },
  { value: "rib", label: "Ортогональные рёбра" },
  { value: "engraved", label: "Гравированная сетка" },
] as const);

export const VAULT_GRID_DEFAULTS: Readonly<VaultGridParams> = Object.freeze({
  pattern: "tile", cellSize: 62, lineWidth: 4, bevel: 6, depth: 1.25,
  roughness: 0.38, lightAngle: -35, lightElevation: 45, lightStrength: 1.1,
  baseColor: "#111820", metalColor: "#69727c", drift: 0,
});

export const VAULT_GRID_PRESETS = Object.freeze([
  { id: "graphite-plates", label: "Графит · плиты с фаской", params: VAULT_GRID_DEFAULTS },
  { id: "brushed-steel-ribs", label: "Сталь · ортогональные рёбра", params: Object.freeze<VaultGridParams>({
    pattern: "rib", cellSize: 48, lineWidth: 8, bevel: 3, depth: 1.4,
    roughness: 0.28, lightAngle: -65, lightElevation: 40, lightStrength: 1.2,
    baseColor: "#202a2e", metalColor: "#acb8bd", drift: 0.006,
  }) },
  { id: "warm-etched-alloy", label: "Тёплый сплав · гравировка", params: Object.freeze<VaultGridParams>({
    pattern: "engraved", cellSize: 72, lineWidth: 2, bevel: 1.5, depth: 0.9,
    roughness: 0.52, lightAngle: -42, lightElevation: 55, lightStrength: 1,
    baseColor: "#30251e", metalColor: "#9d8062", drift: 0,
  }) },
] as const);

const PARAM_KEYS = Object.freeze([
  "pattern", "cellSize", "lineWidth", "bevel", "depth", "roughness",
  "lightAngle", "lightElevation", "lightStrength", "baseColor", "metalColor", "drift",
] as const);

export function parseVaultGridParams(input: unknown): VaultGridParams | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  try {
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(input);
    if (keys.length !== PARAM_KEYS.length || keys.some((key) => !PARAM_KEYS.some((allowed) => allowed === key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (PARAM_KEYS.some((key) => !descriptors[key]?.enumerable || !("value" in descriptors[key]))) return null;
    const values = input as Record<string, unknown>;
    if (!VAULT_GRID_PATTERNS.some((option) => option.value === values.pattern)) return null;
    for (const [key, bounds] of Object.entries(VAULT_GRID_BOUNDS)) {
      const value = values[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < bounds.min || value > bounds.max) return null;
    }
    if (typeof values.baseColor !== "string" || !/^#[\da-f]{6}$/i.test(values.baseColor)
      || typeof values.metalColor !== "string" || !/^#[\da-f]{6}$/i.test(values.metalColor)) return null;
    return {
      pattern: values.pattern as VaultGridPattern,
      cellSize: values.cellSize as number,
      lineWidth: values.lineWidth as number,
      bevel: values.bevel as number,
      depth: values.depth as number,
      roughness: values.roughness as number,
      lightAngle: values.lightAngle as number,
      lightElevation: values.lightElevation as number,
      lightStrength: values.lightStrength as number,
      baseColor: values.baseColor.toLowerCase(),
      metalColor: values.metalColor.toLowerCase(),
      drift: values.drift as number,
    };
  } catch {
    // Proxy traps and getters are not accepted as recipe data.
    return null;
  }
}

export const vaultGridSchema: ParameterSchema<VaultGridParams> = {
  defaults: VAULT_GRID_DEFAULTS,
  controls: [
    { key: "pattern", label: "Геометрия", group: "surface", kind: "select", options: VAULT_GRID_PATTERNS,
      description: "Плиты с фаской, поднятые рёбра или тонкая гравировка." },
    { key: "cellSize", label: "Шаг ячейки", group: "surface", kind: "range", unit: "px", ...VAULT_GRID_BOUNDS.cellSize,
      description: "Одинаковый шаг по горизонтали и вертикали в CSS-пикселях." },
    { key: "lineWidth", label: "Ширина линии", group: "surface", kind: "range", unit: "px", ...VAULT_GRID_BOUNDS.lineWidth,
      description: "Зазор плит, сердцевина ребра или ширина гравировки." },
    { key: "bevel", label: "Фаска", group: "surface", kind: "range", unit: "px", ...VAULT_GRID_BOUNDS.bevel,
      description: "Ширина перехода рельефа от линии к плоскости." },
    { key: "depth", label: "Глубина", group: "surface", kind: "range", ...VAULT_GRID_BOUNDS.depth,
      description: "Наклон нормали рельефа и видимая глубина кромки." },
    { key: "roughness", label: "Шероховатость", group: "surface", kind: "range", ...VAULT_GRID_BOUNDS.roughness,
      description: "Ширина и сила отражения вместе с очень тонким зерном." },
    { key: "lightAngle", label: "Направление света", group: "light", kind: "range", unit: "°", ...VAULT_GRID_BOUNDS.lightAngle },
    { key: "lightElevation", label: "Высота света", group: "light", kind: "range", unit: "°", ...VAULT_GRID_BOUNDS.lightElevation },
    { key: "lightStrength", label: "Сила света", group: "light", kind: "range", ...VAULT_GRID_BOUNDS.lightStrength },
    { key: "baseColor", label: "Цвет основы", group: "color", kind: "color" },
    { key: "metalColor", label: "Цвет металла", group: "color", kind: "color" },
    { key: "drift", label: "Дрейф света", group: "motion", kind: "range", unit: "рад/с", ...VAULT_GRID_BOUNDS.drift,
      description: "Медленный поворот света. Ноль полностью неподвижен." },
  ],
  parse(input) {
    const value = parseVaultGridParams(input);
    return value ? { ok: true, value } : { ok: false, issues: [{
      code: "invalid-vault-grid-params",
      message: "Нужны все параметры vault-grid в допустимых пределах, два HEX-цвета и известная геометрия.",
    }] };
  },
};
