import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, resolveActionRoutes, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "../mono-product/demo-adapter";
import type { ProductActivity } from "../mono-product/demo-activity";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "../mono-product/product-controller";
import { createSwapActivityFixture, createSwapSimulationFixture } from "../mono-product/commerce-test-fixtures";
import { buyQuote, buyRoute } from "../mono-product/commerce/test-fixtures";
import { commerceOperationId } from "../mono-product/commerce/validation";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 480, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 480, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(372, 710, 84, 48);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

const pending: ProductActivity = {
  id: "account-old-pending", accountId: "demo-custody", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "outgoing", status: "pending", quantity: "31.456789",
  feeLabel: "0.004321 ETH", occurredAt: "2026-09-26T10:00:00Z",
};
const completed: ProductActivity = { ...pending, id: "account-new-completed", status: "completed", occurredAt: "2026-10-10T01:00:00Z" };
const foreign: ProductActivity = { ...pending, id: "foreign-pending", accountId: "demo-depositary", accountLabel: "Хранилище" };

async function accountScene(activities: readonly ProductActivity[], options: {
  status?: "ready" | "loading" | "error"; retry?: () => void; hidden?: boolean; readonlySection?: boolean;
} = {}) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const appearance = createMonoAppearanceEnvelope("ledger").appearance;
  const accounts = [...MONO_PRODUCT_DEMO_ADAPTER.snapshot.accounts];
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, snapshot: { ...MONO_PRODUCT_DEMO_ADAPTER.snapshot, accounts }, activities,
    activityStatus: options.status ?? "ready", retryActivities: options.retry };
  let controller!: MonoProductController, refresh!: () => void;
  function Host() {
    const [, setRevision] = useState(0);
    refresh = () => setRevision(value => value + 1);
    controller = useMonoProductController(adapter, { initialHidden: options.hidden ?? false });
    const [section, setSection] = useState<MonoSection>("overview");
    return <div data-material-scrollport><MonoScene snapshot={wallet} appearance={appearance} product={controller} effectsDisabled
      session={{ section, onSectionChange: options.readonlySection ? undefined : setSection, period: "1D", onPeriodChange() {},
        balanceHidden: controller.view.balanceHidden, onBalanceHiddenChange: controller.commands.setBalanceHidden }} /></div>;
  }
  const view = render(<Host />);
  return { ...view, accounts, current: () => controller,
    allowSectionChange(allowed: boolean) { act(() => { options.readonlySection = !allowed; refresh(); }); },
    update(next: Partial<MonoProductAdapter>) { act(() => { Object.assign(adapter, next); refresh(); }); },
    scene: view.container.querySelector<HTMLElement>("[data-mono-preview]")!,
    scrollport: view.container.querySelector<HTMLElement>("[data-material-scrollport]")! };
}

function inspect(label = "Основной", fromPin = false) {
  if (fromPin) fireEvent.click(screen.getByRole("button", { name: "Открыть группу Кастодиальные" }));
  else {
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Мои счета" }));
  }
  fireEvent.click(screen.getByRole("button", { name: `Открыть счёт: ${label}` }));
  return screen.getByRole("region", { name: label });
}
function launcher(count = 1) { return screen.getByRole("button", { name: `В процессе · ${count}` }); }
function historyIds() {
  return screen.getAllByRole("button").filter(button => button.hasAttribute("data-product-activity-id"))
    .map(button => button.getAttribute("data-product-activity-id"));
}

async function accountProductHost() {
  const wallet = await new MockWalletRepository().getSnapshot();
  const appearance = createMonoAppearanceEnvelope("ledger").appearance;
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [completed, pending, foreign] };
  let changeSection!: (section: MonoSection) => void, refresh!: () => void;
  function Host() {
    const [section, setSection] = useState<MonoSection>("overview");
    const [hidden, setHidden] = useState(true);
    const [, setRevision] = useState(0);
    changeSection = setSection; refresh = () => setRevision(value => value + 1);
    return <div data-material-scrollport><MonoProductScene snapshot={wallet} appearance={appearance}
      productAdapter={adapter} material={{ background: null, buttons: null }} effectsDisabled
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: hidden, onBalanceHiddenChange: setHidden }} /></div>;
  }
  const view = render(<Host />);
  return { ...view, scene: view.container.querySelector<HTMLElement>("[data-mono-preview]")!,
    scrollport: view.container.querySelector<HTMLElement>("[data-material-scrollport]")!,
    setSection: (section: MonoSection) => act(() => changeSection(section)), rerenderHost: () => act(refresh) };
}

it.each(["overview", "profile"] as const)("account pending actual host preserves single History and Back from %s", async origin => {
  const view = await accountProductHost();
  if (origin === "profile") fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  const detail = inspect();
  fireEvent.click(detail.querySelector<HTMLButtonElement>('[data-product-holding-id="demo-usdc-eth"]')!);
  view.scrollport.scrollTop = 123;
  fireEvent.click(launcher());
  expect(view.scene).toHaveAttribute("data-mono-section", "history");
  expect(historyIds()).toEqual(["account-old-pending"]);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).not.toHaveTextContent(/31[.,]456789|0[.,]004321/);
  await waitFor(() => expect(document.querySelector('[data-product-activity-id="account-old-pending"]')).toHaveFocus());
  view.rerenderHost();
  expect(view.scene).toHaveAttribute("data-mono-section", "history");
  fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(launcher()).toHaveFocus());
  expect(view.scene).toHaveAttribute("data-mono-section", origin);
  expect(screen.getByRole("region", { name: "Основной" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Основной" }).querySelector('[data-product-holding-id="demo-usdc-eth"]')).toHaveAttribute("aria-expanded", "true");
  expect(view.scrollport.scrollTop).toBe(123);
});

it("account pending actual host clears the inspection on ordinary navigation away", async () => {
  const view = await accountProductHost(); inspect(); fireEvent.click(launcher());
  expect(view.scene).toHaveAttribute("data-mono-section", "history");
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  expect(view.scene).toHaveAttribute("data-mono-section", "assets");
  expect(screen.queryByRole("region", { name: "Основной" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  expect(screen.queryByRole("button", { name: "К счёту" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(historyIds()).toContain("foreign-pending");
});

it("account pending actual host honors an external controlled section change and clears the inspection", async () => {
  const view = await accountProductHost(); inspect(); fireEvent.click(launcher());
  expect(view.scene).toHaveAttribute("data-mono-section", "history");
  view.setSection("assets");
  await waitFor(() => expect(view.scene).toHaveAttribute("data-mono-section", "assets"));
  expect(screen.queryByRole("region", { name: "Основной" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  expect(screen.queryByRole("button", { name: "К счёту" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(historyIds()).toContain("foreign-pending");
});

it("account pending single returns to its pinned detail, holding, scroll and launcher without changing working context or private draft", async () => {
  const view = await accountScene([completed, pending, foreign], { hidden: true });
  const route = resolveActionRoutes(MONO_PRODUCT_DEMO_ADAPTER.snapshot, { kind: "account", accountId: "demo-custody" }, "send")
    .routes.filter(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")[0]!;
  const draft = { route: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum" }, recipient: { address: "demo:kept" }, amount: "001," };
  act(() => { view.current().commands.selectContext({ kind: "account", accountId: "demo-depositary" }); view.current().commands.saveSendDraft(route, draft); });
  const detail = inspect("Основной", true);
  const holding = detail.querySelector<HTMLButtonElement>('[data-product-holding-id="demo-usdc-eth"]')!;
  fireEvent.click(holding);
  view.scrollport.scrollTop = 123;
  const context = view.current().view.context, workspace = view.current().view.accountsWorkspace;
  const entry = launcher();
  expect(entry).toHaveAccessibleDescription("Отправка USDC Ethereum · Основной Примеры и симуляции");
  expect(entry.outerHTML).not.toMatch(/31[.,]456789|0[.,]004321/);
  fireEvent.click(entry);
  const row = document.querySelector('[data-product-activity-id="account-old-pending"]')!;
  await waitFor(() => expect(row).toHaveFocus());
  expect(row).toHaveAttribute("aria-expanded", "true");
  expect(historyIds()).toEqual(["account-old-pending"]);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).not.toHaveTextContent(/31[.,]456789|0[.,]004321/);
  expect(screen.queryByRole("button", { name: "Назад в обзор" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(launcher()).toHaveFocus());
  expect(screen.getByRole("region", { name: "Основной" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Основной" }).querySelector('[data-product-holding-id="demo-usdc-eth"]')).toHaveAttribute("aria-expanded", "true");
  expect(view.scrollport.scrollTop).toBe(123);
  expect(view.current().view.accountsWorkspace).toBe(workspace);
  expect(view.current().view.context).toBe(context);
  expect(view.current().view.sendDrafts[sendDraftKey(route)]).toEqual(draft);
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам" }));
  expect(screen.getByRole("heading", { name: "Кастодиальные" })).toBeInTheDocument();
});

it("account pending many opens only account pending History, folds the exact receipt and returns to its underlying profile detail", async () => {
  const view = await accountScene([completed, pending, { ...pending, id: "account-second-pending", assetId: "eth", assetSymbol: "ETH" }, foreign]);
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  inspect(); fireEvent.click(launcher(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Фильтр статуса" })).toHaveFocus());
  expect(historyIds()).toEqual(["account-old-pending", "account-second-pending"]);
  expect(screen.getByText("Основной · примеры и симуляции")).toBeVisible();
  const row = document.querySelector<HTMLButtonElement>('[data-product-activity-id="account-second-pending"]')!;
  fireEvent.click(row);
  expect(row).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
  fireEvent.click(row);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(screen.getByRole("button", { name: "Фильтр статуса" })).toHaveAccessibleDescription("Текущий статус: Ожидают");
  fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(launcher(2)).toHaveFocus());
  expect(view.scene).toHaveAttribute("data-mono-section", "profile");
  expect(view.current().view.context).toEqual({ kind: "all" });
});

it.each(["completed", "failed"] as const)("account pending fix opens the current %s result from a stale many History row", async status => {
  const event = { ...pending };
  await accountScene([event, { ...pending, id: "still-pending" }, completed, foreign], { hidden: true });
  inspect(); fireEvent.click(launcher(2));
  const staleRow = document.querySelector<HTMLButtonElement>('[data-product-activity-id="account-old-pending"]')!;
  event.status = status; fireEvent.click(staleRow);
  const row = document.querySelector('[data-product-activity-id="account-old-pending"]');
  expect(row).toHaveAttribute("data-status", status);
  expect(row).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Фильтр статуса" })).toHaveAccessibleDescription("Текущий статус: Все статусы");
  expect(screen.getByRole("region", { name: "Квитанция операции" })).not.toHaveTextContent(/31[.,]456789|0[.,]004321/);
  expect(historyIds()).not.toContain("foreign-pending");
  fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(launcher()).toHaveFocus());
});

it("account pending fix refuses Back before changing the inspection when the host removes section navigation", async () => {
  const view = await accountScene([pending, foreign]); inspect(); fireEvent.click(launcher());
  const workspace = view.current().view.accountsWorkspace, context = view.current().view.context;
  view.allowSectionChange(false);
  const back = screen.getByRole("button", { name: "К счёту" });
  back.focus(); fireEvent.click(back);
  expect(view.scene).toHaveAttribute("data-mono-section", "history");
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Основной" })).toBeNull();
  expect(view.current().view.expandedActivityId).toBe("account-old-pending");
  expect(view.current().view.accountsWorkspace).toBe(workspace);
  expect(view.current().view.context).toBe(context);
  expect(back).toHaveFocus();
  view.allowSectionChange(true); fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(launcher()).toHaveFocus());
});

it("account pending fix clears its imported receipt selection after explicit navigation away", async () => {
  const view = await accountScene([pending, foreign]); inspect(); fireEvent.click(launcher());
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  expect(view.current().view.accountsWorkspace).toBeNull();
  view.update({ activities: [{ ...foreign, id: "account-old-pending" }] });
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(document.querySelector('[data-product-activity-id="account-old-pending"]')).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "К счёту" })).toBeNull();
});

it("account pending rejects a changed History-row scope before exposing a foreign receipt", async () => {
  const event = { ...pending };
  await accountScene([event, { ...pending, id: "still-in-account" }]); inspect(); fireEvent.click(launcher(2));
  const row = document.querySelector<HTMLButtonElement>('[data-product-activity-id="account-old-pending"]')!;
  event.accountId = "demo-depositary"; event.accountLabel = "Хранилище";
  fireEvent.click(row);
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Операция сейчас недоступна");
  expect(historyIds()).toEqual(["still-in-account"]);
});

it.each(["Основной", "Хранилище"])("account pending scopes both internal participants and commerce legs once for %s even without a holding", async label => {
  const internal: ProductActivity = { ...pending, id: "internal-once", internalTransfer: {
    sourceAccountId: "demo-custody", sourceAccountLabel: "Основной", destinationAccountId: "demo-depositary", destinationAccountLabel: "Хранилище",
  } };
  const commerce = createSwapSimulationFixture();
  commerce.quote.credit = { ...commerce.quote.credit, accountId: "demo-depositary", accountLabel: "Хранилище" };
  commerce.quote.request.destination = { ...commerce.quote.credit };
  await accountScene([internal, createSwapActivityFixture({ status: "pending", commerce }),
    { ...foreign, id: "unrelated", accountId: "demo-private" }]);
  inspect(label); fireEvent.click(launcher(2));
  expect(historyIds()).toEqual(["internal-once", "commerce-swap-fixture"]);
  expect(screen.getByText(`${label} · примеры и симуляции`)).toBeVisible();
});

it("account pending does not require an active account, holdings or send capability", async () => {
  const account = MONO_PRODUCT_DEMO_ADAPTER.snapshot.accounts.find(candidate => candidate.id === "demo-inactive")!;
  await accountScene([{ ...pending, accountId: account.id, accountLabel: account.label }]);
  inspect(account.label);
  expect(launcher()).not.toBeDisabled();
  fireEvent.click(launcher());
  expect(historyIds()).toEqual(["account-old-pending"]);
});

it.each(["ready", "loading", "error"] as const)("account pending reuses %s state and retry without revealing a foreign counter", async status => {
  const retry = vi.fn();
  await accountScene(status === "ready" ? [completed, foreign] : [pending, foreign], { status, retry });
  inspect();
  expect(screen.queryByRole("button", { name: /В процессе/ })).toBeNull();
  if (status === "ready") expect(screen.queryByRole("status")).toBeNull();
  else expect(screen.getByRole("status")).toHaveTextContent(status === "loading" ? "Проверяем операции…" : "Операции сейчас недоступны");
  if (status === "error") { fireEvent.click(screen.getByRole("button", { name: "Повторить" })); expect(retry).toHaveBeenCalledOnce(); }
  else expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
});

it.each(["completed", "failed"] as const)("account pending opens the current %s result after a status race and returns to the account heading at zero", async status => {
  const event = { ...pending };
  await accountScene([event]); inspect();
  const entry = launcher(); event.status = status;
  fireEvent.click(entry);
  expect(document.querySelector('[data-product-activity-id="account-old-pending"]')).toHaveAttribute("data-status", status);
  expect(screen.getByRole("button", { name: "Фильтр статуса" })).toHaveAccessibleDescription("Текущий статус: Все статусы");
  fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Основной" })).toHaveFocus());
  expect(screen.queryByRole("button", { name: /В процессе/ })).toBeNull();
});

it.each(["event", "ambiguous", "status", "account"] as const)("account pending rejects a missing or invalid %s without choosing another identity", async failure => {
  const event = { ...pending };
  const view = await accountScene([event, foreign]); inspect();
  if (failure === "event") event.id = "vanished-original";
  else if (failure === "ambiguous") view.update({ activities: [event, { ...foreign, id: event.id }] });
  else if (failure === "status") event.status = "unknown" as ProductActivity["status"];
  else view.accounts.splice(view.accounts.findIndex(account => account.id === "demo-custody"), 1);
  fireEvent.click(launcher());
  expect(screen.getByRole("status")).toHaveTextContent("Операции сейчас недоступны");
  expect(screen.queryByRole("heading", { name: "История операций" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(view.current().view.context).toEqual({ kind: "all" });
});

it("account pending leaves a guard-rejected controlled section and its account detail intact", async () => {
  const view = await accountScene([pending], { readonlySection: true }); inspect();
  const workspace = view.current().view.accountsWorkspace;
  fireEvent.click(launcher());
  expect(screen.getByRole("region", { name: "Основной" })).toBeVisible();
  expect(launcher()).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("heading", { name: "История операций" })).toBeNull();
  expect(view.current().view.accountsWorkspace).toBe(workspace);
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
});

it("account pending cannot leave an accepted submit or replace its route and raw draft", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const view = await accountScene([pending]); inspect();
  act(() => view.current().commands.openAccountRoute(buyRoute));
  act(() => view.current().commands.saveBuyDraft(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "23," }));
  const quote = buyQuote(); quote.portId = view.current().view.flowPorts.buy.id;
  const key = "account-pending-guard";
  act(() => view.current().commands.setCommerceSubmitState(buyRoute, { busy: true,
    attempt: { kind: "buy", quote, idempotencyKey: key, operationId: commerceOperationId(quote, key) } }));
  const sheet = view.current().view.sheet, workspace = view.current().view.accountsWorkspace;
  const entry = screen.getByRole("button", { name: "В процессе · 1", hidden: true });
  expect(entry).toBeDisabled(); fireEvent.click(entry);
  expect(screen.queryByRole("heading", { name: "История операций" })).toBeNull();
  expect(view.current().view.sheet).toBe(sheet);
  expect(view.current().view.accountsWorkspace).toBe(workspace);
  expect(Object.values(view.current().view.buyDrafts)[0]?.fiatAmount).toBe("23,");
});

it.each(["session", "account", "context"] as const)("account pending invalidates the inspection on %s change without revealing a foreign receipt or returning to another account", async change => {
  const view = await accountScene([pending, foreign]); inspect(); fireEvent.click(launcher());
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
  if (change === "context") act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  else {
    const snapshot: ProductSnapshot = { ...MONO_PRODUCT_DEMO_ADAPTER.snapshot,
      accounts: change === "account" ? view.accounts.filter(account => account.id !== "demo-custody") : [...view.accounts] };
    view.update({ snapshot, activities: [{ ...foreign, id: "account-old-pending" }] });
  }
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(screen.queryByRole("button", { name: "К счёту" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Хранилище" })).toBeNull();
  expect(view.scene).toHaveAttribute("data-mono-section", "overview");
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
});
