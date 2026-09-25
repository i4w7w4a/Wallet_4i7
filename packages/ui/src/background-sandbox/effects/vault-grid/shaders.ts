/** Original Novex procedural material. No external texture, logo, or shader source. */
export const VAULT_GRID_VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

/**
 * One RGBA8 pass. Coordinates and dimensions are CSS pixels so cells stay square
 * at every host DPR and in a button-local render target. Output is opaque sRGB;
 * the shared compositor owns target clipping and the live DOM text/focus layer.
 */
export const VAULT_GRID_FRAGMENT = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform float u_dpr;
uniform float u_seed;
uniform float u_mode;
uniform float u_cellSize;
uniform float u_lineWidth;
uniform float u_bevel;
uniform float u_depth;
uniform float u_roughness;
uniform float u_lightAngle;
uniform float u_lightElevation;
uniform float u_lightStrength;
uniform float u_phase;
uniform vec3 u_baseColor;
uniform vec3 u_metalColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Distance from a point to the nearest horizontal or vertical cell boundary.
// Cell size is in CSS pixels; both axes use the same value at every aspect.
float gridEdge(vec2 p) {
  vec2 inCell = fract(p / u_cellSize) * u_cellSize;
  vec2 toEdge = min(inCell, u_cellSize - inCell);
  return min(toEdge.x, toEdge.y);
}

float materialHeight(vec2 p) {
  float edge = gridEdge(p);
  float halfLine = 0.5 * u_lineWidth;
  float aa = max(0.35, 0.45 / u_dpr);

  if (u_mode < 0.5) {
    // Separate square plates: dark gap, sloped bevel, broad level face.
    return smoothstep(halfLine - aa, halfLine + u_bevel + aa, edge);
  }
  if (u_mode < 1.5) {
    // Raised orthogonal bars cross at every grid intersection.
    return 1.0 - smoothstep(max(0.0, halfLine - aa), halfLine + u_bevel + aa, edge);
  }

  // Engraved material: narrow V-like cut and a restrained raised lip.
  float cut = 1.0 - smoothstep(halfLine - aa, halfLine + aa, edge);
  float shoulder = 1.0 - smoothstep(halfLine, halfLine + u_bevel + aa, edge);
  float lip = smoothstep(halfLine, halfLine + 0.55 * u_bevel, edge)
    * (1.0 - smoothstep(halfLine + 0.55 * u_bevel, halfLine + u_bevel + aa, edge));
  return 1.0 - 0.58 * cut - 0.22 * shoulder + 0.12 * lip;
}

void main() {
  vec2 p = gl_FragCoord.xy / u_dpr;
  float height = materialHeight(p);
  // Central differences are cheap here: no texture reads or extra passes.
  const float epsilon = 0.7;
  vec2 gradient = vec2(
    materialHeight(p + vec2(epsilon, 0.0)) - materialHeight(p - vec2(epsilon, 0.0)),
    materialHeight(p + vec2(0.0, epsilon)) - materialHeight(p - vec2(0.0, epsilon))
  ) / (2.0 * epsilon);
  vec3 normal = normalize(vec3(-gradient * u_depth * 2.6, 1.0));

  float azimuth = radians(u_lightAngle) + u_phase;
  float elevation = radians(u_lightElevation);
  vec3 lightDir = normalize(vec3(cos(azimuth) * cos(elevation),
    sin(azimuth) * cos(elevation), sin(elevation)));
  vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float diffuse = max(dot(normal, lightDir), 0.0);
  float specular = pow(max(dot(normal, halfDir), 0.0), mix(90.0, 4.0, u_roughness));
  specular *= mix(0.72, 0.10, u_roughness) * u_lightStrength;

  float coverage;
  if (u_mode < 0.5) coverage = mix(0.12, 1.0, clamp(height, 0.0, 1.0));
  else if (u_mode < 1.5) coverage = mix(0.20, 1.0, clamp(height, 0.0, 1.0));
  else coverage = 1.0 - clamp((1.0 - height) * 1.2, 0.0, 1.0);

  // Palette inputs are sRGB; illumination is evaluated in approximate linear RGB.
  vec3 baseLinear = pow(u_baseColor, vec3(2.2));
  vec3 metalLinear = pow(u_metalColor, vec3(2.2));
  vec3 material = mix(baseLinear, metalLinear, coverage);
  float occlusion = mix(0.74, 1.0, coverage);
  vec3 lit = material * (0.55 + u_lightStrength * (0.10 + 0.53 * diffuse)) * occlusion;
  lit += metalLinear * specular * coverage * 0.40;

  // Microscopic fixed grain changes roughness without moving the geometry.
  float grain = hash21(floor(p * vec2(0.78, 1.13)) + u_seed) - 0.5;
  vec3 srgb = pow(clamp(lit, 0.0, 1.0), vec3(1.0 / 2.2));
  srgb += grain * u_roughness * 0.018;
  fragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}`;
