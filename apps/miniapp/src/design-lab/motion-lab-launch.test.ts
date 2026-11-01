import { expect, it } from "vitest";
import { parseMotionLabSearch } from "./motion-lab-launch";

it("accepts only a complete, unique existing same-origin launch envelope", () => {
  const session = "6bffb852-c139-4471-9558-4ed764dfcbde";
  expect(parseMotionLabSearch(`?session=${session}&target=mono.quick-actions&working=preset-1`))
    .toEqual({ sessionId: session, targetId: "mono.quick-actions", workingPresetId: "preset-1" });
  expect(parseMotionLabSearch(`?session=${session}&session=${session}&target=mono.quick-actions`)).toBeNull();
  expect(parseMotionLabSearch(`?session=${session}&target=mono.quick-actions&unexpected=1`)).toBeNull();
  expect(parseMotionLabSearch("?session=bad&target=mono.quick-actions")).toBeNull();
  expect(parseMotionLabSearch("")).toBeNull();
});
