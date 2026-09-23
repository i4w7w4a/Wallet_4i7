import { expect, it } from "vitest";
import { createMonoChartGeometry } from "./mono-chart-geometry";

it("maps every original sample in order without smoothing or inventing extra values", () => {
  const values = Object.freeze([10, 20, 15]);
  const geometry = createMonoChartGeometry(values);
  expect(geometry?.points).toEqual([{ x: 4, y: 92 }, { x: 150, y: 8 }, { x: 296, y: 50 }]);
  expect(geometry?.line).toBe("M4 92 L150 8 L296 50");
  expect(geometry?.step).toBe("M4 92 H150 V8 H296 V50");
  expect(values).toEqual([10, 20, 15]);
});

it("centers a flat or single-value series without NaN or fabricated variation", () => {
  expect(createMonoChartGeometry([0, 0, 0])?.points.map((point) => point.y)).toEqual([50, 50, 50]);
  expect(createMonoChartGeometry([7])?.points).toEqual([{ x: 150, y: 50 }]);
});

it.each([[], [1, NaN], [Infinity], [-Infinity, 2]].map((values) => ({ values })))("does not draw invalid series $values", ({ values }) => {
  expect(createMonoChartGeometry(values)).toBeNull();
});
