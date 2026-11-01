import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "./mono-scene";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../mono-product/demo-adapter";
import { useMonoProductController } from "../mono-product/product-controller";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as { animate?: unknown }).animate; });

async function motionHost({ reduced = false, effectsDisabled = false, productSnapshot = MONO_PRODUCT_DEMO_ADAPTER.snapshot } = {}) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduced-motion"), media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", undefined);
  const targets: HTMLElement[] = [];
  const animations: Animation[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (this: HTMLElement) {
    targets.push(this);
    const animation = { cancel: vi.fn(), onfinish: null, oncancel: null } as unknown as Animation;
    animations.push(animation);
    return animation;
  } });
  const snapshot = await new MockWalletRepository().getSnapshot();
  const appearance = createMonoAppearanceEnvelope("ledger").appearance;
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, snapshot: productSnapshot };
  function Host({ disabled = effectsDisabled }: { disabled?: boolean }) {
    const [section, setSection] = useState<MonoSection>("overview");
    const product = useMonoProductController(adapter, { initialHidden: false });
    return <div data-material-scrollport><MonoScene snapshot={snapshot} appearance={appearance} product={product}
      homeComposition="compact" historyPresentation="compact" assetsPresentation="wallet-selection" effectsDisabled={disabled}
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: product.view.balanceHidden, onBalanceHiddenChange: product.commands.setBalanceHidden }} /></div>;
  }
  const view = render(<Host />);
  const page = view.container.querySelector<HTMLElement>("[data-mono-preview]")!;
  await waitFor(() => expect(page).toHaveAttribute("data-mono-motion", reduced || effectsDisabled ? "static" : "ready"));
  return { ...view, page, targets, animations, setDisabled: (disabled: boolean) => view.rerender(<Host disabled={disabled} />) };
}

function openAssets() {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Активы" }));
}

it("moves only the current R1 account and Receive content, preserving the route and Back focus", async () => {
  const view = await motionHost();
  const { targets } = view;
  openAssets();
  targets.length = 0;
  const card = view.container.querySelector<HTMLButtonElement>("[data-r1-wallet-kind='custodial']")!;
  fireEvent.click(card);
  const workspace = view.container.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]")!;
  expect(workspace).toHaveAttribute("data-mono-product-accounts-workspace", "demo-custody");
  expect(targets).toContain(workspace);
  targets.length = 0;
  fireEvent.click(within(workspace).getByRole("button", { name: "Получить" }));
  expect(within(workspace).getByRole("button", { name: "Подготовить получение USDC · Кастодиальный · Ethereum · Внешнее получение" })).toBeVisible();
  expect(targets).not.toContain(workspace);
  fireEvent.click(await screen.findByRole("button", { name: "Подготовить получение USDC · Кастодиальный · Ethereum · Внешнее получение" }));
  const dialog = await screen.findByRole("dialog", { name: "Получить" });
  expect(dialog.parentElement?.className).toContain("r1Receive");
  expect(targets.some(target => dialog.contains(target))).toBe(true);
  expect(view.container.querySelectorAll("[data-mono-product-accounts-workspace]")).toHaveLength(1);
  expect(targets.some(target => target.matches(".mono-app-header, nav"))).toBe(false);
  targets.length = 0;
  fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(within(workspace).getByRole("button", { name: "Получить" })).toHaveFocus());
  expect(targets).toContain(workspace);
  targets.length = 0;
  fireEvent.click(within(workspace).getByRole("button", { name: /^Назад/ }));
  await waitFor(() => expect(view.container.querySelector("[data-r1-wallet-kind='custodial']")).toHaveFocus());
  expect(targets).toEqual([view.container.querySelector("[data-r1-wallet-kind='custodial']")]);
});

it("cancels an open Receive entry when effects turn off and does not replay when restored", async () => {
  const view = await motionHost();
  openAssets();
  fireEvent.click(view.container.querySelector<HTMLButtonElement>("[data-r1-wallet-kind='custodial']")!);
  const workspace = view.container.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]")!;
  fireEvent.click(within(workspace).getByRole("button", { name: "Получить" }));
  fireEvent.click(within(workspace).getByRole("button", { name: "Подготовить получение USDC · Кастодиальный · Ethereum · Внешнее получение" }));
  const dialog = await screen.findByRole("dialog", { name: "Получить" });
  expect(dialog.closest("[data-r1-receive-motion]")).toBeInTheDocument();
  const running = view.animations.slice(-2);
  expect(running).toHaveLength(2);
  view.setDisabled(true);
  expect(running.every(animation => vi.mocked(animation.cancel).mock.calls.length > 0)).toBe(true);
  view.targets.length = 0;
  view.setDisabled(false);
  await waitFor(() => expect(view.page).toHaveAttribute("data-mono-motion", "ready"));
  expect(view.targets).toHaveLength(0);
  expect(dialog).toBeVisible();
});

it("does not add the linked transition to depositary or replay it on return", async () => {
  const view = await motionHost();
  openAssets();
  view.targets.length = 0;
  fireEvent.click(view.container.querySelector<HTMLButtonElement>("[data-r1-wallet-kind='depositary']")!);
  const workspace = view.container.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]")!;
  expect(workspace).toBeVisible();
  expect(view.targets).not.toContain(workspace);
  fireEvent.click(within(workspace).getByRole("button", { name: /^Назад/ }));
  await waitFor(() => expect(view.container.querySelector("[data-r1-wallet-kind='depositary']")).toHaveFocus());
  expect(view.targets).toHaveLength(0);
});

it("animates an explicit custody chooser and the chosen account without changing identity", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const first = source.accounts.find(account => account.id === "demo-custody")!;
  const view = await motionHost({ productSnapshot: { ...source, accounts: [...source.accounts,
    { ...first, id: "second-custody", label: "Второй кастодиальный" }] } });
  openAssets();
  view.targets.length = 0;
  fireEvent.click(view.container.querySelector<HTMLButtonElement>("[data-r1-wallet-kind='custodial']")!);
  let workspace = view.container.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]")!;
  expect(workspace).toHaveAttribute("data-mono-product-accounts-workspace", "list");
  expect(view.targets).toContain(workspace);
  expect(within(workspace).getByRole("heading", { name: "Кошельки" }).closest("header"))
    .toHaveAttribute("data-r1-linked-identity");
  view.targets.length = 0;
  fireEvent.click(within(workspace).getByRole("button", { name: "Открыть счёт: Второй кастодиальный" }));
  workspace = view.container.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]")!;
  expect(workspace).toHaveAttribute("data-mono-product-accounts-workspace", "second-custody");
  expect(view.targets).toContain(workspace);
  fireEvent.click(within(workspace).getByRole("button", { name: /^Назад/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Открыть счёт: Второй кастодиальный" })).toHaveFocus());
  const identity = screen.getByRole("heading", { name: "Кошельки" }).closest("header")!;
  expect(identity).toHaveAttribute("data-r1-linked-identity");
  view.setDisabled(true);
  view.setDisabled(false);
  expect(identity).toHaveAttribute("data-r1-linked-identity");
});

it.each([{ reduced: true }, { effectsDisabled: true }])("keeps R1 and Receive static when motion is disabled: %o", async preferences => {
  const view = await motionHost(preferences);
  openAssets();
  view.targets.length = 0;
  fireEvent.click(view.container.querySelector<HTMLButtonElement>("[data-r1-wallet-kind='custodial']")!);
  const workspace = view.container.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]")!;
  fireEvent.click(within(workspace).getByRole("button", { name: "Получить" }));
  fireEvent.click(within(workspace).getByRole("button", { name: "Подготовить получение USDC · Кастодиальный · Ethereum · Внешнее получение" }));
  const dialog = await screen.findByRole("dialog", { name: "Получить" });
  expect(dialog.parentElement?.className).toContain("r1Receive");
  fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
  expect(view.targets).toHaveLength(0);
  if (preferences.effectsDisabled) {
    view.setDisabled(false);
    await waitFor(() => expect(view.page).toHaveAttribute("data-mono-motion", "ready"));
    expect(view.targets).toHaveLength(0);
  }
});
