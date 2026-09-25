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
    host.push({ id: 9, phase: "move", uv: [0.41, 0.5], time: 8, buttons: 1, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);
    host.push({ id: 9, phase: "up", uv: [0.41, 0.5], time: 8, buttons: 0, pointerType: "touch" } as Parameters<PointerInput["push"]>[0]);

    const splats = new FluidV2PointerInput().consume(host.drain(), 1, true);
    expect(splats).toHaveLength(1);
    expect(splats[0]).toMatchObject({ kind: "drag", x: 0.41, y: 0.5, dy: 0 });
    expect(splats[0]?.dx).toBeCloseTo(0.01);
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
});
