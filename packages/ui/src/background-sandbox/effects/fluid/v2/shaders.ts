/** Pavel MIT solver passes remain imported unchanged from v1. Post passes adapt his
 * pinned bloom/sunrays mathematics; see ../LICENSE.upstream and ./PROVENANCE.md. */
export {
  vertex, clear, curl, vorticity, divergence, decayPressure, pressure, gradient,
  splat as velocitySplat,
} from "../shaders";

const header = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
`;

const pigments = `
uniform sampler2D dyeA;
uniform sampler2D dyeB;
uniform vec3 color0;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;
uniform vec3 color5;
uniform float colorAlpha;
vec3 colorAt(vec2 uv) {
  vec4 a = max(texture(dyeA, uv), vec4(0.0));
  vec4 b = max(texture(dyeB, uv), vec4(0.0));
  return (a.r * color0 + a.g * color1 + a.b * color2 + a.a * color3 +
          b.r * color4 + b.g * color5) * colorAlpha;
}
float massAt(vec2 uv) {
  vec4 a = max(texture(dyeA, uv), vec4(0.0));
  vec4 b = max(texture(dyeB, uv), vec4(0.0));
  return dot(a, vec4(1.0)) + b.r + b.g;
}
`;

export const pigmentSplat = `${header}
uniform sampler2D source;
uniform vec2 point;
uniform vec4 impulse;
uniform float radius;
uniform float aspect;
void main() {
  vec2 p = vUv - point;
  p.x *= aspect;
  outColor = clamp(texture(source, vUv) + exp(-dot(p, p) / radius) * impulse, 0.0, 8.0);
}
`;

export const advect = `${header}
uniform sampler2D velocity;
uniform sampler2D source;
uniform vec2 texelSize;
uniform float dt;
uniform float retention;
void main() {
  vec2 coordinate = vUv - dt * texture(velocity, vUv).xy * texelSize;
  outColor = texture(source, coordinate) * retention;
}
`;

export const bloomPrefilter = `${header}${pigments}
uniform float threshold;
void main() {
  vec3 c = max(colorAt(vUv), vec3(0.0));
  float br = max(c.r, max(c.g, c.b));
  float knee = threshold * 0.7 + 0.0001;
  float rq = clamp(br - (threshold - knee), 0.0, 2.0 * knee);
  rq = (0.25 / knee) * rq * rq;
  outColor = vec4(c * max(rq, br - threshold) / max(br, 0.0001), 1.0);
}
`;

export const bloomDownsample = `${header}
uniform sampler2D source;
uniform vec2 texelSize;
void main() {
  vec2 x = vec2(texelSize.x, 0.0);
  vec2 y = vec2(0.0, texelSize.y);
  outColor = 0.25 * (texture(source, vUv - x) + texture(source, vUv + x) +
                     texture(source, vUv - y) + texture(source, vUv + y));
}
`;

export const sunraysMask = `${header}${pigments}
void main() {
  vec3 c = max(colorAt(vUv), vec3(0.0));
  float br = max(c.r, max(c.g, c.b));
  outColor = vec4(1.0 - min(max(br * 20.0, 0.0), 0.8), 0.0, 0.0, 1.0);
}
`;

export const sunrays = `${header}
uniform sampler2D mask;
uniform float weight;
void main() {
  vec2 coordinate = vUv;
  vec2 rayStep = (vUv - 0.5) * (0.3 / 16.0);
  float attenuation = 1.0;
  float light = texture(mask, coordinate).r;
  for (int i = 0; i < 16; i++) {
    coordinate -= rayStep;
    light += texture(mask, coordinate).r * attenuation * weight;
    attenuation *= 0.95;
  }
  outColor = vec4(light * 0.7, 0.0, 0.0, 1.0);
}
`;

export const sunraysBlur = `${header}
uniform sampler2D source;
uniform vec2 axis;
void main() {
  float c = texture(source, vUv).r * 0.29411764;
  c += texture(source, vUv - axis * 1.33333333).r * 0.35294117;
  c += texture(source, vUv + axis * 1.33333333).r * 0.35294117;
  outColor = vec4(c, 0.0, 0.0, 1.0);
}
`;

export const display = `${header}${pigments}
uniform vec2 texelSize;
uniform vec3 backgroundColor;
uniform float backgroundAlpha;
uniform float shadingOn;
uniform float bloomOn;
uniform float bloomIntensity;
uniform sampler2D bloom0;
uniform sampler2D bloom1;
uniform sampler2D bloom2;
uniform sampler2D bloom3;
uniform sampler2D bloom4;
uniform sampler2D bloom5;
uniform float sunraysOn;
uniform sampler2D sunraysTexture;

vec3 linearToGamma(vec3 c) {
  c = max(c, vec3(0.0));
  return max(1.055 * pow(c, vec3(0.416666667)) - 0.055, vec3(0.0));
}
void main() {
  vec3 color = max(colorAt(vUv), vec3(0.0));
  float mass = massAt(vUv);
  if (shadingOn > 0.5) {
    float dx = massAt(vUv + vec2(texelSize.x, 0.0)) - massAt(vUv - vec2(texelSize.x, 0.0));
    float dy = massAt(vUv + vec2(0.0, texelSize.y)) - massAt(vUv - vec2(0.0, texelSize.y));
    vec3 n = normalize(vec3(dx, dy, length(texelSize)));
    color *= clamp(n.z + 0.7, 0.7, 1.0);
  }
  vec3 bloom = vec3(0.0);
  if (bloomOn > 0.5) {
    bloom = texture(bloom0, vUv).rgb * 0.35 + texture(bloom1, vUv).rgb * 0.24 +
            texture(bloom2, vUv).rgb * 0.17 + texture(bloom3, vUv).rgb * 0.11 +
            texture(bloom4, vUv).rgb * 0.08 + texture(bloom5, vUv).rgb * 0.05;
    bloom = linearToGamma(bloom) * bloomIntensity;
  }
  if (sunraysOn > 0.5) {
    float rays = clamp(texture(sunraysTexture, vUv).r, 0.0, 3.0);
    color *= rays;
    bloom *= rays;
  }
  float dyeAlpha = clamp(1.0 - exp(-mass * colorAlpha), 0.0, 1.0);
  vec3 dye = 1.0 - exp(-color);
  vec3 premul = dye * dyeAlpha + backgroundColor * backgroundAlpha * (1.0 - dyeAlpha);
  float alpha = dyeAlpha + backgroundAlpha * (1.0 - dyeAlpha);
  if (bloomOn > 0.5) {
    float bloomAlpha = clamp(max(bloom.r, max(bloom.g, bloom.b)) * 0.4, 0.0, 1.0);
    premul = premul * (1.0 - bloomAlpha) + min(bloom, vec3(1.0)) * bloomAlpha;
    alpha += bloomAlpha * (1.0 - alpha);
  }
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  premul = clamp(premul + noise / 255.0 * alpha, 0.0, alpha);
  outColor = vec4(premul, alpha);
}
`;
