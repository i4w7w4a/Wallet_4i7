import { describe, expect, it } from "vitest";
import type { OGLRenderingContext } from "ogl";
import type { MaterialDefinition } from "./material-contract";
import { bindMaterialV2 } from "./material-binding-v2";
import { createMaterialCatalogV2 } from "./registry-v2";

type Params = { pattern: "tile" | "rib"; baseColor: string; drift: number };
const definition: MaterialDefinition<"vault-grid", Params> = {
  id: "vault-grid", abiVersion: 2, effectVersion: 1, label: "Test material", description: "Catalog fixture",
  capabilities: ["background", "button-fill"], assetIds: [],
  provenance: { id: "test", sourceUrl: "https://example.com", revision: "test", license: "test", changes: [] },
  fallback: { color: "#111820", label: "Static" },
  presets: [{ id: "base", label: "Base", seed: 7, params: { pattern: "tile", baseColor: "#111820", drift: 0 } }],
  schema: {
    defaults: { pattern: "tile", baseColor: "#111820", drift: 0 },
    controls: [
      { key: "pattern", kind: "select", label: "Pattern", options: [
        { value: "tile", label: "Tile" }, { value: "rib", label: "Rib" },
      ] },
      { key: "baseColor", kind: "color", label: "Base color" },
      { key: "drift", kind: "range", label: "Drift", min: 0, max: 1, step: 0.01 },
    ],
    parse(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, issues: [
        { code: "params", message: "Invalid params" },
      ] };
      const p = input as Partial<Params>;
      if (Object.keys(p).length !== 3 || (p.pattern !== "tile" && p.pattern !== "rib") ||
          typeof p.baseColor !== "string" || !/^#[\da-f]{6}$/i.test(p.baseColor) ||
          typeof p.drift !== "number" || !Number.isFinite(p.drift) || p.drift < 0 || p.drift > 1) {
        return { ok: false, issues: [{ code: "params", message: "Invalid params" }] };
      }
      return { ok: true, value: { pattern: p.pattern, baseColor: p.baseColor.toLowerCase(), drift: p.drift } };
    },
  },
  plan() { throw new Error("Descriptor test must not acquire GPU resources"); },
  create() { throw new Error("Descriptor test must not acquire GPU resources"); },
};

describe("v2 material catalog", () => {
  it("copies a complete installed recipe into a button target without sharing its parameters", () => {
    const source = {
      kind: "novex-material", version: 2, effectId: "vault-grid", effectVersion: 1,
      seed: 7, params: { ...definition.schema.defaults }, assetIds: [],
    };
    const catalog = createMaterialCatalogV2([bindMaterialV2(definition)]);
    const copied = catalog.copyForTarget(source, "button-fill");

    expect(copied.ok).toBe(true);
    if (!copied.ok) return;
    expect(copied.value).toEqual(source);
    expect(copied.value.params).not.toBe(source.params);
    source.params.baseColor = "#ffffff";
    expect((copied.value.params as { baseColor: string }).baseColor).toBe("#111820");
  });

  it("rejects a material on a target outside its declared capabilities", () => {
    const catalog = createMaterialCatalogV2([bindMaterialV2(definition)]);
    const recipe = catalog.materials[0]!.presets[0]!.recipe;

    expect(catalog.copyForTarget(recipe, "button-border").ok).toBe(false);
    expect(catalog.copyForTarget(recipe, "button-fill").ok).toBe(true);
  });

  it("rejects an accessor recipe without running untrusted code", () => {
    const catalog = createMaterialCatalogV2([bindMaterialV2(definition)]);
    const recipe = { ...catalog.materials[0]!.presets[0]!.recipe };
    let reads = 0;
    Object.defineProperty(recipe, "effectId", { enumerable: true, get() { reads++; throw new Error("must not run"); } });

    expect(catalog.parseRecipe(recipe).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("keeps the direct descriptor parser safe for imported accessor fields", () => {
    const descriptor = bindMaterialV2(definition).descriptor;
    const recipe = { ...descriptor.presets[0]!.recipe };
    let reads = 0;
    Object.defineProperty(recipe, "seed", { enumerable: true, get() { reads++; return 1; } });

    expect(descriptor.parseRecipe(recipe).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("marks dependent controls unavailable without removing their saved values", () => {
    const conditionalDefinition = {
      ...definition,
      isControlDisabled: (params: Readonly<Params>, key: string) =>
        key === "drift" && params.pattern === "tile",
    };
    const descriptor = bindMaterialV2(conditionalDefinition).descriptor;
    const recipe = descriptor.presets[0]!.recipe;

    expect(descriptor.readControls(recipe).find(item => item.control.key === "drift")?.disabled).toBe(true);
    const updated = descriptor.updateParameter(recipe, "drift", 0.01);
    expect(updated.ok).toBe(true);
    if (updated.ok) expect((updated.value.params as { drift: number }).drift).toBe(0.01);
  });

  it("rejects accessor entries in asset IDs without evaluating them", () => {
    const descriptor = bindMaterialV2({ ...definition, assetIds: ["mono.quick.send"] }).descriptor;
    const source = descriptor.presets[0]!.recipe;
    const assetIds: string[] = ["mono.quick.send"];
    let reads = 0;
    Object.defineProperty(assetIds, "0", { enumerable: true, get() { reads++; return "mono.quick.send"; } });

    expect(descriptor.parseRecipe({ ...source, assetIds }).ok).toBe(false);
    expect(reads).toBe(0);
  });

  it("refuses duplicate effect registrations instead of choosing a hidden winner", () => {
    const binding = bindMaterialV2(definition);

    expect(() => createMaterialCatalogV2([binding, binding])).toThrow(/vault-grid/);
  });

  it("preflights a validated recipe and target before any GPU allocation", async () => {
    const runtimeDefinition: MaterialDefinition<"vault-grid", Params> = {
      ...definition,
      plan(init) { return { ok: true, value: {
        attachmentBytes: init.geometry.pixelWidth * init.geometry.pixelHeight * 4,
        textureBytes: 0, passesPerFrame: 1, quality: init.quality,
      } }; },
    };
    const binding = bindMaterialV2(runtimeDefinition);
    const geometry = { capability: "background" as const, x: 0, y: 0, width: 32, height: 16,
      pixelWidth: 64, pixelHeight: 32, dpr: 2, radiusCss: 0, borderWidthCss: 0,
      mask: { kind: "rounded-rect" as const } };
    const prepared = await binding.prepare(binding.descriptor.presets[0]!.recipe,
      geometry, "balanced", 2 * 1024 * 1024, new AbortController().signal);

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.plan({ cssWidth: 32, cssHeight: 16, pixelWidth: 64, pixelHeight: 32, dpr: 2 },
      { maxTextureSize: 4096, maxRenderTargetBytes: 28 * 1024 * 1024 })).toEqual({ ok: true, value: {
      attachmentBytes: 8192, textureBytes: 0, passesPerFrame: 1, quality: "balanced",
    } });
  });

  it("mounts the approved plan and forwards normalized edits without resetting the live pass", async () => {
    const events: string[] = [];
    const runtimeDefinition: MaterialDefinition<"vault-grid", Params> = {
      ...definition,
      plan() { return { ok: true, value: { attachmentBytes: 8192, textureBytes: 0,
        passesPerFrame: 1, quality: "balanced" } }; },
      create(_gl, init) {
        events.push(`create:${init.plan.attachmentBytes}:${init.prepared === null}`);
        return { ok: true, value: {
          update(params) { events.push(`update:${params.drift}`); },
          resize() {}, render() { throw new Error("render belongs to GPU integration"); },
          reset() { events.push("reset"); }, dispose() { events.push("dispose"); },
        } };
      },
    };
    const binding = bindMaterialV2(runtimeDefinition);
    const geometry = { capability: "background" as const, x: 0, y: 0, width: 32, height: 16,
      pixelWidth: 64, pixelHeight: 32, dpr: 2, radiusCss: 0, borderWidthCss: 0,
      mask: { kind: "rounded-rect" as const } };
    const viewport = { cssWidth: 32, cssHeight: 16, pixelWidth: 64, pixelHeight: 32, dpr: 2 };
    const limits = { maxTextureSize: 4096, maxRenderTargetBytes: 28 * 1024 * 1024 };
    const prepared = await binding.prepare(binding.descriptor.presets[0]!.recipe,
      geometry, "balanced", 2 * 1024 * 1024, new AbortController().signal);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const plan = prepared.value.plan(viewport, limits);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const mounted = prepared.value.create({} as OGLRenderingContext, viewport, limits, plan.value);
    expect(mounted.ok).toBe(true);
    if (!mounted.ok) return;
    mounted.value.update({ ...binding.descriptor.presets[0]!.recipe,
      params: { pattern: "rib", baseColor: "#FFFFFF", drift: 0.2 } });
    expect(events).toEqual(["create:8192:true", "update:0.2"]);
  });

  it("passes only host-approved icon coverage to adapter preparation", async () => {
    let received: unknown;
    const runtimeDefinition: MaterialDefinition<"vault-grid", Params> = {
      ...definition,
      capabilities: ["button-icon"],
      async prepare(request) { received = request.maskSource; return { ok: true, value: null }; },
    };
    const source = { assetId: "mono.quick.send" as const, width: 2, height: 2,
      coverage: new Uint8Array([0, 255, 255, 0]) };
    const geometry = { capability: "button-icon" as const, x: 0, y: 0, width: 2, height: 2,
      pixelWidth: 2, pixelHeight: 2, dpr: 1, radiusCss: 0, borderWidthCss: 0,
      mask: { kind: "icon" as const, assetId: source.assetId } };
    const result = await bindMaterialV2(runtimeDefinition).prepare(
      { ...bindMaterialV2(runtimeDefinition).descriptor.presets[0]!.recipe },
      geometry, "balanced", 1024, new AbortController().signal, source);

    expect(result.ok).toBe(true);
    expect(received).toBe(source);
  });
});
