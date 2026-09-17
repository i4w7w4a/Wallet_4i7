import { compositeMonoSrgb, gamutMapMonoOklch, monoContrastRatio, normalizeMonoOklch, oklchToSrgb, type MonoOklch, type MonoSrgb } from "./mono-color-space";

export const MONO_PALETTE_GROUPS = {
  core: ["canvas", "surfaceBase", "surfaceRaised", "surfaceOverlay"],
  content: ["textPrimary", "textSecondary", "textMuted", "textDisabled"],
  structure: ["borderSubtle", "borderStrong", "focus"],
  decorative: ["accentPrimary", "accentSecondary", "glassTint", "edgeCool", "edgeWarm", "atmosphereCool", "atmosphereWarm", "chartLine", "selection"],
  system: ["success", "warning", "danger", "info"],
} as const;
export type MonoPaletteGroup = keyof typeof MONO_PALETTE_GROUPS;
export type MonoPaletteRole = typeof MONO_PALETTE_GROUPS[MonoPaletteGroup][number];
export type MonoPaletteMode = "dark" | "light";
export const MONO_PALETTE_HARMONIES = ["spectral-graphite", "mineral", "thermal-duet", "analog-mist", "split-prism"] as const;
export type MonoPaletteHarmony = typeof MONO_PALETTE_HARMONIES[number];
export type MonoPaletteRecipe = {
  anchorHue: number; anchorChroma: number; harmony: MonoPaletteHarmony;
  temperature: number; iridescence: number; exposure: number; contrast: number; surfaceResponse: number;
};
export type MonoPaletteRoleState = {
  mode: "linked" | "offset" | "manual";
  offset: { l: number; c: number; h: number };
  value: MonoOklch;
  locked: boolean;
  lockedValue: MonoOklch | null;
};
export type ThemePaletteState = {
  mode: MonoPaletteMode;
  recipe: MonoPaletteRecipe;
  roles: Record<MonoPaletteRole, MonoPaletteRoleState>;
  groupLocks: Record<MonoPaletteGroup, boolean>;
};
export type MonoPaletteConfigV1 = {
  version: 1; engineVersion: 1; catalogVersion: 1; skinId: "mono-ledger-v1";
  themes: Record<MonoPaletteMode, ThemePaletteState>;
  linkedThemes: boolean; seed: string; actionCounter: number;
};
export type MonoResolvedPalette = {
  mode: MonoPaletteMode;
  roles: Record<MonoPaletteRole, MonoOklch>;
  srgb: Record<MonoPaletteRole, MonoSrgb>;
};

export const MONO_PALETTE_ROLES = Object.values(MONO_PALETTE_GROUPS).flat() as MonoPaletteRole[];
export const MONO_PALETTE_RECIPE_BOUNDS = {
  anchorHue: { min: 0, max: 360, default: 250 },
  anchorChroma: { min: 0, max: 0.2, default: 0.035 },
  temperature: { min: -1, max: 1, default: 0 },
  iridescence: { min: 0, max: 1, default: 0.35 },
  exposure: { min: -0.08, max: 0.08, default: 0 },
  contrast: { min: 0.8, max: 1.2, default: 1 },
  surfaceResponse: { min: 0, max: 1, default: 0.5 },
} as const;

const record = (input: unknown): Record<string, unknown> =>
  input !== null && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
const bounded = (input: unknown, min: number, max: number, fallback: number): number =>
  typeof input === "number" && Number.isFinite(input) ? Math.max(min, Math.min(max, input)) : fallback;
const wrapHue = (input: number): number => ((input % 360) + 360) % 360;

function normalizeRecipe(input: unknown): MonoPaletteRecipe {
  const source = record(input);
  const values = Object.fromEntries(Object.entries(MONO_PALETTE_RECIPE_BOUNDS).map(([key, bound]) =>
    [key, bounded(source[key], bound.min, bound.max, bound.default)])) as Omit<MonoPaletteRecipe, "harmony">;
  values.anchorHue = wrapHue(bounded(source.anchorHue, -Number.MAX_VALUE, Number.MAX_VALUE, 250));
  return { ...values, harmony: MONO_PALETTE_HARMONIES.includes(source.harmony as MonoPaletteHarmony)
    ? source.harmony as MonoPaletteHarmony : "spectral-graphite" };
}

function normalizeTheme(input: unknown, mode: MonoPaletteMode): ThemePaletteState {
  const source = record(input), sourceRoles = record(source.roles), groupLocks = record(source.groupLocks);
  const roles = Object.fromEntries(MONO_PALETTE_ROLES.map(role => {
    const state = record(sourceRoles[role]), offset = record(state.offset);
    return [role, {
      mode: state.mode === "manual" || state.mode === "offset" ? state.mode : "linked",
      offset: { l: bounded(offset.l, -1, 1, 0), c: bounded(offset.c, -0.4, 0.4, 0), h: bounded(offset.h, -360, 360, 0) },
      value: normalizeMonoOklch(state.value), locked: state.locked === true,
      lockedValue: state.lockedValue == null ? null : normalizeMonoOklch(state.lockedValue),
    }];
  })) as Record<MonoPaletteRole, MonoPaletteRoleState>;
  return { mode, recipe: normalizeRecipe(source.recipe), roles,
    groupLocks: Object.fromEntries(Object.keys(MONO_PALETTE_GROUPS).map(group => [group, groupLocks[group] === true])) as ThemePaletteState["groupLocks"] };
}

/** Recovery normalizer, not an import codec: unknown fields are dropped; unsupported versions reject atomically. */
export function normalizeMonoPaletteConfig(input?: unknown): MonoPaletteConfigV1 {
  const source = record(input), themes = record(source.themes);
  for (const key of ["version", "engineVersion", "catalogVersion"]) {
    if (source[key] !== undefined && source[key] !== 1) throw new Error(`Unsupported palette ${key} version`);
  }
  if (source.skinId !== undefined && source.skinId !== "mono-ledger-v1") throw new Error("Unsupported palette skinId");
  return { version: 1, engineVersion: 1, catalogVersion: 1, skinId: "mono-ledger-v1",
    themes: { dark: normalizeTheme(themes.dark, "dark"), light: normalizeTheme(themes.light, "light") },
    linkedThemes: source.linkedThemes === true, seed: typeof source.seed === "string" ? source.seed.slice(0, 256) : "mono",
    actionCounter: Math.floor(bounded(source.actionCounter, 0, Number.MAX_SAFE_INTEGER - 1, 0)) };
}
type RoleRecipe = { group: MonoPaletteGroup; dark: number; light: number; chroma: number; hue: 0 | 1 | 2; alpha: number };
const role = (group: MonoPaletteGroup, dark: number, light: number, chroma = 0.018, hue: 0 | 1 | 2 = 0, alpha = 1): RoleRecipe =>
  ({ group, dark, light, chroma, hue, alpha });

/** Single role catalog for resolution, lock addressing and randomization. */
export const MONO_PALETTE_ROLE_SCHEMA: Record<MonoPaletteRole, RoleRecipe> = {
  canvas: role("core", 0.12, 0.97), surfaceBase: role("core", 0.17, 0.94),
  surfaceRaised: role("core", 0.21, 0.99), surfaceOverlay: role("core", 0.25, 0.92),
  textPrimary: role("content", 0.97, 0.18, 0.012), textSecondary: role("content", 0.81, 0.3, 0.012),
  textMuted: role("content", 0.69, 0.4, 0.012), textDisabled: role("content", 0.65, 0.44, 0.012),
  borderSubtle: role("structure", 0.37, 0.78), borderStrong: role("structure", 0.61, 0.54), focus: role("structure", 0.94, 0.27),
  accentPrimary: role("decorative", 0.74, 0.48, 0.14), accentSecondary: role("decorative", 0.7, 0.53, 0.12, 1),
  glassTint: role("decorative", 0.25, 0.9, 0.045, 0, 0.12),
  edgeCool: role("decorative", 0.8, 0.68, 0.09), edgeWarm: role("decorative", 0.78, 0.7, 0.09, 2),
  atmosphereCool: role("decorative", 0.5, 0.75, 0.08, 0, 0.16), atmosphereWarm: role("decorative", 0.5, 0.8, 0.08, 2, 0.14),
  chartLine: role("decorative", 0.8, 0.4, 0.07), selection: role("decorative", 0.72, 0.55, 0.08, 1, 0.2),
  success: role("system", 0.76, 0.4, 0.1), warning: role("system", 0.82, 0.4, 0.1),
  danger: role("system", 0.75, 0.4, 0.12), info: role("system", 0.76, 0.4, 0.1),
};

function recipeColor(theme: ThemePaletteState, id: MonoPaletteRole): MonoOklch {
  const schema = MONO_PALETTE_ROLE_SCHEMA[id], recipe = theme.recipe;
  if (schema.group === "system") {
    const systemHue = { success: 145, warning: 80, danger: 25, info: 250 };
    return { l: schema[theme.mode], c: schema.chroma, h: systemHue[id as keyof typeof systemHue], alpha: 1 };
  }
  const harmonyOffsets = {
    "spectral-graphite": [0, 168, 168], mineral: [0, 0, 0], "thermal-duet": [0, 168, 168],
    "analog-mist": [0, 24, 24], "split-prism": [0, 150, 210],
  } as const;
  const decorative = schema.group === "decorative";
  const saturation = decorative ? (0.35 + recipe.iridescence * 0.65) : 1;
  const spectral = recipe.harmony === "spectral-graphite" && decorative ? 0.45 : 1;
  const l = 0.5 + (schema[theme.mode] - 0.5) * (schema.group === "content" ? recipe.contrast : 1)
    + recipe.exposure + (schema.group === "core" && id !== "canvas" ? (recipe.surfaceResponse - 0.5) * 0.035 : 0);
  return normalizeMonoOklch({ l, c: Math.min(schema.chroma, recipe.anchorChroma * saturation * spectral),
    h: recipe.anchorHue + recipe.temperature * 12 + (decorative ? harmonyOffsets[recipe.harmony][schema.hue] : 0), alpha: schema.alpha });
}

function resolvedFromRoles(mode: MonoPaletteMode, roles: Record<MonoPaletteRole, MonoOklch>): MonoResolvedPalette {
  return { mode, roles, srgb: Object.fromEntries(MONO_PALETTE_ROLES.map(id => [id, oklchToSrgb(roles[id])])) as MonoResolvedPalette["srgb"] };
}

export function resolveMonoPalette(theme: ThemePaletteState): MonoResolvedPalette {
  const roles = Object.fromEntries(MONO_PALETTE_ROLES.map(id => {
    const state = theme.roles[id], base = recipeColor(theme, id);
    if (MONO_PALETTE_ROLE_SCHEMA[id].group === "system") return [id, gamutMapMonoOklch(base)];
    if (isLocked(theme, id) && state.lockedValue) return [id, { ...state.lockedValue }];
    const color = state.mode === "manual" ? state.value : state.mode === "offset"
      ? { ...base, l: base.l + state.offset.l, c: base.c + state.offset.c, h: base.h + state.offset.h } : base;
    const group = MONO_PALETTE_ROLE_SCHEMA[id].group;
    const boundedColor = state.mode !== "manual" && (group === "core" || group === "content")
      ? { ...color, c: Math.min(color.c, 0.018) } : color;
    return [id, gamutMapMonoOklch(boundedColor)];
  })) as MonoResolvedPalette["roles"];
  const backgrounds = contrastBackgrounds(resolvedFromRoles(theme.mode, roles));
  for (const id of MONO_PALETTE_ROLES) {
    if (theme.roles[id].mode === "manual" || isLocked(theme, id) || MONO_PALETTE_ROLE_SCHEMA[id].group === "system") continue;
    const minimum = contrastMinimum(id);
    if (!minimum || worstRatio(roles[id], backgrounds) >= minimum) continue;
    // Search both lightness directions; incompatible mixed surfaces remain invalid.
    let best: MonoOklch | null = null;
    for (let step = 0; step <= 256; step++) {
      const candidate = gamutMapMonoOklch({ ...roles[id], l: step / 256 });
      if (worstRatio(candidate, backgrounds) >= minimum && (!best || Math.abs(candidate.l - roles[id].l) < Math.abs(best.l - roles[id].l))) best = candidate;
    }
    if (best) roles[id] = best;
  }
  return resolvedFromRoles(theme.mode, roles);
}

export type MonoPaletteIssue = { role: MonoPaletteRole; code: "contrast" | "neutrality" | "opaque-canvas"; message: string; ratio?: number; minimum?: number };
const isLocked = (theme: ThemePaletteState, id: MonoPaletteRole): boolean =>
  theme.groupLocks[MONO_PALETTE_ROLE_SCHEMA[id].group] || theme.roles[id].locked;

function contrastMinimum(id: MonoPaletteRole): number {
  if (id === "textPrimary") return 7;
  if (MONO_PALETTE_ROLE_SCHEMA[id].group === "content" || MONO_PALETTE_ROLE_SCHEMA[id].group === "system") return 4.5;
  if (id === "focus" || id === "borderStrong" || id === "chartLine" || id === "accentPrimary") return 3;
  return 0;
}

function contrastBackgrounds(palette: MonoResolvedPalette): MonoSrgb[] {
  // An opaque canvas bounds the permitted backdrop catalog. Overlay/base/raised
  // may be translucent; glass is tested on every one of those allowed surfaces.
  const canvas = { ...palette.srgb.canvas, alpha: 1 };
  const surfaces = MONO_PALETTE_GROUPS.core.map(id => compositeMonoSrgb(palette.srgb[id], canvas));
  return [...surfaces, ...surfaces.map(surface => compositeMonoSrgb(palette.srgb.glassTint, surface))];
}

function worstRatio(color: MonoOklch, backgrounds: readonly MonoSrgb[]): number {
  const foreground = oklchToSrgb(color);
  return Math.min(...backgrounds.map(background => monoContrastRatio(foreground, background)));
}

export function validateMonoPaletteApply(theme: ThemePaletteState, palette = resolveMonoPalette(theme)): { valid: boolean; issues: MonoPaletteIssue[] } {
  const issues: MonoPaletteIssue[] = [], backgrounds = contrastBackgrounds(palette);
  if (palette.roles.canvas.alpha !== 1) issues.push({ role: "canvas", code: "opaque-canvas", message: "Canvas must be opaque to bound backdrop contrast" });
  for (const id of MONO_PALETTE_ROLES) {
    const group = MONO_PALETTE_ROLE_SCHEMA[id].group;
    if ((group === "core" || group === "content") && palette.roles[id].c > 0.018) {
      issues.push({ role: id, code: "neutrality", message: `${id}: core/content chroma exceeds 0.018` });
    }
    const minimum = contrastMinimum(id), ratio = worstRatio(palette.roles[id], backgrounds);
    if (minimum && ratio < minimum) issues.push({ role: id, code: "contrast", ratio, minimum,
      message: `${id}: worst composited contrast ${ratio.toFixed(2)} is below ${minimum}:1` });
  }
  return { valid: issues.length === 0, issues };
}
export type MonoPaletteScope = { kind: "global" } | { kind: "group"; group: MonoPaletteGroup } | { kind: "point"; role: MonoPaletteRole };
const inScope = (id: MonoPaletteRole, scope: MonoPaletteScope): boolean => scope.kind === "global"
  || (scope.kind === "point" ? scope.role === id : MONO_PALETTE_ROLE_SCHEMA[id].group === scope.group);

export function setMonoPaletteLock(theme: ThemePaletteState, scope: MonoPaletteScope, locked: boolean): ThemePaletteState {
  const resolved = resolveMonoPalette(theme), next = normalizeTheme(theme, theme.mode);
  if (scope.kind === "global") for (const group of Object.keys(next.groupLocks) as MonoPaletteGroup[]) next.groupLocks[group] = locked;
  if (scope.kind === "group") next.groupLocks[scope.group] = locked;
  if (scope.kind === "point") next.roles[scope.role].locked = locked;
  for (const id of MONO_PALETTE_ROLES.filter(id => inScope(id, scope))) {
    next.roles[id].lockedValue = isLocked(next, id) ? { ...resolved.roles[id] } : null;
  }
  return next;
}

/** Recipe edits freeze inherited locks before computing the new dependency graph. */
export function updateMonoPaletteRecipe(theme: ThemePaletteState, patch: Partial<MonoPaletteRecipe>): ThemePaletteState {
  const resolved = resolveMonoPalette(theme), next = normalizeTheme(theme, theme.mode);
  for (const id of MONO_PALETTE_ROLES) if (isLocked(next, id)) next.roles[id].lockedValue = { ...resolved.roles[id] };
  next.recipe = normalizeRecipe({ ...next.recipe, ...patch });
  const blocked = validateMonoPaletteApply(next).issues.filter(issue => isLocked(next, issue.role));
  if (blocked.length) throw new Error(`Recipe conflicts with locked roles: ${blocked.map(issue => issue.message).join("; ")}`);
  return next;
}

export type MonoPaletteRandomizeResult = {
  status: "changed" | "noop" | "error";
  config: MonoPaletteConfigV1;
  changed: MonoPaletteRole[];
  skipped: Array<{ role: MonoPaletteRole; reason: "locked" | "protected" | "constrained" }>;
  issues: MonoPaletteIssue[];
  replay: { seed: string; actionCounter: number; engineVersion: 1; catalogVersion: 1; schemaHash: string;
    baseHash: string; skinId: "mono-ledger-v1"; mode: MonoPaletteMode; scope: MonoPaletteScope } | null;
};
function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const MONO_PALETTE_SCHEMA_HASH = stableHash(JSON.stringify({ roles: MONO_PALETTE_ROLE_SCHEMA, recipe: MONO_PALETTE_RECIPE_BOUNDS }));

export function randomizeMonoPalette(config: MonoPaletteConfigV1, mode: MonoPaletteMode, scope: MonoPaletteScope): MonoPaletteRandomizeResult {
  const next = normalizeMonoPaletteConfig(config), theme = next.themes[mode];
  const before = resolveMonoPalette(theme);
  const skipped: MonoPaletteRandomizeResult["skipped"] = [], eligible: MonoPaletteRole[] = [];
  for (const id of MONO_PALETTE_ROLES.filter(id => inScope(id, scope))) {
    if (MONO_PALETTE_ROLE_SCHEMA[id].group === "system" || id === "focus") skipped.push({ role: id, reason: "protected" });
    else if (isLocked(theme, id)) skipped.push({ role: id, reason: "locked" });
    else eligible.push(id);
  }
  const unchanged = (status: "noop" | "error", issues: MonoPaletteIssue[] = []): MonoPaletteRandomizeResult =>
    ({ status, config, changed: [], skipped, issues, replay: null });
  if (!eligible.length) return unchanged("noop");
  const scopeKey = scope.kind === "global" ? "global" : scope.kind === "point" ? `point:${scope.role}` : `group:${scope.group}`;
  const prefix = JSON.stringify([1, 1, "mono-ledger-v1", 1, MONO_PALETTE_SCHEMA_HASH, config.seed, mode, scopeKey, config.actionCounter]);
  for (const id of eligible) {
    const schema = MONO_PALETTE_ROLE_SCHEMA[id], current = before.roles[id], base = recipeColor(theme, id);
    // No mutable PRNG: removing any neighbor leaves this parameter's stream intact.
    const sample = (channel: string) => parseInt(stableHash(`${prefix}/${schema.group}/${id}/${channel}`), 16) / 0x100000000;
    const delta = (sample("L") < 0.5 ? -1 : 1) * (0.004 + Math.floor(sample("L-step") * 12) / 1000);
    const lightness = current.l + delta;
    const color = normalizeMonoOklch({ ...current,
      l: lightness < 0 || lightness > 1 ? current.l - delta : lightness,
      c: Math.min(schema.chroma, Math.floor(sample("C") * schema.chroma * 1000) / 1000),
      h: schema.group === "decorative" ? Math.floor(sample("H") * 360) : current.h });
    if (theme.roles[id].mode === "manual") theme.roles[id].value = color;
    else {
      theme.roles[id].mode = "offset";
      theme.roles[id].offset = { l: color.l - base.l, c: color.c - base.c, h: color.h - base.h };
    }
  }
  const after = resolveMonoPalette(theme);
  // A contrast repair may depend on a changed surface. It must never modify a
  // neighboring role outside this operation, even if that would make Apply valid.
  for (const id of MONO_PALETTE_ROLES) {
    if (!eligible.includes(id) && JSON.stringify(after.roles[id]) !== JSON.stringify(before.roles[id])) {
      skipped.push(...eligible.map(role => ({ role, reason: "constrained" as const })));
      return unchanged("error", [{ role: id, code: "contrast", message: `${id}: constraints would change a locked or out-of-scope value` }]);
    }
  }
  const validation = validateMonoPaletteApply(theme, after);
  if (!validation.valid) return unchanged("error", validation.issues);
  const changed = eligible.filter(id => {
    if (JSON.stringify(after.roles[id]) !== JSON.stringify(before.roles[id])) return true;
    skipped.push({ role: id, reason: "constrained" });
    theme.roles[id] = { ...config.themes[mode].roles[id] };
    return false;
  });
  if (!changed.length) return unchanged("noop");
  next.actionCounter += 1;
  return { status: "changed", config: next, changed, skipped, issues: [], replay: {
    seed: config.seed, actionCounter: config.actionCounter, engineVersion: 1, catalogVersion: 1,
    skinId: "mono-ledger-v1", schemaHash: MONO_PALETTE_SCHEMA_HASH, baseHash: stableHash(JSON.stringify(normalizeMonoPaletteConfig(config))), mode, scope,
  } };
}

export const MONO_PALETTE_QUICK_HARMONIES = ["spectral-graphite", "mineral", "analog-mist", "thermal-duet"] as const;
type MonoPaletteCharacterKey = "anchorHue" | "anchorChroma" | "harmony" | "temperature" | "iridescence";
export type MonoPaletteRecipeRandomizeResult = {
  status: "changed" | "noop" | "error";
  config: MonoPaletteConfigV1;
  changed: MonoPaletteMode[];
  issues: MonoPaletteIssue[];
  message: string | null;
  replay: {
    seed: string;
    actionCounter: number;
    randomizerVersion: 1;
    engineVersion: 1;
    catalogVersion: 1;
    schemaHash: string;
    baseHash: string;
    skinId: "mono-ledger-v1";
    mode: MonoPaletteMode;
    linkedThemes: boolean;
  } | null;
};

const MONO_PALETTE_RECIPE_RANDOMIZER_SCHEMA = {
  anchorHue: { min: 0, max: 359, step: 1 },
  anchorChroma: { min: 0.05, max: 0.16, step: 0.001 },
  harmony: MONO_PALETTE_QUICK_HARMONIES,
  temperature: { min: -0.6, max: 0.6, step: 0.01 },
  iridescence: { min: 0.25, max: 0.9, step: 0.01 },
} as const;
export const MONO_PALETTE_RECIPE_RANDOMIZER_SCHEMA_HASH = stableHash(JSON.stringify(MONO_PALETTE_RECIPE_RANDOMIZER_SCHEMA));

function sampleDifferentRange(current: number, min: number, max: number, step: number, unit: number): number {
  const steps = Math.round((max - min) / step);
  let value = min + Math.floor(unit * (steps + 1)) * step;
  value = Math.round(value / step) * step;
  if (Math.abs(value - current) < step / 2) value = value + step <= max ? value + step : value - step;
  return Number(value.toFixed(6));
}

function sampleMonoPaletteCharacter(theme: ThemePaletteState, prefix: string): Pick<MonoPaletteRecipe, MonoPaletteCharacterKey> {
  const sample = (channel: string) => parseInt(stableHash(`${prefix}/${channel}`), 16) / 0x100000000;
  let harmony = MONO_PALETTE_QUICK_HARMONIES[Math.floor(sample("harmony") * MONO_PALETTE_QUICK_HARMONIES.length)];
  if (harmony === theme.recipe.harmony) {
    harmony = MONO_PALETTE_QUICK_HARMONIES[(MONO_PALETTE_QUICK_HARMONIES.indexOf(harmony) + 1) % MONO_PALETTE_QUICK_HARMONIES.length];
  }
  return {
    anchorHue: sampleDifferentRange(theme.recipe.anchorHue, 0, 359, 1, sample("anchorHue")),
    anchorChroma: sampleDifferentRange(theme.recipe.anchorChroma, 0.05, 0.16, 0.001, sample("anchorChroma")),
    harmony,
    temperature: sampleDifferentRange(theme.recipe.temperature, -0.6, 0.6, 0.01, sample("temperature")),
    iridescence: sampleDifferentRange(theme.recipe.iridescence, 0.25, 0.9, 0.01, sample("iridescence")),
  };
}

function preserveMonoPaletteFocus(theme: ThemePaletteState, focus: MonoOklch): ThemePaletteState {
  if (isLocked(theme, "focus")) return theme;
  const next = normalizeTheme(theme, theme.mode);
  next.roles.focus.mode = "manual";
  next.roles.focus.value = { ...focus };
  return next;
}

function hasVisibleCharacterChange(before: MonoResolvedPalette, after: MonoResolvedPalette, theme: ThemePaletteState): boolean {
  return MONO_PALETTE_ROLES.some(role => {
    if (role === "focus" || MONO_PALETTE_ROLE_SCHEMA[role].group === "system" || isLocked(theme, role)) return false;
    const left = before.roles[role], right = after.roles[role];
    return Math.abs(left.l - right.l) >= 0.002 || Math.abs(left.c - right.c) >= 0.002
      || (Math.min(left.c, right.c) >= 0.01 && Math.abs(left.h - right.h) >= 2);
  });
}

/** Coherent quick action. The exact global/group/point randomizer above remains a separate tool. */
export function randomizeMonoPaletteRecipe(config: MonoPaletteConfigV1, mode: MonoPaletteMode): MonoPaletteRecipeRandomizeResult {
  const base = normalizeMonoPaletteConfig(config);
  const modes: MonoPaletteMode[] = base.linkedThemes ? [mode, mode === "dark" ? "light" : "dark"] : [mode];
  const before = Object.fromEntries(modes.map(key => [key, resolveMonoPalette(base.themes[key])])) as Record<MonoPaletteMode, MonoResolvedPalette>;
  const unchanged = (status: "noop" | "error", message: string, issues: MonoPaletteIssue[] = []): MonoPaletteRecipeRandomizeResult =>
    ({ status, config, changed: [], issues, message, replay: null });
  let lastIssues: MonoPaletteIssue[] = [];
  let lastMessage = "No safe recipe satisfies the current locks and palette constraints";
  let constraintFailed = false;

  for (let attempt = 0; attempt < 32; attempt++) {
    const next = normalizeMonoPaletteConfig(base);
    const prefix = JSON.stringify([1, next.engineVersion, next.catalogVersion, next.skinId, next.version,
      MONO_PALETTE_RECIPE_RANDOMIZER_SCHEMA_HASH, next.seed, mode, next.actionCounter, attempt]);
    const character = sampleMonoPaletteCharacter(base.themes[mode], prefix);
    let failed = false;
    for (const key of modes) {
      try {
        const focus = before[key].roles.focus;
        next.themes[key] = preserveMonoPaletteFocus(updateMonoPaletteRecipe(next.themes[key], character), focus);
      } catch (error) {
        failed = true;
        constraintFailed = true;
        lastMessage = error instanceof Error ? error.message : lastMessage;
        break;
      }
      const validation = validateMonoPaletteApply(next.themes[key]);
      if (!validation.valid) {
        failed = true;
        constraintFailed = true;
        lastIssues = validation.issues;
        lastMessage = "Recipe conflicts with palette constraints";
        break;
      }
      const resolved = resolveMonoPalette(next.themes[key]);
      for (const role of MONO_PALETTE_ROLES) {
        const protectedRole = role === "focus" || MONO_PALETTE_ROLE_SCHEMA[role].group === "system" || isLocked(base.themes[key], role);
        if (protectedRole && JSON.stringify(resolved.roles[role]) !== JSON.stringify(before[key].roles[role])) {
          failed = true;
          constraintFailed = true;
          lastMessage = `${role}: protected or locked value would change`;
          break;
        }
      }
      if (failed) break;
    }
    if (failed) continue;
    if (!hasVisibleCharacterChange(before[mode], resolveMonoPalette(next.themes[mode]), base.themes[mode])) {
      lastMessage = "No unlocked recipe-dependent role can produce a visible change";
      continue;
    }
    next.actionCounter += 1;
    return { status: "changed", config: next, changed: modes, issues: [], message: null, replay: {
      seed: base.seed, actionCounter: base.actionCounter, randomizerVersion: 1, engineVersion: 1, catalogVersion: 1,
      schemaHash: MONO_PALETTE_RECIPE_RANDOMIZER_SCHEMA_HASH, baseHash: stableHash(JSON.stringify(base)),
      skinId: "mono-ledger-v1", mode, linkedThemes: base.linkedThemes,
    } };
  }
  return unchanged(constraintFailed ? "error" : "noop", lastMessage, lastIssues);
}
