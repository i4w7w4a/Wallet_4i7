import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene } from "./mono-scene";
import { MONO_GOLD_ENVELOPE } from "./mono-gold-appearance";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "../mono-product/demo-adapter";
import type { ProductActivity } from "../mono-product/demo-activity";
import { useMonoProductController, type MonoProductController } from "../mono-product/product-controller";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 390, 68);
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

async function renderGold(activities: readonly ProductActivity[] = [custodyPending]) {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const adapter: MonoProductAdapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities };
  let controller!: MonoProductController;
  function Host({ blocked = false }: { blocked?: boolean }) {
    controller = useMonoProductController(adapter, { initialHidden: false }, { viewerPreferencesEnabled: true });
    const product = blocked ? { ...controller, commands: { ...controller.commands, requestContextChange: () => false } } : controller;
    return <div data-material-scrollport><MonoScene snapshot={snapshot} appearance={MONO_GOLD_ENVELOPE.appearance}
      presentation="gold" product={product} effectsDisabled /></div>;
  }
  const view = render(<Host />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  return { ...view, current: () => controller, block: () => view.rerender(<Host blocked />),
    update(next: Partial<MonoProductAdapter>) { Object.assign(adapter, next); view.rerender(<Host />); } };
}
function choose(label: string) {
  const button = within(screen.getByRole("group", { name: "Счёт для обзора" })).getByRole("button", { name: label });
  fireEvent.click(button);
  return button;
}
function historyIds() {
  return screen.getAllByRole("button").filter(button => button.hasAttribute("data-product-activity-id"))
    .map(button => button.getAttribute("data-product-activity-id"));
}

it("starts Gold at the wallet estimate with only exact active account shortcuts", async () => {
  await renderGold();
  const selector = screen.getByRole("group", { name: "Счёт для обзора" });
  expect(within(selector).getAllByRole("button").map(button => button.textContent)).toEqual(["Все", "Основной", "Хранилище"]);
  expect(within(selector).getByRole("button", { name: "Все" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
  expect(screen.getByText("Оценка активов в USD")).toBeInTheDocument();
});

it("projects the selected empty account into both the balance and holdings", async () => {
  const view = await renderGold();
  choose("Хранилище");
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(screen.getByRole("region", { name: "Баланс счёта" })).toHaveTextContent(/0,00/);
  expect(screen.getByText("Активов пока нет")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Открыть актив Bitcoin/ })).toBeNull();
  choose("Все");
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
});

it("routes Gold quick actions through the account shown by its balance", async () => {
  const view = await renderGold();
  choose("Хранилище");
  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  expect(view.current().view.intent?.routes.map(route => route.accountId)).toEqual(["demo-depositary"]);
  act(() => view.current().commands.closeSheet());
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  expect(view.current().view.intent?.routes).toEqual([]);
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("does not show another account's pending or recent activity in an empty account", async () => {
  await renderGold();
  choose("Хранилище");
  expect(screen.queryByRole("button", { name: /В процессе/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "Последняя операция" })).toBeNull();
});

it.each([1, 2])("opens %i selected-account pending records and returns to that account's launcher", async count => {
  const pending = count === 1 ? [vaultPending] : [vaultPending, { ...vaultPending, id: "vault-second-pending" }];
  const view = await renderGold([custodyPending, vaultCompleted, ...pending]);
  choose("Хранилище");
  fireEvent.click(screen.getByRole("button", { name: `В процессе · ${count}` }));
  expect(historyIds()).toEqual(count === 1 ? ["vault-pending"] : ["vault-pending", "vault-second-pending"]);
  expect(screen.getByText("Хранилище · примеры и симуляции")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Квитанция операции" }) !== null).toBe(count === 1);
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: `В процессе · ${count}` })).toHaveFocus());
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(within(screen.getByRole("group", { name: "Счёт для обзора" })).getByRole("button", { name: "Хранилище" })).toHaveAttribute("aria-pressed", "true");
});

it("opens the selected account's recent receipt with a return to its exact home row", async () => {
  const view = await renderGold([{ ...custodyPending, occurredAt: "2026-10-13T12:00:00Z" }, vaultCompleted]);
  choose("Хранилище");
  const recent = within(screen.getByRole("region", { name: "Последняя операция" })).getByRole("button");
  expect(recent).toHaveAttribute("data-product-activity-id", "vault-completed");
  fireEvent.click(recent);
  expect(historyIds()).toEqual(["vault-completed"]);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Последняя операция" })).getByRole("button")).toHaveFocus());
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("does not let unrelated completed duplicates block selected-account pending History", async () => {
  await renderGold([vaultPending, { ...vaultPending, id: "vault-second-pending" }, vaultCompleted, { ...vaultCompleted }]);
  choose("Хранилище");
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 2" }));
  expect(historyIds()).toEqual(["vault-pending", "vault-second-pending"]);
  expect(screen.getByRole("button", { name: "Назад в обзор" })).toBeInTheDocument();
});

it("returns Accounts to the compact Gold launcher without changing the selected account", async () => {
  const view = await renderGold();
  choose("Хранилище");
  const entry = screen.getByRole("button", { name: "Мои счета" });
  entry.focus(); fireEvent.click(entry);
  fireEvent.click(screen.getByRole("button", { name: "Назад в кошелёк" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Мои счета" })).toHaveFocus());
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("discards a recent receipt's reveal and return when its snapshot changes", async () => {
  const view = await renderGold([vaultCompleted]);
  choose("Хранилище");
  fireEvent.click(within(screen.getByRole("region", { name: "Последняя операция" })).getByRole("button"));
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
  view.update({ snapshot: { ...MONO_PRODUCT_DEMO_ADAPTER.snapshot }, activities: [{ ...vaultCompleted, quantity: "99.99" }] });
  await act(async () => {});
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Назад в обзор" })).toBeNull();
  expect(document.querySelector('[data-product-activity-id="vault-completed"]')).toHaveAttribute("aria-expanded", "false");
});

it("keeps the visible selection when the shared context guard rejects a switch", async () => {
  const view = await renderGold();
  view.block(); choose("Хранилище");
  expect(view.current().view.context).toEqual({ kind: "all" });
  expect(within(screen.getByRole("group", { name: "Счёт для обзора" })).getByRole("button", { name: "Все" })).toHaveAttribute("aria-pressed", "true");
});

it("honors total-only pins and privacy without discarding the current account shortcut", async () => {
  const view = await renderGold();
  choose("Хранилище");
  act(() => { view.current().commands.setHomeTotalOnly(true); view.current().commands.setBalanceHidden(true); });
  expect(screen.queryByRole("button", { name: /Открыть группу/ })).toBeNull();
  expect(screen.getByRole("region", { name: "Баланс счёта" })).toHaveTextContent("••••••");
  expect(within(screen.getByRole("group", { name: "Счёт для обзора" })).getByRole("button", { name: "Хранилище" })).toHaveAttribute("aria-pressed", "true");
  expect(view.current().view.homePinnedKinds).toEqual(["custodial", "depositary"]);
});
