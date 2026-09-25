import type { ParameterControl, ParameterGroup, ParameterSchema, ParameterValue, ParseResult } from "../../contracts";

export type PaperShape = "none" | "circle" | "daisy" | "diamond" | "metaballs";
export type PaperFit = "none" | "contain" | "cover";
export type PaperSizing = Readonly<{
  fit: PaperFit;
  scale: number;
  rotation: number;
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
  worldWidth: number;
  worldHeight: number;
  speed: number;
  phaseMs: number;
}>;
export type LiquidMetalParams = PaperSizing & Readonly<{
  colorBack: string; colorTint: string; repetition: number; softness: number;
  shiftRed: number; shiftBlue: number; distortion: number; contour: number;
  angle: number; shape: PaperShape;
}>;
export type PulsingBorderParams = PaperSizing & Readonly<{
  colorBack: string; colors: readonly string[]; roundness: number; thickness: number;
  marginLeft: number; marginRight: number; marginTop: number; marginBottom: number;
  aspectRatio: "auto" | "square"; softness: number; intensity: number; bloom: number;
  spots: number; spotSize: number; pulse: number; smoke: number; smokeSize: number;
}>;
export type GemSmokeParams = PaperSizing & Readonly<{
  colors: readonly string[]; colorBack: string; colorInner: string;
  innerDistortion: number; outerDistortion: number; innerGlow: number; outerGlow: number;
  offset: number; angle: number; size: number; shape: PaperShape;
}>;
export type HeatmapParams = PaperSizing & Readonly<{
  colors: readonly string[]; colorBack: string; contour: number; angle: number;
  noise: number; innerGlow: number; outerGlow: number;
}>;

const sizing: PaperSizing = {
  fit: "contain", scale: 1, rotation: 0, originX: 0.5, originY: 0.5,
  offsetX: 0, offsetY: 0, worldWidth: 0, worldHeight: 0,
  speed: 0.25, phaseMs: 0,
};

function range(key: string, label: string, group: ParameterGroup, min: number, max: number, step: number, description?: string): ParameterControl {
  return { key, label, group, kind: "range", min, max, step, description };
}
function color(key: string, label: string, group: ParameterGroup): ParameterControl {
  return { key, label, group, kind: "color" };
}
function list(key: string, label: string, maxItems: number): ParameterControl {
  return { key, label, group: "color", kind: "color-list", minItems: 1, maxItems };
}
function select(key: string, label: string, group: ParameterGroup, values: readonly string[]): ParameterControl {
  return { key, label, group, kind: "select", options: values.map((value) => ({ value, label: value })) };
}

const sizingControls: readonly ParameterControl[] = [
  select("fit", "Вписывание", "surface", ["none", "contain", "cover"]),
  range("scale", "Масштаб", "surface", 0.01, 4, 0.01),
  range("rotation", "Поворот", "surface", 0, 360, 1, "Градусы"),
  range("originX", "Опора X", "precise", 0, 1, 0.01),
  range("originY", "Опора Y", "precise", 0, 1, 0.01),
  range("offsetX", "Смещение X", "surface", -1, 1, 0.01),
  range("offsetY", "Смещение Y", "surface", -1, 1, 0.01),
  range("worldWidth", "Виртуальная ширина", "precise", 0, 2048, 1),
  range("worldHeight", "Виртуальная высота", "precise", 0, 2048, 1),
  range("speed", "Скорость", "motion", -2, 2, 0.01, "0 останавливает фазу; отрицательное значение обращает движение"),
  range("phaseMs", "Фаза", "motion", -120000, 120000, 1, "Сдвиг source frame в миллисекундах"),
];

const shapeControl = select("shape", "Форма", "surface", ["none", "circle", "daisy", "diamond", "metaballs"]);
const angleControl = range("angle", "Направление", "motion", 0, 360, 1);

function makeSchema<P extends object>(defaults: Readonly<P>, controls: readonly ParameterControl[]): ParameterSchema<P> {
  const allowed = new Set(controls.map((control) => control.key));
  if (allowed.size !== controls.length || allowed.size !== Object.keys(defaults).length) {
    throw new Error("Paper schema defaults and controls differ.");
  }
  return {
    defaults,
    controls: controls as readonly ParameterControl<Extract<keyof P, string>>[],
    parse(input: unknown): ParseResult<P> {
      const invalid = (field?: string): ParseResult<P> => ({
        ok: false,
        issues: [{ code: "invalid-paper-params", field, message: "Нужен полный Paper recipe с допустимыми значениями." }],
      });
      if (!input || typeof input !== "object" || Array.isArray(input)) return invalid();
      const prototype: unknown = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return invalid();
      const fields = Reflect.ownKeys(input);
      if (fields.length !== controls.length || fields.some((key) => typeof key !== "string" || !allowed.has(key))) return invalid();
      const values = input as Record<string, unknown>;
      const normalized: Record<string, ParameterValue> = {};
      for (const control of controls) {
        const value = values[control.key];
        if (control.kind === "range") {
          if (typeof value !== "number" || !Number.isFinite(value) || value < control.min || value > control.max ||
              (control.key === "spots" && !Number.isInteger(value))) return invalid(control.key);
          normalized[control.key] = value;
        } else if (control.kind === "select") {
          if (typeof value !== "string" || !control.options.some((option) => option.value === value)) return invalid(control.key);
          normalized[control.key] = value;
        } else if (control.kind === "color") {
          if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(value)) return invalid(control.key);
          normalized[control.key] = value.toLowerCase();
        } else if (control.kind === "color-list") {
          if (!Array.isArray(value) || value.length < control.minItems || value.length > control.maxItems ||
              value.some((item) => typeof item !== "string" || !/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(item))) return invalid(control.key);
          normalized[control.key] = value.map((item: string) => item.toLowerCase());
        } else if (control.kind === "toggle") {
          if (typeof value !== "boolean") return invalid(control.key);
          normalized[control.key] = value;
        }
      }
      return { ok: true, value: normalized as P };
    },
  };
}

export const liquidMetalSchema = makeSchema<LiquidMetalParams>({
  ...sizing, colorBack: "#00000000", colorTint: "#ffffff", repetition: 2,
  softness: 0.1, shiftRed: 0.3, shiftBlue: 0.3, distortion: 0.07,
  contour: 0.4, angle: 70, shape: "none",
}, [
  ...sizingControls, color("colorBack", "Фон", "color"), color("colorTint", "Тон металла", "color"),
  range("repetition", "Частота полос", "surface", 1, 10, 0.1),
  range("softness", "Мягкость", "surface", 0, 1, 0.01),
  range("shiftRed", "Красное смещение", "light", -1, 1, 0.01),
  range("shiftBlue", "Синее смещение", "light", -1, 1, 0.01),
  range("distortion", "Искажение", "surface", 0, 1, 0.01),
  range("contour", "Контур", "surface", 0, 1, 0.01), angleControl, shapeControl,
]);

export const pulsingBorderSchema = makeSchema<PulsingBorderParams>({
  ...sizing, colorBack: "#00000000", colors: ["#81adec"], roundness: 0.25,
  thickness: 0.05, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0,
  aspectRatio: "auto", softness: 0.2, intensity: 0.2, bloom: 0.15,
  spots: 4, spotSize: 1, pulse: 0, smoke: 0, smokeSize: 0.5,
}, [
  ...sizingControls, color("colorBack", "Фон", "color"), list("colors", "Цвета бликов", 5),
  range("roundness", "Скругление", "surface", 0, 1, 0.01),
  range("thickness", "Толщина", "surface", 0, 1, 0.01),
  range("marginLeft", "Левый отступ", "precise", 0, 1, 0.01),
  range("marginRight", "Правый отступ", "precise", 0, 1, 0.01),
  range("marginTop", "Верхний отступ", "precise", 0, 1, 0.01),
  range("marginBottom", "Нижний отступ", "precise", 0, 1, 0.01),
  select("aspectRatio", "Пропорция", "surface", ["auto", "square"]),
  range("softness", "Мягкость", "surface", 0, 1, 0.01),
  range("intensity", "Плотность пятен", "light", 0, 1, 0.01),
  range("bloom", "Сложение света", "light", 0, 1, 0.01, "Source умножает bloom на 4; высокий уровень может клиппировать"),
  range("spots", "Пятен на цвет", "surface", 1, 4, 1),
  range("spotSize", "Размер пятна", "surface", 0, 1, 0.01),
  range("pulse", "Пульсация", "motion", 0, 1, 0.01),
  range("smoke", "Дым", "surface", 0, 1, 0.01),
  range("smokeSize", "Размер дыма", "surface", 0, 1, 0.01),
]);

export const gemSmokeSchema = makeSchema<GemSmokeParams>({
  ...sizing, colors: ["#6687ba", "#a695ad", "#d5bea5"], colorBack: "#00000000",
  colorInner: "#ffffff", innerDistortion: 0.25, outerDistortion: 0.25,
  innerGlow: 0.55, outerGlow: 0.35, offset: 0, angle: 0, size: 0.5, shape: "none",
}, [
  ...sizingControls, list("colors", "Цвета дыма", 6), color("colorBack", "Фон", "color"),
  color("colorInner", "Цвет внутри", "color"),
  range("innerDistortion", "Искажение внутри", "surface", 0, 1, 0.01),
  range("outerDistortion", "Искажение снаружи", "surface", 0, 1, 0.01),
  range("innerGlow", "Внутреннее свечение", "light", 0, 1, 0.01),
  range("outerGlow", "Внешнее свечение", "light", 0, 1, 0.01),
  range("offset", "Смещение дыма", "surface", -1, 1, 0.01), angleControl,
  range("size", "Размер дыма", "surface", 0, 1, 0.01), shapeControl,
]);

export const heatmapSchema = makeSchema<HeatmapParams>({
  ...sizing, colors: ["#1d4d72", "#647c99", "#b6a18e", "#efce9b"],
  colorBack: "#00000000", contour: 0.5, angle: 0, noise: 0.1,
  innerGlow: 0.55, outerGlow: 0.35,
}, [
  ...sizingControls, list("colors", "Тепловая палитра", 10), color("colorBack", "Фон", "color"),
  range("contour", "Кромка", "surface", 0, 1, 0.01), angleControl,
  range("noise", "Зерно", "surface", 0, 1, 0.01),
  range("innerGlow", "Внутреннее тепло", "light", 0, 1, 0.01),
  range("outerGlow", "Внешнее тепло", "light", 0, 1, 0.01),
]);
