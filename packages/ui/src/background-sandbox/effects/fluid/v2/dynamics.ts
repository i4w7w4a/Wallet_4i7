/** Factors passed to the actual velocity/dye advection and pressure shaders. */
export function fluidV2Decay(dt: number, velocityDissipation: number, dyeDissipation: number, pressureRetention: number) {
  return {
    velocity: 1 / (1 + velocityDissipation * dt),
    dye: 1 / (1 + dyeDissipation * dt),
    pressure: Math.pow(pressureRetention, dt * 60),
  };
}
