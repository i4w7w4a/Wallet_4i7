import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { MONO_GLASS_DEFAULTS, normalizeMonoPaletteConfig } from "@wallet/ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoScene, type MonoScenePresentation } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { createMonoExtendedAppearance } from "./mono-preset-envelope";
import { normalizeMonoBackgroundRecipe } from "./mono-background-recipes";
import * as fontLoader from "./mono-font-loader";
import { createMonoTypographyDefaults, type MonoTypographyConfigV1 } from "./mono-typography";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.monoTheme;
});

const appearance = (): MonoScenePresentation => ({
  preset: "frost",
  palette: { enabled: true, config: normalizeMonoPaletteConfig() },
  shape: { "quick-actions": 7, "bottom-navigation": 4 },
  optics: { ...MONO_GLASS_DEFAULTS.frost },
  environment: { theme: "light", background: "tide" },
  logo: { version: 1, variant: "plaque", customColor: true, hue: 330 },
});

it("waits for the initial document and fonts, falls back on failure, and keeps later trials visible", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const typography = createMonoTypographyDefaults("ledger");
  let rejectInitial!: (reason: Error) => void;
  let resolveTrial!: (value: MonoTypographyConfigV1) => void;
  const load = vi.spyOn(fontLoader, "loadMonoTypography")
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectInitial = reject; }))
    .mockImplementationOnce(() => new Promise(resolve => { resolveTrial = resolve; }));
  const presentation = { ...appearance(), typography };
  const { container, rerender } = render(<MonoScene snapshot={snapshot} appearance={presentation} ready={false} />);
  expect(container.querySelector("[data-mono-preview]")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Загрузка оформления");
  expect(load).not.toHaveBeenCalled();

  rerender(<MonoScene snapshot={snapshot} appearance={presentation} ready />);
  expect(container.querySelector("[data-mono-preview]")).toBeNull();
  await act(async () => rejectInitial(new Error("offline")));
  await waitFor(() => expect(container.querySelector("[data-mono-preview]")).toBeVisible());
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-font-status", "error");

  const trial = createMonoTypographyDefaults("mercury");
  rerender(<MonoScene snapshot={snapshot} appearance={{ ...presentation, typography: trial }} ready />);
  expect(container.querySelector("[data-mono-preview]")).toBeVisible();
  await act(async () => resolveTrial(trial));
  await waitFor(() => expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-font-status", "ready"));
});

it("renders supplied appearance and trusted account data without editor or storage dependencies", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const presentation = appearance();
  const original = JSON.stringify(presentation);
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("The standalone scene must not read browser presets");
  });
  const write = vi.spyOn(Storage.prototype, "setItem");
  document.documentElement.dataset.monoTheme = "dark";

  const { container } = render(<MonoScene snapshot={snapshot} appearance={presentation} viewport={390} />);
  const scene = container.querySelector<HTMLElement>("[data-mono-preview]")!;
  expect(scene).toHaveAttribute("data-mono-preset", "frost");
  expect(scene).toHaveAttribute("data-mono-theme", "light");
  expect(scene).toHaveAttribute("data-mono-background", "tide");
  expect(scene).toHaveAttribute("data-mono-logo-variant", "plaque");
  expect(scene).toHaveAttribute("data-mono-logo-custom", "true");
  expect(scene).toHaveAttribute("data-palette-ready", "true");
  expect(scene.style.getPropertyValue("--mono-actions-radius")).toBe("7px");
  expect(scene.style.getPropertyValue("--mono-nav-radius")).toBe("4px");
  expect(screen.getByText(snapshot.profile.name)).toBeVisible();
  expect(screen.getByRole("img", { name: "Novex Wallet" })).toBeVisible();
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
  expect(container.querySelectorAll('[data-control-effect="material"]')).toHaveLength(4);
  expect(container.querySelector("[data-mono-rail], [data-mono-workbench]")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("img", { name: "График баланса скрыт" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Отправить — демо, операция недоступна" }));
  expect(screen.getByRole("status", { name: "Статус быстрых действий" })).toHaveTextContent("операция недоступна в демо");
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.monoTheme).toBe("dark");
  expect(JSON.stringify(presentation)).toBe(original);
});

it("opens four distinct wallet sections while keeping privacy and demo actions honest", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const { container } = render(<MonoScene snapshot={snapshot} appearance={appearance()} />);
  const nav = screen.getByRole("navigation", { name: "Разделы кошелька" });
  expect(screen.getByRole("button", { name: "Обзор" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Отправить — демо, операция недоступна" })).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole("button", { name: "Активы" }));
  expect(within(nav).getByRole("button", { name: "Активы" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Отправить — демо, операция недоступна" })).toBeNull();
  fireEvent.click(within(nav).getByRole("button", { name: "История" }));
  expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  expect(screen.getByText(/история операций пока не подключена/i)).toBeInTheDocument();
  fireEvent.click(within(nav).getByRole("button", { name: "Профиль" }));
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
  expect(screen.getByText(snapshot.profile.shortAddress)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Скрыть суммы" }));
  fireEvent.click(within(nav).getByRole("button", { name: "Активы" }));
  expect(screen.getAllByText("Значения скрыты")).toHaveLength(snapshot.assets.length);
  expect(container.querySelectorAll("canvas").length).toBeLessThanOrEqual(1);
});

it("lets the host own section state across a scene remount", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const onSectionChange = vi.fn();
  const session = { balanceHidden: false, onBalanceHiddenChange: vi.fn(),
    period: "1D" as const, onPeriodChange: vi.fn(),
    section: "history" as const, onSectionChange };
  const view = render(<MonoScene snapshot={snapshot} appearance={appearance()} session={session} />);
  expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  expect(onSectionChange).toHaveBeenCalledWith("assets");
  view.unmount();
  render(<MonoScene snapshot={snapshot} appearance={appearance()} session={{ ...session, section: "assets" }} />);
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
});

it("renders a frame-only separate product without a material renderer", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const { container } = render(<MonoProductScene snapshot={snapshot} appearance={appearance()}
    material={{ background: null, buttons: { version: 2, frameMode: "separate", bindings: [] } }} />);
  expect(container.querySelector(".mono-actions")).toHaveAttribute("data-frame-mode", "separate");
  expect(container.querySelector("[data-mono-product-material]")).toBeNull();
});

it("updates presentation in place while preserving transient privacy and a single optical canvas", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const first = appearance();
  const { container, rerender } = render(<MonoScene snapshot={snapshot} appearance={first} />);
  const canvas = container.querySelector("canvas");
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  rerender(<MonoScene snapshot={snapshot} appearance={{ ...first,
    preset: "mercury", shape: { "quick-actions": 18, "bottom-navigation": 11 },
    environment: { theme: "dark", background: "strata" },
  }} />);

  const scene = container.querySelector<HTMLElement>("[data-mono-preview]")!;
  expect(scene).toHaveAttribute("data-mono-preset", "mercury");
  expect(scene).toHaveAttribute("data-mono-background", "strata");
  expect(scene.style.getPropertyValue("--mono-actions-radius")).toBe("18px");
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
  expect(container.querySelector("canvas")).toBe(canvas);
});

it("leases the atmosphere surface to an adapter without retaining the legacy ambient renderer", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const surfaceRef = createRef<HTMLElement>();
  const { container, rerender } = render(<MonoScene snapshot={snapshot} appearance={appearance()}
    atmosphere={<div data-custom-atmosphere />} surfaceRef={surfaceRef} />);
  const scene = container.querySelector("[data-mono-preview]");
  expect(container.querySelector("[data-custom-atmosphere]")).not.toBeNull();
  expect(container.querySelector("[data-mono-atmosphere]")).toBeNull();
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
  expect(surfaceRef.current).toBe(scene);
  fireEvent.pointerMove(scene!, { clientX: 40, clientY: 80, pointerType: "mouse" });
  expect(scene).toHaveAttribute("data-pointer-active", "false");

  rerender(<MonoScene snapshot={snapshot} appearance={appearance()} />);
  expect(container.querySelector("[data-custom-atmosphere]")).toBeNull();
  expect(container.querySelectorAll("[data-mono-atmosphere]")).toHaveLength(1);
  expect(container.querySelectorAll("canvas")).toHaveLength(1);
});

it("renders full appearance in the common scene, keeps chart period transient and shares privacy with assets", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const presentation = { ...appearance(), ...createMonoExtendedAppearance("frost"),
    balance: { composition: "centered" as const, fractionSize: "small" as const, fractionTone: "secondary" as const },
    assets: { variant: "tiles" as const, density: "compact" as const, separators: "none" as const },
    chart: { visible: true, variant: "step" as const }, layout: { chartPosition: "bottom" as const },
    background: normalizeMonoBackgroundRecipe({ recipe: "obsidian", calm: true }),
  };
  const { container, rerender } = render(<MonoScene snapshot={snapshot} appearance={presentation} />);
  expect(container.querySelector('.mono-balance[data-composition="centered"]')).not.toBeNull();
  expect(container.querySelector('.mono-asset-list[data-variant="tiles"][data-density="compact"]')).not.toBeNull();
  const assets = container.querySelector(".mono-asset-list")!;
  const chart = container.querySelector('[data-chart-variant="step"]')!;
  expect(assets.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "За неделю" }));
  expect(screen.getByRole("button", { name: "За неделю" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(screen.getAllByText("Значения скрыты")).toHaveLength(snapshot.assets.length);
  expect(screen.getByText("График скрыт")).toBeVisible();
  expect(container.querySelector('[data-mono-background-recipe="obsidian"]')).not.toBeNull();
  expect(container.querySelector("[data-mono-atmosphere]")).toBeNull();
  expect(container.querySelectorAll("canvas")).toHaveLength(1);

  rerender(<MonoScene snapshot={snapshot} appearance={{ ...presentation, chart: { visible: false, variant: "line" } }} />);
  expect(screen.queryByRole("region", { name: "График баланса" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Период графика" })).toBeNull();
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
});
