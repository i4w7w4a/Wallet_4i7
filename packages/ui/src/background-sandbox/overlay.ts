import type { OGLRenderingContext } from "ogl";
import type { Frame, FrameTexture, GpuLimits, Viewport } from "./contracts";

export type OverlayFrame = FrameTexture & Readonly<{
  /** CSS coordinates inside the host, bottom-left origin. */
  rect: readonly [number, number, number, number];
  radius: number;
}>;

/** One optional DOM-aligned optical pass. Shares the host context, input and clock. */
export interface BackgroundOverlay {
  create(gl: OGLRenderingContext, limits: GpuLimits): {
    render(frame: Frame, viewport: Viewport, root: HTMLElement): OverlayFrame | null;
    dispose(): void;
  };
  subscribeInvalidation(listener: () => void): () => void;
  markPresented(presented: boolean): void;
}
