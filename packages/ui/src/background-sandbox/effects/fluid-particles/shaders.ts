import { adaptSourceShader } from "./shader-compat";
import { UPSTREAM_SHADERS } from "./upstream-shaders";

export type ParticleProgramName =
  | "transferGrid" | "mark" | "normalize" | "copy" | "force" | "boundary"
  | "divergence" | "jacobi" | "subtract" | "transferParticles" | "advect"
  | "sphere" | "sphereAO" | "sphereDepth" | "composite" | "fxaa";

type ShaderName = keyof typeof UPSTREAM_SHADERS;
type Spec = Readonly<{ vertex: ShaderName; fragment: ShaderName; tiled?: boolean; sphere?: boolean }>;
const SPECS: Record<ParticleProgramName, Spec> = {
  transferGrid: { vertex: "transfertogrid.vert", fragment: "transfertogrid.frag", tiled: true },
  mark: { vertex: "mark.vert", fragment: "mark.frag" },
  normalize: { vertex: "fullscreen.vert", fragment: "normalizegrid.frag" },
  copy: { vertex: "fullscreen.vert", fragment: "copy.frag" },
  force: { vertex: "fullscreen.vert", fragment: "addforce.frag", tiled: true },
  boundary: { vertex: "fullscreen.vert", fragment: "enforceboundaries.frag", tiled: true },
  divergence: { vertex: "fullscreen.vert", fragment: "divergence.frag", tiled: true },
  jacobi: { vertex: "fullscreen.vert", fragment: "jacobi.frag", tiled: true },
  subtract: { vertex: "fullscreen.vert", fragment: "subtract.frag", tiled: true },
  transferParticles: { vertex: "fullscreen.vert", fragment: "transfertoparticles.frag", tiled: true },
  advect: { vertex: "fullscreen.vert", fragment: "advect.frag", tiled: true },
  sphere: { vertex: "sphere.vert", fragment: "sphere.frag", sphere: true },
  sphereAO: { vertex: "sphereao.vert", fragment: "sphereao.frag", sphere: true },
  sphereDepth: { vertex: "spheredepth.vert", fragment: "spheredepth.frag", sphere: true },
  composite: { vertex: "fullscreen.vert", fragment: "composite.frag" },
  fxaa: { vertex: "fullscreen.vert", fragment: "fxaa.frag" },
};

export function particleShaderPair(name: ParticleProgramName): Readonly<{ vertex: string; fragment: string; sphere: boolean }> {
  const spec = SPECS[name];
  let fragment: string = UPSTREAM_SHADERS[spec.fragment];
  if (spec.tiled) fragment = `${UPSTREAM_SHADERS["common.frag"]}\n${fragment}`;
  if (name === "force") fragment = fragment
    .replace("void main () {", "uniform float u_gravity;\nuniform float u_pointerForce;\nvoid main () {")
    .replace("-40.0 * u_timeStep", "-u_gravity * u_timeStep")
    .replace("* 3.0 * smoothstep", "* u_pointerForce * smoothstep");
  if (name === "advect") fragment = fragment
    .replace("void main () {", "uniform float u_radiusMargin;\nvoid main () {")
    .replace("clamp(newPosition, vec3(0.01), u_gridSize - 0.01)",
      "clamp(newPosition, vec3(u_radiusMargin), u_gridSize - vec3(u_radiusMargin))");
  if (name === "sphereAO") fragment = fragment.replace(
    "vec4 data = texture2D(u_renderingTexture, coordinates);",
    "vec4 data = texture2D(u_renderingTexture, coordinates);\n    if (data.b < 0.0) discard;",
  );
  if (name === "composite") fragment = fragment
    .replace("void main () {", "uniform vec3 u_particleColor;\nuniform vec3 u_backgroundColor;\nvoid main () {")
    .replace("vec3 color = hsvToRGB(vec3(max(0.6 - speed * 0.0025, 0.52), 0.75, 1.0));",
      "vec3 sourceColor = hsvToRGB(vec3(max(0.6 - speed * 0.0025, 0.52), 0.75, 1.0));\n    vec3 color = clamp(sourceColor * u_particleColor / vec3(0.25, 0.55, 1.0), 0.0, 1.0);")
    .replace("vec3 backgroundColor = vec3(1.0) - length(v_coordinates * 2.0 - 1.0) * 0.1;",
      "vec3 backgroundColor = u_backgroundColor * (1.0 - length(v_coordinates * 2.0 - 1.0) * 0.1);");
  return { vertex: adaptSourceShader("vertex", UPSTREAM_SHADERS[spec.vertex]),
    fragment: adaptSourceShader("fragment", fragment), sphere: Boolean(spec.sphere) };
}
