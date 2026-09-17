import {
  MONO_PALETTE_GROUPS, MONO_PALETTE_ROLES, MONO_PALETTE_SCHEMA_HASH,
  normalizeMonoPaletteConfig, resolveMonoPalette, validateMonoPaletteApply,
  type MonoPaletteConfigV1, type MonoPaletteMode, type MonoPaletteRole,
  type MonoResolvedPalette, type ThemePaletteState,
} from "@wallet/ui";

export type MonoSha256 = (bytes: Uint8Array) => Promise<Uint8Array>;
export type MonoPalettePresetV1 = {
  schemaVersion: 1; skinId: "mono-ledger-v1"; configVersion: 1; engineVersion: 1; catalogVersion: 1;
  schemaHash: string; config: MonoPaletteConfigV1;
  resolved: Record<MonoPaletteMode, MonoResolvedPalette>; contentHash: string;
};
export type MonoPaletteFragmentScope = "entire" | "dark" | "light" | "palette" | "background" | "glass-color" | "typography";
export type MonoPaletteFragment = { version: 1; scope: MonoPaletteFragmentScope; payload: unknown };
export type MonoPaletteDiff = { path: string; before: unknown; after: unknown };
export type MonoPaletteMerge = { config: MonoPaletteConfigV1; diff: MonoPaletteDiff[]; skipped: string[]; issues: string[] };

const LIMIT = 131_072;
const scopes: MonoPaletteFragmentScope[] = ["entire", "dark", "light", "palette", "background", "glass-color", "typography"];
const colorTemplate = { l: 0, c: 0, h: 0, alpha: 1 };
const clone = <T,>(value: T): T => structuredClone(value);
const has = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Browser Web Crypto boundary; Node callers may inject node:crypto's SHA-256. */
export const webCryptoMonoSha256: MonoSha256 = async bytes => {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource));
};

async function hash(value: unknown, sha256: MonoSha256): Promise<string> {
  const output = await sha256(new TextEncoder().encode(JSON.stringify(value)));
  if (output.length !== 32) throw new Error("SHA-256 digest must contain 32 bytes");
  return `sha256-${Array.from(output, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function strictShape(value: unknown, template: unknown, path: string): void {
  if (template === null) {
    if (value !== null) strictShape(value, colorTemplate, path);
    return;
  }
  if (has(template)) {
    if (!has(value)) throw new Error(`Invalid field ${path}`);
    const wanted = Object.keys(template);
    for (const key of Object.keys(value)) if (!wanted.includes(key)) throw new Error(`Unknown field ${path}.${key}`);
    for (const key of wanted) {
      if (!(key in value)) throw new Error(`Missing field ${path}.${key}`);
      strictShape(value[key], template[key], `${path}.${key}`);
    }
    return;
  }
  if (typeof value !== typeof template || (typeof value === "number" && !Number.isFinite(value))) throw new Error(`Invalid field ${path}`);
}

function payload(config: MonoPaletteConfigV1) {
  return {
    schemaVersion: 1 as const, skinId: "mono-ledger-v1" as const, configVersion: 1 as const,
    engineVersion: 1 as const, catalogVersion: 1 as const, schemaHash: MONO_PALETTE_SCHEMA_HASH,
    config,
    resolved: { dark: resolveMonoPalette(config.themes.dark), light: resolveMonoPalette(config.themes.light) },
  };
}

export async function exportMonoPalettePreset(config: MonoPaletteConfigV1, sha256: MonoSha256 = webCryptoMonoSha256): Promise<string> {
  const body = payload(normalizeMonoPaletteConfig(config));
  return JSON.stringify({ ...body, contentHash: await hash(body, sha256) });
}

export async function importMonoPalettePreset(text: string, sha256: MonoSha256 = webCryptoMonoSha256): Promise<MonoPalettePresetV1> {
  if (new TextEncoder().encode(text).length > LIMIT) throw new Error("Palette preset size limit exceeded");
  const input: unknown = JSON.parse(text);
  if (!has(input)) throw new Error("Invalid palette preset");
  for (const key of ["schemaVersion", "configVersion", "engineVersion", "catalogVersion"])
    if (input[key] !== 1) throw new Error(`Unsupported palette ${key} version`);
  if (input.skinId !== "mono-ledger-v1" || input.schemaHash !== MONO_PALETTE_SCHEMA_HASH) throw new Error("Unsupported palette schema version");
  const config = normalizeMonoPaletteConfig(input.config);
  const expected = payload(config);
  strictShape(input, { ...expected, contentHash: "" }, "preset");
  strictShape(input.config, config, "config");
  strictShape(input.resolved, expected.resolved, "resolved");
  if (!equal(input.config, config) || !equal(input.resolved, expected.resolved)) throw new Error("Preset values are not normalized or resolved");
  if (input.contentHash !== await hash(expected, sha256)) throw new Error("Preset content hash mismatch");
  return input as MonoPalettePresetV1;
}

function roleSelection(scope: MonoPaletteFragmentScope): MonoPaletteRole[] {
  if (scope === "background") return ["canvas", "atmosphereCool", "atmosphereWarm"];
  if (scope === "glass-color") return ["glassTint", "edgeCool", "edgeWarm"];
  // Font IDs have no field in the color-only V1 contract. Keep this scope
  // allowlisted but inert until a typed typography contract exists.
  if (scope === "typography") return [];
  return [...MONO_PALETTE_ROLES];
}

function copyRoleValue(target: ThemePaletteState["roles"][MonoPaletteRole], source: ThemePaletteState["roles"][MonoPaletteRole], respectLocks: boolean) {
  return respectLocks ? { ...clone(source), locked: target.locked, lockedValue: clone(target.lockedValue) } : clone(source);
}

export function createMonoPaletteFragment(preset: MonoPalettePresetV1, scope: MonoPaletteFragmentScope): MonoPaletteFragment {
  if (!scopes.includes(scope)) throw new Error("Unsupported palette fragment scope");
  if (scope === "entire") return { version: 1, scope, payload: clone(preset.config) };
  if (scope === "dark" || scope === "light") return { version: 1, scope, payload: clone(preset.config.themes[scope]) };
  if (scope === "palette") return { version: 1, scope, payload: clone(preset.config.themes) };
  const roles = roleSelection(scope);
  return { version: 1, scope, payload: {
    dark: Object.fromEntries(roles.map(role => [role, clone(preset.config.themes.dark.roles[role])])),
    light: Object.fromEntries(roles.map(role => [role, clone(preset.config.themes.light.roles[role])])),
  } };
}

function validateFragment(fragment: MonoPaletteFragment): void {
  if (fragment.version !== 1 || !scopes.includes(fragment.scope)) throw new Error("Unsupported palette fragment scope or version");
  const defaults = normalizeMonoPaletteConfig();
  if (fragment.scope === "entire") strictShape(fragment.payload, defaults, "fragment");
  else if (fragment.scope === "dark" || fragment.scope === "light") strictShape(fragment.payload, defaults.themes[fragment.scope], "fragment");
  else if (fragment.scope === "palette") strictShape(fragment.payload, defaults.themes, "fragment");
  else {
    const roles = roleSelection(fragment.scope);
    const template = Object.fromEntries((["dark", "light"] as const).map(mode => [mode,
      Object.fromEntries(roles.map(role => [role, defaults.themes[mode].roles[role]]))]));
    strictShape(fragment.payload, template, "fragment");
  }
}

function mergeTheme(target: ThemePaletteState, source: ThemePaletteState, respectLocks: boolean, path: string, diff: MonoPaletteDiff[], skipped: string[]): ThemePaletteState {
  const next = clone(target);
  if (!equal(target.recipe, source.recipe)) {
    diff.push({ path: `${path}.recipe`, before: clone(target.recipe), after: clone(source.recipe) });
    next.recipe = clone(source.recipe);
  }
  for (const role of MONO_PALETTE_ROLES) {
    if (equal(target.roles[role], source.roles[role])) continue;
    const rolePath = `${path}.roles.${role}`;
    if (respectLocks && (target.groupLocks[Object.entries(MONO_PALETTE_GROUPS).find(([, values]) => (values as readonly string[]).includes(role))![0] as keyof typeof MONO_PALETTE_GROUPS] || target.roles[role].locked)) {
      skipped.push(rolePath);
      continue;
    }
    const after = copyRoleValue(target.roles[role], source.roles[role], respectLocks);
    diff.push({ path: rolePath, before: clone(target.roles[role]), after: clone(after) });
    next.roles[role] = after;
  }
  if (!respectLocks) next.groupLocks = clone(source.groupLocks);
  return next;
}

export function mergeMonoPaletteFragment(target: MonoPaletteConfigV1, fragment: MonoPaletteFragment, options: { respectLocks?: boolean } = {}): MonoPaletteMerge {
  validateFragment(fragment);
  const respectLocks = options.respectLocks !== false;
  const config = normalizeMonoPaletteConfig(target), diff: MonoPaletteDiff[] = [], skipped: string[] = [];
  const modes: MonoPaletteMode[] = fragment.scope === "dark" || fragment.scope === "light" ? [fragment.scope] : ["dark", "light"];
  if (fragment.scope === "entire" || fragment.scope === "palette" || fragment.scope === "dark" || fragment.scope === "light") {
    const source = fragment.scope === "entire" ? (fragment.payload as MonoPaletteConfigV1).themes :
      fragment.scope === "palette" ? fragment.payload as MonoPaletteConfigV1["themes"] : { [fragment.scope]: fragment.payload } as Partial<MonoPaletteConfigV1["themes"]>;
    for (const mode of modes) config.themes[mode] = mergeTheme(config.themes[mode], source[mode]!, respectLocks, `themes.${mode}`, diff, skipped);
    if (fragment.scope === "entire") {
      const full = fragment.payload as MonoPaletteConfigV1;
      config.seed = full.seed; config.actionCounter = full.actionCounter; config.linkedThemes = full.linkedThemes;
    }
  } else {
    const source = fragment.payload as Record<MonoPaletteMode, Record<MonoPaletteRole, ThemePaletteState["roles"][MonoPaletteRole]>>;
    for (const mode of modes) for (const role of roleSelection(fragment.scope)) {
      const current = config.themes[mode], rolePath = `themes.${mode}.roles.${role}`;
      if (equal(current.roles[role], source[mode][role])) continue;
      const group = Object.entries(MONO_PALETTE_GROUPS).find(([, values]) => (values as readonly string[]).includes(role))![0] as keyof typeof MONO_PALETTE_GROUPS;
      if (respectLocks && (current.groupLocks[group] || current.roles[role].locked)) { skipped.push(rolePath); continue; }
      const after = copyRoleValue(current.roles[role], source[mode][role], respectLocks);
      diff.push({ path: rolePath, before: clone(current.roles[role]), after: clone(after) });
      current.roles[role] = after;
    }
  }
  const normalized = normalizeMonoPaletteConfig(config);
  const issues = modes.flatMap(mode => validateMonoPaletteApply(normalized.themes[mode]).issues.map(issue => `${mode}.${issue.role}: ${issue.message}`));
  if (fragment.scope === "typography") issues.push("Typography is not part of MonoPaletteConfigV1");
  return { config: normalized, diff, skipped, issues };
}

export function previewMonoPaletteFragment(target: MonoPaletteConfigV1, fragment: MonoPaletteFragment): MonoPaletteMerge {
  return mergeMonoPaletteFragment(target, fragment);
}
