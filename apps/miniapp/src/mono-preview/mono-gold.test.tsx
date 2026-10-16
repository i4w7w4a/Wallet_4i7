import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { resolveMonoPalette, validateMonoPaletteApply } from "@wallet/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "./mono-product-scene";
import { MonoScene } from "./mono-scene";
import { createMonoAppearanceEnvelope, normalizeMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { createDefaultActionArtworkMap } from "./action-artwork/model";
import { MONO_GOLD_ENVELOPE } from "./mono-gold-appearance";
import { MonoGoldViewer } from "./mono-gold-viewer";
import { HOME_PINS_STORAGE_KEY } from "../mono-product/home-pins";

const THEME_KEY = "wallet4i7.mono.viewer-theme.v1";
const fixedGoldHost = { themePreference: "fixed" as const, presentation: "gold" as const };

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 390, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(300, 710, 68, 48);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it("fixed Gold does not restore or overwrite a visitor's light theme", async () => {
  const preference = JSON.stringify({ version: 1, theme: "light" });
  localStorage.setItem(THEME_KEY, preference);
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope();
  const view = render(<MonoProductScene {...fixedGoldHost} snapshot={snapshot} appearance={envelope.appearance}
    material={envelope.material} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "dark"));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-presentation", "gold");
  expect(localStorage.getItem(THEME_KEY)).toBe(preference);
});

it("ordinary standalone viewers still restore the visitor theme and have no Gold marker", async () => {
  localStorage.setItem(THEME_KEY, JSON.stringify({ version: 1, theme: "light" }));
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope();
  const view = render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance}
    material={envelope.material} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light"));
  expect(view.container.querySelector("[data-mono-preview]")).not.toHaveAttribute("data-mono-presentation");
});

it("Gold uses the tray receive glyph only for original artwork without material targets", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope();
  const artwork = createDefaultActionArtworkMap();
  const view = render(<MonoScene {...fixedGoldHost} snapshot={snapshot} appearance={envelope.appearance}
    actionArtwork={artwork} effectsDisabled />);
  const receive = () => screen.getByRole("button", { name: /Получить — демо/ });
  expect(receive().querySelector("path")?.getAttribute("d")).toContain("M12 5.2v9.2");
  view.rerender(<MonoScene {...fixedGoldHost} snapshot={snapshot} appearance={envelope.appearance}
    actionArtwork={artwork} materialTargets effectsDisabled />);
  expect(receive().querySelector("path")?.getAttribute("d")).not.toContain("M12 5.2v9.2");
  artwork["quick.receive"].packId = "contour-v1";
  view.rerender(<MonoScene {...fixedGoldHost} snapshot={snapshot} appearance={envelope.appearance}
    actionArtwork={artwork} effectsDisabled />);
  expect(receive()).toHaveAttribute("data-artwork-pack", "contour-v1");
  expect(receive().querySelector("[data-artwork-id]")).not.toBeNull();
  view.rerender(<MonoScene snapshot={snapshot} appearance={envelope.appearance}
    actionArtwork={createDefaultActionArtworkMap()} effectsDisabled />);
  expect(receive().querySelector("path")?.getAttribute("d")).not.toContain("M12 5.2v9.2");
});

it("Gold has a normalized immutable matte envelope and distinct readable financial states", async () => {
  const gold = MONO_GOLD_ENVELOPE;
  expect(normalizeMonoAppearanceEnvelope(gold)).toEqual(gold);
  expect(Object.isFrozen(gold.appearance.palette.config.themes.dark.roles)).toBe(true);
  expect(gold.material.background).toBeNull();
  expect(gold.material.buttons).toMatchObject({ frameMode: "icons", bindings: [] });
  for (const theme of Object.values(gold.appearance.palette.config.themes)) {
    expect(validateMonoPaletteApply(theme).issues).toEqual([]);
  }
  const palette = resolveMonoPalette(gold.appearance.palette.config.themes.dark);
  expect(new Set([palette.roles.success.h, palette.roles.warning.h, palette.roles.danger.h, palette.roles.info.h]).size).toBe(4);
  expect(createMonoAppearanceEnvelope().appearance.palette.enabled).toBe(false);
  expect(createMonoAppearanceEnvelope().material.buttons).toBeNull();
});

it("Gold keeps the real product host and preserves existing MONO home-pin preferences", async () => {
  const preference = JSON.stringify({ version: 2, groups: ["depositary"], totalOnly: true });
  localStorage.setItem(HOME_PINS_STORAGE_KEY, preference);
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<MonoGoldViewer snapshot={snapshot} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  const host = view.container.querySelector<HTMLElement>("[data-mono-gold-viewer]")!;
  expect(host.style.getPropertyValue("--mono-gold-accent")).toMatch(/^rgb\(/);
  expect(host.style.getPropertyValue("--mono-gold-danger")).toMatch(/^rgb\(/);
  expect(view.container.querySelector("[data-mono-product]")).toHaveAttribute("data-mono-product", "true");
  expect(view.container.querySelector("[data-mono-rail], [data-mono-workbench]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  const menu = screen.getByRole("dialog", { name: "Меню" });
  expect(within(menu).queryByRole("button", { name: "На главной" })).toBeNull();
  expect(localStorage.getItem(HOME_PINS_STORAGE_KEY)).toBe(preference);
  expect(screen.getByText("Демо · операции не выполняются")).toBeInTheDocument();
});

it("Gold owns a dedicated frame scrollport and resets it on section navigation without material bindings", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<MonoGoldViewer snapshot={snapshot} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  const page = view.container.querySelector<HTMLElement>("[data-mono-preview]")!;
  const scrollport = page.closest<HTMLElement>("[data-material-scrollport]");
  expect(scrollport).toHaveClass("mono-preview-frame");
  expect(scrollport?.parentElement).toHaveAttribute("data-mono-gold-viewer");
  scrollport!.scrollTop = 160;
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" }))
    .getByRole("button", { name: "Активы" }));
  expect(page).toHaveAttribute("data-mono-section", "assets");
  expect(scrollport!.scrollTop).toBe(0);
});

function openBalanceDynamicsSettings() {
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Язык" }));
  return screen.getByRole("dialog", { name: "Настройки" });
}

it("balance dynamics Gold starts without a graph, periods or an empty chart wrapper", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<MonoGoldViewer snapshot={snapshot} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  expect(screen.queryByRole("region", { name: "График баланса" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Период графика" })).toBeNull();
  expect(screen.queryByText("Динамика баланса")).toBeNull();
  expect(view.container.querySelector(".mono-product-chart, .mono-scene-domain--chart")).toBeNull();
  expect(screen.getByRole("button", { name: "Скрыть баланс" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Отправить" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Мои средства" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Последняя операция" })).toBeNull();
});

it("balance dynamics Gold Settings toggles the real graph and periods without storage writes", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<MonoGoldViewer snapshot={snapshot} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  const writes = vi.spyOn(Storage.prototype, "setItem");
  const settings = openBalanceDynamicsSettings();
  const toggle = within(settings).getByRole("switch", { name: "Динамика баланса" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(toggle).toHaveAccessibleDescription("Выключена");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(toggle).toHaveAccessibleDescription("Включена");
  fireEvent.click(screen.getByRole("button", { name: "Закрыть панель" }));
  expect(screen.getByRole("region", { name: "График баланса" })).toBeInTheDocument();
  const periods = screen.getByRole("group", { name: "Период графика" });
  fireEvent.click(within(periods).getByRole("button", { name: "За неделю" }));
  expect(screen.getByRole("img", { name: "Динамика баланса за неделю" })).toBeInTheDocument();
  fireEvent.click(within(openBalanceDynamicsSettings()).getByRole("switch", { name: "Динамика баланса" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть панель" }));
  expect(screen.queryByRole("region", { name: "График баланса" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Период графика" })).toBeNull();
  expect(view.container.querySelector(".mono-product-chart, .mono-scene-domain--chart")).toBeNull();
  expect(writes).not.toHaveBeenCalled();
});

it("balance dynamics ordinary MONO keeps its graph and has no Gold Settings switch", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope();
  render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material} effectsDisabled />);
  expect(screen.getByRole("region", { name: "График баланса" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Период графика" })).toBeInTheDocument();
  expect(within(openBalanceDynamicsSettings()).queryByRole("switch", { name: "Динамика баланса" })).toBeNull();
});

it("balance dynamics memory preference resets to off when the Gold viewer remounts", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = render(<MonoGoldViewer snapshot={snapshot} effectsDisabled />);
  await waitFor(() => expect(first.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  fireEvent.click(within(openBalanceDynamicsSettings()).getByRole("switch", { name: "Динамика баланса" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть панель" }));
  expect(screen.getByRole("region", { name: "График баланса" })).toBeInTheDocument();
  first.unmount();
  const second = render(<MonoGoldViewer snapshot={snapshot} effectsDisabled />);
  await waitFor(() => expect(second.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  expect(screen.queryByRole("region", { name: "График баланса" })).toBeNull();
  expect(within(openBalanceDynamicsSettings()).getByRole("switch", { name: "Динамика баланса" }))
    .toHaveAttribute("aria-checked", "false");
});

it.each([
  { chartPosition: "top" as const, dynamics: false },
  { chartPosition: "top" as const, dynamics: true },
  { chartPosition: "bottom" as const, dynamics: true },
])("Gold keeps Funds after actions and before pending with chart $chartPosition / $dynamics", async ({ chartPosition, dynamics }) => {
  // Exercise the shipped CSS order contract, not jsdom's nonexistent layout geometry.
  const style = document.createElement("style");
  style.textContent = ["./mono-preview.css", "../mono-product/product-home.css", "./mono-gold-smoked-glass.css"]
    .map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  document.head.append(style);
  try {
    const snapshot = await new MockWalletRepository().getSnapshot();
    const appearance = { ...MONO_GOLD_ENVELOPE.appearance, layout: { chartPosition } };
    const view = render(<div className="mono-gold-viewer"><MonoProductScene {...fixedGoldHost} snapshot={snapshot}
      appearance={appearance} material={MONO_GOLD_ENVELOPE.material} effectsDisabled
      balanceDynamics={{ enabled: dynamics, onChange() {} }} /></div>);
    await waitFor(() => expect(view.container.querySelector(".mono-scene")).toBeInTheDocument());
    const scene = view.container.querySelector<HTMLElement>(".mono-scene")!;
    const balance = scene.querySelector<HTMLElement>(".mono-hero")!;
    const actions = scene.querySelector<HTMLElement>(".mono-actions")!;
    const funds = screen.getByRole("button", { name: "Мои средства" });
    const pending = scene.querySelector<HTMLElement>(".mono-product-recent")!;
    const order = (element: HTMLElement) => Number(getComputedStyle(element).order || 0);
    expect(getComputedStyle(scene).display).toBe("flex");
    expect(order(balance)).toBeLessThan(order(actions));
    expect(order(actions)).toBeLessThan(order(funds));
    expect(order(funds)).toBeLessThanOrEqual(order(pending));
    expect(funds.compareDocumentPosition(pending) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    const chart = scene.querySelector<HTMLElement>(".mono-scene-domain--chart");
    if (!dynamics) expect(chart).toBeNull();
    else if (chartPosition === "top") {
      expect(order(chart!)).toBeGreaterThan(order(actions));
      expect(order(chart!)).toBeLessThan(order(funds));
    } else expect(order(chart!)).toBeGreaterThan(order(pending));
  } finally {
    style.remove();
  }
});
