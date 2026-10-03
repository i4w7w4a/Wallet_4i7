import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoProductScene } from "../../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../../mono-preview/mono-preset-envelope";

const preferenceKey = "wallet4i7.mono.viewer-theme.v1";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function openProfile() {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" }))
    .getByRole("button", { name: "Профиль" }));
}

it("keeps editor theme controlled by its host without accessing the visitor preference", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const appearance = { ...envelope.appearance,
    environment: Object.freeze({ ...envelope.appearance.environment, theme: "light" as const }) };
  localStorage.setItem(preferenceKey, '{"version":1,"theme":"dark"}');
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const onThemeChange = vi.fn();
  const session = { balanceHidden: false, onBalanceHiddenChange: vi.fn(),
    period: "1D" as const, onPeriodChange: vi.fn(), section: "profile" as const,
    onSectionChange: vi.fn(), onThemeChange };
  const view = render(<MonoProductScene snapshot={wallet} appearance={appearance}
    material={envelope.material} session={session} />);

  expect(screen.queryByRole("button", { name: "Светлая" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Тёмная" }));
  expect(onThemeChange).toHaveBeenCalledExactlyOnceWith("dark");
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  view.rerender(<MonoProductScene snapshot={wallet}
    appearance={{ ...appearance, environment: { ...appearance.environment, theme: "dark" } }}
    material={envelope.material} session={session} />);
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "dark");
  expect(screen.getByRole("button", { name: "Тёмная" })).toHaveAttribute("aria-pressed", "true");
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(appearance.environment.theme).toBe("light");
});

it("changes the visitor scene, restores the choice on remount, and preserves the published envelope and other storage", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const original = JSON.stringify(envelope);
  Object.freeze(envelope.appearance.environment);
  Object.freeze(envelope.appearance);
  localStorage.setItem("working-preset-sentinel", "unchanged");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const props = { snapshot: wallet, appearance: envelope.appearance, material: envelope.material };
  const view = render(<MonoProductScene {...props} />);
  openProfile();
  expect(screen.queryByRole("button", { name: "Тёмная" })).toHaveAttribute("aria-pressed", "true");
  expect(write).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Светлая" }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  expect(screen.getByRole("button", { name: "Светлая" })).toHaveAttribute("aria-pressed", "true");
  expect(write).toHaveBeenCalledExactlyOnceWith(preferenceKey, '{"version":1,"theme":"light"}');
  expect(JSON.stringify(envelope)).toBe(original);
  expect(localStorage.getItem("working-preset-sentinel")).toBe("unchanged");

  view.unmount();
  const restored = render(<MonoProductScene {...props} />);
  openProfile();
  expect(restored.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  expect(screen.getByRole("button", { name: "Светлая" })).toHaveAttribute("aria-pressed", "true");
  expect(write).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(envelope)).toBe(original);
});

it.each([
  "broken-json",
  '"light"',
  '{"version":2,"theme":"light"}',
  '{"version":1,"theme":"sepia"}',
  '{"version":1,"theme":"light","appearance":{"preset":"frost"}}',
])("ignores invalid visitor preferences without importing or rewriting them: %s", async raw => {
  localStorage.setItem(preferenceKey, raw);
  const write = vi.spyOn(Storage.prototype, "setItem");
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const view = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance}
    material={envelope.material} />);
  openProfile();
  expect(screen.queryByRole("button", { name: "Тёмная" })).toHaveAttribute("aria-pressed", "true");
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "dark");
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem(preferenceKey)).toBe(raw);
});

it("keeps theme switching usable in memory when browser storage is denied", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Denied"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
  const view = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance}
    material={envelope.material} />);
  openProfile();
  expect(screen.queryByRole("button", { name: "Светлая" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Светлая" }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  expect(envelope.appearance.environment.theme).toBe("dark");
});

it("renders the source theme on the server without reading browser preferences", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  localStorage.setItem(preferenceKey, '{"version":1,"theme":"light"}');
  const read = vi.spyOn(Storage.prototype, "getItem");
  const html = renderToString(<MonoProductScene snapshot={wallet} appearance={envelope.appearance}
    material={envelope.material} />);
  expect(html).toContain('data-mono-theme="dark"');
  expect(read).not.toHaveBeenCalled();
});
