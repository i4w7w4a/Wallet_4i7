import { expect, it } from "vitest";
import { cardMotionVariables } from "./card-motion-preset";

it("maps the existing material controls to the shared real-card response", () => {
  expect(cardMotionVariables({ effectId: "material", config: { pressDepth: 1.5, magneticTravel: 5, settleMs: 240 } }))
    .toEqual({ "--motion-linked-card": "240ms", "--motion-card-press": "0.05", "--motion-card-edge-opacity": "1" });
  expect(cardMotionVariables({ effectId: "baseline", config: { pressDepth: 2, magneticTravel: 5, settleMs: 190 } }))
    .toEqual({ "--motion-linked-card": "0ms", "--motion-card-press": "0", "--motion-card-edge-opacity": "0" });
});
