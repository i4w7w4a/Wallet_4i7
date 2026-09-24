import type { PointerFrame } from "../../contracts";
export interface DragSplat { x: number; y: number; dx: number; dy: number }
export class FluidDragInput {
  private activeId: number | null = null;
  private lastTime = -Infinity;
  reset(): void { this.activeId = null; this.lastTime = -Infinity; }
  consume(pointer: PointerFrame, aspect: number): DragSplat[] {
    const splats: DragSplat[] = [];
    let remaining = 0.06;
    if (!Number.isFinite(aspect) || aspect <= 0) { this.reset(); return splats; }
    for (const sample of pointer.samples.slice(0, 64)) {
      if (["up", "leave", "cancel", "enter"].includes(sample.phase)) { this.reset(); continue; }
      if (![sample.id, sample.time, ...sample.uv, ...sample.delta].every(Number.isFinite)) continue;
      if (sample.uv.some((value) => value < 0 || value > 1)) continue;
      if (sample.phase === "down") {
        this.activeId = (sample.buttons & 1) !== 0 ? sample.id : null;
        this.lastTime = sample.time;
        continue;
      }
      if (sample.phase !== "move" || this.activeId !== sample.id || sample.time <= this.lastTime) continue;
      this.lastTime = sample.time;
      if ((sample.buttons & 1) === 0) { this.reset(); continue; }
      const dx = sample.delta[0] * Math.min(1, aspect);
      const dy = sample.delta[1] / Math.max(1, aspect);
      const length = Math.hypot(dx, dy);
      if (length <= 0 || splats.length >= 4 || remaining <= 0) continue;
      const distance = Math.min(length, 0.025, remaining);
      const scale = distance / length;
      remaining -= distance;
      splats.push({ x: sample.uv[0], y: sample.uv[1], dx: dx * scale, dy: dy * scale });
    }
    if (!pointer.inside || !pointer.down || pointer.samples.length > 64) this.reset();
    return splats;
  }
}
