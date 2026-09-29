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
  private ownerType: PointerSample["pointerType"];
  private readonly activeTouches = new Set<number>();
  private suppressTouches = false;
  private uv: Vec2 = [0.5, 0.5];
  private inside = false;
  private down = false;
  private samples: PointerSample[] = [];
  private readonly capacity: number;

  constructor(capacity = 32) {
    this.capacity = Number.isFinite(capacity) ? Math.max(1, Math.min(64, Math.floor(capacity))) : 32;
  }

  private append(sample: PointerSample) {
    this.samples.push(sample);
    if (this.samples.length > this.capacity) this.samples.splice(0, this.samples.length - this.capacity);
  }

  private cancelActive(time: number) {
    if (this.owner !== null && this.down) {
      this.append({ id: this.owner, phase: "cancel", pointerType: this.ownerType,
        uv: this.uv, delta: [0, 0], time, buttons: 0 });
    }
    this.owner = null;
    this.ownerType = undefined;
    this.inside = false;
    this.down = false;
  }

  /** A blocked touch still counts as a contact, so drawing cannot resume mid-pinch. */
  push(sample: Omit<PointerSample, "delta">, blocked = false) {
    if (![sample.id, sample.time, sample.buttons, ...sample.uv].every(Number.isFinite)) return;
    if (sample.pointerType === "touch") {
      if (sample.phase === "down") this.activeTouches.add(sample.id);
      if (this.activeTouches.size > 1 || (blocked && this.activeTouches.has(sample.id))) {
        this.suppressTouches = true;
      }
      if (this.suppressTouches) this.cancelActive(sample.time);
      if (sample.phase === "up" || sample.phase === "cancel" || sample.phase === "leave") {
        this.activeTouches.delete(sample.id);
      }
      if (this.suppressTouches) {
        if (this.activeTouches.size === 0) this.suppressTouches = false;
        return;
      }
      if (blocked) return;
      if (sample.phase === "down" && this.owner !== null && sample.id !== this.owner && !this.down) {
        this.cancelActive(sample.time);
      }
    }
    if (this.owner !== null && sample.id !== this.owner) return;
    const uv: Vec2 = [Math.min(1, Math.max(0, sample.uv[0])), Math.min(1, Math.max(0, sample.uv[1]))];
    const departing = sample.phase === "leave" || sample.phase === "cancel";
    const ending = departing || sample.phase === "up";
    const arriving = !this.inside || sample.phase === "enter" ||
      (sample.phase === "down" && this.owner === null);
    const delta: Vec2 = arriving || departing ? [0, 0] : [uv[0] - this.uv[0], uv[1] - this.uv[1]];
    this.owner = ending ? null : sample.id;
    this.ownerType = ending ? undefined : sample.pointerType;
    this.uv = uv;
    this.inside = !departing;
    if (departing || sample.phase === "up" || (sample.buttons & 1) === 0) this.down = false;
    else if (sample.phase === "down") this.down = true;
    this.append({ ...sample, uv, delta, buttons: this.down ? sample.buttons : 0 });
  }

  drain(): PointerFrame {
    const samples = this.samples;
    this.samples = [];
    return { uv: this.uv, inside: this.inside, down: this.down, samples };
  }

  reset() {
    this.owner = null;
    this.ownerType = undefined;
    this.activeTouches.clear();
    this.suppressTouches = false;
    this.inside = false;
    this.down = false;
    this.samples = [];
  }
}

/** Collect actual wallet scroll and blocked edge gestures once per host frame. */
export class ViewportMotionInput {
  private lastTop: number;
  private deltaY = 0;
  private blockedY = 0;
  private static readonly MAX_DELTA = 0.12;

  constructor(top: number) { this.lastTop = Number.isFinite(top) ? Math.max(0, top) : 0; }

  recordScroll(top: number, maxTop: number, height: number): void {
    if (![top, maxTop, height].every(Number.isFinite) || maxTop < 0 || height <= 0) return;
    const next = Math.min(maxTop, Math.max(0, top));
    this.deltaY = ViewportMotionInput.clamp(this.deltaY + (next - this.lastTop) / height);
    this.lastTop = next;
  }

  /** Use only when the gesture starts at a hard end; actual scroll is counted separately. */
  recordBoundaryAttempt(deltaY: number, top: number, maxTop: number, height: number): void {
    if (![deltaY, top, maxTop, height].every(Number.isFinite) || maxTop < 0 || height <= 0) return;
    if ((deltaY < 0 && top <= 0) || (deltaY > 0 && top >= maxTop))
      this.blockedY = ViewportMotionInput.clamp(this.blockedY + deltaY / height);
  }

  drain(): { deltaY: number; blockedY: number } {
    const result = { deltaY: this.deltaY, blockedY: this.blockedY };
    this.deltaY = 0;
    this.blockedY = 0;
    return result;
  }

  reset(top: number): void {
    this.lastTop = Number.isFinite(top) ? Math.max(0, top) : 0;
    this.deltaY = 0;
    this.blockedY = 0;
  }

  private static clamp(value: number): number {
    return Math.max(-ViewportMotionInput.MAX_DELTA, Math.min(ViewportMotionInput.MAX_DELTA, value));
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
