import { describe, expect, it } from "vitest";
import { rasterizeMaterialIcon } from "./material-icon-assets";

describe("host icon masks", () => {
  it("rejects empty or excessive raster sizes before creating any canvas", () => {
    expect(() => rasterizeMaterialIcon("mono.quick.send", 0, 24)).toThrow(RangeError);
    expect(() => rasterizeMaterialIcon("mono.quick.send", 257, 24)).toThrow(RangeError);
  });
});
