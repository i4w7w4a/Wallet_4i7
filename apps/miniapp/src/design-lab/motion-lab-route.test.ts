import { afterEach, expect, it, vi } from "vitest";
import MotionLabPage from "../../app/design-lab/motion/page";
import DesignLabPage from "../../app/design-lab/page";
import { enabledLabIds } from "./lab-route-navigation";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
afterEach(() => vi.unstubAllEnvs());

it("keeps both old lab entrances closed unless the review build flag is set", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_NOVEX_REVIEW_MOTION_LAB", "0");
  expect(enabledLabIds()).not.toContain("motion");
  await expect(MotionLabPage()).rejects.toThrow("NOT_FOUND");
  await expect(DesignLabPage({ searchParams: Promise.resolve({ session: "x", target: "mono.quick-actions" }) })).rejects.toThrow("NOT_FOUND");
  vi.stubEnv("NEXT_PUBLIC_NOVEX_REVIEW_MOTION_LAB", "1");
  expect(enabledLabIds()).toContain("motion");
  await expect(MotionLabPage()).resolves.toBeTruthy();
});
