import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../../mono-preview/mono-product-scene";
import { MonoScene, type MonoSection } from "../../mono-preview/mono-scene";
import { createMonoAppearanceEnvelope } from "../../mono-preview/mono-preset-envelope";
import { ProductProfile } from "../product-profile";
import { useMonoProductController } from "../product-controller";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../demo-adapter";
import { buyQuote } from "../commerce/test-fixtures";
import { commerceOperationId } from "../commerce/validation";
import type { BuyRoute } from "../commerce";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 320, 900);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(248, 22, 44, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function controlledHome() {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  function Host() {
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [hidden, setHidden] = useState(false);
    const [section, setSection] = useState<MonoSection>("overview");
    return <MonoProductScene snapshot={snapshot} material={envelope.material} viewport={320}
      appearance={{ ...envelope.appearance, environment: { ...envelope.appearance.environment, theme } }}
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: hidden, onBalanceHiddenChange: setHidden, onThemeChange: setTheme }} />;
  }
  return render(<Host />);
}

function openSettings() {
  const trigger = screen.getByRole("button", { name: "Быстрые настройки" });
  trigger.focus(); fireEvent.click(trigger);
  return { trigger, panel: screen.getByRole("dialog", { name: "Быстрые настройки" }) };
}

it("consumes a profile disclosure request once and honours a new revision after manual close", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const base = { profile: snapshot.profile, balanceHidden: false, onBalanceHiddenChange() {} };
  const view = render(<ProductProfile {...base} />);
  view.rerender(<ProductProfile {...base} openSectionRequest={{ section: "help", revision: 1 }} />);
  const help = screen.getByRole("button", { name: "Помощь и документы" });
  expect(help).toHaveAttribute("aria-expanded", "true");
  expect(help).toHaveFocus();
  fireEvent.click(help);
  view.rerender(<ProductProfile {...base} openSectionRequest={{ section: "help", revision: 1 }} />);
  expect(help).toHaveAttribute("aria-expanded", "false");
  view.rerender(<ProductProfile {...base} openSectionRequest={{ section: "help", revision: 2 }} />);
  expect(help).toHaveAttribute("aria-expanded", "true");
  expect(help).toHaveFocus();
});

it("changes shared preferences in place and the avatar reaches the same profile state", async () => {
  const { container } = await controlledHome();
  const { panel } = openSettings();
  expect(panel).not.toHaveAttribute("aria-modal", "true");
  fireEvent.click(within(panel).getByRole("button", { name: "Светлая" }));
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  fireEvent.click(within(panel).getByRole("button", { name: "Скрывать суммы" }));
  expect(within(panel).getByRole("button", { name: "Скрывать суммы" })).toHaveAttribute("aria-pressed", "true");
  expect(panel).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Светлая" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Показать суммы" })).toHaveAttribute("aria-pressed", "true");
});

it("opens existing help with destination focus and repeats the request inside profile", async () => {
  await controlledHome();
  const { panel } = openSettings();
  fireEvent.click(within(panel).getByRole("button", { name: "Помощь" }));
  const help = screen.getByRole("button", { name: "Помощь и документы" });
  expect(help).toHaveAttribute("aria-expanded", "true");
  expect(help).toHaveFocus();
  expect(screen.getByText("Счёт и сеть")).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
  fireEvent.click(help);
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  fireEvent.click(within(openSettings().panel).getByRole("button", { name: "Помощь" }));
  expect(help).toHaveAttribute("aria-expanded", "true");
  expect(help).toHaveFocus();
  fireEvent.click(help);
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  fireEvent.click(screen.getByRole("button", { name: "Профиль" }));
  expect(screen.getByRole("button", { name: "Помощь и документы" })).toHaveAttribute("aria-expanded", "false");
});

it("restores the launcher on Escape while outside navigation keeps its action and focus", async () => {
  await controlledHome();
  const { trigger, panel } = openSettings();
  expect(within(panel).getByRole("button", { name: "Светлая" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
  openSettings();
  const history = screen.getByRole("button", { name: "История" });
  fireEvent.pointerDown(history); history.focus(); fireEvent.click(history);
  expect(history).toHaveFocus();
  expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
});

it("keeps a host without a theme callback read-only", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material}
    session={{ balanceHidden: false, onBalanceHiddenChange() {}, period: "1D", onPeriodChange() {} }} />);
  const { panel } = openSettings();
  expect(within(panel).queryByRole("button", { name: "Светлая" })).toBeNull();
  expect(within(panel).queryByRole("button", { name: "Тёмная" })).toBeNull();
  expect(within(panel).getByText("Тёмная")).toBeVisible();
  expect(within(panel).getByRole("button", { name: "Скрывать суммы" })).toHaveFocus();
});

it("blocks header navigation during an accepted pending lease without changing its route or raw draft", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const route = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, "buy").routes[0] as BuyRoute;
  act(() => result.current.commands.openIntent("buy"));
  act(() => result.current.commands.saveBuyDraft(route, { route, methodId: "demo-payment-usd", fiatAmount: "23," }));
  const quote = buyQuote();
  quote.portId = result.current.view.flowPorts.buy.id; quote.expiresAt = 61_000;
  const key = "header-guard-attempt";
  act(() => result.current.commands.setCommerceSubmitState(route, { busy: true,
    attempt: { kind: "buy", quote, idempotencyKey: key, operationId: commerceOperationId(quote, key) } }));
  expect(result.current.view.commerceBusy).toBe(true);
  const sheet = result.current.view.sheet;
  const view = render(<MonoScene snapshot={snapshot} appearance={envelope.appearance} product={result.current} />);
  fireEvent.click(screen.getByRole("button", { name: "Быстрые настройки", hidden: true }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль", hidden: true }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
  expect(result.current.view.sheet).toBe(sheet);
  expect(result.current.view.context).toEqual({ kind: "all" });
  expect(Object.values(result.current.view.buyDrafts)[0]?.fiatAmount).toBe("23,");
});

it("releases an open menu when the scene becomes inactive", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const view = render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material} />);
  openSettings();
  view.rerender(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material} active={false} />);
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки", hidden: true })).toBeNull();
  view.rerender(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material} />);
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
});
