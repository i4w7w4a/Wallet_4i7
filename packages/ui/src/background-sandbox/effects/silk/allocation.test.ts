import { describe, expect, it } from "vitest";
import type { OGLRenderingContext } from "ogl";
import { captureConstruction } from "./allocation";

// A narrow native allocation boundary. Real OGL lifecycle is exercised by the
// browser proof; here a constructor can fail at every native allocation point.
function nativeBoundary() {
  const created: object[] = [];
  const deleted: object[] = [];
  const allocation = () => { const handle = {}; created.push(handle); return handle; };
  const deletion = (handle: object) => deleted.push(handle);
  const gl = {
    createShader: allocation, createProgram: allocation, createBuffer: allocation,
    createTexture: allocation, createFramebuffer: allocation,
    deleteShader: deletion, deleteProgram: deletion, deleteBuffer: deletion,
    deleteTexture: deletion, deleteFramebuffer: deletion,
    renderer: {
      state: { framebuffer: null, boundBuffer: null, textureUnits: [11] },
      bindFramebuffer: () => {},
    },
  } as unknown as OGLRenderingContext;
  return { gl, created, deleted };
}

describe("Silk synchronous constructor rollback", () => {
  it("cleans only partial owned allocations and restores exact methods after an exception", () => {
    const { gl, deleted } = nativeBoundary();
    const neighbor = gl.createTexture();
    const originals = [gl.createShader, gl.createProgram, gl.createBuffer, gl.createTexture, gl.createFramebuffer];
    let ownShader: WebGLShader | null = null;
    let ownTexture: WebGLTexture | null = null;
    expect(() => captureConstruction(gl, () => {
      ownShader = gl.createShader(0);
      ownTexture = gl.createTexture();
      gl.renderer.state.textureUnits[0] = 12;
      throw new Error("constructor failed");
    })).toThrow("constructor failed");
    expect(deleted).toEqual([ownTexture, ownShader]);
    expect(deleted).not.toContain(neighbor);
    expect(gl.renderer.state.textureUnits[0]).toBe(-1);
    expect([gl.createShader, gl.createProgram, gl.createBuffer, gl.createTexture, gl.createFramebuffer]).toEqual(originals);
  });

  it("allows a fresh successful create on the same context after failure", () => {
    const { gl, deleted } = nativeBoundary();
    expect(() => captureConstruction(gl, () => {
      gl.createBuffer();
      throw new Error("first failure");
    })).toThrow();
    const texture = captureConstruction(gl, () => gl.createTexture());
    expect(texture).toBeTruthy();
    expect(deleted).toHaveLength(1);
    expect(deleted).not.toContain(texture);
  });

  it("treats a null native allocation as failure and rolls back earlier handles", () => {
    const { gl, deleted } = nativeBoundary();
    Object.defineProperty(gl, "createTexture", { configurable: true, writable: true, value: () => null });
    expect(() => captureConstruction(gl, () => {
      gl.createShader(0);
      gl.createTexture();
    })).toThrow();
    expect(deleted).toHaveLength(1);
    expect(gl.createTexture()).toBeNull();
  });
});
