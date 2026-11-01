import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "./mono-product-scene";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoScene, type MonoSection } from "./mono-scene";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../mono-product/demo-adapter";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "../mono-product/product-controller";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.hasAttribute("data-mono-product-context-trigger")) return new DOMRect(12, 88, 180, 48);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(300, 710, 68, 48);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 390, 68);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function renderCompact() {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  return render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material}
    viewport={390} homeComposition="compact" historyPresentation="compact" effectsDisabled />);
}

async function renderObservedCompact() {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  let controller!: MonoProductController;
  function Host({ blocked = false }: { blocked?: boolean }) {
    const [section, setSection] = useState<MonoSection>("overview");
    controller = useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false });
    const product = blocked ? { ...controller, commands: { ...controller.commands, requestContextChange: () => false } } : controller;
    return <MonoScene snapshot={snapshot} appearance={envelope.appearance} homeComposition="compact"
      historyPresentation="compact" product={product} effectsDisabled session={{ section, onSectionChange: setSection,
        period: "1D", onPeriodChange() {}, balanceHidden: controller.view.balanceHidden,
        onBalanceHiddenChange: controller.commands.setBalanceHidden }} />;
  }
  const view = render(<Host />);
  return { current: () => controller, block: () => view.rerender(<Host blocked />),
    unblock: () => view.rerender(<Host />) };
}

function chooseContext(triggerLabel: string, contextId: string) {
  fireEvent.click(screen.getByRole("button", { name: `Выбрать счёт: ${triggerLabel}` }));
  const dialog = screen.getByRole("dialog", { name: "Выбор счёта" });
  const choice = dialog.querySelector<HTMLButtonElement>(`[data-account-context="${contextId}"]`);
  expect(choice).not.toBeNull();
  fireEvent.click(choice!);
}

function inspectCustodialFromMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Меню" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Кастодиальный" }));
  expect(screen.getByRole("heading", { name: "Кастодиальный · Демо" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Выбрать счёт: Депозитарный" })).toBeInTheDocument();
}

it("applies an explicit aggregate choice made during account inspection to the returning Assets view", async () => {
  await renderCompact();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  chooseContext("Общий обзор", "demo-depositary");
  expect(screen.getByRole("heading", { name: "Активы счёта" })).toBeInTheDocument();
  inspectCustodialFromMenu();
  chooseContext("Депозитарный", "all");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Выбор счёта" })).toBeNull());
  expect(screen.getByRole("button", { name: "Выбрать счёт: Общий обзор" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Открыть актив.*BTC/i })).toBeInTheDocument();
});

it("keeps the previous Assets context when inspection is closed with Back", async () => {
  const view = await renderObservedCompact();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  chooseContext("Общий обзор", "demo-depositary");
  inspectCustodialFromMenu();
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам" }));
  fireEvent.click(screen.getByRole("button", { name: "Назад в кошелёк" }));
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(screen.getByRole("button", { name: "Выбрать счёт: Депозитарный" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Активы счёта" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Меню" })).toHaveFocus());
});

it("does not apply or partially display an aggregate choice when the context guard rejects it", async () => {
  const view = await renderObservedCompact();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  chooseContext("Общий обзор", "demo-depositary");
  inspectCustodialFromMenu();
  const route = resolveActionRoutes(MONO_PRODUCT_DEMO_ADAPTER.snapshot, { kind: "account", accountId: "demo-custody" }, "send")
    .routes.find(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")!;
  const draft = { route: { accountId: route.accountId, assetId: route.assetId, networkId: route.networkId },
    recipient: { address: "demo:kept" }, amount: "001," };
  act(() => view.current().commands.saveSendDraft(route, draft));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать счёт: Депозитарный" }));
  const dialog = screen.getByRole("dialog", { name: "Выбор счёта" });
  const aggregate = dialog.querySelector<HTMLButtonElement>('[data-account-context="all"]')!;
  const workspace = view.current().view.accountsWorkspace, sheet = view.current().view.sheet;
  view.block();
  fireEvent.click(aggregate);
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(view.current().view.accountsWorkspace).toBe(workspace);
  expect(view.current().view.sheet).toBe(sheet);
  expect(view.current().view.sendDrafts[sendDraftKey(route)]).toEqual(draft);
  expect(screen.getByRole("dialog", { name: "Выбор счёта" })).toBeInTheDocument();
  view.unblock();
  fireEvent.click(aggregate);
  expect(view.current().view.context).toEqual({ kind: "all" });
  expect(view.current().view.accountsWorkspace).toBeNull();
  expect(view.current().view.sendDrafts[sendDraftKey(route)]).toEqual(draft);
  expect(screen.getByRole("button", { name: "Выбрать счёт: Общий обзор" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
});

it("continues to apply a direct aggregate choice from the Assets root", async () => {
  await renderCompact();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  chooseContext("Общий обзор", "demo-depositary");
  chooseContext("Депозитарный", "all");
  expect(screen.getByRole("button", { name: "Выбрать счёт: Общий обзор" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
});

it("applies an explicit account choice made during inspection to the returning Assets view", async () => {
  const view = await renderObservedCompact();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  chooseContext("Общий обзор", "demo-depositary");
  inspectCustodialFromMenu();
  chooseContext("Депозитарный", "demo-custody");
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(view.current().view.accountsWorkspace).toBeNull();
  expect(screen.getByRole("button", { name: "Выбрать счёт: Кастодиальный" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Активы счёта" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Открыть актив.*BTC/i })).toBeInTheDocument();
});

it("applies an explicit account choice from an asset detail while preserving ordinary Back", async () => {
  const view = await renderObservedCompact();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Открыть актив.*USDC/i }));
  expect(view.current().view.assetWorkspace?.assetId).toBe("usdc");
  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  expect(view.current().view.context).toEqual({ kind: "all" });
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Открыть актив.*USDC/i }));
  chooseContext("Общий обзор", "demo-depositary");
  expect(view.current().view.assetWorkspace).toBeNull();
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(screen.getByRole("button", { name: "Выбрать счёт: Депозитарный" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Активы счёта" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Открыть актив.*BTC/i })).toBeNull();
});

it("keeps an asset detail and its context when the picker selection is guarded", async () => {
  const view = await renderObservedCompact();
  fireEvent.click(screen.getByRole("button", { name: "Активы" }));
  fireEvent.click(screen.getByRole("button", { name: /Открыть актив.*USDC/i }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать счёт: Общий обзор" }));
  const choice = screen.getByRole("dialog", { name: "Выбор счёта" })
    .querySelector<HTMLButtonElement>('[data-account-context="demo-depositary"]')!;
  const asset = view.current().view.assetWorkspace, sheet = view.current().view.sheet;
  view.block();
  fireEvent.click(choice);
  expect(view.current().view.assetWorkspace).toBe(asset);
  expect(view.current().view.sheet).toBe(sheet);
  expect(view.current().view.context).toEqual({ kind: "all" });
  expect(screen.getByRole("dialog", { name: "Выбор счёта" })).toBeInTheDocument();
  view.unblock();
  fireEvent.click(choice);
  expect(view.current().view.assetWorkspace).toBeNull();
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(screen.getByRole("button", { name: "Выбрать счёт: Депозитарный" })).toBeInTheDocument();
});
