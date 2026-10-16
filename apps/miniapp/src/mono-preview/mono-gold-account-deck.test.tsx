import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { MONO_GOLD_ENVELOPE } from "./mono-gold-appearance";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "../mono-product/demo-adapter";
import type { ProductActivity } from "../mono-product/demo-activity";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "../mono-product/product-controller";
import { buyQuote, buyRoute } from "../mono-product/commerce/test-fixtures";
import { commerceOperationId } from "../mono-product/commerce/validation";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 390, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(300, 710, 68, 48);
    if (this.hasAttribute("data-mono-product-context-trigger")) return new DOMRect(18, 80, 160, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

const custodyPending: ProductActivity = {
  id: "custody-pending", accountId: "demo-custody", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "outgoing", status: "pending", quantity: "31.45",
  occurredAt: "2026-10-12T10:00:00Z",
};
const vaultPending: ProductActivity = { ...custodyPending, id: "vault-pending", accountId: "demo-depositary", accountLabel: "Хранилище" };
const vaultCompleted: ProductActivity = { ...vaultPending, id: "vault-completed", status: "completed", occurredAt: "2026-10-13T09:00:00Z" };

async function renderGold(activities: readonly ProductActivity[] = [custodyPending], options: {
  readonlySection?: boolean; status?: "ready" | "loading" | "error"; hidden?: boolean; dynamics?: boolean;
} = {}) {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const adapter: MonoProductAdapter = options.dynamics ? MONO_PRODUCT_DEMO_ADAPTER
    : { ...MONO_PRODUCT_DEMO_ADAPTER, activities, activityStatus: options.status ?? "ready" };
  let controller!: MonoProductController, refresh!: () => void;
  function Host({ blocked = false }: { blocked?: boolean }) {
    const [section, setSection] = useState<MonoSection>("overview");
    const [, setRevision] = useState(0);
    refresh = () => setRevision(value => value + 1);
    controller = useMonoProductController(adapter, { initialHidden: options.hidden ?? false }, { viewerPreferencesEnabled: true });
    const product = blocked ? { ...controller, commands: { ...controller.commands, requestContextChange: () => false } } : controller;
    return <div data-material-scrollport><MonoScene snapshot={snapshot} appearance={MONO_GOLD_ENVELOPE.appearance}
      presentation="gold" product={product} effectsDisabled balanceDynamics={options.dynamics ? { enabled: true, onChange() {} } : undefined} session={{ section,
        onSectionChange: options.readonlySection ? undefined : setSection, period: "1D", onPeriodChange() {},
        balanceHidden: controller.view.balanceHidden, onBalanceHiddenChange: controller.commands.setBalanceHidden }} /></div>;
  }
  const view = render(<Host />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  return { ...view, current: () => controller, block: () => view.rerender(<Host blocked />),
    scene: view.container.querySelector<HTMLElement>("[data-mono-preview]")!,
    allowSectionChange(allowed: boolean) { act(() => { options.readonlySection = !allowed; refresh(); }); },
    update(next: Partial<MonoProductAdapter>) { act(() => { Object.assign(adapter, next); refresh(); }); } };
}
function selectVault(view: Awaited<ReturnType<typeof renderGold>>) {
  act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
}
function inspect(label = "Хранилище") {
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: `Открыть счёт: ${label}` }));
  return screen.getByRole("region", { name: label });
}
function historyIds() {
  return screen.getAllByRole("button").filter(button => button.hasAttribute("data-product-activity-id"))
    .map(button => button.getAttribute("data-product-activity-id"));
}
function funds() { return screen.getByRole("button", { name: "Мои средства" }); }
function nav(label: string) {
  return within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: label });
}
function keepSendDraft(view: Awaited<ReturnType<typeof renderGold>>) {
  const route = resolveActionRoutes(MONO_PRODUCT_DEMO_ADAPTER.snapshot, { kind: "account", accountId: "demo-custody" }, "send")
    .routes.find(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")!;
  const draft = { route: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum" }, recipient: { address: "demo:kept" }, amount: "001," };
  act(() => view.current().commands.saveSendDraft(route, draft));
  return { key: sendDraftKey(route), draft };
}

it("keeps the Gold home estimate ALL when the working account is empty", async () => {
  const view = await renderGold(); selectVault(view);
  const context = view.current().view.context, saved = keepSendDraft(view);
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
  expect(screen.getByText("Оценка активов в USD")).toBeVisible();
  expect(view.current().view.context).toBe(context);
  expect(view.current().view.sendDrafts[saved.key]).toEqual(saved.draft);
  expect(screen.queryByRole("group", { name: "Счёт для обзора" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Мои счета" })).toBeNull();
  expect(screen.queryByRole("group", { name: "Закреплённые группы счетов" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Подробнее/ })).toBeNull();
});

it.each(["Получить", "Отправить", "Обмен", "Купить"])("resolves %s from ALL while preserving the working account", async label => {
  const view = await renderGold(); selectVault(view);
  const context = view.current().view.context;
  fireEvent.click(screen.getByRole("button", { name: label }));
  const routes = view.current().view.intent?.routes ?? [];
  expect(routes.some(route => route.accountId === "demo-custody")).toBe(true);
  if (label === "Получить") expect(routes.some(route => route.accountId === "demo-depositary")).toBe(true);
  expect(view.current().view.context).toBe(context);
});

it("opens Funds in existing Assets ALL and restores focus without changing context or drafts", async () => {
  const view = await renderGold(); selectVault(view);
  const context = view.current().view.context, saved = keepSendDraft(view);
  funds().focus(); fireEvent.click(funds());
  expect(view.scene).toHaveAttribute("data-mono-section", "assets");
  await waitFor(() => expect(screen.getByRole("button", { name: "Назад в обзор" })).toHaveFocus());
  expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Выбрать счёт: Все счета" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" }));
  expect(view.current().view.assetWorkspace?.scope).toEqual({ kind: "all" });
  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(funds()).toHaveFocus());
  expect(view.current().view.context).toBe(context);
  expect(view.current().view.sendDrafts[saved.key]).toEqual(saved.draft);
});

it("opens bottom Assets at ALL even after an explicit scoped account visit", async () => {
  const view = await renderGold();
  fireEvent.click(within(inspect()).getByRole("button", { name: "Выбрать счёт в кошельке" }));
  expect(view.scene).toHaveAttribute("data-mono-section", "assets");
  expect(screen.getByRole("heading", { name: "Активы счёта" })).toBeVisible();
  expect(screen.getByText("Активов пока нет")).toBeVisible();
  fireEvent.click(nav("Обзор")); fireEvent.click(nav("Активы"));
  expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toBeVisible();
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("makes choosing the same working account after Funds ALL visible in Assets", async () => {
  const view = await renderGold(); selectVault(view); fireEvent.click(funds());
  fireEvent.click(screen.getByRole("button", { name: "Выбрать счёт: Все счета" }));
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-account-context="demo-depositary"]')!);
  expect(screen.getByRole("button", { name: "Выбрать счёт: Хранилище" })).toBeVisible();
  expect(screen.getByText("Активов пока нет")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toBeNull();
  fireEvent.click(nav("Обзор"));
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
});

it("keeps Assets ALL across avatar profile and its exact return", async () => {
  const view = await renderGold(); selectVault(view); fireEvent.click(funds());
  const context = view.current().view.context;
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть профиль" }));
  expect(view.scene).toHaveAttribute("data-mono-section", "assets");
  expect(screen.getByRole("button", { name: "Выбрать счёт: Все счета" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toBeVisible();
  expect(view.current().view.context).toBe(context);
});

it("keeps the enabled ALL home chart independent of the working account", async () => {
  const view = await renderGold([], { dynamics: true });
  expect(screen.getByRole("region", { name: "График баланса" })).toBeVisible();
  selectVault(view);
  expect(screen.getByRole("region", { name: "График баланса" })).toBeVisible();
  expect(screen.getByRole("group", { name: "Период графика" })).toBeVisible();
});

it("shows only the compact pending home entry and keeps privacy on the ALL estimate", async () => {
  const view = await renderGold([custodyPending, vaultCompleted]); selectVault(view);
  expect(screen.getByRole("button", { name: "В процессе · 1" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Последняя операция" })).toBeNull();
  expect(screen.queryByText("Контроль", { exact: false })).toBeNull();
  expect(view.container.querySelector(".mono-promo-frame, .mono-product-funds__list")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent("••••••");
  expect(screen.queryByText(/12\s?840,75/)).toBeNull();
});

it.each([1, 2])("opens %i ALL pending records and returns focus to the home entry", async count => {
  const view = await renderGold(count === 1 ? [custodyPending, vaultCompleted] : [custodyPending, vaultPending, vaultCompleted]);
  selectVault(view);
  const context = view.current().view.context;
  fireEvent.click(screen.getByRole("button", { name: `В процессе · ${count}` }));
  expect(historyIds()).toEqual(count === 1 ? ["custody-pending"] : ["custody-pending", "vault-pending"]);
  expect(screen.queryByRole("region", { name: "Квитанция операции" }) !== null).toBe(count === 1);
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: `В процессе · ${count}` })).toHaveFocus());
  expect(view.current().view.context).toBe(context);
});

it("does not let unrelated completed duplicates block ALL pending History", async () => {
  await renderGold([custodyPending, vaultPending, vaultCompleted, { ...vaultCompleted }]);
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 2" }));
  expect(historyIds()).toEqual(["custody-pending", "vault-pending"]);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
});

it("does not leave an empty pending surface on the ready home", async () => {
  const view = await renderGold([vaultCompleted]);
  expect(view.container.querySelector(".mono-product-recent")).toBeNull();
  expect(screen.queryByRole("button", { name: /В процессе/ })).toBeNull();
});

it.each(["loading", "error"] as const)("keeps the existing %s pending resource state on Home", async status => {
  await renderGold([], { status });
  expect(screen.getByText(status === "loading" ? "Проверяем операции…" : "Операции сейчас недоступны")).toBeVisible();
});

it("returns Accounts to the live Menu launcher without changing the working account", async () => {
  const view = await renderGold(); selectVault(view); inspect();
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам" }));
  fireEvent.click(screen.getByRole("button", { name: "Назад в кошелёк" }));
  await waitFor(() => expect(nav("Меню")).toHaveFocus());
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("rejects Funds navigation before changing context, sheets or drafts", async () => {
  const view = await renderGold(); selectVault(view); const saved = keepSendDraft(view);
  act(() => view.current().commands.openIntent("receive"));
  const context = view.current().view.context, sheet = view.current().view.sheet;
  view.block(); fireEvent.click(screen.getByRole("button", { name: "Мои средства", hidden: true }));
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
  expect(view.current().view.context).toBe(context); expect(view.current().view.sheet).toBe(sheet);
  expect(view.current().view.sendDrafts[saved.key]).toEqual(saved.draft);
});

it("does not apply UseAccount when controlled host navigation is unavailable", async () => {
  const view = await renderGold([], { readonlySection: true }); const saved = keepSendDraft(view);
  const detail = inspect(), context = view.current().view.context, workspace = view.current().view.accountsWorkspace;
  fireEvent.click(within(detail).getByRole("button", { name: "Выбрать счёт в кошельке" }));
  expect(view.current().view.context).toBe(context); expect(view.current().view.accountsWorkspace).toBe(workspace);
  expect(view.current().view.sendDrafts[saved.key]).toEqual(saved.draft);
  expect(screen.getByRole("region", { name: "Хранилище" })).toBeVisible();
});

it("does not mutate a scoped Assets display when accepted commerce blocks ALL navigation", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const view = await renderGold();
  fireEvent.click(within(inspect()).getByRole("button", { name: "Выбрать счёт в кошельке" }));
  act(() => view.current().commands.openIntent("buy", { kind: "all" }));
  act(() => view.current().commands.selectRoute(buyRoute));
  act(() => view.current().commands.saveBuyDraft(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "23," }));
  const quote = buyQuote(); quote.portId = view.current().view.flowPorts.buy.id;
  const key = "gold-assets-guard";
  act(() => view.current().commands.setCommerceSubmitState(buyRoute, { busy: true,
    attempt: { kind: "buy", quote, idempotencyKey: key, operationId: commerceOperationId(quote, key) } }));
  expect(view.current().view.commerceBusy).toBe(true);
  const sheet = view.current().view.sheet;
  fireEvent.click(nav("Активы"));
  expect(view.current().view.sheet).toBe(sheet);
  expect(screen.getByRole("button", { name: "Выбрать счёт: Хранилище", hidden: true })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Открыть актив Bitcoin (BTC)", hidden: true })).toBeNull();
  expect(Object.values(view.current().view.buyDrafts)[0]?.fiatAmount).toBe("23,");
});

it("the real Gold host keeps UseAccount scoped Assets and Funds ALL across ordinary navigation", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<MonoProductScene presentation="gold" themePreference="fixed" snapshot={snapshot}
    appearance={MONO_GOLD_ENVELOPE.appearance} material={MONO_GOLD_ENVELOPE.material} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  fireEvent.click(within(inspect()).getByRole("button", { name: "Выбрать счёт в кошельке" }));
  expect(screen.getByText("Активов пока нет")).toBeVisible();
  expect(nav("Активы")).toHaveAttribute("aria-current", "page");
  fireEvent.click(nav("Обзор")); fireEvent.click(funds());
  expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toBeVisible();
});

it.each([true, false])("shows home-pin preferences only in ordinary MONO (Gold=%s)", async gold => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<MonoProductScene presentation={gold ? "gold" : undefined} themePreference="fixed" snapshot={snapshot}
    appearance={MONO_GOLD_ENVELOPE.appearance} material={MONO_GOLD_ENVELOPE.material} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  fireEvent.click(nav("Меню"));
  const menu = screen.getByRole("dialog", { name: "Меню" });
  expect(within(menu).queryByRole("button", { name: "На главной" }) !== null).toBe(!gold);
  expect(within(menu).getByRole("button", { name: "Мои счета" })).toBeVisible();
});
