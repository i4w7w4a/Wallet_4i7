import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { MONO_GOLD_ENVELOPE } from "./mono-gold-appearance";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../mono-product/demo-adapter";
import type { ProductActivity } from "../mono-product/demo-activity";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "../mono-product/product-controller";

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

const completed: ProductActivity = {
  id: "gold-completed", accountId: "demo-custody", accountLabel: "Основной", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "incoming", status: "completed", quantity: "31.456789",
  feeLabel: "0.004321 ETH", occurredAt: "2026-10-03T09:00:00Z",
};
const pending: ProductActivity = { ...completed, id: "gold-pending", direction: "outgoing", status: "pending",
  occurredAt: "2026-10-02T09:00:00Z" };
const foreign: ProductActivity = { ...pending, id: "gold-vault-pending", accountId: "demo-depositary", accountLabel: "Хранилище" };

function rowIds(container: HTMLElement = document.body) {
  return [...container.querySelectorAll<HTMLElement>("[data-product-activity-id]")].map(element => element.dataset.productActivityId);
}
function history() { return screen.getByRole("region", { name: "История операций" }); }
function navigate(name: string) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name }));
}

it("opts real Gold History and embedded asset History in while ordinary MONO keeps per-row details", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [completed, pending] };
  const view = render(<MonoProductScene presentation="gold" themePreference="fixed" snapshot={snapshot}
    appearance={MONO_GOLD_ENVELOPE.appearance} material={MONO_GOLD_ENVELOPE.material} productAdapter={adapter} effectsDisabled />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  navigate("История");
  expect(within(history()).getByRole("heading", { name: "3 октября 2026 г." })).toBeVisible();
  expect(history().querySelector("[data-product-activity-id='gold-completed']")).not.toHaveTextContent("Выполнено");
  navigate("Активы");
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" }));
  expect(within(history()).getByRole("heading", { name: "3 октября 2026 г." })).toBeVisible();
  expect(rowIds(history())).toEqual([completed.id, pending.id]);
  expect(history().querySelector("[data-product-activity-id='gold-completed'] time")).toBeNull();
  view.unmount();

  const mono = render(<MonoProductScene snapshot={snapshot} appearance={MONO_GOLD_ENVELOPE.appearance}
    material={MONO_GOLD_ENVELOPE.material} productAdapter={adapter} effectsDisabled />);
  await waitFor(() => expect(mono.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  navigate("История");
  expect(within(history()).queryByRole("heading", { name: "3 октября 2026 г." })).toBeNull();
  expect(history().querySelector("[data-product-activity-id='gold-completed'] time")).toHaveTextContent("3 окт.");
  expect(history().querySelector("[data-product-activity-id='gold-completed']")).toHaveTextContent("Выполнено");
});

it.each([1, 2])("keeps Gold pending-%i entry exact, grouped and private, with working context, draft and home return focus", async count => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities: count === 1 ? [completed, pending] : [completed, pending, foreign] };
  let controller!: MonoProductController;
  function Host() {
    const [section, setSection] = useState<MonoSection>("overview");
    controller = useMonoProductController(adapter, { initialHidden: true });
    return <div data-material-scrollport><MonoScene presentation="gold" snapshot={snapshot}
      appearance={MONO_GOLD_ENVELOPE.appearance} product={controller} effectsDisabled session={{ section, onSectionChange: setSection,
        period: "1D", onPeriodChange() {}, balanceHidden: controller.view.balanceHidden,
        onBalanceHiddenChange: controller.commands.setBalanceHidden }} /></div>;
  }
  const view = render(<Host />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  const route = resolveActionRoutes(adapter.snapshot, { kind: "account", accountId: "demo-custody" }, "send").routes
    .find(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")!;
  act(() => controller.commands.saveSendDraft(route, {
    route: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum" },
    recipient: { address: "demo:kept" }, amount: "001,",
  }));
  const context = controller.view.context;
  const draftKey = sendDraftKey(route);
  const drafts = controller.view.sendDrafts;
  const draft = drafts[draftKey];
  expect(draft.amount).toBe("001,");
  fireEvent.click(screen.getByRole("button", { name: `В процессе · ${count}` }));
  expect(within(history()).getByRole("heading", { name: "2 октября 2026 г." })).toBeVisible();
  expect(rowIds(history())).toEqual(count === 1 ? [pending.id] : [pending.id, foreign.id]);
  expect(screen.queryByRole("region", { name: "Квитанция операции" }) !== null).toBe(count === 1);
  expect(view.container.innerHTML).not.toMatch(/31[.,]456789|0[.,]004321/);
  expect(controller.view.context).toBe(context);
  expect(controller.view.sendDrafts).toBe(drafts);
  expect(controller.view.sendDrafts[draftKey]).toBe(draft);
  expect(controller.view.balanceHidden).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
  await waitFor(() => expect(screen.getByRole("button", { name: `В процессе · ${count}` })).toHaveFocus());
});

it("uses grouped Gold account-pending History and returns to the same account, scroll and live focus target", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, activities: [completed, pending, foreign] };
  const view = render(<div data-material-scrollport><MonoProductScene presentation="gold" themePreference="fixed" snapshot={snapshot}
    appearance={MONO_GOLD_ENVELOPE.appearance} material={MONO_GOLD_ENVELOPE.material} productAdapter={adapter} effectsDisabled /></div>);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  const account = screen.getByRole("region", { name: "Основной" });
  const scrollport = view.container.querySelector<HTMLElement>("[data-material-scrollport]")!;
  scrollport.scrollTop = 123;
  fireEvent.click(within(account).getByRole("button", { name: "В процессе · 1" }));
  expect(within(history()).getByRole("heading", { name: "2 октября 2026 г." })).toBeVisible();
  expect(rowIds(history())).toEqual([pending.id]);
  expect(screen.getByRole("region", { name: "Квитанция операции" })).toHaveTextContent("31,456789 USDC");
  fireEvent.click(screen.getByRole("button", { name: "К счёту" }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Основной" }))
    .getByRole("button", { name: "В процессе · 1" })).toHaveFocus());
  expect(scrollport.scrollTop).toBe(123);
});
