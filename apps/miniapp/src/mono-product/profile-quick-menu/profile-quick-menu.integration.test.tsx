import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, SINGLE_ACCOUNT_DEMO, resolveActionRoutes, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../../mono-preview/mono-product-scene";
import { MonoScene, type MonoSection } from "../../mono-preview/mono-scene";
import { createMonoAppearanceEnvelope } from "../../mono-preview/mono-preset-envelope";
import { ProductProfile } from "../product-profile";
import { useMonoProductController } from "../product-controller";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "../demo-adapter";
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

async function controlledHome(initialTheme: "dark" | "light" = "dark", productAdapter?: MonoProductAdapter) {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  function Host() {
    const [theme, setTheme] = useState<"dark" | "light">(initialTheme);
    const [hidden, setHidden] = useState(false);
    const [section, setSection] = useState<MonoSection>("overview");
    return <MonoProductScene snapshot={snapshot} material={envelope.material} viewport={320} productAdapter={productAdapter}
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

it.each(["dark", "light"] as const)("hides theme choice in menu and profile while preserving supplied %s appearance and shared privacy", async theme => {
  const { container } = await controlledHome(theme);
  const { panel } = openSettings();
  expect(panel).not.toHaveAttribute("aria-modal", "true");
  expect(within(panel).queryByRole("group", { name: "Тема оформления" })).toBeNull();
  expect(within(panel).queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
  expect(within(panel).getByRole("button", { name: "Скрывать суммы" })).toHaveFocus();
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", theme);
  fireEvent.click(within(panel).getByRole("button", { name: "Скрывать суммы" }));
  expect(within(panel).getByRole("button", { name: "Скрывать суммы" })).toHaveAttribute("aria-pressed", "true");
  expect(panel).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Тема оформления" })).toBeNull();
  expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", theme);
  expect(screen.getByRole("button", { name: "Показать суммы" })).toHaveAttribute("aria-pressed", "true");
});

it("opens existing help with destination focus and repeats the request inside profile", async () => {
  await controlledHome();
  const { panel } = openSettings();
  fireEvent.click(within(panel).getByRole("button", { name: "Помощь" }));
  const help = screen.getByRole("button", { name: "Помощь и документы" });
  expect(help).toHaveAttribute("aria-expanded", "true");
  expect(help).toHaveFocus();
  expect(document.getElementById(help.getAttribute("aria-controls") ?? "")).toBeVisible();
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
  expect(within(panel).getByRole("button", { name: "Скрывать суммы" })).toHaveFocus();
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

it("omits the theme row and placeholder when the host has no theme callback", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material}
    session={{ balanceHidden: false, onBalanceHiddenChange() {}, period: "1D", onPeriodChange() {} }} />);
  const { panel } = openSettings();
  expect(within(panel).queryByRole("button", { name: "Светлая" })).toBeNull();
  expect(within(panel).queryByRole("button", { name: "Тёмная" })).toBeNull();
  expect(within(panel).queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
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

function openAccountsWorkspace() {
  fireEvent.click(within(openSettings().panel).getByRole("button", { name: "Мои счета" }));
  return screen.getByRole("region", { name: "Мои счета" });
}

it("opens account content from profile and backs through exact detail/list origins without an extra tab or sheet", async () => {
  const { container } = await controlledHome();
  fireEvent.click(screen.getByRole("button", { name: "Профиль", exact: true }));
  openAccountsWorkspace();
  expect(screen.getByRole("heading", { name: "Мои счета" })).toHaveFocus();
  expect(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getAllByRole("button")).toHaveLength(4);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Профиль", exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Хранилище" }));
  expect(screen.getByRole("heading", { name: "Хранилище", exact: true })).toHaveFocus();
  expect(screen.getByRole("button", { name: /Выбрать счёт: Все счета/ })).toBeInTheDocument();
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "profile");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Открыть счёт: Хранилище" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("heading", { name: "Профиль", exact: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Быстрые настройки" })).toHaveFocus();
});

it("explicitly uses an inspected account and returns from profile to overview with that exact context", async () => {
  await controlledHome();
  fireEvent.click(screen.getByRole("button", { name: "Профиль", exact: true }));
  openAccountsWorkspace();
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать счёт в кошельке" }));
  expect(screen.queryByRole("region", { name: "Основной", exact: true })).toBeNull();
  expect(screen.getByRole("button", { name: "Обзор", exact: true })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: /Выбрать счёт: Основной/ })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Профиль", exact: true })).toBeNull();
});

it("enters the exact selected send route directly and restores its route button after closing the existing flow", async () => {
  await controlledHome();
  openAccountsWorkspace();
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const solana = screen.getByRole("button", { name: "Подготовить отправку USDC · Основной · Solana" });
  const ethereum = screen.getByRole("button", { name: "Подготовить отправку USDC · Основной · Ethereum" });
  solana.focus(); fireEvent.click(solana);
  expect(screen.queryByRole("dialog", { name: "Выбрать размещение для отправки" })).toBeNull();
  const recipient = await screen.findByRole("textbox", { name: "Получатель" });
  expect(screen.getByRole("dialog", { name: "Отправить" })).toHaveTextContent("Solana");
  fireEvent.change(recipient, { target: { value: "demo:kept" } });
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Отправить" }), { key: "Escape" });
  await waitFor(() => expect(solana).toHaveFocus());
  expect(ethereum).not.toHaveFocus();
  expect(screen.getByRole("heading", { name: "Основной", exact: true })).toBeInTheDocument();
  fireEvent.click(solana);
  expect(await screen.findByRole("textbox", { name: "Получатель" })).toHaveValue("demo:kept");
});

it("opens an exact holding from profile inside the existing asset workspace and returns to its account row", async () => {
  await controlledHome();
  fireEvent.click(screen.getByRole("button", { name: "Профиль", exact: true }));
  openAccountsWorkspace();
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const holding = screen.getByRole("button", { name: "Открыть актив: USD Coin · USDC · Solana" });
  holding.focus(); fireEvent.click(holding);
  expect(screen.getByRole("heading", { name: "USD Coin", exact: true })).toHaveFocus();
  expect(screen.getByRole("region", { name: "USD Coin", exact: true })).toHaveTextContent("Solana");
  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  expect(screen.getByRole("heading", { name: "Основной", exact: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Открыть актив: USD Coin · USDC · Solana" })).toHaveFocus();
});

it("clears the workspace when navigating to another or the already-active tab", async () => {
  await controlledHome();
  openAccountsWorkspace();
  fireEvent.click(screen.getByRole("button", { name: "Обзор", exact: true }));
  expect(screen.queryByRole("heading", { name: "Мои счета" })).toBeNull();
  openAccountsWorkspace();
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  fireEvent.click(screen.getByRole("button", { name: "История", exact: true }));
  expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Основной", exact: true })).toBeNull();
  openAccountsWorkspace();
  expect(screen.getByRole("heading", { name: "Мои счета" })).toHaveFocus();
});

it.each([
  { label: "zero", snapshot: { fiatCurrency: "USD", accounts: [], holdings: [] } as ProductSnapshot, count: 0 },
  { label: "one", snapshot: SINGLE_ACCOUNT_DEMO, count: 1 },
])("keeps the menu destination usable for $label accounts without relying on the quick chooser", async ({ snapshot, count }) => {
  await controlledHome("dark", { kind: "demo", snapshot });
  const accounts = openAccountsWorkspace();
  expect(within(accounts).queryAllByRole("button", { name: /Открыть счёт:/ })).toHaveLength(count);
  expect(screen.queryByRole("dialog")).toBeNull();
  if (count === 0) expect(accounts).toHaveTextContent("Счетов пока нет.");
  else {
    fireEvent.click(within(accounts).getByRole("button", { name: "Открыть счёт: Основной" }));
    expect(screen.getByRole("heading", { name: "Основной", exact: true })).toHaveFocus();
  }
});

it("shares privacy with the real accounts list/details and keeps the supplied light appearance without theme controls", async () => {
  const { container } = await controlledHome("light");
  const { panel } = openSettings();
  fireEvent.click(within(panel).getByRole("button", { name: "Скрывать суммы" }));
  fireEvent.click(within(panel).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const details = screen.getByRole("region", { name: "Основной", exact: true });
  expect(details.textContent).not.toMatch(/500|400|1,1|0,12|12\s?840/);
  expect(within(details).getAllByText("••••").length).toBeGreaterThan(3);
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  expect(screen.queryByRole("group", { name: "Тема оформления" })).toBeNull();
  expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
});

it("shows a removed account explicitly and backs to the list heading when its exact row no longer exists", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  let snapshot: Readonly<ProductSnapshot> = MULTI_ACCOUNT_DEMO;
  const adapter: MonoProductAdapter = { kind: "demo", get snapshot() { return snapshot; } };
  const scene = <MonoProductScene snapshot={wallet} productAdapter={adapter}
    appearance={envelope.appearance} material={envelope.material} />;
  const view = render(scene);
  openAccountsWorkspace();
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  snapshot = { ...MULTI_ACCOUNT_DEMO, accounts: MULTI_ACCOUNT_DEMO.accounts.filter(account => account.id !== "demo-custody"),
    holdings: MULTI_ACCOUNT_DEMO.holdings.filter(holding => holding.accountId !== "demo-custody") };
  view.rerender(<MonoProductScene snapshot={wallet} productAdapter={adapter}
    appearance={envelope.appearance} material={envelope.material} />);
  expect(screen.getByRole("heading", { name: "Счёт недоступен" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Подготовить отправку/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам" }));
  expect(screen.getByRole("heading", { name: "Мои счета" })).toHaveFocus();
});
