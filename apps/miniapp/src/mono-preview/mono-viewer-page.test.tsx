import "@testing-library/jest-dom/vitest";
import { Blob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { CompressionStream, DecompressionStream } from "node:stream/web";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { MonoViewerPage } from "./mono-viewer-page";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { createMonoShareUrl } from "./mono-share-codec";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("opens the real common wallet scene with private interactions and no editor or storage", async () => {
  vi.stubGlobal("Blob", Blob);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("CompressionStream", CompressionStream);
  vi.stubGlobal("DecompressionStream", DecompressionStream);
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: media.includes("reduced-motion"), media, addEventListener() {}, removeEventListener() {} }));
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("frost");
  envelope.appearance.environment = { theme: "light", background: "strata" };
  envelope.appearance.logo.variant = "plaque";
  history.replaceState(null, "", await createMonoShareUrl(envelope, location.origin));
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const { container } = render(<MonoViewerPage snapshot={snapshot} />);
  await waitFor(() => expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light"));
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-background", "strata");
  expect(container.querySelector("[data-mono-rail]")).toBeNull();
  expect(container.querySelector("[data-mono-workbench]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeInTheDocument();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
