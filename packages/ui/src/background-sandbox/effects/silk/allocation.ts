import type { OGLRenderingContext } from "ogl";

/** OGL constructors may throw before returning their resource-owning instance.
 * Capture only their synchronous native allocations; never wrap rendering or
 * await inside this scope. Restore property descriptors, including inheritance.
 */
export function captureConstruction<T>(gl: OGLRenderingContext, construct: () => T): T {
  const release: (() => void)[] = [];
  const restore: (() => void)[] = [];
  const texturesBefore = gl.renderer.state.textureUnits.slice();
  const pairs = [
    ["createShader", "deleteShader"], ["createProgram", "deleteProgram"],
    ["createBuffer", "deleteBuffer"], ["createTexture", "deleteTexture"],
    ["createFramebuffer", "deleteFramebuffer"],
  ] as const;
  try {
    for (const [create, remove] of pairs) {
      const descriptor = Object.getOwnPropertyDescriptor(gl, create);
      const original = gl[create];
      Object.defineProperty(gl, create, {
        configurable: true, writable: true,
        value: (...args: unknown[]) => {
          const handle: unknown = Reflect.apply(original, gl, args);
          if (!handle) throw new Error(`Silk: ${create} failed`);
          release.push(() => {
            if (gl.renderer.state.framebuffer === handle) gl.renderer.bindFramebuffer();
            if (gl.renderer.state.boundBuffer === handle) gl.renderer.state.boundBuffer = null;
            Reflect.apply(gl[remove], gl, [handle]);
          });
          return handle;
        },
      });
      restore.push(() => {
        if (descriptor) Object.defineProperty(gl, create, descriptor);
        else Reflect.deleteProperty(gl, create);
      });
    }
    return construct();
  } catch (error) {
    for (const dispose of release.reverse()) dispose();
    // Only invalidate units touched by this construction. Other context users'
    // resources and uniform caches are untouched; no render-state bypass.
    gl.renderer.state.textureUnits.forEach((id, index, units) => {
      if (id !== texturesBefore[index]) units[index] = -1;
    });
    throw error;
  } finally {
    for (const putBack of restore.reverse()) putBack();
  }
}
