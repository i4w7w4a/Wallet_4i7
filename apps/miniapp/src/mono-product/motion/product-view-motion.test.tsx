import "@testing-library/jest-dom/vitest";
import { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useProductViewMotion, type ProductViewIdentity } from "./product-view-motion";

type Entry = { frames: Keyframe[]; options: KeyframeAnimationOptions; animation: Animation };
let entries: Entry[];
let reduced: boolean;
let hidden: boolean;
let media: EventTarget;

function Harness({ view, enabled = true, gate = "ready", copy = "Current content" }: {
  view: ProductViewIdentity; enabled?: boolean; gate?: "ready" | "static"; copy?: string;
}) {
  const surfaceRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useProductViewMotion({ surfaceRef, contentRef, view, enabled });
  return <main ref={surfaceRef} data-mono-motion={gate}>
    <div ref={contentRef} className="mono-scene">
      <header className="mono-app-header">Stable header</header>
      <div className="mono-product-context">Stable context</div>
      <section>{copy}<input aria-label="Draft" defaultValue="kept" /></section>
    </div>
  </main>;
}
const overview: ProductViewIdentity = { section: "overview", assetId: null };
const assets: ProductViewIdentity = { section: "assets", assetId: null };

beforeEach(() => {
  entries = []; reduced = false; hidden = false; media = new EventTarget();
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; },
    addEventListener: media.addEventListener.bind(media), removeEventListener: media.removeEventListener.bind(media) }));
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => hidden ? "hidden" : "visible");
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (
    frames: Keyframe[], options: KeyframeAnimationOptions,
  ) {
    const animation = { cancel: vi.fn(), onfinish: null, oncancel: null } as unknown as Animation;
    entries.push({ frames, options, animation });
    return animation;
  } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

it("keeps initial and nonsemantic renders still, cancels old motion, and ignores stale completion", () => {
  const rendered = render(<Harness view={overview} />);
  const draft = screen.getByRole("textbox", { name: "Draft" });
  expect(entries).toHaveLength(0);
  rendered.rerender(<Harness view={assets} />);
  expect(entries).toHaveLength(1);
  const oldFinish = entries[0].animation.onfinish!;
  rendered.rerender(<Harness view={{ section: "profile", assetId: null }} />);
  expect(entries).toHaveLength(2);
  expect(entries[0].animation.cancel).toHaveBeenCalledOnce();
  act(() => oldFinish.call(entries[0].animation, new Event("finish") as AnimationPlaybackEvent));
  expect(entries[1].animation.cancel).not.toHaveBeenCalled();
  rendered.rerender(<Harness view={{ section: "profile", assetId: null }} copy="Privacy/theme/data changed" />);
  expect(entries).toHaveLength(2);
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  rendered.rerender(<Harness view={overview} />);
  expect(entries).toHaveLength(3);
  expect(entries[2].frames[0].transform).toBe("translate3d(-6px, 0, 0)");
  act(() => entries[2].animation.onfinish!.call(entries[2].animation, new Event("finish") as AnimationPlaybackEvent));
  expect(rendered.container.querySelector("[data-product-view-motion-target]")).toBeNull();
  expect(screen.getByText("Current content")).toBeVisible();
});

it("settles on every motion gate change, skips hidden transitions, and never replays them on resume", async () => {
  const rendered = render(<Harness view={overview} />);
  rendered.rerender(<Harness view={assets} />);
  expect(entries).toHaveLength(1);
  await act(async () => { rendered.rerender(<Harness view={assets} gate="static" />); });
  expect(entries[0].animation.cancel).toHaveBeenCalledOnce();
  rendered.rerender(<Harness view={{ ...assets, assetId: "usdc" }} gate="static" />);
  rendered.rerender(<Harness view={{ ...assets, assetId: "usdc" }} />);
  expect(entries).toHaveLength(1);
  rendered.rerender(<Harness view={assets} />);
  expect(entries).toHaveLength(2);
  act(() => { reduced = true; media.dispatchEvent(new Event("change")); });
  expect(entries[1].animation.cancel).toHaveBeenCalledOnce();
  rendered.rerender(<Harness view={overview} />);
  expect(entries).toHaveLength(2);
  act(() => { reduced = false; media.dispatchEvent(new Event("change")); });
  expect(entries).toHaveLength(2);
  rendered.rerender(<Harness view={assets} />);
  act(() => { hidden = true; document.dispatchEvent(new Event("visibilitychange")); });
  expect(entries[2].animation.cancel).toHaveBeenCalledOnce();
  rendered.rerender(<Harness view={overview} />);
  expect(entries).toHaveLength(3);
  act(() => { hidden = false; document.dispatchEvent(new Event("visibilitychange")); });
  rendered.rerender(<Harness view={assets} />);
  rendered.rerender(<Harness view={assets} enabled={false} />);
  expect(entries[3].animation.cancel).toHaveBeenCalledOnce();
  rendered.rerender(<Harness view={{ ...assets, assetId: "btc" }} enabled={false} />);
  rendered.rerender(<Harness view={{ ...assets, assetId: "btc" }} />);
  expect(entries).toHaveLength(4);
  rendered.rerender(<Harness view={assets} />);
  rendered.unmount();
  expect(entries[4].animation.cancel).toHaveBeenCalledOnce();
  act(() => { reduced = true; media.dispatchEvent(new Event("change")); });
  expect(entries[4].animation.cancel).toHaveBeenCalledOnce();
});

it("keeps current content visible when WAAPI is unavailable", () => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  const rendered = render(<Harness view={overview} />);
  rendered.rerender(<Harness view={assets} />);
  expect(screen.getByText("Current content")).toBeVisible();
  expect(rendered.container.querySelector("[data-product-view-motion-target]")).toBeNull();
});
