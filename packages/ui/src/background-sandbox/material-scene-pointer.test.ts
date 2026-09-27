import { describe, expect, it } from "vitest";
// @vitest-environment jsdom
import { materialPointerOverControl, materialPointerPhase } from "./material-scene-pointer";

describe("material scene pointer routing", () => {
  it("keeps controls interactive while closing a gesture released over them", () => {
    expect(materialPointerPhase("down", true)).toBeNull();
    expect(materialPointerPhase("move", true)).toBe("cancel");
    expect(materialPointerPhase("up", true)).toBe("cancel");
    expect(materialPointerPhase("cancel", true)).toBe("cancel");
    expect(materialPointerPhase("leave", true)).toBe("leave");
    expect(materialPointerPhase("move", false)).toBe("move");
  });

  it("recognizes a control beneath an implicitly captured touch and exit from the scene", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    const empty = document.createElement("span");
    root.append(button, empty);
    expect(materialPointerOverControl(root, button, root)).toBe(true);
    expect(materialPointerOverControl(root, empty, root)).toBe(false);
    expect(materialPointerOverControl(root, document.createElement("div"), root)).toBe(true);
  });
});
