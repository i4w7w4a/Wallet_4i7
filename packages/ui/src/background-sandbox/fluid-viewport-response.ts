/** Saved response to motion inside the visible wallet viewport; live input stays with the host. */
export type FluidViewportResponseV1 = Readonly<{
  version: 1;
  enabled: boolean;
  strength: number;
  inertia: number;
  edgeResponse: number;
}>;

export const FLUID_VIEWPORT_RESPONSE_DEFAULTS: FluidViewportResponseV1 = Object.freeze({
  version: 1, enabled: false, strength: 0.35, inertia: 0.45, edgeResponse: 0.35,
});

const UNIT_RANGE = Object.freeze({ min: 0, max: 1, step: 0.01 });
export const FLUID_VIEWPORT_RESPONSE_BOUNDS = Object.freeze({
  strength: UNIT_RANGE, inertia: UNIT_RANGE, edgeResponse: UNIT_RANGE,
});

const KEYS = ["version", "enabled", "strength", "inertia", "edgeResponse"] as const;

/** Reject unknown, incomplete and executable fields before they enter storage or the solver. */
export function parseFluidViewportResponse(input: unknown): FluidViewportResponseV1 | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  try {
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(input);
    if (keys.length !== KEYS.length || keys.some(key => typeof key !== "string" || !KEYS.includes(key as typeof KEYS[number]))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (KEYS.some(key => !descriptors[key]?.enumerable || !("value" in descriptors[key]))) return null;
    const version = descriptors.version.value;
    const enabled = descriptors.enabled.value;
    if (version !== 1 || typeof enabled !== "boolean") return null;
    const values = {} as Record<"strength" | "inertia" | "edgeResponse", number>;
    for (const key of ["strength", "inertia", "edgeResponse"] as const) {
      const value = descriptors[key].value;
      const bounds = FLUID_VIEWPORT_RESPONSE_BOUNDS[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < bounds.min || value > bounds.max ||
          Math.abs(value / bounds.step - Math.round(value / bounds.step)) > 1e-8) return null;
      values[key] = value;
    }
    return { version: 1, enabled, ...values };
  } catch { return null; }
}
