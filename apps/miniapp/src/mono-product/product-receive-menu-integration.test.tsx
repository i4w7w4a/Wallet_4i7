import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { MonoQuickActionFeedback, MONO_QUICK_ACTION_DEFAULT } from "../mono-preview/mono-quick-action-feedback";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import { useMonoProductController } from "./product-controller";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function home() {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  return render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
}

it("opens a nonmodal receive menu, follows an exact external route, and restores draft/focus on Back and close", async () => {
  const { container } = await home();
  const page = container.querySelector<HTMLElement>("[data-mono-preview]")!;
  const trigger = screen.getByRole("button", { name: "Получить" });
  const originalBounds = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this === page ? new DOMRect(250, -100, 390, 1100)
      : this === trigger ? new DOMRect(390, 300, 60, 60) : originalBounds.call(this);
  });
  expect(trigger).toHaveAttribute("data-mono-product-receive-trigger");
  expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  trigger.focus(); fireEvent.click(trigger);
  const menu = screen.getByRole("dialog", { name: "Получить" });
  expect(menu).not.toHaveAttribute("aria-modal", "true");
  expect(container.querySelector("[data-product-sheet]")).toBeNull();
  expect(container.querySelector(".mono-scene")).not.toHaveAttribute("inert");
  expect(screen.getByRole("navigation", { name: "Разделы кошелька" })).not.toHaveAttribute("inert");
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  const route = () => within(screen.getByRole("dialog", { name: "Получить" }))
    .getByRole("button", { name: /(?=.*USDC)(?=.*Ethereum)(?=.*Основной)/ });
  fireEvent.click(route());
  const amount = await screen.findByRole("textbox", { name: /Желаемая сумма/ });
  const fullScreen = screen.getByRole("dialog", { name: "Получить" });
  expect(fullScreen).toHaveAttribute("aria-modal", "true");
  expect(fullScreen.closest("[data-product-receive-screen]")).not.toBeNull();
  expect(fullScreen.closest("[data-product-receive-screen]")).toHaveStyle({ left: "250px", top: "0px", width: "390px", height: `${window.innerHeight}px` });
  expect(container.querySelector(".mono-product-sheet__handle")).toBeNull();
  expect(container.querySelector(".mono-scene")).toHaveAttribute("inert");
  expect(trigger).not.toHaveFocus();
  fireEvent.change(amount, { target: { value: "012,50" } });
  fireEvent.click(screen.getByRole("button", { name: /Назад к выбору маршрута/ }));
  await waitFor(() => expect(route()).toHaveFocus());
  expect(trigger).not.toHaveFocus();
  fireEvent.keyDown(route(), { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger); fireEvent.click(route());
  expect(await screen.findByRole("textbox", { name: /Желаемая сумма/ })).toHaveValue("012,50");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Получить" })).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("keeps menu account switching local, toggles the trigger and lets another action replace it", async () => {
  await home();
  const trigger = screen.getByRole("button", { name: "Получить" });
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("dialog", { name: "Получить" })).getByRole("button", { name: "Хранилище" }));
  expect(screen.getByRole("button", { name: /Выбрать счёт: Все счета/ })).toBeInTheDocument();
  const route = within(screen.getByRole("dialog", { name: "Получить" }))
    .getByRole("button", { name: /(?=.*USDC)(?=.*Ethereum)(?=.*Хранилище)(?=.*Между счетами)/ });
  fireEvent.click(route);
  await screen.findByRole("textbox", { name: "Сумма пополнения" });
  fireEvent.click(screen.getByRole("button", { name: /Назад к выбору маршрута/ }));
  expect(within(screen.getByRole("dialog", { name: "Получить" })).getByRole("button", { name: "Хранилище" }))
    .toHaveAttribute("aria-pressed", "true");
  fireEvent.click(trigger);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(trigger);
  const send = screen.getByRole("button", { name: "Отправить" });
  fireEvent.pointerDown(send); fireEvent.click(send);
  expect(screen.queryByRole("dialog", { name: "Получить" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Отправить" })).toBeVisible();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("keeps an exact placement direct and returns Back to the same placement", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openAsset("usdc"));
  act(() => result.current.commands.selectAssetHolding("demo-usdc-sol"));
  act(() => result.current.commands.openPlacementAction("demo-usdc-sol", "receive"));
  const sheet = result.current.view.sheet;
  expect(sheet).toMatchObject({ kind: "intent", placementId: "demo-usdc-sol", route: { assetId: "usdc", networkId: "solana" } });
  if (sheet?.kind !== "intent" || !sheet.route) throw new Error("Expected direct placement route");
  act(() => result.current.commands.backToRoutes(sheet.route!));
  expect(result.current.view.sheet).toBeNull();
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: "demo-usdc-sol" });
  expect(result.current.view.context).toEqual({ kind: "all" });
});

it("does not mark laboratory quick actions as real product receive triggers", () => {
  render(<MonoQuickActionFeedback label="Получить" path="M0 0" preset={MONO_QUICK_ACTION_DEFAULT} onActivate={vi.fn()} />);
  const action = screen.getByRole("button", { name: /Получить/ });
  expect(action).not.toHaveAttribute("data-mono-product-receive-trigger");
  expect(action).not.toHaveAttribute("aria-haspopup");
  expect(action).not.toHaveAttribute("aria-expanded");
});
