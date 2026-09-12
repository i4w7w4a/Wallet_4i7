import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroVideo } from "./hero-video";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

describe("HeroVideo", () => {
  it.each([
    { reducedMotion: true, saveData: false, mode: "reduced motion" },
    { reducedMotion: false, saveData: true, mode: "saveData" },
  ])("при $mode оставляет только постер", ({ reducedMotion, saveData }) => {
    const { container } = render(
      <HeroVideo active reducedMotion={reducedMotion} saveData={saveData} />,
    );

    expect(poster(container)).toHaveStyle({
      backgroundImage: 'url("/media/liquid-hero-poster.avif")',
    });
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("в обычном режиме показывает постер и оба runtime-формата", () => {
    const { container } = render(
      <HeroVideo active reducedMotion={false} saveData={false} className="hero" />,
    );

    const root = container.firstElementChild;
    const video = container.querySelector("video");
    const sources = [...container.querySelectorAll("source")];

    expect(root).toHaveClass("hero");
    expect(root).toHaveAttribute("data-video-loaded", "false");
    expect(poster(container)).toBeInTheDocument();
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).toHaveProperty("muted", true);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("src", "/media/liquid-hero.webm");
    expect(sources[0]).toHaveAttribute("type", "video/webm");
    expect(sources[1]).toHaveAttribute("src", "/media/liquid-hero.mp4");
    expect(sources[1]).toHaveAttribute("type", "video/mp4");

    fireEvent.loadedData(video as HTMLVideoElement);
    expect(root).toHaveAttribute("data-video-loaded", "true");
  });

  it("ставит видео на паузу, когда приложение неактивно", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");

    const { container } = render(
      <HeroVideo active={false} reducedMotion={false} saveData={false} />,
    );

    expect(container.querySelector("video")).not.toHaveAttribute("autoplay");
    await waitFor(() => expect(pause).toHaveBeenCalled());
  });

  it("при ошибке видео оставляет постер", async () => {
    const { container } = render(
      <HeroVideo active reducedMotion={false} saveData={false} />,
    );

    fireEvent.error(container.querySelector("video") as HTMLVideoElement);

    await waitFor(() => expect(container.querySelector("video")).not.toBeInTheDocument());
    expect(poster(container)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-video-loaded", "false");
  });

  it("при отклонении autoplay оставляет постер", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new DOMException("Autoplay отклонён", "NotAllowedError"),
    );
    const { container } = render(
      <HeroVideo active reducedMotion={false} saveData={false} />,
    );

    await waitFor(() => expect(container.querySelector("video")).not.toBeInTheDocument());
    expect(poster(container)).toBeInTheDocument();
  });
});

function poster(container: HTMLElement): HTMLElement {
  const layer = container.querySelector<HTMLElement>(".hero-video__poster");
  if (!layer) {
    throw new Error("постер HeroVideo не найден");
  }
  return layer;
}
