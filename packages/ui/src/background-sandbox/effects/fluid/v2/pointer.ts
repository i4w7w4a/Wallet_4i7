import type { PointerFrame } from "../../../contracts";

export interface FluidV2Gesture {
  kind: "tap" | "drag";
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export class FluidV2PointerInput {
  private activeId: number | null = null;
  private touch = false;
  private moved = false;
  private lastTime = -Infinity;

  reset(): void { this.activeId = null; this.touch = false; this.moved = false; this.lastTime = -Infinity; }

  consume(pointer: PointerFrame, aspect: number, allowTap: boolean): FluidV2Gesture[] {
    const splats: FluidV2Gesture[] = [];
    let gestureStart = 0;
    let remaining = 0.06;
    if (!Number.isFinite(aspect) || aspect <= 0) { this.reset(); return splats; }
    for (const sample of pointer.samples) {
      const type = (sample as typeof sample & { pointerType?: string }).pointerType;
      if (sample.phase === "down" && (sample.buttons & 1) !== 0) {
        gestureStart = splats.length;
        this.activeId = sample.id;
        this.touch = type === "touch";
        this.moved = false;
        this.lastTime = sample.time;
      } else if (sample.phase === "move" && sample.id === this.activeId && (sample.buttons & 1) !== 0 && sample.time >= this.lastTime) {
        const dx = sample.delta[0] * Math.min(1, aspect);
        const dy = sample.delta[1] / Math.max(1, aspect);
        const length = Math.hypot(dx, dy);
        if (Number.isFinite(length) && length > 0 && splats.length < 4 && remaining > 0) {
          const distance = Math.min(length, 0.025, remaining);
          const scale = distance / length;
          splats.push({ kind: "drag", x: sample.uv[0], y: sample.uv[1], dx: dx * scale, dy: dy * scale });
          remaining -= distance;
          this.moved = true;
        }
        this.lastTime = sample.time;
      } else if (sample.phase === "up" && sample.id === this.activeId) {
        if (allowTap && this.touch && !this.moved && splats.length < 4) splats.push({ kind: "tap", x: sample.uv[0], y: sample.uv[1], dx: 0, dy: 0 });
        this.reset();
      } else if (sample.phase === "cancel" || sample.phase === "leave") {
        if (this.touch) splats.splice(gestureStart);
        this.reset();
      }
    }
    if (!pointer.inside || !pointer.down) this.reset();
    return splats;
  }
}
