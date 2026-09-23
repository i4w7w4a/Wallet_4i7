import { expect, it } from "vitest";
import { normalizeMonoSceneAppearance, parseMonoSceneAppearance } from "./mono-scene-lab-contract";

it("recovers malformed appearance field by field and excludes wallet data", () => {
  expect(normalizeMonoSceneAppearance({
    balance: { composition: "centered", fractionSize: 100, fractionTone: "transparent", amount: 42 },
    chart: { visible: false, variant: "execute-script" },
    layout: { chartPosition: "bottom" },
    assets: { variant: "tiles", density: "compact", separators: "none", account: "secret" },
    hidden: true, period: "ALL",
  })).toEqual({
    balance: { composition: "centered", fractionSize: "medium", fractionTone: "secondary" },
    chart: { visible: false, variant: "line" },
    layout: { chartPosition: "bottom" },
    assets: { variant: "tiles", density: "compact", separators: "none" },
  });
});

it("rejects an entire import with extra, missing or invalid fields", () => {
  const valid = normalizeMonoSceneAppearance({});
  expect(parseMonoSceneAppearance(valid)).toEqual(valid);
  expect(parseMonoSceneAppearance({ ...valid, hidden: false })).toBeNull();
  expect(parseMonoSceneAppearance({ ...valid, chart: { visible: true } })).toBeNull();
  expect(parseMonoSceneAppearance({ ...valid, balance: { ...valid.balance, fractionSize: "tiny" } })).toBeNull();
  expect(parseMonoSceneAppearance({ ...valid, assets: { ...valid.assets, amount: 10 } })).toBeNull();
  expect(parseMonoSceneAppearance(null)).toBeNull();
});

it.each([undefined, null, [], "invalid", 5])("returns a usable independent default for %s", (input) => {
  const first = normalizeMonoSceneAppearance(input);
  first.chart.visible = false;
  expect(normalizeMonoSceneAppearance(input).chart.visible).toBe(true);
});
