import { describe, expect, it } from "vitest";
import { vaultGridDefinition } from "./definition";

describe("vault-grid material definition", () => {
  it("offers real background and button-fill recipes through the v2 catalog contract", () => {
    expect(vaultGridDefinition.capabilities).toEqual(["background", "button-fill"]);
    expect(vaultGridDefinition.abiVersion).toBe(2);
    expect(vaultGridDefinition.effectVersion).toBe(1);
    expect(vaultGridDefinition.assetIds).toEqual([]);
    expect(vaultGridDefinition.presets).toHaveLength(3);
    for (const preset of vaultGridDefinition.presets) {
      expect(vaultGridDefinition.schema.parse(preset.params).ok).toBe(true);
    }
  });
});
