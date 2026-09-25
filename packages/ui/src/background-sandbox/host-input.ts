import type { PointerFrame, PointerSample, Vec2, Viewport } from "./contracts";

export class ActiveClock {
  private lastMs: number | null = null;
  private elapsed = 0;
  private lastSampleTime = 0;

  get time() { return this.elapsed; }

  advance(nowMs: number) {
    if (!Number.isFinite(nowMs) || (this.lastMs !== null && nowMs < this.lastMs)) {
      return { time: this.elapsed, dt: 0 };
    }
    const dt = this.lastMs === null ? 0 : Math.min(0.064, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    this.elapsed = Math.max(this.elapsed + dt, this.lastSampleTime);
    return { time: this.elapsed, dt };
  }

  /** Pointer events between RAFs need ordered active timestamps without counting hidden time. */
  sampleTime(nowMs: number): number {
    const sinceFrame = this.lastMs !== null && Number.isFinite(nowMs)
      ? Math.max(0, Math.min(0.064, (nowMs - this.lastMs) / 1000)) : 0;
    this.lastSampleTime = Math.max(this.elapsed + sinceFrame, this.lastSampleTime + 0.0001);
    return this.lastSampleTime;
  }

  pause() { this.lastMs = null; this.lastSampleTime = this.elapsed; }
  reset() { this.elapsed = 0; this.pause(); }
}

export class PointerInput {
  private owner: number | null = null;
  private uv: Vec2 = [0.5, 0.5];
  private inside = false;
  private down = false;
  private samples: PointerSample[] = [];
  private readonly capacity: number;

  constructor(capacity = 32) {
    this.capacity = Number.isFinite(capacity) ? Math.max(1, Math.min(64, Math.floor(capacity))) : 32;
  }

  push(sample: Omit<PointerSample, "delta">) {
    if (![sample.id, sample.time, sample.buttons, ...sample.uv].every(Number.isFinite)) return;
    if (this.owner !== null && sample.id !== this.owner) return;
    const uv: Vec2 = [Math.min(1, Math.max(0, sample.uv[0])), Math.min(1, Math.max(0, sample.uv[1]))];
    const departing = sample.phase === "leave" || sample.phase === "cancel";
    const ending = departing || sample.phase === "up";
    const arriving = !this.inside || sample.phase === "enter" ||
      (sample.phase === "down" && this.owner === null);
    const delta: Vec2 = arriving || departing ? [0, 0] : [uv[0] - this.uv[0], uv[1] - this.uv[1]];
    this.owner = ending ? null : sample.id;
    this.uv = uv;
    this.inside = !departing;
    if (departing || sample.phase === "up" || (sample.buttons & 1) === 0) this.down = false;
    else if (sample.phase === "down") this.down = true;
    this.samples.push({ ...sample, uv, delta, buttons: this.down ? sample.buttons : 0 });
    if (this.samples.length > this.capacity) this.samples.splice(0, this.samples.length - this.capacity);
  }

  drain(): PointerFrame {
    const samples = this.samples;
    this.samples = [];
    return { uv: this.uv, inside: this.inside, down: this.down, samples };
  }

  reset() {
    this.owner = null;
    this.inside = false;
    this.down = false;
    this.samples = [];
  }
}

/** Keep layout dimensions independent of the physical raster and device DPR. */
export function resolveViewport(width: number, height: number, deviceDpr: number, maxTextureSize: number): Viewport | null {
  if (![width, height, maxTextureSize].every(Number.isFinite) || width <= 0 || height <= 0 || maxTextureSize < 1) return null;
  const requestedDpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  const dpr = Math.min(requestedDpr, width <= 480 ? 1.5 : 2, maxTextureSize / width, maxTextureSize / height);
  return { cssWidth: width, cssHeight: height, pixelWidth: Math.max(1, Math.floor(width * dpr)),
    pixelHeight: Math.max(1, Math.floor(height * dpr)), dpr };
}
