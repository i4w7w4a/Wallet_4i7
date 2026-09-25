import { describe, expect, it } from "vitest";

import type { ParameterControl } from "../../contracts";
import type { MaterialTargetGeometry } from "../../material-contract";
import { paperUniformValues, type PaperKind, type PaperParams } from "./gpu";
import { gemSmokeSchema, heatmapSchema, liquidMetalSchema, pulsingBorderSchema } from "./schema";

const geometry: MaterialTargetGeometry = {
  capability: "button-fill", x: 0, y: 0, width: 44, height: 44,
  pixelWidth: 66, pixelHeight: 66, dpr: 1.5,
  radiusCss: 8, borderWidthCss: 1, mask: { kind: "rounded-rect" },
};

function changedValue(control: ParameterControl, current: unknown): unknown {
  if (control.kind === "range") return current === control.min ? control.max : control.min;
  if (control.kind === "select") return control.options.find((option) => option.value !== current)!.value;
  if (control.kind === "color") return current === "#112233ff" ? "#445566" : "#112233ff";
  if (control.kind === "color-list") return ["#112233", "#aabbcc"];
  return !current;
}

describe("Paper control to shader mapping", () => {
  it("changes an executed uniform for every artistic control other than the active clock", () => {
    const cases: { kind: PaperKind; defaults: PaperParams; controls: readonly ParameterControl[] }[] = [
      { kind: "liquid-metal", ...liquidMetalSchema },
      { kind: "pulsing-border", ...pulsingBorderSchema },
      { kind: "gem-smoke", ...gemSmokeSchema },
      { kind: "heatmap", ...heatmapSchema },
    ];
    for (const { kind, defaults, controls } of cases) {
      const baseline = paperUniformValues(kind, defaults, geometry, true);
      for (const control of controls) {
        if (control.key === "speed" || control.key === "phaseMs") continue;
        const next = { ...defaults, [control.key]: changedValue(control, defaults[control.key as keyof PaperParams]) } as PaperParams;
        expect(paperUniformValues(kind, next, geometry, true)).not.toEqual(baseline);
      }
    }
  });
});
