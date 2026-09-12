import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VISUAL_EFFECTS } from "@wallet/core";

import {
  WebThreads,
  type WebThreadsColors,
} from "./web-threads";
import type {
  WebThreadsEngine,
  WebThreadsEngineInput,
} from "./web-threads-engine";

const COLORS: WebThreadsColors = {
  color1: "#ff4500",
  color2: "#242424",
  color3: "#ffffff",
  backgroundColor: "#050505",
};

afterEach(cleanup);

describe("WebThreads", () => {
  it("создаёт один canvas и один engine, затем обновляет uniforms без пересоздания", async () => {
    const engine = createEngineMock();
    const factory = vi.fn(
      (canvas: HTMLCanvasElement, input: WebThreadsEngineInput) => {
        void canvas;
        void input;
        return engine;
      },
    );
    const unavailable = vi.fn();
    const view = render(
      <WebThreads
        effects={DEFAULT_VISUAL_EFFECTS}
        colors={COLORS}
        active
        coarsePointer={false}
        onUnavailable={unavailable}
        engineFactory={factory}
      />,
    );

    const canvas = screen.getByTestId("web-threads-canvas");
    expect(canvas).toHaveAttribute("data-web-threads");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    await waitFor(() => expect(factory).toHaveBeenCalledTimes(1));

    const nextEffects = { ...DEFAULT_VISUAL_EFFECTS, speed: 1.5 };
    const nextColors = { ...COLORS, color1: "#00ffaa" };
    view.rerender(
      <WebThreads
        effects={nextEffects}
        colors={nextColors}
        active
        coarsePointer={false}
        onUnavailable={unavailable}
        engineFactory={factory}
      />,
    );

    await waitFor(() =>
      expect(engine.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          effects: nextEffects,
          colors: nextColors,
          mouseInteraction: true,
        }),
      ),
    );
    expect(factory).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("canvas[data-web-threads]")).toHaveLength(1);
  });

  it("отключает pointer interaction для coarse pointer", async () => {
    const engine = createEngineMock();
    const factory = vi.fn(
      (canvas: HTMLCanvasElement, input: WebThreadsEngineInput) => {
        void canvas;
        void input;
        return engine;
      },
    );

    render(
      <WebThreads
        effects={DEFAULT_VISUAL_EFFECTS}
        colors={COLORS}
        active
        coarsePointer
        onUnavailable={vi.fn()}
        engineFactory={factory}
      />,
    );

    await waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
    expect(factory.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ mouseInteraction: false }),
    );
  });

  it("ставит engine на паузу и освобождает его ровно один раз", async () => {
    const engine = createEngineMock();
    const factory = vi.fn(() => engine);
    const props = {
      effects: DEFAULT_VISUAL_EFFECTS,
      colors: COLORS,
      coarsePointer: false,
      onUnavailable: vi.fn(),
      engineFactory: factory,
    };
    const view = render(<WebThreads {...props} active />);

    await waitFor(() => expect(engine.setRunning).toHaveBeenCalledWith(true));
    view.rerender(<WebThreads {...props} active={false} />);
    await waitFor(() => expect(engine.setRunning).toHaveBeenLastCalledWith(false));

    view.unmount();
    expect(engine.dispose).toHaveBeenCalledTimes(1);
  });
});

function createEngineMock(): WebThreadsEngine {
  return {
    update: vi.fn(),
    setRunning: vi.fn(),
    dispose: vi.fn(),
  };
}
