/** Adapted from Pavel Dobryakov's MIT solver. See LICENSE.upstream and PROVENANCE.md. */
export const vertex = `#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

const header = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform vec2 texelSize;
`;

export const clear = `${header}
void main() { outColor = vec4(0.0); }
`;
export const splat = `${header}
uniform sampler2D source;
uniform vec2 point;
uniform vec3 impulse;
uniform float radius;
uniform float aspect;
uniform float limitValue;
void main() {
  vec2 p = vUv - point;
  p.x *= aspect;
  vec3 addition = exp(-dot(p, p) / radius) * impulse;
  outColor = vec4(clamp(texture(source, vUv).xyz + addition, -limitValue, limitValue), 1.0);
}
`;
export const curl = `${header}
uniform sampler2D velocity;
void main() {
  float L = texture(velocity, vUv - vec2(texelSize.x, 0)).y;
  float R = texture(velocity, vUv + vec2(texelSize.x, 0)).y;
  float T = texture(velocity, vUv + vec2(0, texelSize.y)).x;
  float B = texture(velocity, vUv - vec2(0, texelSize.y)).x;
  outColor = vec4(0.5 * (R - L - T + B), 0, 0, 1);
}
`;
export const vorticity = `${header}
uniform sampler2D velocity;
uniform sampler2D curlField;
uniform float strength;
uniform float dt;
void main() {
  float L = texture(curlField, vUv - vec2(texelSize.x, 0)).x;
  float R = texture(curlField, vUv + vec2(texelSize.x, 0)).x;
  float T = texture(curlField, vUv + vec2(0, texelSize.y)).x;
  float B = texture(curlField, vUv - vec2(0, texelSize.y)).x;
  float C = texture(curlField, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= strength * C;
  force.y *= -1.0;
  outColor = vec4(clamp(texture(velocity, vUv).xy + force * dt, -1000.0, 1000.0), 0, 1);
}
`;
export const divergence = `${header}
uniform sampler2D velocity;
void main() {
  vec2 left = vUv - vec2(texelSize.x, 0);
  vec2 right = vUv + vec2(texelSize.x, 0);
  vec2 top = vUv + vec2(0, texelSize.y);
  vec2 bottom = vUv - vec2(0, texelSize.y);
  vec2 C = texture(velocity, vUv).xy;
  float L = left.x < 0.0 ? -C.x : texture(velocity, left).x;
  float R = right.x > 1.0 ? -C.x : texture(velocity, right).x;
  float T = top.y > 1.0 ? -C.y : texture(velocity, top).y;
  float B = bottom.y < 0.0 ? -C.y : texture(velocity, bottom).y;
  outColor = vec4(0.5 * (R - L + T - B), 0, 0, 1);
}
`;
export const decayPressure = `${header}
uniform sampler2D pressure;
uniform float retention;
void main() { outColor = texture(pressure, vUv) * retention; }
`;
export const pressure = `${header}
uniform sampler2D pressure;
uniform sampler2D divergenceField;
void main() {
  float L = texture(pressure, vUv - vec2(texelSize.x, 0)).x;
  float R = texture(pressure, vUv + vec2(texelSize.x, 0)).x;
  float T = texture(pressure, vUv + vec2(0, texelSize.y)).x;
  float B = texture(pressure, vUv - vec2(0, texelSize.y)).x;
  float div = texture(divergenceField, vUv).x;
  outColor = vec4((L + R + B + T - div) * 0.25, 0, 0, 1);
}
`;
export const gradient = `${header}
uniform sampler2D pressure;
uniform sampler2D velocity;
void main() {
  float L = texture(pressure, vUv - vec2(texelSize.x, 0)).x;
  float R = texture(pressure, vUv + vec2(texelSize.x, 0)).x;
  float T = texture(pressure, vUv + vec2(0, texelSize.y)).x;
  float B = texture(pressure, vUv - vec2(0, texelSize.y)).x;
  outColor = vec4(texture(velocity, vUv).xy - vec2(R - L, T - B), 0, 1);
}
`;
export const advect = `${header}
uniform sampler2D velocity;
uniform sampler2D source;
uniform float dt;
uniform float dissipation;
void main() {
  vec2 coordinate = vUv - dt * texture(velocity, vUv).xy * texelSize;
  outColor = texture(source, coordinate) / (1.0 + dissipation * dt);
}
`;
export const display = `${header}
uniform sampler2D dye;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 background;
void main() {
  vec3 pigment = max(texture(dye, vUv).rgb, vec3(0));
  float dx = length(texture(dye, vUv + vec2(texelSize.x, 0)).rgb) - length(texture(dye, vUv - vec2(texelSize.x, 0)).rgb);
  float dy = length(texture(dye, vUv + vec2(0, texelSize.y)).rgb) - length(texture(dye, vUv - vec2(0, texelSize.y)).rgb);
  vec3 n = normalize(vec3(dx, dy, length(texelSize)));
  float diffuse = clamp(n.z + 0.7, 0.7, 1.0);
  vec3 c = (pigment.r * colorA + pigment.g * colorB + pigment.b * colorC) * diffuse;
  c = background + (1.0 - background) * (1.0 - exp(-c));
  // Original, static procedural dithering. No texture, entropy or temporal shimmer.
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  outColor = vec4(clamp(c + noise / 255.0, 0.0, 1.0), 1.0);
}
`;
