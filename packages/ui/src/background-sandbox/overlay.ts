import type { OGLRenderingContext } from "ogl";
import type { Frame, FrameTexture, GpuLimits, Viewport } from "./contracts";

export type OverlayFrame = FrameTexture & Readonly<{
  /** CSS coordinates inside the host, bottom-left origin. */
  rect: readonly [number, number, number, number];
  radius: number;
  /** Follows the DOM panel's finite open/close opacity in the shared canvas. */
  opacity?: number;
}>;

/** Borrowed current-frame background; no DOM/foreground capture or texture ownership. */
export type OverlaySource = FrameTexture & Readonly<{
  /** Opaque CSS base underneath a premultiplied background texture, display sRGB. */
  baseColor?: readonly [number, number, number];
  /** Same side-darkening, inset, softness used by the background compositor. */
  edgeFinish?: readonly [number, number, number];
}>;
export type OverlayFrames = OverlayFrame | readonly OverlayFrame[] | null;
export const overlayFrameList = (frames: OverlayFrames): readonly OverlayFrame[] =>
  frames === null ? [] : "texture" in frames ? [frames] : frames;

/** Optional DOM-aligned optical passes, sharing the host context, input and clock. */
export interface BackgroundOverlay {
  create(gl: OGLRenderingContext, limits: GpuLimits): {
    render(frame: Frame, viewport: Viewport, root: HTMLElement, source?: OverlaySource | null): OverlayFrames;
    dispose(): void;
  };
  subscribeInvalidation(listener: () => void): () => void;
  markPresented(presented: boolean): void;
}
