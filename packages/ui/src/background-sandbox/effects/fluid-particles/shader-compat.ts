/** Mechanical WebGL1 to WebGL2 syntax conversion; solver equations stay upstream. */
export function adaptSourceShader(stage: "vertex" | "fragment", source: string): string {
  let body = source;
  if (/sampler2D\s+texture\b/.test(body)) body = body.replace(/\btexture\b/g, "sourceTex");
  body = body.replace(/\btexture3DNearest\b/g, "sampleTiledGridNearest")
    .replace(/\btexture3D\b/g, "sampleTiledGrid")
    .replace(/\btexture2D\b/g, "texture")
    .replace(/\bvarying\b/g, stage === "vertex" ? "out" : "in")
    .replace(/\battribute\b/g, "in")
    .replace(/\bgl_FragColor\b/g, "fragColor");
  return `#version 300 es\nprecision highp float;\n${stage === "fragment" ? "out vec4 fragColor;\n" : ""}${body}`;
}
