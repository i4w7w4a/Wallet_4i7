import { describe, expect, it } from "vitest";
import { materialPointerPhase } from "./material-scene-pointer";

describe("material scene pointer routing", () => {
  it("keeps controls interactive while closing a gesture released over them", () => {
    expect(materialPointerPhase("down", true)).toBeNull();
    expect(materialPointerPhase("move", true)).toBe("cancel");
    expect(materialPointerPhase("up", true)).toBe("up");
    expect(materialPointerPhase("cancel", true)).toBe("cancel");
    expect(materialPointerPhase("leave", true)).toBe("leave");
    expect(materialPointerPhase("move", false)).toBe("move");
  });
});
