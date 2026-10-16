import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoldLiquidRenderer, GOLD_LIQUID_INTERACTION_LIMITS } from "./mono-gold-liquid-renderer";
import { normalizeGoldLiquidSettings } from "./mono-gold-liquid-settings";

// GL is the unavailable external boundary in jsdom; shader pixels are a browser gate.
function driver(failure?: "compile" | "link" | "texture" | "upload", textureLimit = 4096) {
  const resources = new Set<object>();
  const make = () => { const value = {}; resources.add(value); return value; };
  const drop = (value: object) => resources.delete(value);
  const uniforms = new Map<string, number>();
  const vectors = new Map<string, number[]>();
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    MAX_TEXTURE_SIZE: 5, MAX_RENDERBUFFER_SIZE: 6, MAX_VIEWPORT_DIMS: 7,
    ARRAY_BUFFER: 8, STATIC_DRAW: 9, FLOAT: 10, TEXTURE_2D: 11, RGBA: 12, UNSIGNED_BYTE: 13,
    TEXTURE_MIN_FILTER: 14, TEXTURE_MAG_FILTER: 15, LINEAR: 16, TEXTURE_WRAP_S: 17,
    TEXTURE_WRAP_T: 18, CLAMP_TO_EDGE: 19, TEXTURE0: 20, TRIANGLES: 21,
    DEPTH_TEST: 22, STENCIL_TEST: 23, BLEND: 24, NO_ERROR: 0,
    createShader: vi.fn(make), shaderSource: vi.fn(), compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => failure !== "compile"), getShaderInfoLog: vi.fn(() => "compile failure"),
    createProgram: vi.fn(make), attachShader: vi.fn(), linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => failure !== "link"), getProgramInfoLog: vi.fn(() => "link failure"),
    createBuffer: vi.fn(make), bindBuffer: vi.fn(), bufferData: vi.fn(),
    createTexture: vi.fn(() => failure === "texture" ? null : make()), bindTexture: vi.fn(),
    texImage2D: vi.fn(), texParameteri: vi.fn(), activeTexture: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => name),
    uniform1f: vi.fn((name: string, value: number) => uniforms.set(name, value)),
    uniform1i: vi.fn(), uniform2f: vi.fn(),
    uniform4f: vi.fn((name: string, ...values: number[]) => vectors.set(name, values)),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(), vertexAttribPointer: vi.fn(), disable: vi.fn(),
    useProgram: vi.fn(), viewport: vi.fn(), drawArrays: vi.fn(),
    getParameter: vi.fn((key: number) => key === 7 ? [4096, 4096] : key === 5 ? textureLimit : 4096),
    isContextLost: vi.fn(() => false), getError: vi.fn(() => failure === "upload" ? 1285 : 0),
    deleteShader: vi.fn(drop), deleteProgram: vi.fn(drop),
    deleteTexture: vi.fn(drop), deleteBuffer: vi.fn(drop),
  };
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(gl as unknown as WebGLRenderingContext);
  return { gl, canvas, uniforms, vectors, resources };
}
afterEach(() => vi.restoreAllMocks());

describe("Gold single-pass GL boundary", () => {
  it.each([512, 256])("prepares a soft, opaque source within the Y budget at texture cap %s", side => {
    const gpu = driver(undefined, side);
    const renderer = createGoldLiquidRenderer(gpu.canvas, normalizeGoldLiquidSettings({ ior: 0 }))!;
    const upload = gpu.gl.texImage2D.mock.calls[0];
    const pixels = upload[8] as Uint8Array;
    const decode = (byte: number) => {
      const c = byte / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const actualSide = upload[3] as number;
    const luminance = new Float32Array(actualSide * actualSide);
    let peak = 0, opaque = true;
    const differences: number[] = [], detail: number[] = [];
    for (let y = 0; y < actualSide; y++) for (let x = 0; x < actualSide; x++) {
      const texel = y * actualSide + x, i = texel * 4;
      const value = decode(pixels[i]) * 0.2126 + decode(pixels[i + 1]) * 0.7152 + decode(pixels[i + 2]) * 0.0722;
      luminance[texel] = value;
      opaque &&= pixels[i + 3] === 255;
      peak = Math.max(peak, value);
      if (x > 0) differences.push(Math.abs(value - luminance[texel - 1]));
      if (y > 0) differences.push(Math.abs(value - luminance[texel - actualSide]));
      if (y / actualSide < 0.56 && (x / actualSide >= 0.27 && x / actualSide < 0.35 ||
        x / actualSide >= 0.65 && x / actualSide < 0.73)) detail.push(value);
    }
    differences.sort((a, b) => a - b);
    detail.sort((a, b) => a - b);
    expect(opaque).toBe(true);
    expect(peak).toBeLessThanOrEqual(0.030);
    expect.soft(differences.at(-1)).toBeLessThanOrEqual(0.0045);
    expect.soft(differences[Math.floor(differences.length * 0.99)]).toBeLessThanOrEqual(0.0015);
    expect(detail[Math.floor(detail.length * 0.95)] - detail[Math.floor(detail.length * 0.05)]).toBeGreaterThan(0.003);
    // Count prominent ridges in uploaded pixels, ignoring RGBA8 plateaus/rounding noise.
    for (const row of [0.20, 0.36, 0.52]) {
      const offset = Math.floor(actualSide * row) * actualSide;
      let peaks = 0, rising = false, valley = luminance[offset], crest = valley;
      for (let x = 1; x < actualSide; x++) {
        const value = luminance[offset + x];
        if (!rising) {
          valley = Math.min(valley, value);
          if (value - valley > 0.0015) { rising = true; crest = value; }
        } else {
          crest = Math.max(crest, value);
          if (crest - value > 0.0015) { peaks++; rising = false; valley = value; }
        }
      }
      if (rising) peaks++;
      expect(peaks).toBeGreaterThan(0);
      expect(peaks).toBeLessThanOrEqual(2);
    }
    expect(upload[3]).toBe(side);
    expect(upload[4]).toBe(side);
    expect(pixels.byteLength).toBe(side * side * 4);
    expect(pixels.byteLength).toBeLessThanOrEqual(1048576);
    renderer.resize(390, 844, 2);
    renderer.render(0); renderer.render(10);
    expect(gpu.gl.texImage2D).toHaveBeenCalledTimes(1);
    renderer.dispose();
    expect(gpu.resources.size).toBe(0);
  });
  it("keeps broad fold softness in CSS pixels and consumes the unchanged optical defaults", () => {
    const gpu = driver();
    const renderer = createGoldLiquidRenderer(gpu.canvas, normalizeGoldLiquidSettings({}))!;
    renderer.resize(480, 1244, 1);
    renderer.render(2);
    expect(gpu.uniforms.get("uFoldCoreSigmaPixels")).toBe(12);
    expect(gpu.uniforms.get("uFoldGlowSigmaPixels")).toBe(36);
    expect(gpu.uniforms.get("uTapRadiusPixels")).toBe(56);
    expect(gpu.uniforms.get("uMediaYKnee")).toBe(0.016);
    expect(gpu.uniforms.get("uMediaYLimit")).toBe(0.028);
    expect(gpu.uniforms.get("uDispersion")).toBe(0.012);
    expect(gpu.uniforms.get("uHighlightStrength")).toBe(0.24);
    renderer.resize(480, 2000, 4);
    renderer.render(3);
    expect(gpu.uniforms.get("uFoldCoreSigmaPixels")).toBeCloseTo(12 * gpu.canvas.height / 2000);
    expect(gpu.uniforms.get("uFoldGlowSigmaPixels")).toBeCloseTo(36 * gpu.canvas.height / 2000);
    expect(gpu.canvas.width * gpu.canvas.height).toBeLessThanOrEqual(786432);
    expect(gpu.gl.texImage2D).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });
  it("bounds ephemeral response, clears it on the next ordinary draw and never uploads a new texture", () => {
    const gpu = driver();
    const renderer = createGoldLiquidRenderer(gpu.canvas, normalizeGoldLiquidSettings({}))!;
    renderer.resize(390, 844, 2);
    renderer.render(1, { tapUv: [-5, 9], tapAge: 0.12, tapStrength: 8, scrollShiftCss: 10000 });
    expect(gpu.vectors.get("uTap")).toEqual([0, 1, 0.12, 1]);
    expect(gpu.uniforms.get("uScrollShift")).toBeCloseTo(6 / 844);
    renderer.render(2, { tapUv: [NaN, Infinity], tapAge: Infinity, tapStrength: 1, scrollShiftCss: NaN });
    expect(gpu.vectors.get("uTap")).toEqual([0.5, 0.5, GOLD_LIQUID_INTERACTION_LIMITS.tapLifetime, 0]);
    expect(gpu.uniforms.get("uScrollShift")).toBe(0);
    renderer.render(3, { tapUv: [0.2, 0.8], tapAge: 0.08, tapStrength: 0.4, scrollShiftCss: -9 });
    expect(gpu.vectors.get("uTap")).toEqual([0.2, 0.8, 0.08, 0.4]);
    expect(gpu.uniforms.get("uScrollShift")).toBeCloseTo(-6 / 844);
    renderer.render(4);
    expect(gpu.vectors.get("uTap")?.[3]).toBe(0);
    expect(gpu.uniforms.get("uScrollShift")).toBe(0);
    expect(gpu.gl.texImage2D).toHaveBeenCalledTimes(1);
    expect(gpu.gl.createTexture).toHaveBeenCalledTimes(1);
    expect(gpu.gl.drawArrays).toHaveBeenCalledTimes(4);
    renderer.dispose();
    expect(gpu.resources.size).toBe(0);
  });
  it("passes signed and zero optical settings to the real renderer consumer", () => {
    const gpu = driver();
    const renderer = createGoldLiquidRenderer(gpu.canvas, normalizeGoldLiquidSettings({ ior: -0.83 }))!;
    expect(renderer.resize(390, 844, 4)).toBe(true);
    expect(renderer.render(2)).toBe(true);
    expect(gpu.uniforms.get("uIOR")).toBe(-0.83);
    renderer.update(normalizeGoldLiquidSettings({ ior: 0, cornerRadius: 0, dispersion: 0,
      highlightStrength: 0, fieldStrength: 0, flowSpeed: 0, fieldEnabled: false, fieldFadeMode: 0 }));
    expect(renderer.render(3)).toBe(true);
    for (const name of ["uIOR", "uCornerRadius", "uDispersion", "uHighlightStrength", "uFieldStrength", "uFlowSpeed", "uFieldEnabled", "uFieldFadeMode"])
      expect(gpu.uniforms.get(name)).toBe(0);
    expect(gpu.canvas.width * gpu.canvas.height).toBeLessThanOrEqual(786432);
    expect(gpu.gl.drawArrays).toHaveBeenCalledTimes(2);
    const upload = gpu.gl.texImage2D.mock.calls[0];
    expect(upload[3]).toBe(512);
    expect(upload[4]).toBe(512);
    expect(upload[8]).toBeInstanceOf(Uint8Array);
    expect((upload[8] as Uint8Array).length).toBe(1048576);
    renderer.dispose();
    renderer.dispose();
    expect(gpu.resources.size).toBe(0);
    expect(gpu.canvas.width * gpu.canvas.height).toBe(1);
    expect(gpu.gl.useProgram.mock.calls.at(-1)).toEqual([null]);
    expect(renderer.render(4)).toBe(false);
    expect(gpu.gl.drawArrays).toHaveBeenCalledTimes(2);
  });

  it.each(["compile", "link", "texture", "upload"] as const)("cleans partial resources after %s failure", failure => {
    const gpu = driver(failure);
    expect(createGoldLiquidRenderer(gpu.canvas, normalizeGoldLiquidSettings({}))).toBeNull();
    expect(gpu.resources.size).toBe(0);
    expect(gpu.gl.drawArrays).not.toHaveBeenCalled();
  });
  it("returns safe fallback when WebGL is unavailable", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    expect(createGoldLiquidRenderer(canvas, normalizeGoldLiquidSettings({}))).toBeNull();
  });
  it("does not draw into a lost context", () => {
    const gpu = driver();
    const renderer = createGoldLiquidRenderer(gpu.canvas, normalizeGoldLiquidSettings({}))!;
    renderer.resize(390, 844, 2);
    gpu.gl.isContextLost.mockReturnValue(true);
    expect(renderer.render(10)).toBe(false);
    expect(gpu.gl.drawArrays).not.toHaveBeenCalled();
    renderer.dispose();
    expect(gpu.resources.size).toBe(0);
  });
});
