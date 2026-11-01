import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoPreview } from "../mono-preview/mono-preview";
import { DesignLab } from "./design-lab";
import { parseMotionLabSearch } from "./motion-lab-launch";

class Channel {
  static peers = new Set<Channel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(readonly name: string) { Channel.peers.add(this); }
  postMessage(data: unknown) { for (const peer of Channel.peers) if (peer !== this && peer.name === this.name)
    queueMicrotask(() => peer.onmessage?.({ data } as MessageEvent)); }
  close() { Channel.peers.delete(this); }
}
beforeEach(() => {
  localStorage.clear(); history.replaceState(null, "", "/mono");
  vi.stubEnv("NEXT_PUBLIC_NOVEX_REVIEW_MOTION_LAB", "1");
  vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("BroadcastChannel", Channel);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); Channel.peers.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

// The exact-path launcher and existing channel must change the real host rather than merely the lab display.
it("applies a validated same-origin lab session to the real wallet host", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const host = render(<MonoPreview snapshot={snapshot} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Пресет 1:/ })).toBeEnabled(), { timeout: 10000 });
  const anchor = host.container.querySelector<HTMLAnchorElement>("[data-review-motion-launch]");
  expect(anchor).not.toBeNull();
  expect(anchor).toHaveAttribute("data-review-motion-ready", "true");
  fireEvent.click(anchor!);
  const url = new URL(anchor!.href);
  expect(url.pathname).toBe("/design-lab/motion");
  const launch = parseMotionLabSearch(url.search);
  expect(launch).not.toBeNull();
  render(<DesignLab walletSnapshot={snapshot} launch={launch} />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Мягкость возврата" }), { target: { value: "240" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить к локальной примерке MONO" }));
  await waitFor(() => expect(host.container.querySelector(".mono-preview-frame")).toHaveStyle({ "--motion-linked-card": "240ms" }));
  expect(screen.getByText(/MONO подтвердил применение/)).toBeVisible();
});
