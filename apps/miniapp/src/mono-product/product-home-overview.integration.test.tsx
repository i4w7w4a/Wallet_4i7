import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { HOME_PINS_STORAGE_KEY } from "./home-pins";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import type { ProductActivity } from "./demo-activity";
import { MonoScene } from "../mono-preview/mono-scene";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "./product-controller";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {},
  }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 480, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 480, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(372, 710, 84, 48);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function renderOverview(props: { productAdapter?: MonoProductAdapter } = {}) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  return { ...render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} {...props} />), wallet, envelope };
}

it("keeps the entire wallet and home routes visible after selecting an empty account elsewhere", async () => {
  await renderOverview();
  const navigation = screen.getByRole("navigation", { name: "Разделы кошелька" });
  fireEvent.click(within(navigation).getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" }))
    .getByRole("button", { name: /Хранилище/ }));
  fireEvent.click(within(navigation).getByRole("button", { name: "Обзор" }));

  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
  expect(screen.queryByRole("button", { name: /Хранилище/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  const receive = screen.getByRole("dialog", { name: "Получить" });
  expect(within(receive).getByRole("button", { name: "Основной" })).toBeInTheDocument();
  expect(within(receive).getByRole("button", { name: "Хранилище" })).toBeInTheDocument();
  expect(receive).toHaveTextContent("Solana");
});

const n1Pending: ProductActivity = {
  id: "n1-old-pending", accountId: "demo-custody", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "outgoing", status: "pending", quantity: "31.456789",
  feeLabel: "0.004321 ETH", occurredAt: "2026-09-26T10:00:00Z",
};
const n1Completed: ProductActivity = { ...n1Pending, id: "n1-new-completed", status: "completed", occurredAt: "2026-10-10T01:00:00Z" };

it("N1 keeps an older pending visible, opens its masked exact receipt globally and returns to its launcher", async () => {
  await renderOverview({ productAdapter: { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [n1Completed, n1Pending] } });
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" })).getByRole("button", { name: /Хранилище/ }));
  fireEvent.click(screen.getByRole("button", { name: "Обзор" }));
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  const recent = screen.getByRole("region", { name: "Последняя операция" });
  expect(within(recent).getByRole("button")).toHaveAttribute("data-product-activity-id", "n1-new-completed");
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  expect(entry).toHaveAccessibleDescription("Отправка USDC Ethereum · Основной Примеры и симуляции");
  entry.focus(); fireEvent.click(entry);
  const row = screen.getByRole("button", { name: /Отправка.*USDC.*В обработке.*скрыт/i });
  await waitFor(() => expect(row).toHaveFocus());
  expect(row).toHaveAttribute("data-product-activity-id", "n1-old-pending");
  expect(row).toHaveAttribute("aria-expanded", "true");
  const receipt = screen.getByRole("region", { name: "Квитанция операции" });
  expect(receipt).not.toHaveTextContent(/31[.,]456789|0[.,]004321/);
  expect(receipt).toHaveTextContent("••••");
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "В процессе · 1" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  expect(screen.getByRole("button", { name: "Выбрать счёт: Хранилище" })).toBeInTheDocument();
});

it("N1 opens many in pending History without choosing an arbitrary receipt", async () => {
  await renderOverview({ productAdapter: { ...MONO_PRODUCT_DEMO_ADAPTER,
    activities: [n1Completed, n1Pending, { ...n1Pending, id: "n1-other", direction: "incoming", accountId: "demo-private" }] } });
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 2" }));
  const status = screen.getByRole("button", { name: "Фильтр статуса" });
  await waitFor(() => expect(status).toHaveFocus());
  expect(status).toHaveAccessibleDescription("Текущий статус: Ожидают");
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  const rows = screen.getAllByRole("button").filter(button => button.hasAttribute("data-product-activity-id"));
  expect(rows.map(row => row.getAttribute("data-product-activity-id"))).toEqual(["n1-old-pending", "n1-other"]);
  expect(rows.every(row => row.getAttribute("aria-expanded") === "false")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "В процессе · 2" })).toHaveFocus());
});

it("N1 honours navigation guards without partial entry and preserves the raw draft and working account", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const adapter: MonoProductAdapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [n1Pending] };
  let current!: MonoProductController;
  function Host({ locked }: { locked: boolean }) {
    current = useMonoProductController(adapter, { initialHidden: false });
    return <MonoScene snapshot={wallet} appearance={envelope.appearance} product={current}
      session={locked ? { section: "overview", period: "1D", onPeriodChange() {}, balanceHidden: false, onBalanceHiddenChange() {} } : undefined} />;
  }
  const view = render(<Host locked />);
  const route = { action: "send" as const, accountId: "demo-custody", accountLabel: "Основной", accountKind: "custodial" as const,
    assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "solana", networkLabel: "Solana" };
  act(() => {
    current.commands.selectContext({ kind: "account", accountId: "demo-depositary" });
    current.commands.saveSendDraft(route, { route, recipient: { address: "demo:kept" }, amount: "001," });
  });
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 1" }));
  expect(current.view.expandedActivityId).toBeNull();
  expect(screen.queryByRole("heading", { name: "История операций" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Назад в обзор" })).toBeNull();
  view.rerender(<Host locked={false} />);
  fireEvent.click(screen.getByRole("button", { name: "История" }));
  expect(screen.getByText("Для этого счёта операций пока нет.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Обзор" }));
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 1" }));
  await screen.findByRole("region", { name: "Квитанция операции" });
  expect(current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(current.view.sendDrafts[sendDraftKey(route)]).toEqual({ route: { accountId: "demo-custody", assetId: "usdc", networkId: "solana" },
    recipient: { address: "demo:kept" }, amount: "001," });
});

it.each(["completed", "failed"] as const)("N1 opens the current %s result when a displayed single changes before the click", async status => {
  const activity: ProductActivity = { ...n1Pending };
  await renderOverview({ productAdapter: { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [activity, n1Completed] } });
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  activity.status = status;
  fireEvent.click(entry);
  expect(screen.getByRole("button", { name: "Фильтр статуса" })).toHaveAccessibleDescription("Текущий статус: Все статусы");
  const exact = document.querySelector('[data-product-activity-id="n1-old-pending"]');
  expect(exact).toHaveAttribute("data-status", status);
  expect(exact).toHaveAttribute("aria-expanded", "true");
  expect(document.querySelector('[data-product-activity-id="n1-new-completed"]')).toHaveAttribute("aria-expanded", "false");
});

it("N1 rejects a vanished single identity without replacing it with another receipt", async () => {
  const activity: ProductActivity = { ...n1Pending };
  await renderOverview({ productAdapter: { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [activity, n1Completed] } });
  const entry = screen.getByRole("button", { name: "В процессе · 1" });
  activity.id = "different-event";
  fireEvent.click(entry);
  expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Операции сейчас недоступны");
  expect(screen.queryByRole("heading", { name: "История операций" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Общий баланс" })).toHaveFocus();
});

it("N1 invalidates its reveal, Back and queued focus when the source session changes", async () => {
  const adapter: MonoProductAdapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [n1Pending] };
  const { rerender, wallet, envelope } = await renderOverview({ productAdapter: adapter });
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 1" }));
  rerender(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material}
    productAdapter={{ ...adapter, snapshot: { ...adapter.snapshot }, activities: [{ ...n1Pending, accountId: "demo-depositary" }] }} />);
  await act(async () => {});
  const fresh = document.querySelector('[data-product-activity-id="n1-old-pending"]');
  expect(fresh).toHaveAttribute("aria-expanded", "false");
  expect(fresh).not.toHaveFocus();
  expect(screen.queryByRole("button", { name: "Назад в обзор" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
  fireEvent.click(fresh!);
  expect(fresh).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toBeInTheDocument();
});

it("N1 cancels queued focus when working context changes with the same snapshot and ports", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const adapter: MonoProductAdapter = { ...MONO_PRODUCT_DEMO_ADAPTER,
    activities: [n1Pending, { ...n1Pending, id: "n1-vault-pending", accountId: "demo-depositary", accountLabel: "Хранилище" }] };
  let current!: MonoProductController;
  function Host() {
    current = useMonoProductController(adapter, { initialHidden: false });
    return <MonoScene snapshot={wallet} appearance={envelope.appearance} product={current} />;
  }
  render(<Host />);
  const sourceSnapshot = current.view.snapshot, sourcePorts = current.view.flowPorts;
  fireEvent.click(screen.getByRole("button", { name: "В процессе · 2" }));
  act(() => current.commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  const historyTab = screen.getByRole("button", { name: "История" });
  historyTab.focus();
  expect(current.view.snapshot).toBe(sourceSnapshot); expect(current.view.flowPorts).toBe(sourcePorts);
  expect(current.view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(screen.queryByRole("button", { name: "Назад в обзор" })).toBeNull();
  await act(async () => {});
  expect(historyTab).toHaveFocus();
  expect(screen.getByRole("button", { name: "Фильтр статуса" })).not.toHaveFocus();
});

it("opens the pinned group, inspects its account and returns focus to the same pin", async () => {
  await renderOverview();
  const pin = screen.getByRole("button", { name: "Открыть группу Депозитарные" });
  pin.focus(); fireEvent.click(pin);
  expect(screen.getByRole("heading", { name: "Депозитарные" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: /Открыть счёт: Основной/ })).toBeNull();
  const account = screen.getByRole("button", { name: /Открыть счёт: Хранилище/ });
  fireEvent.click(account);
  expect(screen.getByRole("heading", { name: "Хранилище" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам" }));
  expect(screen.getByRole("button", { name: /Открыть счёт: Хранилище/ })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Назад в кошелёк" }));
  expect(screen.getByRole("button", { name: "Открыть группу Депозитарные" })).toHaveFocus();
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
});

it("edits remembered home wallets in Menu, keeps unavailable types inert and leaves Accounts without an editor", async () => {
  await renderOverview();
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "На главной" }));
  const settings = screen.getByRole("group", { name: "На главной" });
  const custody = within(settings).getByRole("checkbox", { name: "Кастодиальные" });
  const depositary = within(settings).getByRole("checkbox", { name: "Депозитарные" });
  expect(custody).toBeChecked(); expect(depositary).toBeChecked();
  for (const name of ["Закрытый", "Фиатный"]) {
    const unavailable = within(settings).getByRole("checkbox", { name });
    expect(unavailable).toBeDisabled(); fireEvent.click(unavailable);
  }
  fireEvent.click(within(settings).getByRole("checkbox", { name: "Только общий баланс" }));
  expect(custody).toBeChecked(); expect(depositary).toBeChecked();
  expect(screen.queryByRole("group", { name: "Закреплённые группы счетов" })).toBeNull();
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
  fireEvent.click(within(settings).getByRole("checkbox", { name: "Только общий баланс" }));
  expect(screen.getAllByRole("button", { name: /Открыть группу/ })).toHaveLength(2);
  fireEvent.click(custody); fireEvent.click(depositary);
  expect(screen.queryByRole("group", { name: "Закреплённые группы счетов" })).toBeNull();
  expect(JSON.parse(localStorage.getItem(HOME_PINS_STORAGE_KEY)!)).toEqual({ version: 2, groups: [], totalOnly: false });
  fireEvent.click(screen.getByRole("button", { name: "Закрыть панель" }));
  expect(screen.getByRole("button", { name: "Меню" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Открыть группу Кастодиальные" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Открыть группу Депозитарные" })).toBeNull();
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Мои счета" }));
  expect(screen.queryByRole("group", { name: "На главной" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад в кошелёк" }));
  expect(screen.getByRole("region", { name: "Общий баланс" })).toHaveTextContent(/12\s?840,75/);
});

it("masks the total, pin descriptions and inspected account estimates together", async () => {
  await renderOverview();
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  const total = screen.getByRole("region", { name: "Общий баланс" });
  expect(total).toHaveTextContent("••••••");
  const pins = screen.getByRole("group", { name: "Закреплённые группы счетов" });
  expect(pins).not.toHaveTextContent(/12\s?840,75|0,00/);
  expect(screen.getByRole("button", { name: "Открыть группу Кастодиальные" })).toHaveAccessibleDescription("••••");
  fireEvent.click(screen.getByRole("button", { name: "Открыть группу Кастодиальные" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const accountValue = screen.getByRole("group", { name: "Оценка активов счёта в USD" });
  expect(accountValue).toHaveTextContent("••••");
  expect(accountValue).not.toHaveTextContent(/12\s?840,75/);
});

it("opens a global recent activity in History while preserving the working account for Assets", async () => {
  await renderOverview();
  const navigation = screen.getByRole("navigation", { name: "Разделы кошелька" });
  fireEvent.click(within(navigation).getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" })).getByRole("button", { name: /Хранилище/ }));
  fireEvent.click(within(navigation).getByRole("button", { name: "Обзор" }));
  const recent = screen.getByRole("region", { name: "Последняя операция" });
  const recentTrigger = within(recent).getByRole("button");
  const receiptName = recentTrigger.getAttribute("aria-label")!.replace("Открыть операцию: ", "");
  fireEvent.click(recentTrigger);
  expect(within(navigation).getByRole("button", { name: "История" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: receiptName })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: /Все счета/ })).toBeInTheDocument();
  fireEvent.click(within(navigation).getByRole("button", { name: "Активы" }));
  expect(screen.getByRole("button", { name: /Выбрать счёт: Хранилище/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Открыть актив/ })).toBeNull();
});
