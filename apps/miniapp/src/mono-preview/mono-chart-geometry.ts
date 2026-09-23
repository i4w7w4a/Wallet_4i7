export type MonoChartGeometry = {
  points: { x: number; y: number }[];
  line: string;
  step: string;
  area: string;
};

export function createMonoChartGeometry(values: readonly number[]): MonoChartGeometry | null {
  if (!values.length || values.some((value) => !Number.isFinite(value))) return null;
  // Scale before subtracting so even finite values near Number.MAX_VALUE stay finite.
  const scale = values.reduce((max, value) => Math.max(max, Math.abs(value)), 1);
  const normalized = values.map((value) => value / scale);
  const low = normalized.reduce((min, value) => Math.min(min, value), Infinity);
  const high = normalized.reduce((max, value) => Math.max(max, value), -Infinity);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const points = normalized.map((value, index) => ({
    x: values.length === 1 ? 150 : round(4 + index / (values.length - 1) * 292),
    y: high === low ? 50 : round(92 - (value - low) / (high - low) * 84),
  }));
  const line = points.map(({ x, y }, index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
  const step = points.map(({ x, y }, index) => index ? `H${x} V${y}` : `M${x} ${y}`).join(" ");
  const area = `${line} L${points[points.length - 1].x} 100 L${points[0].x} 100 Z`;
  return { points, line, step, area };
}
