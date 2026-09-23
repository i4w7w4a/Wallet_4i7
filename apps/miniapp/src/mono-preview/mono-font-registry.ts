import audit from "./mono-font-audit.json";

export type MonoUiFontId = "ibm-plex-sans" | "golos-text" | "onest" | "manrope" | "source-sans-3";
export type MonoFontId = MonoUiFontId | "ibm-plex-mono";
export type MonoFontDefinition = {
  id: MonoFontId;
  label: string;
  family: string;
  character: string;
  category: "sans" | "mono";
  weights: readonly number[] | { min: number; max: number };
  files: readonly (keyof typeof audit)[];
  tabular: boolean;
  missingCurrencies: string;
  source: string;
  license: string;
  reservedName: string | null;
};

const IBM = "https://github.com/IBM/plex/tree/78cd4223d8de9fcb78cba84eadecb269c56093c5";
export const MONO_FONT_REGISTRY: Readonly<Record<MonoFontId, MonoFontDefinition>> = {
  "ibm-plex-sans": {
    id: "ibm-plex-sans", label: "IBM Plex Sans", family: "Mono Plex Sans",
    character: "Точный · технический", category: "sans", weights: { min: 100, max: 700 },
    files: ["plex-sans-var-roman.woff2"], tabular: true, missingCurrencies: "",
    source: IBM, license: "/fonts/mono/OFL-IBM-Plex.txt", reservedName: "Plex",
  },
  "golos-text": {
    id: "golos-text", label: "Golos Text", family: "Mono Golos Text",
    character: "Спокойный · кириллический", category: "sans", weights: [400, 500, 600],
    files: ["golos-text-regular.woff2", "golos-text-medium.woff2", "golos-text-semibold.woff2"],
    tabular: false, missingCurrencies: "₿",
    source: "https://github.com/googlefonts/golos-text/tree/cf2e27222937d97c2d858fff0499bcc667a64e9d",
    license: "/fonts/mono/OFL-Golos-Text.txt", reservedName: null,
  },
  onest: {
    id: "onest", label: "Onest", family: "Mono Onest", character: "Мягкий · открытый",
    category: "sans", weights: { min: 100, max: 900 }, files: ["onest-variable.woff2"],
    tabular: true, missingCurrencies: "₿",
    source: "https://github.com/google/fonts/tree/51f27c6a966556a8d106923a692f76f1e0ac4ad4/ofl/onest",
    license: "/fonts/mono/OFL-Onest.txt", reservedName: null,
  },
  manrope: {
    id: "manrope", label: "Manrope", family: "Mono Manrope", character: "Геометричный · выразительный",
    category: "sans", weights: { min: 200, max: 800 }, files: ["manrope-variable.woff2"],
    tabular: true, missingCurrencies: "₸",
    source: "https://github.com/google/fonts/tree/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/manrope",
    license: "/fonts/mono/OFL-Manrope.txt", reservedName: null,
  },
  "source-sans-3": {
    id: "source-sans-3", label: "Source Sans 3", family: "Mono Source Sans 3",
    character: "Гуманистический · компактный", category: "sans", weights: { min: 200, max: 900 },
    files: ["source-sans-3-variable.woff2"], tabular: true, missingCurrencies: "₿",
    source: "https://github.com/adobe-fonts/source-sans/tree/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e",
    license: "/fonts/mono/OFL-Source-Sans-3.txt", reservedName: "Source",
  },
  "ibm-plex-mono": {
    id: "ibm-plex-mono", label: "IBM Plex Mono", family: "Mono Plex Mono",
    character: "Моноширинный · адреса и ID", category: "mono", weights: [400],
    files: ["plex-mono-regular.woff2"], tabular: true, missingCurrencies: "",
    source: IBM, license: "/fonts/mono/OFL-IBM-Plex.txt", reservedName: "Plex",
  },
};

export const MONO_UI_FONT_IDS: readonly MonoUiFontId[] = ["ibm-plex-sans", "golos-text", "onest", "manrope", "source-sans-3"];
export const MONO_FONT_AUDIT = audit;
export const MONO_FONT_SPECIMEN = "Добрый день · Добры дзень · Ўў Іі · Bitcoin 0123456789 ₽ $ € £ ¥ ₸ ₿ ↑ +2,34% ↓ −7,08%";

export function isMonoFontId(value: unknown): value is MonoFontId {
  return typeof value === "string" && Object.hasOwn(MONO_FONT_REGISTRY, value);
}

export function normalizeMonoFontWeight(id: MonoFontId, value: number): number {
  const weights = MONO_FONT_REGISTRY[id].weights;
  if ("min" in weights) return Math.max(weights.min, Math.min(weights.max, Math.round(value)));
  return weights.reduce((best, candidate) => Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best);
}

export function monoFontPairCoversCurrencies(primary: MonoFontId, secondary: MonoFontId): boolean {
  return ![...MONO_FONT_REGISTRY[primary].missingCurrencies]
    .some(char => MONO_FONT_REGISTRY[secondary].missingCurrencies.includes(char));
}
