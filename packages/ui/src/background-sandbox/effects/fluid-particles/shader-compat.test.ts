import { describe, expect, it } from "vitest";
import { adaptSourceShader } from "./shader-compat";

describe("David Li shader port", () => {
  it("moves vertex attributes and varyings to GLSL 300 in/out", () => {
    const shader = adaptSourceShader("vertex", "attribute vec2 a_position; varying vec2 v_uv; void main(){ v_uv=a_position; gl_Position=vec4(a_position,0.,1.); }");
    expect(shader).toContain("#version 300 es");
    expect(shader).toContain("in vec2 a_position;");
    expect(shader).toContain("out vec2 v_uv;");
    expect(shader).not.toContain("attribute");
  });

  it("retains tiled 3D sampling without colliding with GLSL texture", () => {
    const shader = adaptSourceShader("fragment", "varying vec2 v_uv; vec4 texture3D(sampler2D texture, vec2 uv){ return texture2D(texture, uv); } void main(){ gl_FragColor=texture3D(s, v_uv); }");
    expect(shader).toContain("in vec2 v_uv;");
    expect(shader).toContain("vec4 sampleTiledGrid(sampler2D sourceTex");
    expect(shader).toContain("texture(sourceTex, uv)");
    expect(shader).toContain("fragColor=sampleTiledGrid(s, v_uv)");
    expect(shader).not.toContain("gl_FragColor");
  });
});
