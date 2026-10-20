import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import preset2 from "../../../../checkpoints/mono-published/2026-10-17/slot-2.appearance.json";
import { normalizeMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoScene, type MonoSection } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../mono-product/demo-adapter";
import type { ProductActivity } from "../mono-product/demo-activity";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "../mono-product/product-controller";

const preset = normalizeMonoAppearanceEnvelope(preset2);
const completed: ProductActivity = {
  id: "compact-completed", accountId: "demo-custody", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "incoming", status: "completed", quantity: "31.456789",
  feeLabel: "0.004321 ETH", occurredAt: "2026-10-03T09:00:00Z",
};
const pending: ProductActivity = { ...completed, id: "compact-pending", direction: "outgoing", status: "pending",
  occurredAt: "2026-10-02T09:00:00Z" };
const foreign: ProductActivity = { ...pending, id: "compact-vault", accountId: "demo-depositary", accountLabel: "Хранилище" };

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 390, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(300, 710, 68, 48);
    if (this.hasAttribute("data-history-status-trigger")) return new DOMRect(280, 170, 44, 44);
    if (this.hasAttribute("data-history-status-filter")) return new DOMRect(180, 170, 144, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function renderCompact(activities: readonly ProductActivity[] = [completed, pending], hidden = false) {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities };
  let controller!: MonoProductController;
  function Host() {
    const [section, setSection] = useState<MonoSection>("overview");
    controller = useMonoProductController(adapter, { initialHidden: hidden });
    return <div data-material-scrollport><MonoScene snapshot={snapshot} appearance={preset.appearance}
      homeComposition="compact" historyPresentation="compact" product={controller} effectsDisabled
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: controller.view.balanceHidden, onBalanceHiddenChange: controller.commands.setBalanceHidden }} /></div>;
  }
  const result = render(<Host />);
  await waitFor(() => expect(result.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  return { ...result, current: () => controller };
}
function navigate(name: string) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name }));
}
function history() { return screen.getByRole("region", { name: "История операций" }); }
function rowIds() {
  return [...history().querySelectorAll<HTMLElement>("[data-product-activity-id]")].map(element => element.dataset.productActivityId);
}

// A missing compact branch must expose the legacy Home content and fail this test.
it("opts preset 2 into a single neutral balance, four actions and Funds without exposing saved Home extras", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const before = JSON.stringify(preset);
  const view = render(<MonoProductScene snapshot={snapshot} appearance={preset.appearance} material={preset.material}
    homeComposition="compact" historyPresentation="compact" effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Мои средства" })).toBeVisible();
  expect(screen.getAllByRole("region", { name: "Общий баланс" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Скрыть баланс" })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Действия" })).getAllByRole("button")).toHaveLength(4);
  expect(view.container.querySelector(".mono-actions")).toHaveAttribute("data-frame-mode", "group");
  expect([...view.container.querySelectorAll("[data-artwork-pack]")].map(element => element.getAttribute("data-artwork-pack")))
    .toEqual(["original", "original", "original", "original"]);
  expect(screen.queryByRole("group", { name: "Закреплённые группы счетов" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Последняя операция" })).toBeNull();
  expect(screen.queryByRole("region", { name: "График баланса" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Подробнее/ })).toBeNull();
  expect(view.container.querySelector(".mono-promo-frame, .mono-product-funds__list, [data-mono-gold-account-deck]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  expect(within(screen.getByRole("dialog", { name: "Меню" })).queryByRole("button", { name: "На главной" })).toBeNull();
  expect(JSON.stringify(preset)).toBe(before);
});

// Replacing the display scope with selectContext would discard this exact working context.
it("opens existing Assets ALL and restores the Funds focus while preserving working account and drafts", async () => {
  const view = await renderCompact();
  act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  const route = resolveActionRoutes(MONO_PRODUCT_DEMO_ADAPTER.snapshot, { kind: "account", accountId: "demo-custody" }, "send")
    .routes.find(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")!;
  act(() => view.current().commands.saveSendDraft(route, {
    route: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum" }, recipient: { address: "demo:kept" }, amount: "001,",
  }));
  const context = view.current().view.context, drafts = view.current().view.sendDrafts;
  const draft = drafts[sendDraftKey(route)];
  fireEvent.click(screen.getByRole("button", { name: "Мои средства" }));
  expect(screen.getByRole("button", { name: "Выбрать счёт: Все счета" })).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Назад в обзор" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" }));
  expect(view.current().view.assetWorkspace?.scope).toEqual({ kind: "all" });
  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Мои средства" })).toHaveFocus());
  expect(view.current().view.context).toBe(context);
  expect(view.current().view.sendDrafts).toBe(drafts);
  expect(view.current().view.sendDrafts[sendDraftKey(route)]).toBe(draft);
});

it.each([1, 2])("opens %i ALL pending records in grouped History with private receipts and exact Home return", async count => {
  const view = await renderCompact(count === 1 ? [completed, pending] : [completed, pending, foreign], true);
  act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  const context = view.current().view.context;
  fireEvent.click(screen.getByRole("button", { name: `В процессе · ${count}` }));
  expect(within(history()).getByRole("heading", { name: "2 октября 2026 г." })).toBeVisible();
  expect(rowIds()).toEqual(count === 1 ? [pending.id] : [pending.id, foreign.id]);
  expect(screen.queryByRole("region", { name: "Квитанция операции" }) !== null).toBe(count === 1);
  expect(view.container.innerHTML).not.toMatch(/31[.,]456789|0[.,]004321/);
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: `В процессе · ${count}` })).toHaveFocus());
  expect(view.current().view.context).toBe(context);
});

it("keeps account inspection and its pending receipt return on the same account and scroll position", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<div data-material-scrollport><MonoProductScene snapshot={snapshot} appearance={preset.appearance}
    material={preset.material} productAdapter={{ ...MONO_PRODUCT_DEMO_ADAPTER, activities: [completed, pending, foreign] }}
    homeComposition="compact" historyPresentation="compact" effectsDisabled /></div>);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const scrollport = view.container.querySelector<HTMLElement>("[data-material-scrollport]")!;
  scrollport.scrollTop = 123;
  fireEvent.click(within(screen.getByRole("region", { name: "Основной" })).getByRole("button", { name: "В процессе · 1" }));
  expect(within(history()).getByRole("heading", { name: "2 октября 2026 г." })).toBeVisible();
  expect(rowIds()).toEqual([pending.id]);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toHaveTextContent("31,456789 USDC");
  fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Основной" }))
    .getByRole("button", { name: "В процессе · 1" })).toHaveFocus());
  expect(scrollport.scrollTop).toBe(123);
});

it("leaves ordinary preset 2 Home and History on their legacy composition", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const view = render(<MonoProductScene snapshot={snapshot} appearance={preset.appearance} material={preset.material}
    productAdapter={{ ...MONO_PRODUCT_DEMO_ADAPTER, activities: [completed, pending] }} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Мои средства" })).toBeNull();
  expect(view.container.querySelector(".mono-promo-frame")).toBeInTheDocument();
  navigate("История");
  expect(within(history()).queryByRole("heading", { name: "3 октября 2026 г." })).toBeNull();
  expect(history().querySelector("[data-product-activity-id='compact-completed'] time")).toHaveTextContent("3 окт.");
});
