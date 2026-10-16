import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "../mono-product/demo-adapter";
import { createDemoProfileResource, type ProductProfileResource } from "../mono-product/profile";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "../mono-product/product-controller";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 320, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 320, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(240, 710, 68, 48);
    if (this.hasAttribute("data-mono-support-trigger")) return new DOMRect(218, 16, 44, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function renderMenuScene(presentation?: "gold") {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  let current!: MonoProductController;
  let changeSection!: (section: MonoSection) => void;
  function Host({ active = true }: { active?: boolean }) {
    current = useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false });
    const [section, setSection] = useState<MonoSection>("overview");
    changeSection = setSection;
    return <MonoScene snapshot={snapshot} appearance={envelope.appearance} product={current} active={active} presentation={presentation}
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: current.view.balanceHidden, onBalanceHiddenChange: current.commands.setBalanceHidden }} />;
  }
  const view = render(<Host />);
  return { ...view, Host, current: () => current, setSection: (section: MonoSection) => act(() => changeSection(section)),
    scene: view.container.querySelector<HTMLElement>("[data-mono-preview]")! };
}

function openBottomMenu() {
  const launcher = within(screen.getByRole("navigation", { name: "Разделы кошелька" }))
    .getByRole("button", { name: "Меню" });
  launcher.focus(); fireEvent.click(launcher);
  return { launcher, panel: screen.getByRole("dialog", { name: "Меню" }) };
}

async function renderMenuSupportHost(options: { readonlySection?: boolean; resource?: ProductProfileResource } = {}) {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  let adapter: MonoProductAdapter = { ...MONO_PRODUCT_DEMO_ADAPTER };
  let changeSection!: (section: MonoSection) => void, refresh!: () => void;
  const themeChanges: string[] = [];
  function Host() {
    const [section, setSection] = useState<MonoSection>("overview");
    const [hidden, setHidden] = useState(false);
    const [, setRevision] = useState(0);
    changeSection = setSection; refresh = () => setRevision(value => value + 1);
    return <div data-material-scrollport><MonoProductScene snapshot={snapshot} appearance={envelope.appearance}
      material={{ background: null, buttons: null }} productAdapter={adapter} profileResource={options.resource}
      effectsDisabled session={{ section, onSectionChange: options.readonlySection ? undefined : setSection,
        balanceHidden: hidden, onBalanceHiddenChange: setHidden, period: "1D", onPeriodChange() {},
        onThemeChange: value => { themeChanges.push(value); } }} /></div>;
  }
  const view = render(<Host />);
  return { ...view, themeChanges, scene: view.container.querySelector<HTMLElement>("[data-mono-preview]")!,
    scrollport: view.container.querySelector<HTMLElement>("[data-material-scrollport]")!,
    setSection: (section: MonoSection) => act(() => changeSection(section)),
    replaceSource(kind: "snapshot" | "ports") {
      act(() => {
        adapter = kind === "snapshot" ? { ...adapter, snapshot: { ...adapter.snapshot } } : { ...adapter };
        refresh();
      });
    } };
}

function newMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  return screen.getByRole("dialog", { name: "Меню" });
}

it.each([
  { presentation: undefined, label: "Gold · золотое оформление", href: "/gold" },
  { presentation: "gold" as const, label: "MONO · варианты оформления", href: "/p/2" },
])("viewer route link in $presentation Menu uses $href without theme or financial state changes", async ({ presentation, label, href }) => {
  const view = await renderMenuScene(presentation);
  const writes = vi.spyOn(Storage.prototype, "setItem");
  const context = view.current().view.context;
  const menu = newMenu();
  const link = within(menu).getByRole("link", { name: label });
  expect(link).toHaveAttribute("href", href);
  expect(link).not.toHaveAttribute("target");
  expect(link).not.toHaveAttribute("aria-disabled");
  expect(within(menu).getByRole("button", { name: "Тема" })).toBeDisabled();
  expect(screen.getByRole("navigation", { name: "Разделы кошелька" }).querySelectorAll("button")).toHaveLength(4);
  expect(screen.getByRole("button", { name: "Открыть профиль" })).toBeInTheDocument();
  const artwork = link.querySelector("svg");
  expect(artwork).toHaveAttribute("aria-hidden", "true");
  expect(artwork).toHaveAttribute("focusable", "false");
  link.focus();
  expect(link).toHaveFocus();
  link.addEventListener("click", event => event.preventDefault()); // Native route navigation is outside jsdom.
  fireEvent.click(link);
  expect(view.current().view.context).toBe(context);
  expect(view.current().view.sheet).toBeNull();
  expect(writes).not.toHaveBeenCalled();
});

it("viewer route link is absent from details and the direct Support panel", async () => {
  const view = await renderMenuScene();
  const menu = newMenu();
  expect(within(menu).getByRole("link", { name: "Gold · золотое оформление" })).toHaveAttribute("href", "/gold");
  fireEvent.click(within(menu).getByRole("button", { name: "Документы сервиса" }));
  expect(screen.getByRole("dialog", { name: "Документы сервиса" })).toBeInTheDocument();
  expect(view.container.querySelector('a[href="/gold"], a[href="/p/2"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть панель" }));
  fireEvent.click(screen.getByRole("button", { name: "Поддержка" }));
  expect(screen.getByRole("dialog", { name: "Поддержка" })).toBeInTheDocument();
  expect(view.container.querySelector('a[href="/gold"], a[href="/p/2"]')).toBeNull();
});

it.each(["inactive", "sheet"] as const)("viewer route link cannot survive the existing %s navigation guard", async guard => {
  const view = await renderMenuScene();
  expect(within(newMenu()).getByRole("link", { name: "Gold · золотое оформление" })).toBeInTheDocument();
  if (guard === "inactive") view.rerender(<view.Host active={false} />);
  else act(() => view.current().commands.openIntent("buy"));
  expect(view.container.querySelector('a[href="/gold"], a[href="/p/2"]')).toBeNull();
  expect(screen.getByRole("button", { name: "Меню" })).toBeDisabled();
});

it("wallet cohesion places contact Support beside brand without header identity or FAQ and returns focus", async () => {
  const resource = createDemoProfileResource();
  if (resource.status === "ready") resource.data.support = null;
  const view = await renderMenuSupportHost({ resource });
  const header = view.scene.querySelector("header")!;
  expect(header).not.toHaveTextContent("Демо пользователь");
  expect(header).not.toHaveTextContent("Демо-режим");
  const support = within(header).getByRole("button", { name: "Поддержка" });
  expect(support.parentElement).toBe(within(header).getByRole("button", { name: "На главную" }).parentElement);
  fireEvent.click(support);
  const contact = screen.getByRole("dialog", { name: "Поддержка" });
  expect(within(contact).queryByRole("button", { name: "Получить" })).toBeNull();
  expect(within(contact).queryByRole("button", { name: "Отправить" })).toBeNull();
  expect(contact).toHaveTextContent(/Контакт поддержки пока не подключён/i);
  fireEvent.click(within(contact).getByRole("button", { name: "Назад в обзор" }));
  expect(support).toHaveFocus();
});

it("wallet cohesion repeated avatar closes Profile to its original section with focus", async () => {
  const view = await renderMenuSupportHost();
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Настройки" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Помощь и документы" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть профиль" }));
  expect(view.scene).toHaveAttribute("data-mono-section", "history");
  expect(screen.getByRole("button", { name: "Открыть профиль" })).toHaveFocus();
});

it("wallet cohesion actual host suspends the exact account and its disclosure for avatar return", async () => {
  const view = await renderMenuSupportHost();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const account = screen.getByRole("region", { name: "Основной" });
  const holding = account.querySelector<HTMLButtonElement>('[data-product-holding-id="demo-usdc-eth"]')!;
  fireEvent.click(holding); view.scrollport.scrollTop = 129;
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Основной" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть профиль" }));
  expect(screen.getByRole("region", { name: "Основной" })).toBe(account);
  expect(holding).toHaveAttribute("aria-expanded", "true");
  expect(view.scrollport.scrollTop).toBe(129);
  expect(screen.getByRole("button", { name: "Открыть профиль" })).toHaveFocus();
});

it("wallet cohesion actual host retains an exact selected asset placement through avatar return", async () => {
  const view = await renderMenuSupportHost();
  fireEvent.click(screen.getByRole("button", { name: /^Мои средства/ }));
  fireEvent.click(view.scene.querySelector('[data-mono-product-asset-trigger="usdc"]')!);
  const asset = view.scene.querySelector('[data-mono-product-asset-workspace="usdc"]')!;
  const placement = screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" });
  fireEvent.click(placement); view.scrollport.scrollTop = 84;
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть профиль" }));
  expect(view.scene.querySelector('[data-mono-product-asset-workspace="usdc"]')).toBe(asset);
  expect(placement).toBeChecked(); expect(view.scrollport.scrollTop).toBe(84);
});

it.each(["snapshot", "ports"] as const)("wallet cohesion avatar rejects stale %s identity and closes to safe Overview", async kind => {
  const view = await renderMenuSupportHost();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  view.replaceSource(kind);
  fireEvent.click(screen.getByRole("button", { name: "Закрыть профиль" }));
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
  expect(screen.queryByRole("region", { name: "Основной" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Профиль" })).toBeNull();
});

it("wallet cohesion Menu home settings share controller commands while preserving working context and remembered choices", async () => {
  const view = await renderMenuScene();
  act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-custody" }));
  const context = view.current().view.context;
  const menu = newMenu();
  const row = within(menu).getByRole("button", { name: "На главной" });
  expect(row).toHaveTextContent("2 кошелька");
  fireEvent.click(row);
  const detail = screen.getByRole("dialog", { name: "На главной" });
  const custody = within(detail).getByRole("checkbox", { name: "Кастодиальные" });
  const depositary = within(detail).getByRole("checkbox", { name: "Депозитарные" });
  expect(custody).toBeChecked(); expect(depositary).toBeChecked();
  fireEvent.click(within(detail).getByRole("checkbox", { name: "Только общий баланс" }));
  expect(view.current().view.context).toBe(context);
  expect(view.current().view.homePinnedKinds).toEqual(["custodial", "depositary"]);
  fireEvent.click(screen.getByRole("button", { name: "Назад в меню" }));
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "На главной" }))
    .toHaveTextContent("Только общий баланс");
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "На главной" })).toHaveFocus();
});

it("wallet cohesion direct Documents has one accessible heading and no second editor", async () => {
  await renderMenuSupportHost();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Документы сервиса" }));
  expect(within(screen.getByRole("dialog", { name: "Документы сервиса" })).getAllByRole("heading", { name: "Документы сервиса" })).toHaveLength(1);
});

it("menu support actual host shows current resource values and an unavailable theme while the real eye still controls privacy", async () => {
  const resource = createDemoProfileResource();
  if (resource.status !== "ready") throw new Error("Expected ready fixture");
  resource.data.languageLabel = "Deutsch"; resource.data.valuationCurrencyLabel = "EUR";
  const view = await renderMenuSupportHost({ resource });
  const menu = newMenu();
  const theme = within(menu).getByRole("button", { name: /Тема/ });
  expect(theme).toBeDisabled(); expect(theme).toHaveTextContent("Пока недоступно");
  fireEvent.click(theme); expect(view.themeChanges).toEqual([]);
  expect(within(menu).getByRole("button", { name: /Язык/ })).toHaveTextContent("Deutsch");
  expect(within(menu).getByRole("button", { name: /Валюта оценки/ })).toHaveTextContent("EUR");
  expect(within(menu).queryByRole("button", { name: "Скрывать суммы" })).toBeNull();
  expect(within(menu).getByRole("button", { name: /Язык/ })).toHaveFocus();
  fireEvent.click(within(menu).getByRole("button", { name: "Закрыть меню" }));
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toHaveAttribute("aria-pressed", "true");
});

it.each(["Язык", "Валюта оценки"])("menu support actual host opens %s through the shared readonly Settings and returns to its exact row", async label => {
  const view = await renderMenuSupportHost();
  const menu = newMenu();
  fireEvent.click(within(menu).getByRole("button", { name: new RegExp(label) }));
  const detail = screen.getByRole("dialog", { name: "Настройки" });
  expect(detail).toHaveTextContent("Русский"); expect(detail).toHaveTextContent("USD");
  expect(within(detail).queryByRole("combobox")).toBeNull();
  expect(detail).toHaveTextContent(/Выбор.*не подключён/);
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
  fireEvent.click(within(detail).getByRole("button", { name: "Назад в меню" }));
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: new RegExp(label) })).toHaveFocus();
});

it("menu support actual host opens only service Documents and returns without presenting an operation receipt or fake download", async () => {
  await renderMenuSupportHost();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Документы сервиса" }));
  const docs = screen.getByRole("dialog", { name: "Документы сервиса" });
  expect(docs).toHaveTextContent("Документы сервиса пока не подключены");
  expect(within(docs).queryByRole("button", { name: "Получить" })).toBeNull();
  expect(within(docs).queryByRole("link")).toBeNull();
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Документы сервиса" })).toHaveFocus();
});

it("menu support actual host shares Help between Home headset and Menu with distinct guarded Back focus", async () => {
  const view = await renderMenuSupportHost();
  const support = screen.getByRole("button", { name: "Поддержка" });
  expect(support.closest("header")).not.toBeNull();
  support.focus(); fireEvent.click(support);
  const help = screen.getByRole("dialog", { name: "Поддержка" });
  expect(within(help).getByRole("link", { name: /@re_pick/ })).toHaveAttribute("href", "https://t.me/re_pick");
  expect(within(help).queryByRole("button", { name: "Получить" })).toBeNull();
  fireEvent.click(within(help).getByRole("button", { name: "Назад в обзор" }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(support).toHaveFocus();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Помощь" }));
  expect(screen.getByRole("dialog", { name: "Помощь" })).toHaveTextContent(/реальные средства/i);
  fireEvent.click(screen.getByRole("button", { name: "Назад в меню" }));
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Помощь" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  expect(screen.queryByRole("button", { name: "Поддержка" })).toBeNull();
  expect(view.scene).toHaveAttribute("data-mono-section", "history");
});

it("menu support actual host keeps the exact inspected account, expanded holding and scroll mounted beneath Help Back", async () => {
  const view = await renderMenuSupportHost();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const account = screen.getByRole("region", { name: "Основной" });
  const holding = account.querySelector<HTMLButtonElement>('[data-product-holding-id="demo-usdc-eth"]')!;
  fireEvent.click(holding); view.scrollport.scrollTop = 123;
  expect(screen.queryByRole("button", { name: "Поддержка" })).toBeNull();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Помощь" }));
  expect(screen.getByRole("region", { name: "Основной" })).toBe(account);
  expect(screen.getByRole("button", { name: /Выбрать счёт: Все счета/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Назад в меню" }));
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Помощь" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть меню" }));
  expect(screen.getByRole("region", { name: "Основной" })).toBe(account);
  expect(holding).toHaveAttribute("aria-expanded", "true"); expect(view.scrollport.scrollTop).toBe(123);
});

it.each(["snapshot", "ports", "section"] as const)("menu support actual host clears stale details after a changed %s and never reopens the old request", async kind => {
  const view = await renderMenuSupportHost();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Документы сервиса" }));
  if (kind === "section") view.setSection("history"); else view.replaceSource(kind);
  expect(screen.queryByRole("dialog", { name: "Документы сервиса" })).toBeNull();
  expect(newMenu()).toHaveAccessibleName("Меню");
  expect(screen.queryByRole("button", { name: "Назад в меню" })).toBeNull();
});

it("menu support actual host keeps FAQ readable in a readonly section while operation entry guards stay closed", async () => {
  const view = await renderMenuSupportHost({ readonlySection: true });
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Помощь" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Помощь" })).getByRole("button", { name: "Получить" }));
  expect(screen.queryByRole("button", { name: "Открыть получение" })).toBeNull();
  expect(screen.getByRole("region", { name: "Получить" })).toHaveTextContent("Переход к операциям сейчас недоступен.");
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
  fireEvent.click(screen.getByRole("button", { name: "Назад в меню" }));
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Помощь" })).toHaveFocus();
});

it("menu support clears an inspection on working context changes without carrying its previous request", async () => {
  const view = await renderMenuScene();
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Помощь" }));
  act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-private" }));
  expect(screen.queryByRole("dialog", { name: "Помощь" })).toBeNull();
  expect(newMenu()).toHaveAccessibleName("Меню");
});

it("menu support actual host keeps asset selection mounted on Back and rejects a changed asset workspace", async () => {
  const view = await renderMenuSupportHost();
  fireEvent.click(screen.getByRole("button", { name: /^Мои средства/ }));
  fireEvent.click(view.scene.querySelector('[data-mono-product-asset-trigger="usdc"]')!);
  const asset = view.scene.querySelector('[data-mono-product-asset-workspace="usdc"]')!;
  const mainPlacement = screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" });
  fireEvent.click(mainPlacement);
  view.scrollport.scrollTop = 87;
  fireEvent.click(within(newMenu()).getByRole("button", { name: "Помощь" }));
  expect(view.scene.querySelector('[data-mono-product-asset-workspace="usdc"]')).toBe(asset);
  fireEvent.click(screen.getByRole("button", { name: "Назад в меню" }));
  expect(mainPlacement).toBeChecked();
  expect(view.scrollport.scrollTop).toBe(87);
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Помощь" }));
  const nextPlacement = screen.getAllByRole("radio").find(radio => radio !== mainPlacement)!;
  expect(nextPlacement).toBeInTheDocument(); fireEvent.click(nextPlacement);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Помощь" })).toBeNull());
  expect(newMenu()).toHaveAccessibleName("Меню");
  expect(screen.queryByRole("button", { name: "Назад в меню" })).toBeNull();
});

it("bottom Menu replaces only product Profile navigation and keeps avatar and logo truthful", async () => {
  const { scene } = await renderMenuScene();
  const nav = screen.getByRole("navigation", { name: "Разделы кошелька" });
  expect(within(nav).getAllByRole("button").map(button => button.textContent)).toEqual(["Обзор", "Активы", "История", "Меню"]);
  expect(scene.querySelector("header [data-profile-quick-menu-trigger]")).toBeNull();
  expect(screen.queryByRole("button", { name: "Быстрые настройки" })).toBeNull();
  const menu = within(nav).getByRole("button", { name: "Меню" });
  expect(menu.querySelector('svg path')).not.toBeNull();
  expect(menu).toHaveAttribute("aria-haspopup", "dialog");
  expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(menu).not.toHaveAttribute("aria-current");
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Закрыть профиль" })).toHaveAttribute("aria-current", "page");
  expect(menu).toHaveAttribute("data-active", "false");
  expect(menu).not.toHaveAttribute("aria-current");
  fireEvent.click(screen.getByRole("button", { name: "На главную" }));
  expect(within(nav).getByRole("button", { name: "Обзор" })).toHaveAttribute("aria-current", "page");
});

it("bottom Menu opens and closes without changing section, working account or raw drafts", async () => {
  const view = await renderMenuScene();
  const route = resolveActionRoutes(MONO_PRODUCT_DEMO_ADAPTER.snapshot, { kind: "account", accountId: "demo-custody" }, "send")
    .routes.filter(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")[0]!;
  const draft = { route: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum" },
    recipient: { address: "demo:kept" }, amount: "001," };
  act(() => {
    view.current().commands.selectContext({ kind: "account", accountId: "demo-private" });
    view.current().commands.saveSendDraft(route, draft);
  });
  expect(view.current().view.sendDrafts[sendDraftKey(route)]).toEqual(draft);
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  const context = view.current().view.context, drafts = view.current().view.sendDrafts;
  for (const close of ["escape", "repeat", "close", "outside"] as const) {
    const { launcher, panel } = openBottomMenu();
    expect(panel).toHaveAttribute("id", launcher.getAttribute("aria-controls"));
    expect(panel).toHaveAttribute("data-side", "above");
    expect(within(panel).getAllByRole("button").map(button => button.getAttribute("aria-label") ?? button.textContent))
      .toEqual(["Закрыть меню", "Тема", "Язык", "Валюта оценки", "Документы сервиса", "На главной", "Мои счета", "Помощь"]);
    expect(within(panel).getByRole("button", { name: "Язык" })).toHaveFocus();
    expect(view.current().view.balanceHidden).toBe(false);
    expect(view.scene).toHaveAttribute("data-mono-section", "history");
    expect(screen.getByRole("button", { name: "История" })).toHaveAttribute("aria-current", "page");
    expect(launcher).not.toHaveAttribute("aria-current");
    if (close === "escape") fireEvent.keyDown(document, { key: "Escape" });
    else if (close === "repeat") fireEvent.click(launcher);
    else if (close === "close") fireEvent.click(within(panel).getByRole("button", { name: "Закрыть меню" }));
    else fireEvent.pointerDown(view.scene.querySelector(".mono-header-brand")!);
    expect(screen.queryByRole("dialog", { name: "Меню" })).toBeNull();
    expect(launcher).toHaveFocus();
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(view.current().view.context).toBe(context);
    expect(view.current().view.sendDrafts).toBe(drafts);
    expect(view.current().view.sendDrafts[sendDraftKey(route)]).toEqual(draft);
  }
  const { panel } = openBottomMenu();
  expect(within(panel).queryByRole("button", { name: "Скрывать суммы" })).toBeNull();
  expect(view.current().view.balanceHidden).toBe(false);
});

it("bottom Menu preserves Accounts Back focus and shares Help without leaving the underlying section", async () => {
  const view = await renderMenuScene();
  const context = view.current().view.context;
  const { launcher, panel } = openBottomMenu();
  fireEvent.click(within(panel).getByRole("button", { name: "Мои счета" }));
  expect(screen.getByRole("heading", { name: "Мои счета" })).toHaveFocus();
  expect(view.current().view.context).toBe(context);
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("heading", { name: "Мои счета" })).toBeNull();
  expect(launcher).toHaveFocus();
  fireEvent.click(within(openBottomMenu().panel).getByRole("button", { name: "Помощь" }));
  expect(screen.getByRole("dialog", { name: "Помощь" })).toHaveTextContent(/реальные средства/i);
  expect(screen.getByRole("button", { name: "Назад в меню" })).toHaveFocus();
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
  fireEvent.click(screen.getByRole("button", { name: "Назад в меню" }));
  expect(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Помощь" })).toHaveFocus();
  expect(launcher).not.toHaveAttribute("aria-current");
  expect(view.current().view.context).toBe(context);
});

it("bottom Menu closes on section change, inactivity and unmount without retaining an overlay", async () => {
  const view = await renderMenuScene();
  openBottomMenu();
  view.setSection("history");
  expect(screen.queryByRole("dialog", { name: "Меню" })).toBeNull();
  expect(screen.getByRole("button", { name: "Меню" })).toHaveAttribute("aria-expanded", "false");
  openBottomMenu();
  view.rerender(<view.Host active={false} />);
  expect(screen.queryByRole("dialog", { name: "Меню", hidden: true })).toBeNull();
  expect(screen.getByRole("button", { name: "Меню", hidden: true })).toBeDisabled();
  view.rerender(<view.Host />);
  expect(screen.queryByRole("dialog", { name: "Меню" })).toBeNull();
  openBottomMenu(); view.unmount();
  expect(document.querySelector("[data-profile-quick-menu-layer]")).toBeNull();
});

it("bottom Menu remains unavailable and inert behind an existing product modal", async () => {
  const view = await renderMenuScene();
  act(() => view.current().commands.openIntent("buy"));
  const menu = screen.getByRole("button", { name: "Меню", hidden: true });
  expect(menu).toBeDisabled();
  expect(menu.closest("nav")).toHaveAttribute("inert");
  const sheet = view.current().view.sheet;
  fireEvent.click(menu);
  expect(screen.queryByRole("dialog", { name: "Меню" })).toBeNull();
  expect(view.current().view.sheet).toBe(sheet);
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
});

it("bottom Menu preserves the non-product Lab Profile navigation", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  render(<MonoScene snapshot={snapshot} appearance={envelope.appearance} />);
  const nav = screen.getByRole("navigation", { name: "Разделы кошелька" });
  expect(within(nav).getAllByRole("button").map(button => button.textContent)).toEqual(["Обзор", "Активы", "История", "Профиль"]);
  fireEvent.click(within(nav).getByRole("button", { name: "Профиль" }));
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
});
