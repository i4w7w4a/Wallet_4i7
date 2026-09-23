import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ControlFeedbackButton } from "./control-feedback-button";
import { DEFAULT_CONFIG } from "./control-feedback-model";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("magnetic button lifecycle", () => {
  it("balances visibility and reduced-motion listeners across Strict Mode mount and unmount", () => {
    const mediaAdd = vi.fn();
    const mediaRemove = vi.fn();
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: mediaAdd, removeEventListener: mediaRemove }));
    const documentAdd = vi.spyOn(document, "addEventListener");
    const documentRemove = vi.spyOn(document, "removeEventListener");

    const mounted = render(
      <StrictMode><ControlFeedbackButton effectId="magnetic" config={DEFAULT_CONFIG} onActivate={() => {}} /></StrictMode>,
    );
    mounted.unmount();

    const visibilityAdds = documentAdd.mock.calls.filter(([event]) => event === "visibilitychange").length;
    const visibilityRemoves = documentRemove.mock.calls.filter(([event]) => event === "visibilitychange").length;
    expect(visibilityAdds).toBeGreaterThan(0);
    expect(visibilityRemoves).toBe(visibilityAdds);
    expect(mediaRemove).toHaveBeenCalledTimes(mediaAdd.mock.calls.length);
  });
});
