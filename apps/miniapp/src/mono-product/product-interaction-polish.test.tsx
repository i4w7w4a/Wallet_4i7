import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, SINGLE_ACCOUNT_DEMO } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "../mono-preview/mono-scene";
import { MONO_BACKGROUND_DEFAULTS } from "../mono-preview/mono-background-recipes";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { useMonoProductController, type MonoProductController } from "./product-controller";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import { disclosureTestAnimations } from "./motion/disclosure-test-animations";
import { buyQuote, buyRoute } from "./commerce/test-fixtures";
import { commerceOperationId } from "./commerce/validation";

let animations: ReturnType<typeof disclosureTestAnimations>;
let width: number;
let anchorTop: number;
let frameBounds: DOMRect | null;
beforeEach(() => {
  animations = disclosureTestAnimations(); width = 390; anchorTop = 88; frameBounds = null;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(40, 20, width, 900);
    if (this.hasAttribute("data-mono-product-context-trigger")) return new DOMRect(64, anchorTop, 130, 44);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(width - 32, 28, 44, 44);
    if (this.classList.contains("mono-preview-frame") && frameBounds) return frameBounds;
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); animations.restore(); });

async function home(options: { calm?: boolean; active?: boolean; effectsDisabled?: boolean; readonly?: boolean;
  initialSection?: MonoSection; adapter?: MonoProductAdapter; framed?: boolean } = {}) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const appearance = { ...envelope.appearance, background: options.calm
    ? { ...MONO_BACKGROUND_DEFAULTS.obsidian, calm: true } : null };
  let controller!: MonoProductController;
  function Host() {
    controller = useMonoProductController(options.adapter ?? MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false });
    const [section, setSection] = useState<MonoSection>(options.initialSection ?? "overview");
    const scene = <MonoScene snapshot={wallet} appearance={appearance} product={controller} active={options.active}
      effectsDisabled={options.effectsDisabled} session={{ section, onSectionChange: options.readonly ? undefined : setSection,
        period: "1D", onPeriodChange() {}, balanceHidden: controller.view.balanceHidden,
        onBalanceHiddenChange: controller.commands.setBalanceHidden }} />;
    return options.framed ? <div className="mono-preview-frame">{scene}</div> : scene;
  }
  const view = render(<Host />);
  return { ...view, current: () => controller, appearance };
}

it("animates functional funds disclosure on a calm backdrop without enabling ambient motion", async () => {
  const view = await home({ calm: true });
  const scene = view.container.querySelector("[data-mono-preview]")!;
  expect(scene).toHaveAttribute("data-mono-motion", "static");
  const funds = screen.getByRole("button", { name: /Мои средства/ });
  fireEvent.click(funds);
  const list = document.getElementById(funds.getAttribute("aria-controls")!)!;
  expect(list.style.transition).toBe("");
  fireEvent.click(funds);
  expect(list).toHaveAttribute("inert");
  expect(list).not.toHaveAttribute("hidden");
  await animations.finish(list);
  expect(list).toHaveAttribute("hidden");
  expect(view.appearance.background?.calm).toBe(true);
  expect(scene).toHaveAttribute("data-mono-motion", "static");
});

it.each(["reduced", "effects-off", "inactive", "hidden", "save-data"])("keeps functional disclosure static under the %s guard", async guard => {
  if (guard === "reduced") await animations.reduceMotion();
  if (guard === "hidden") vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const original = Object.getOwnPropertyDescriptor(navigator, "connection");
  if (guard === "save-data") Object.defineProperty(navigator, "connection", { configurable: true,
    value: Object.assign(new EventTarget(), { saveData: true }) });
  try {
    await home({ calm: true, active: guard !== "inactive", effectsDisabled: guard === "effects-off" });
    const funds = screen.getByRole("button", { name: /Мои средства/ });
    fireEvent.click(funds);
    const list = document.getElementById(funds.getAttribute("aria-controls")!)!;
    expect(list.style.transition).toBe("none");
    fireEvent.click(funds);
    expect(list).toHaveAttribute("hidden");
  } finally {
    if (guard === "save-data") {
      if (original) Object.defineProperty(navigator, "connection", original);
      else Reflect.deleteProperty(navigator, "connection");
    }
  }
});

it("disables functional disclosure when the wallet leaves the viewport and restores only functional motion on reentry", async () => {
  const observations: { target: Element; intersect(value: boolean): void }[] = [];
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) { observations.push({ target, intersect: value => this.callback(
      [{ target, isIntersecting: value } as IntersectionObserverEntry], this as unknown as IntersectionObserver) }); }
    unobserve() {}
    disconnect() {}
  });
  const view = await home({ calm: true });
  const scene = view.container.querySelector("[data-mono-preview]")!;
  const funds = screen.getByRole("button", { name: /Мои средства/ });
  fireEvent.click(funds);
  const list = document.getElementById(funds.getAttribute("aria-controls")!)!;
  expect(list.style.transition).toBe("none");
  const observation = observations.find(item => item.target === scene)!;
  expect(observation).toBeDefined();
  await act(async () => observation.intersect(true));
  expect(list.style.transition).toBe("");
  expect(scene).toHaveAttribute("data-mono-motion", "static");
  fireEvent.click(funds);
  expect(list).not.toHaveAttribute("hidden");
  await act(async () => observation.intersect(false));
  expect(list).toHaveAttribute("hidden");
  expect(list.style.transition).toBe("none");
});

it("returns home inside the same viewer from account and asset content while keeping context, privacy and drafts", async () => {
  window.history.replaceState({}, "", "/p/6");
  const view = await home({ initialSection: "profile" });
  act(() => view.current().commands.setBalanceHidden(true));
  act(() => view.current().commands.saveSendDraft({ action: "send", accountId: "demo-custody", accountLabel: "Основной",
    accountKind: "custodial", assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "solana", networkLabel: "Solana" },
  { route: { accountId: "demo-custody", assetId: "usdc", networkId: "solana" }, recipient: { address: "demo:kept" }, amount: "23," }));
  act(() => view.current().commands.openAccountsWorkspace());
  act(() => view.current().commands.inspectAccount("demo-custody"));
  act(() => view.current().commands.openAccountHolding("demo-custody", "demo-usdc-sol"));
  const logo = screen.getByRole("button", { name: "На главную" });
  expect(logo).toHaveAttribute("type", "button");
  expect(logo).not.toHaveAttribute("href");
  logo.focus(); fireEvent.click(logo, { detail: 0 });
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
  expect(view.current().view.accountsWorkspace).toBeNull();
  expect(view.current().view.assetWorkspace).toBeNull();
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(view.current().view.balanceHidden).toBe(true);
  expect(Object.values(view.current().view.sendDrafts)[0]?.amount).toBe("23,");
  expect(window.location.pathname).toBe("/p/6");
  expect(logo).toHaveFocus();
});

it.each(["readonly", "inactive", "accepted"])("does not let logo navigation bypass the %s guard", async guard => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const view = await home({ initialSection: "profile", readonly: guard === "readonly", active: guard !== "inactive" });
  if (guard === "accepted") {
    act(() => view.current().commands.openIntent("buy"));
    act(() => view.current().commands.saveBuyDraft(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "23," }));
    const quote = buyQuote(); quote.portId = view.current().view.flowPorts.buy.id;
    const idempotencyKey = "logo-pending";
    act(() => view.current().commands.setCommerceSubmitState(buyRoute, { busy: true,
      attempt: { kind: "buy", quote, idempotencyKey, operationId: commerceOperationId(quote, idempotencyKey) } }));
  }
  const before = view.current().view.sheet;
  const logo = screen.getByRole("button", { name: "На главную", hidden: true });
  expect(logo).toBeDisabled();
  fireEvent.click(logo);
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "profile");
  expect(view.current().view.sheet).toBe(before);
  if (guard === "accepted") expect(Object.values(view.current().view.buyDrafts)[0]?.fiatAmount).toBe("23,");
});

it("allows a harmless home return from a readonly Overview account workspace", async () => {
  const view = await home({ readonly: true });
  act(() => view.current().commands.openAccountsWorkspace());
  const logo = screen.getByRole("button", { name: "На главную" });
  expect(logo).toBeEnabled(); fireEvent.click(logo);
  expect(view.current().view.accountsWorkspace).toBeNull();
  expect(view.current().view.context).toEqual({ kind: "all" });
});

it.each([320, 390, 480])("anchors the account chooser beside its actual trigger within a %ipx wallet", async size => {
  width = size;
  const view = await home();
  const trigger = screen.getByRole("button", { name: "Выбрать счёт: Все счета" });
  trigger.focus(); fireEvent.click(trigger);
  const panel = screen.getByRole("dialog", { name: "Выбор счёта" });
  expect(panel.closest("[data-product-sheet]")).toBeNull();
  expect(panel).not.toHaveAttribute("aria-modal", "true");
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(Number.parseFloat(panel.style.top)).toBe(120);
  const left = Number.parseFloat(panel.style.left), panelWidth = Number.parseFloat(panel.style.width);
  expect(left).toBeGreaterThanOrEqual(12);
  expect(left + panelWidth).toBeLessThanOrEqual(size - 12);
  expect(view.current().view.context).toEqual({ kind: "all" });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Выбор счёта" })).toBeNull();
  expect(trigger).toHaveFocus();
});

it("selects exact view-only account context, masks estimates, toggles and leaves outside navigation focus alone", async () => {
  const view = await home();
  act(() => view.current().commands.setBalanceHidden(true));
  const trigger = screen.getByRole("button", { name: "Выбрать счёт: Все счета" });
  fireEvent.click(trigger);
  const panel = screen.getByRole("dialog", { name: "Выбор счёта" });
  expect(panel.textContent).not.toMatch(/12\s?840|8\s?040|3\s?900|500|400/);
  fireEvent.click(within(panel).getByRole("button", { name: /Приватный/ }));
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-private" });
  const selected = screen.getByRole("button", { name: "Выбрать счёт: Приватный" });
  await waitFor(() => expect(selected).toHaveFocus());
  fireEvent.click(selected); fireEvent.click(selected);
  expect(screen.queryByRole("dialog", { name: "Выбор счёта" })).toBeNull();
  fireEvent.click(selected);
  const history = screen.getByRole("button", { name: "История" });
  fireEvent.pointerDown(history); history.focus(); fireEvent.click(history);
  expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  expect(history).toHaveFocus();
});

it("keeps a long chooser within the frame and visual viewport while following a scrolling trigger", async () => {
  width = 320; anchorTop = 170; frameBounds = new DOMRect(50, 30, 300, 240);
  const viewport = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, width: 375, height: 260 });
  vi.stubGlobal("visualViewport", viewport);
  const snapshot = { ...MULTI_ACCOUNT_DEMO, accounts: [ ...MULTI_ACCOUNT_DEMO.accounts,
    ...Array.from({ length: 20 }, (_, index) => ({ ...MULTI_ACCOUNT_DEMO.accounts[0]!, id: `extra-${index}`, label: `Счёт ${index + 1}` })) ] };
  const view = await home({ framed: true, adapter: { kind: "demo", snapshot } });
  const trigger = screen.getByRole("button", { name: "Выбрать счёт: Все счета" });
  fireEvent.click(trigger);
  const panel = screen.getByRole("dialog", { name: "Выбор счёта" });
  expect(panel).toHaveAttribute("data-side", "above");
  expect(Number.parseFloat(panel.style.left)).toBeGreaterThanOrEqual(22);
  expect(Number.parseFloat(panel.style.left) + Number.parseFloat(panel.style.width)).toBeLessThanOrEqual(298);
  expect(Number.parseFloat(panel.style.top)).toBeGreaterThanOrEqual(22);
  expect(Number.parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(120);
  expect(within(panel).getAllByRole("button", { name: /Счёт \d/ })).toHaveLength(20);
  anchorTop = 68;
  fireEvent.scroll(document);
  expect(panel).toHaveAttribute("data-side", "below");
  expect(Number.parseFloat(panel.style.top)).toBe(100);
  viewport.height = 180; viewport.dispatchEvent(new Event("resize"));
  await waitFor(() => expect(Number.parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(48));
  fireEvent.click(within(panel).getByRole("button", { name: /Счёт 20/ }));
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "extra-19" });
  expect(screen.getByRole("button", { name: "Выбрать счёт: Счёт 20" })).toHaveFocus();
});

it("retains an inert chooser for its finite close and ignores stale completion after rapid reopening", async () => {
  const view = await home({ calm: true });
  const trigger = screen.getByRole("button", { name: "Выбрать счёт: Все счета" });
  fireEvent.click(trigger);
  const panel = screen.getByRole("dialog", { name: "Выбор счёта" });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(panel).toHaveAttribute("data-state", "closing");
  expect(panel).toHaveAttribute("inert");
  expect(panel).toHaveAttribute("aria-hidden", "true");
  expect(view.container.contains(panel)).toBe(true);
  fireEvent.click(trigger);
  await animations.finish(panel);
  expect(screen.getByRole("dialog", { name: "Выбор счёта" })).toBe(panel);
  expect(panel).not.toHaveAttribute("inert");
  fireEvent.click(within(panel).getByRole("button", { name: "Закрыть выбор счёта" }));
  await animations.finish(panel);
  expect(view.container.querySelector("[data-product-account-popover]")).toBeNull();
  expect(trigger).toHaveFocus();
});

it.each(["reduced", "effects-off"])("closes the chooser immediately under the %s motion guard", async guard => {
  if (guard === "reduced") await animations.reduceMotion();
  const view = await home({ calm: true, effectsDisabled: guard === "effects-off" });
  const trigger = screen.getByRole("button", { name: "Выбрать счёт: Все счета" });
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Выбор счёта" })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.container.querySelector("[data-product-account-popover]")).toBeNull();
  expect(trigger).toHaveFocus();
});

it("keeps the chooser trigger absent for one account", async () => {
  await home({ adapter: { kind: "demo", snapshot: SINGLE_ACCOUNT_DEMO } });
  expect(screen.queryByRole("button", { name: /Выбрать счёт:/ })).toBeNull();
});
