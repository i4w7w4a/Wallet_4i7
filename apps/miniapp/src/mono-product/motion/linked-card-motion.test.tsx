import "@testing-library/jest-dom/vitest";
import { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLinkedCardMotion } from "./linked-card-motion";

let animations: Animation[];
let durations: number[];
function Harness({ detailId, content = "Current", enabled = true }: { detailId: string | null; content?: string; enabled?: boolean }) {
  const surfaceRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLinkedCardMotion({ surfaceRef, contentRef, detailId, enabled });
  return <main ref={surfaceRef} data-mono-motion={enabled ? "ready" : "static"} style={{ "--motion-linked-card": "410ms" } as React.CSSProperties}><div ref={contentRef}>
    <section>{content}<input aria-label="Current input" /></section>
  </div></main>;
}
beforeEach(() => {
  animations = []; durations = [];
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: (_frames: Keyframe[], options: KeyframeAnimationOptions) => {
    durations.push(Number(options.duration));
    const animation = { cancel: vi.fn(), onfinish: null, oncancel: null } as unknown as Animation;
    animations.push(animation);
    return animation;
  } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as Partial<HTMLElement>).animate; });

it("keeps one current tree and ignores a stale completion after rapid selection and privacy changes", () => {
  const view = render(<Harness detailId={null} />);
  expect(animations).toHaveLength(0);
  const input = screen.getByRole("textbox");
  view.rerender(<Harness detailId="alpha" />);
  expect(durations[0]).toBe(410);
  const stale = animations[0].onfinish!;
  view.rerender(<Harness detailId="beta" content="Hidden" />);
  expect(animations[0].cancel).toHaveBeenCalled();
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.getByRole("textbox")).toBe(input);
  expect(screen.queryByText("Current")).toBeNull();
  act(() => stale.call(animations[0], new Event("finish") as AnimationPlaybackEvent));
  expect(animations[1].cancel).not.toHaveBeenCalled();
  view.rerender(<Harness detailId="beta" content="Fresh" />);
  expect(animations).toHaveLength(2);
  view.rerender(<Harness detailId={null} />);
  view.rerender(<Harness detailId={null} enabled={false} />);
  expect(animations[2].cancel).toHaveBeenCalled();
});
