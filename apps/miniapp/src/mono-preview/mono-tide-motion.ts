export type TideMotionSample = {
  x: number;
  y: number;
  time: number;
};

export type TideMotionState = TideMotionSample & {
  velocityX: number;
  velocityY: number;
  energy: number;
  lastPulseX: number;
  lastPulseY: number;
  lastPulseTime: number;
};

export type TideMotionPulse = {
  angle: number;
  energy: number;
};

export type TideMotionStep = {
  state: TideMotionState;
  pulse: TideMotionPulse | null;
};

const VELOCITY_MEMORY_MS = 280;
const VELOCITY_RESPONSE_MS = 120;
const ENERGY_FLOOR = 0.06;
const ENERGY_CEILING = 0.9;
const PULSE_ENERGY = 0.3;
const PULSE_INTERVAL_MS = 140;
const PULSE_DISTANCE_PX = 44;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const unit = clamp01((value - edge0) / Math.max(Number.EPSILON, edge1 - edge0));
  return unit * unit * (3 - 2 * unit);
}

export function stepTideMotion(
  previous: TideMotionState | null,
  sample: TideMotionSample,
): TideMotionStep {
  if (!previous || !Number.isFinite(previous.time) || sample.time <= previous.time) {
    return {
      state: {
        ...sample,
        velocityX: 0,
        velocityY: 0,
        energy: 0,
        lastPulseX: sample.x,
        lastPulseY: sample.y,
        lastPulseTime: sample.time,
      },
      pulse: null,
    };
  }

  const deltaTime = sample.time - previous.time;
  const rawVelocityX = (sample.x - previous.x) / deltaTime;
  const rawVelocityY = (sample.y - previous.y) / deltaTime;
  const retained = Math.exp(-deltaTime / VELOCITY_MEMORY_MS);
  const response = 1 - Math.exp(-Math.min(deltaTime, 24) / VELOCITY_RESPONSE_MS);
  const retainedVelocityX = previous.velocityX * retained;
  const retainedVelocityY = previous.velocityY * retained;
  const velocityX = retainedVelocityX + (rawVelocityX - retainedVelocityX) * response;
  const velocityY = retainedVelocityY + (rawVelocityY - retainedVelocityY) * response;
  const energy = smoothstep(ENERGY_FLOOR, ENERGY_CEILING, Math.hypot(velocityX, velocityY));
  const pulseDistance = Math.hypot(sample.x - previous.lastPulseX, sample.y - previous.lastPulseY);
  const pulseElapsed = sample.time - previous.lastPulseTime;
  const shouldPulse = energy >= PULSE_ENERGY &&
    pulseElapsed >= PULSE_INTERVAL_MS && pulseDistance >= PULSE_DISTANCE_PX;
  const pulse = shouldPulse ? { energy, angle: Math.atan2(velocityY, velocityX) || 0 } : null;

  return {
    state: {
      ...sample,
      velocityX,
      velocityY,
      energy,
      lastPulseX: shouldPulse ? sample.x : previous.lastPulseX,
      lastPulseY: shouldPulse ? sample.y : previous.lastPulseY,
      lastPulseTime: shouldPulse ? sample.time : previous.lastPulseTime,
    },
    pulse,
  };
}
