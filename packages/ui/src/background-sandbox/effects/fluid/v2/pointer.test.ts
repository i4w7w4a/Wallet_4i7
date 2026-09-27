import { describe, expect, it } from "vitest";
import { PointerInput } from "../../../host-input";
import { FluidV2PointerInput } from "./pointer";

describe("Fluid v2 scene gestures", () => {
  it("turns a same-frame tap into one dye splat", () => {
    const host = new PointerInput();
    const down = { id: 7, phase: "down" as const, uv: [0.42, 0.63] as const, time: 4, buttons: 1, pointerType: "touch" as const };
    const up = { ...down, phase: "up" as const, buttons: 0 };
    host.push(down);
    host.push(up);

    const input = new FluidV2PointerInput();
    expect(input.consume(host.drain(), 1, true)).toEqual([
      { kind: "tap", x: 0.42, y: 0.63, dx: 0, dy: 0 },
    ]);
  });

  it("keeps a short touch drag when down, move and up share one host frame time", () => {
    const host = new PointerInput();
    host.push({ id: 9, phase: "down", uv: [0.4, 0.5], time: 8, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 9, phase: "move", uv: [0.42, 0.5], time: 8, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 9, phase: "up", uv: [0.42, 0.5], time: 8, buttons: 0, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);

    const splats = new FluidV2PointerInput().consume(host.drain(), 0.46, true);
    expect(splats).toHaveLength(1);
    expect(splats[0]).toMatchObject({ kind: "drag", x: 0.42, y: 0.5, dy: 0 });
    expect(splats[0]?.dx).toBeCloseTo(0.0092);
  });

  it("discards a touch gesture canceled by native scrolling before the frame drains", () => {
    const host = new PointerInput();
    host.push({ id: 11, phase: "down", uv: [0.5, 0.6], time: 10, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 11, phase: "move", uv: [0.5, 0.56], time: 10, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 11, phase: "cancel", uv: [0.5, 0.56], time: 10, buttons: 0, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);

    expect(new FluidV2PointerInput().consume(host.drain(), 1, true)).toEqual([]);
  });

  it("bounds the energy and count of a burst of touch moves", () => {
    const host = new PointerInput();
    host.push({ id: 13, phase: "down", uv: [0.5, 0.5], time: 12, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    for (let i = 0; i < 20; i++) {
      host.push({ id: 13, phase: "move", uv: [i % 2, 0.5], time: 12, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    }

    const splats = new FluidV2PointerInput().consume(host.drain(), 1, true);
    expect(splats.length).toBeGreaterThan(0);
    expect(splats.length).toBeLessThanOrEqual(4);
    expect(splats.reduce((sum, splat) => sum + Math.hypot(splat.dx, splat.dy), 0)).toBeLessThanOrEqual(0.060001);
  });

  it("keeps a mouse click passive while a touch tap is limited to draw mode", () => {
    const mouse = new PointerInput();
    const mouseDown = { id: 1, phase: "down" as const, uv: [0.5, 0.5] as const, time: 1, buttons: 1, pointerType: "mouse" as const };
    mouse.push(mouseDown);
    mouse.push({ ...mouseDown, phase: "up", buttons: 0 });
    expect(new FluidV2PointerInput().consume(mouse.drain(), 1, true)).toEqual([]);

    const ambient = new PointerInput();
    const touchDown = { ...mouseDown, id: 2, pointerType: "touch" as const };
    ambient.push(touchDown);
    ambient.push({ ...touchDown, phase: "up", buttons: 0 });
    expect(new FluidV2PointerInput().consume(ambient.drain(), 1, false)).toEqual([]);
  });

  it("preserves intentional mouse drawing", () => {
    const host = new PointerInput();
    host.push({ id: 1, phase: "down", uv: [0.4, 0.5], time: 1, buttons: 1, pointerType: "mouse" });
    host.push({ id: 1, phase: "move", uv: [0.43, 0.5], time: 2, buttons: 1, pointerType: "mouse" });
    host.push({ id: 1, phase: "up", uv: [0.43, 0.5], time: 3, buttons: 0, pointerType: "mouse" });
    expect(new FluidV2PointerInput().consume(host.drain(), 1, true)).toEqual([
      { kind: "drag", x: 0.43, y: 0.5, dx: 0.025, dy: 0 },
    ]);
  });

  it("reserves a vertical touch start for page scroll before pointercancel arrives", () => {
    const host = new PointerInput();
    host.push({ id: 21, phase: "down", uv: [0.5, 0.6], time: 14, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 21, phase: "move", uv: [0.501, 0.58], time: 14, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    const input = new FluidV2PointerInput();

    expect(input.consume(host.drain(), 0.46, true)).toEqual([]);
    host.push({ id: 21, phase: "cancel", uv: [0.501, 0.58], time: 14.01, buttons: 0, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    expect(input.consume(host.drain(), 0.46, true)).toEqual([]);
  });

  it("does not mistake a substantial undecided diagonal touch movement for a tap", () => {
    const host = new PointerInput();
    host.push({ id: 22, phase: "down", uv: [0.5, 0.5], time: 15, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 22, phase: "move", uv: [0.53, 0.515], time: 15, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 22, phase: "up", uv: [0.53, 0.515], time: 15, buttons: 0, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);

    expect(new FluidV2PointerInput().consume(host.drain(), 0.46, true)).toEqual([]);
  });

  it("drops drawing during a two-finger gesture and permits the next separate tap", () => {
    const host = new PointerInput();
    const input = new FluidV2PointerInput();
    host.push({ id: 31, phase: "down", uv: [0.4, 0.5], time: 1, buttons: 1, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toEqual([]);

    host.push({ id: 32, phase: "down", uv: [0.6, 0.5], time: 2, buttons: 1, pointerType: "touch" });
    host.push({ id: 31, phase: "move", uv: [0.42, 0.5], time: 3, buttons: 1, pointerType: "touch" });
    host.push({ id: 31, phase: "up", uv: [0.42, 0.5], time: 4, buttons: 0, pointerType: "touch" });
    host.push({ id: 32, phase: "up", uv: [0.6, 0.5], time: 5, buttons: 0, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toEqual([]);

    host.push({ id: 33, phase: "down", uv: [0.5, 0.5], time: 6, buttons: 1, pointerType: "touch" });
    host.push({ id: 33, phase: "up", uv: [0.5, 0.5], time: 7, buttons: 0, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toEqual([
      { kind: "tap", x: 0.5, y: 0.5, dx: 0, dy: 0 },
    ]);
  });

  it("cancels a touch crossing a control, even if its pointer target remains captured", () => {
    const host = new PointerInput();
    const input = new FluidV2PointerInput();
    host.push({ id: 41, phase: "down", uv: [0.49, 0.5], time: 1, buttons: 1, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toEqual([]);

    host.push({ id: 41, phase: "move", uv: [0.51, 0.5], time: 2, buttons: 1, pointerType: "touch" }, true);
    host.push({ id: 41, phase: "up", uv: [0.51, 0.5], time: 3, buttons: 0, pointerType: "touch" }, true);
    expect(input.consume(host.drain(), 1, true)).toEqual([]);

    host.push({ id: 42, phase: "down", uv: [0.5, 0.5], time: 4, buttons: 1, pointerType: "touch" });
    host.push({ id: 42, phase: "up", uv: [0.5, 0.5], time: 5, buttons: 0, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toHaveLength(1);
  });

  it("never starts a background tap from a control touch", () => {
    const host = new PointerInput();
    host.push({ id: 43, phase: "down", uv: [0.5, 0.5], time: 1, buttons: 1, pointerType: "touch" }, true);
    host.push({ id: 43, phase: "up", uv: [0.5, 0.5], time: 2, buttons: 0, pointerType: "touch" }, true);
    expect(new FluidV2PointerInput().consume(host.drain(), 1, true)).toEqual([]);
  });

  it("stays suppressed after one finger cancels until every contact has ended", () => {
    const host = new PointerInput();
    const input = new FluidV2PointerInput();
    host.push({ id: 51, phase: "down", uv: [0.4, 0.5], time: 1, buttons: 1, pointerType: "touch" });
    input.consume(host.drain(), 1, true);
    host.push({ id: 52, phase: "down", uv: [0.6, 0.5], time: 2, buttons: 1, pointerType: "touch" });
    host.push({ id: 51, phase: "cancel", uv: [0.4, 0.5], time: 3, buttons: 0, pointerType: "touch" });
    host.push({ id: 52, phase: "move", uv: [0.7, 0.5], time: 4, buttons: 1, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toEqual([]);
    host.push({ id: 52, phase: "up", uv: [0.7, 0.5], time: 5, buttons: 0, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toEqual([]);
    host.push({ id: 53, phase: "down", uv: [0.5, 0.5], time: 6, buttons: 1, pointerType: "touch" });
    host.push({ id: 53, phase: "up", uv: [0.5, 0.5], time: 7, buttons: 0, pointerType: "touch" });
    expect(input.consume(host.drain(), 1, true)).toHaveLength(1);
  });
});
