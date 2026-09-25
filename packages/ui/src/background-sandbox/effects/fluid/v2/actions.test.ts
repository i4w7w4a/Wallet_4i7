import { describe, expect, it } from "vitest";
import { createFluidActionState, drainFluidAction, queueFluidAction } from "./actions";

describe("Fluid v2 transient seeded splats", () => {
  it("adds six splats to the current field over bounded frames without a reset", () => {
    const queued = queueFluidAction(createFluidActionState(147), { kind: "seeded-splats", count: 6 });
    expect(queued.pending).toBe(6);
    const first = drainFluidAction(queued, 4);
    expect(first.splats).toHaveLength(4);
    expect(first.state.pending).toBe(2);
    const second = drainFluidAction(first.state, 4);
    expect(second.splats).toHaveLength(2);
    expect(second.state.pending).toBe(0);
    expect(second.state.cursor).toBe(6);
    expect([...first.splats, ...second.splats]).toEqual(drainFluidAction(queueFluidAction(createFluidActionState(147), { kind: "seeded-splats", count: 6 }), 6).splats);
  });

  it("caps repeated queued actions and gives each seed a stable but distinct sequence", () => {
    let state = createFluidActionState(147);
    for (let i = 0; i < 20; i++) state = queueFluidAction(state, { kind: "seeded-splats", count: 6 });
    expect(state.pending).toBe(12);
    const first = drainFluidAction(state, 4).splats;
    expect(first).toEqual(drainFluidAction(queueFluidAction(createFluidActionState(147), { kind: "seeded-splats", count: 6 }), 4).splats);
    expect(first).not.toEqual(drainFluidAction(queueFluidAction(createFluidActionState(148), { kind: "seeded-splats", count: 6 }), 4).splats);
  });

  it("rejects malformed runtime count without adding work", () => {
    const state = createFluidActionState(147);
    expect(queueFluidAction(state, { kind: "seeded-splats", count: 100 as 6 })).toEqual(state);
    expect(queueFluidAction(state, { kind: "seeded-splats", count: 0 as 1 })).toEqual(state);
  });
});
