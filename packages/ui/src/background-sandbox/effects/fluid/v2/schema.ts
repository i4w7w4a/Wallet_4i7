import type { ParameterSchema } from "../../../contracts";

export interface FluidV2Params {
  mode: "draw" | "ambient";
  timeScale: number;
  force: number;
  radius: number;
  curl: number;
  velocityDissipation: number;
  dyeDissipation: number;
  pressureRetention: number;
  shading: boolean;
  colors: readonly string[];
  colorAlpha: number;
  backgroundColor: string;
  backgroundAlpha: number;
  colorCycleRate: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  sunraysEnabled: boolean;
  sunraysWeight: number;
  ambientRate: number;
}
export const FLUID_V2_DEFAULTS: Readonly<FluidV2Params> = Object.freeze({
  mode: "draw", timeScale: 1, force: 3600, radius: 0.25, curl: 30,
  velocityDissipation: 0.2, dyeDissipation: 1, pressureRetention: 0.8,
  shading: true, colors: Object.freeze(["#9AA6B3", "#62738B", "#A7927E"]),
  colorAlpha: 0.9, backgroundColor: "#080A0F", backgroundAlpha: 1,
  colorCycleRate: 0, bloomEnabled: false, bloomIntensity: 0.8, bloomThreshold: 0.6,
  sunraysEnabled: false, sunraysWeight: 1, ambientRate: 0.5,
});
export const FLUID_V2_BOUNDS = Object.freeze({
  timeScale: { min: 0, max: 2, step: 0.01 },
  force: { min: 0, max: 6000, step: 100 },
  radius: { min: 0.01, max: 1, step: 0.01 },
  curl: { min: 0, max: 50, step: 1 },
  velocityDissipation: { min: 0, max: 4, step: 0.05 },
  dyeDissipation: { min: 0, max: 4, step: 0.05 },
  pressureRetention: { min: 0, max: 1, step: 0.01 },
  colorAlpha: { min: 0, max: 1, step: 0.01 },
  backgroundAlpha: { min: 0, max: 1, step: 0.01 },
  colorCycleRate: { min: 0, max: 10, step: 0.1 },
  bloomIntensity: { min: 0, max: 2, step: 0.05 },
  bloomThreshold: { min: 0, max: 1, step: 0.01 },
  sunraysWeight: { min: 0.3, max: 2, step: 0.05 },
  ambientRate: { min: 0.05, max: 2, step: 0.05 },
});

const COLOR = /^#[\da-fA-F]{6}$/;
const isColor = (value: unknown): value is string => typeof value === "string" && COLOR.test(value);
export function parseFluidV2Params(value: unknown): FluidV2Params | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== Object.keys(FLUID_V2_DEFAULTS).length || keys.some((key) => typeof key !== "string" || !Object.hasOwn(FLUID_V2_DEFAULTS, key))) return null;
    const names = keys as string[]; // The preceding guard rejects every symbol key.
    const fields = Object.getOwnPropertyDescriptors(value);
    if (names.some((key) => { const field = fields[key]; return !field?.enumerable || !("value" in field); })) return null;
    const record = Object.fromEntries(names.map((key) => [key, fields[key].value])) as Record<string, unknown>;
    if (record.mode !== "draw" && record.mode !== "ambient") return null;
    if (typeof record.shading !== "boolean" || typeof record.bloomEnabled !== "boolean" || typeof record.sunraysEnabled !== "boolean") return null;
    for (const key of Object.keys(FLUID_V2_BOUNDS) as (keyof typeof FLUID_V2_BOUNDS)[]) {
      const number = record[key];
      const bounds = FLUID_V2_BOUNDS[key];
      if (typeof number !== "number" || !Number.isFinite(number) || number < bounds.min || number > bounds.max) return null;
    }
    if (!Array.isArray(record.colors) || Object.getPrototypeOf(record.colors) !== Array.prototype) return null;
    const colorKeys = Reflect.ownKeys(record.colors);
    const colorsLength = Object.getOwnPropertyDescriptor(record.colors, "length")?.value;
    if (!Number.isInteger(colorsLength) || colorsLength < 1 || colorsLength > 6 || colorKeys.length !== colorsLength + 1) return null;
    const colorFields = Object.getOwnPropertyDescriptors(record.colors);
    const colors: string[] = [];
    for (let i = 0; i < colorsLength; i++) {
      const field = colorFields[i];
      if (!field?.enumerable || !("value" in field) || !isColor(field.value)) return null;
      colors.push(field.value.toUpperCase());
    }
    if (!isColor(record.backgroundColor)) return null;
    return {
      mode: record.mode,
      timeScale: record.timeScale as number,
      force: record.force as number,
      radius: record.radius as number,
      curl: record.curl as number,
      velocityDissipation: record.velocityDissipation as number,
      dyeDissipation: record.dyeDissipation as number,
      pressureRetention: record.pressureRetention as number,
      shading: record.shading,
      colors,
      colorAlpha: record.colorAlpha as number,
      backgroundColor: record.backgroundColor.toUpperCase(),
      backgroundAlpha: record.backgroundAlpha as number,
      colorCycleRate: record.colorCycleRate as number,
      bloomEnabled: record.bloomEnabled,
      bloomIntensity: record.bloomIntensity as number,
      bloomThreshold: record.bloomThreshold as number,
      sunraysEnabled: record.sunraysEnabled,
      sunraysWeight: record.sunraysWeight as number,
      ambientRate: record.ambientRate as number,
    };
  } catch { return null; }
}

export const fluidV2Schema: ParameterSchema<FluidV2Params> = {
  defaults: FLUID_V2_DEFAULTS,
  controls: [
    { key: "mode", group: "motion", kind: "select", label: "Режим", description: "Рисование реагирует на drag. Живой фон получает ограниченные seeded импульсы без жеста.", options: [{ value: "draw", label: "Рисование" }, { value: "ambient", label: "Живой фон" }] },
    { key: "timeScale", group: "motion", kind: "range", label: "Скорость симуляции", description: "Физическое время на кадр, не частота кадров; ноль останавливает поле.", ...FLUID_V2_BOUNDS.timeScale },
    { key: "force", group: "physics", kind: "range", label: "Сила воздействия", description: "Импульс скорости от drag и seeded всплеска.", ...FLUID_V2_BOUNDS.force },
    { key: "radius", group: "surface", kind: "range", label: "Радиус пятна", description: "Ширина Gaussian splat в поле скорости и красителя.", ...FLUID_V2_BOUNDS.radius },
    { key: "curl", group: "physics", kind: "range", label: "Вихри", description: "Сила vorticity confinement.", ...FLUID_V2_BOUNDS.curl },
    { key: "velocityDissipation", group: "physics", kind: "range", label: "Затухание скорости", description: "Выше — течение быстрее теряет скорость; цвет меняется отдельно.", ...FLUID_V2_BOUNDS.velocityDissipation },
    { key: "dyeDissipation", group: "physics", kind: "range", label: "Затухание цвета", description: "Выше — краситель быстрее исчезает, даже когда движение сохраняется.", ...FLUID_V2_BOUNDS.dyeDissipation },
    { key: "pressureRetention", group: "physics", kind: "range", label: "Память давления", description: "Доля предыдущего поля давления за шаг 1/60 секунды.", ...FLUID_V2_BOUNDS.pressureRetention },
    { key: "shading", group: "light", kind: "toggle", label: "Объёмное освещение", description: "Светотень по локальному градиенту красителя." },
    { key: "colors", group: "color", kind: "color-list", label: "Цвета красителя", description: "От одного до шести редактируемых цветов, по одному на transported pigment.", minItems: 1, maxItems: 6 },
    { key: "colorAlpha", group: "color", kind: "range", label: "Прозрачность красителя", description: "Покрытие окрашенной части поля, независимо от фона.", ...FLUID_V2_BOUNDS.colorAlpha },
    { key: "backgroundColor", group: "color", kind: "color", label: "Цвет фона", description: "Цвет основы под жидкостью." },
    { key: "backgroundAlpha", group: "color", kind: "range", label: "Непрозрачность фона", description: "Ноль оставляет прозрачное основание для общего compositor.", ...FLUID_V2_BOUNDS.backgroundAlpha },
    { key: "colorCycleRate", group: "motion", kind: "range", label: "Смена цветов", description: "Плавная циклическая смена палитры в секундах симуляции; ноль фиксирует цвета.", ...FLUID_V2_BOUNDS.colorCycleRate },
    { key: "bloomEnabled", group: "light", kind: "toggle", label: "Свечение", description: "Добавляет ограниченную цепочку bloom-проходов." },
    { key: "bloomIntensity", group: "light", kind: "range", label: "Сила свечения", description: "Действует при включённом свечении.", ...FLUID_V2_BOUNDS.bloomIntensity },
    { key: "bloomThreshold", group: "light", kind: "range", label: "Порог свечения", description: "Высокие значения оставляют светиться только яркие участки.", ...FLUID_V2_BOUNDS.bloomThreshold },
    { key: "sunraysEnabled", group: "light", kind: "toggle", label: "Лучи", description: "Добавляет радиальное рассеяние через отдельный mask/pass." },
    { key: "sunraysWeight", group: "light", kind: "range", label: "Вес лучей", description: "Действует при включённых лучах.", ...FLUID_V2_BOUNDS.sunraysWeight },
    { key: "ambientRate", group: "motion", kind: "range", label: "Частота подпитки", description: "Действует только в режиме «Живой фон»; seeded всплесков в секунду симуляции.", ...FLUID_V2_BOUNDS.ambientRate },
  ],
  parse(input) {
    const value = parseFluidV2Params(input);
    return value ? { ok: true, value } : { ok: false, issues: [{ code: "invalid-fluid-v2-params", message: "Fluid v2 требует полный допустимый набор параметров без посторонних полей." }] };
  },
};
