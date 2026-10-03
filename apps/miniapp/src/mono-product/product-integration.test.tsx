import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, resolveActionRoutes } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { useMonoProductController } from "./product-controller";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});

it("opens the scoped recent activity in history without changing the selected account", async () => {
  await home();
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" })).getByRole("button", { name: /Основной/ }));
  fireEvent.click(screen.getByRole("button", { name: /Открыть операцию:/ }));
  expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Выбрать счёт: Основной/ })).toBeInTheDocument();
  expect(screen.getAllByRole("button").some(button => button.getAttribute("aria-expanded") === "true")).toBe(true);
});

it("does not invent a percentage from known remaining transfers", async () => {
  const { wallet, envelope, rerender } = await home();
  rerender(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material}
    productAdapter={{ kind: "demo", snapshot: MULTI_ACCOUNT_DEMO }} />);
  const battery = screen.getByRole("button", { name: /Батарейка:.*Нет данных/ });
  expect(battery).toHaveAttribute("data-charge-state", "unknown");
  fireEvent.click(battery);
  expect(screen.getByRole("dialog", { name: "Батарейка" })).toHaveTextContent("Нет данных");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function home() {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const result = render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material} />);
  return { ...result, wallet, envelope };
}
function choose(action: "Получить" | "Отправить", route: RegExp) {
  const trigger = screen.getByRole("button", { name: action });
  trigger.focus();
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("dialog", { name: action })).getByRole("button", { name: route }));
  return trigger;
}

it("integrates external receive, preserves privacy and returns to the selected chooser route", async () => {
  const { rerender, wallet, envelope } = await home();
  const trigger = choose("Получить", /USDC · Ethereum.*Основной.*Внешний адрес/);
  await screen.findByText(/^DEMO-NON-PAYABLE:/);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  rerender(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material}
    session={{ balanceHidden: true, onBalanceHiddenChange() {}, period: "1D", onPeriodChange() {} }} />);
  expect(screen.queryByText(/^DEMO-NON-PAYABLE:/)).toBeNull();
  expect(screen.getByRole("button", { name: "Копировать демо-реквизиты" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Назад к выбору маршрута/ }));
  const selected = within(screen.getByRole("dialog", { name: "Получить" }))
    .getByRole("button", { name: /USDC · Ethereum.*Основной.*Внешний адрес/ });
  expect(selected).toHaveFocus();
  fireEvent.keyDown(selected, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("finishes the explicitly bound internal receive demo in the selected account", async () => {
  await home();
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Выбор счёта" }))
    .getByRole("button", { name: /Хранилище/ }));
  choose("Получить", /USDC · Ethereum.*Хранилище/);
  fireEvent.click(await screen.findByRole("radio", { name: /Основной/ }));
  fireEvent.click(screen.getByRole("button", { name: "Проверить маршрут" }));
  expect(screen.getByRole("heading", { name: "Маршрут пополнения" })).toBeInTheDocument();
  expect(screen.queryByText(/^DEMO-NON-PAYABLE:/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Готово" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: /Выбрать счёт: Хранилище/ })).toBeInTheDocument();
});

it("keeps the send draft across appearance changes and signals battery use only during pending", async () => {
  const { rerender, wallet, envelope, container } = await home();
  const trigger = choose("Отправить", /USDC · Ethereum.*Основной/);
  const recipient = await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.change(recipient, { target: { value: "demo:recipient" } });
  const frost = createMonoAppearanceEnvelope("frost");
  rerender(<MonoProductScene snapshot={wallet} appearance={frost.appearance} material={envelope.material} />);
  expect(screen.getByRole("textbox", { name: "Получатель" })).toHaveValue("demo:recipient");
  fireEvent.click(screen.getByRole("button", { name: "О валюте USDC в сети Ethereum" }));
  const content = container.querySelector<HTMLElement>("[data-product-flow-content]")!;
  expect(content).toHaveAttribute("hidden");
  expect(content).toHaveAttribute("inert");
  expect(recipient).toBeInTheDocument();
  fireEvent.keyDown(content.parentElement!, { key: "Escape" });
  expect(screen.getByRole("textbox", { name: "Получатель" })).toHaveValue("demo:recipient");
  expect(screen.getByRole("button", { name: "О валюте USDC в сети Ethereum" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  const amount = await screen.findByLabelText(/Сумма.*USDC/);
  fireEvent.change(amount, { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  const battery = container.querySelector("[data-mono-product-battery-trigger]")!;
  expect(battery).toHaveAttribute("data-battery-activity", "idle");
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить симуляцию" }));
  await waitFor(() => expect(battery).toHaveAttribute("data-battery-activity", "using"));
  fireEvent.click(screen.getByRole("button", { name: "О валюте USDC в сети Ethereum" }));
  expect(content).toHaveAttribute("hidden");
  await waitFor(() => expect(battery).toHaveAttribute("data-battery-activity", "idle"));
  fireEvent.keyDown(content.parentElement!, { key: "Escape" });
  expect(screen.getByRole("heading", { name: "Симуляция завершена" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Готово" }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("keeps the activity callback stable and clears operation activity on route change and close", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  const handler = result.current.commands.setBatteryActivity;
  const route = resolveActionRoutes(MULTI_ACCOUNT_DEMO, { kind: "all" }, "send").routes[0]!;
  act(() => { result.current.commands.openIntent("send"); result.current.commands.selectRoute(route); });
  act(() => handler({ poolId: "demo-ethereum-transfer-pool", phase: "using" }));
  expect(result.current.commands.setBatteryActivity).toBe(handler);
  expect(result.current.view.batteryActivity?.phase).toBe("using");
  act(() => result.current.commands.backToRoutes(route));
  expect(result.current.view.batteryActivity).toBeNull();
  act(() => handler({ poolId: "demo-ethereum-transfer-pool", phase: "using" }));
  act(() => result.current.commands.closeSheet());
  expect(result.current.view.batteryActivity).toBeNull();
});

it.each([320, 390, 480])("keeps the battery popover anchored inside a %ipx scene and closes without scrolling", async width => {
  const { container } = await home();
  const page = container.querySelector<HTMLElement>("[data-mono-preview]")!;
  const trigger = screen.getByRole("button", { name: /Батарейка:/ });
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    if (this === page) return new DOMRect(400, 0, width, 800);
    if (this === trigger) return new DOMRect(400 + width - 70, 180, 50, 48);
    return original.call(this);
  });
  page.scrollTop = 140;
  trigger.focus();
  const focus = vi.spyOn(trigger, "focus");
  fireEvent.click(trigger);
  const popover = screen.getByRole("dialog", { name: "Батарейка" });
  expect(popover).toHaveAttribute("data-battery-popover");
  expect(popover.closest("[data-product-sheet]")).toBeNull();
  expect(container.querySelector(".mono-scene")).not.toHaveAttribute("inert");
  const left = Number.parseFloat(popover.style.left), panelWidth = Number.parseFloat(popover.style.width);
  expect(left).toBeGreaterThanOrEqual(8);
  expect(left + panelWidth).toBeLessThanOrEqual(width - 8);
  expect(Number.parseFloat(popover.style.top)).toBeGreaterThan(228);
  expect(popover).toHaveTextContent("3 перевода");
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("dialog", { name: "Батарейка" })).toBeNull();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(page.scrollTop).toBe(140);
});

it("retains the popover for its finite exit and returns keyboard focus immediately", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const { container } = await home();
  const trigger = screen.getByRole("button", { name: /Батарейка:/ });
  trigger.focus();
  fireEvent.click(trigger);
  const panel = screen.getByRole("dialog", { name: "Батарейка" });
  fireEvent.keyDown(panel, { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(container.querySelector("[data-battery-popover]")).toHaveAttribute("data-state", "closing");
  await waitFor(() => expect(container.querySelector("[data-battery-popover]")).toBeNull());
});
