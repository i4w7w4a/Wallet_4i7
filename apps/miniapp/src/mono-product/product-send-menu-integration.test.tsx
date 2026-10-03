import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, type ProductActionRoute } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { MonoQuickActionFeedback, MONO_QUICK_ACTION_DEFAULT } from "../mono-preview/mono-quick-action-feedback";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import { productRouteKey, useMonoProductController } from "./product-controller";
import { ProductOverlay } from "./product-sheet";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(80, 0, 390, 1000);
    if (this.hasAttribute("data-mono-product-send-trigger")) return new DOMRect(115, 250, 56, 56);
    if (this.hasAttribute("data-mono-product-receive-trigger")) return new DOMRect(205, 250, 56, 56);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function home(productAdapter = MONO_PRODUCT_DEMO_ADAPTER) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  return render(<MonoProductScene snapshot={wallet} appearance={envelope.appearance} material={envelope.material}
    productAdapter={productAdapter} />);
}
function sendMenu() { return screen.getByRole("dialog", { name: "Отправить" }); }
function routeButton(network = "Ethereum") {
  return within(sendMenu()).getByRole("button", { name: new RegExp(`(?=.*USDC)(?=.*${network})(?=.*Основной)`) });
}
function singleRouteAdapter(): MonoProductAdapter {
  const snapshot = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const source = snapshot.accounts.find(account => account.id === "demo-custody")!;
  return { kind: "demo", snapshot: { ...snapshot, accounts: [{ ...source,
    capabilities: source.capabilities.filter(capability => capability.action === "send" && capability.assetId === "usdc" && capability.networkId === "ethereum"),
  }], holdings: snapshot.holdings.filter(holding => holding.accountId === source.id && holding.assetId === "usdc" && holding.networkId === "ethereum") } };
}

it("opens a compact nonmodal Send menu, preserves the working form and draft through details, Back and close", async () => {
  const { container } = await home();
  const trigger = screen.getByRole("button", { name: "Отправить" });
  expect(trigger).toHaveAttribute("data-mono-product-send-trigger");
  expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(trigger);
  expect(sendMenu()).toHaveAttribute("data-send-menu");
  expect(sendMenu()).not.toHaveAttribute("aria-modal", "true");
  expect(sendMenu()).toHaveStyle({ width: "260px" });
  expect(container.querySelector("[data-product-sheet]")).toBeNull();
  expect(container.querySelector(".mono-scene")).not.toHaveAttribute("inert");
  expect(screen.getByRole("navigation", { name: "Разделы кошелька" })).not.toHaveAttribute("inert");
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(within(sendMenu()).queryByText("Извне")).toBeNull();
  expect(routeButton().querySelector("img")).toHaveAttribute("src", "/media/currency-logos/usdc.svg");
  fireEvent.click(routeButton());
  const recipient = await screen.findByRole("textbox", { name: "Получатель" });
  expect(sendMenu()).toHaveAttribute("aria-modal", "true");
  expect(container.querySelector(".mono-product-sheet__handle")).toBeNull();
  expect(container.querySelector("[data-product-receive-screen]")).toBeNull();
  expect(container.querySelector(".mono-scene")).toHaveAttribute("inert");
  expect(within(sendMenu()).getAllByRole("button", { name: "Закрыть" })).toHaveLength(1);
  expect(trigger).not.toHaveFocus();
  fireEvent.change(recipient, { target: { value: "demo:recipient" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  const amount = await screen.findByRole("textbox", { name: "Сумма, USDC" });
  fireEvent.change(amount, { target: { value: "12,50" } });
  fireEvent.click(screen.getByRole("button", { name: "О валюте USDC в сети Ethereum" }));
  fireEvent.keyDown(container.querySelector<HTMLElement>("[data-product-asset-content]")!, { key: "Escape" });
  expect(screen.getByRole("textbox", { name: "Сумма, USDC" })).toHaveValue("12,50");
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(screen.getByRole("textbox", { name: "Получатель" })).toHaveValue("demo:recipient");
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  await waitFor(() => expect(routeButton()).toHaveFocus());
  expect(trigger).not.toHaveFocus();
  fireEvent.click(routeButton());
  expect(await screen.findByRole("textbox", { name: "Получатель" })).toHaveValue("demo:recipient");
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByRole("textbox", { name: "Сумма, USDC" })).toHaveValue("12,50");
  fireEvent.click(within(sendMenu()).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("keeps the home chooser even with one allowed route and returns Back to that exact route", async () => {
  await home(singleRouteAdapter());
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  expect(sendMenu()).not.toHaveAttribute("aria-modal", "true");
  expect(sendMenu().querySelectorAll("[data-product-route-key]")).toHaveLength(1);
  fireEvent.click(routeButton());
  await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  await waitFor(() => expect(routeButton()).toHaveFocus());
});

it("has one compact overlay when switching Send/Receive and closes on retrigger, outside, Escape and close", async () => {
  await home();
  const send = screen.getByRole("button", { name: "Отправить" });
  const receive = screen.getByRole("button", { name: "Получить" });
  fireEvent.click(send);
  fireEvent.pointerDown(receive); fireEvent.click(receive);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog", { name: "Получить" })).not.toHaveAttribute("aria-modal", "true");
  expect(send).toHaveAttribute("aria-expanded", "false");
  fireEvent.pointerDown(send); fireEvent.click(send);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(sendMenu()).not.toHaveAttribute("aria-modal", "true");
  expect(receive).toHaveAttribute("aria-expanded", "false");
  fireEvent.pointerDown(send); fireEvent.click(send);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(send); fireEvent.keyDown(sendMenu(), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull(); expect(send).toHaveFocus();
  fireEvent.click(send); fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(send); fireEvent.click(within(sendMenu()).getByRole("button", { name: "Закрыть отправку" }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(send).toHaveFocus();
});

it("keeps menu account selection local, stable bounds and exact network/account focus on Back", async () => {
  const snapshot = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const source = snapshot.accounts.find(account => account.id === "demo-custody")!;
  // The current demo exposes send only on custody. A second explicit capability tests the chooser boundary.
  const other = { ...source, id: "test-secondary", label: "Другой счёт", capabilities: source.capabilities.filter(capability =>
    capability.action === "send" && capability.assetId === "usdc" && capability.networkId === "ethereum") };
  const holding = snapshot.holdings.find(candidate => candidate.accountId === source.id && candidate.assetId === "usdc" && candidate.networkId === "ethereum")!;
  await home({ ...MONO_PRODUCT_DEMO_ADAPTER, snapshot: { ...snapshot, accounts: [...snapshot.accounts, other],
    holdings: [...snapshot.holdings, { ...holding, id: "test-secondary-usdc", accountId: other.id }] } });
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  const before = sendMenu().getAttribute("style");
  fireEvent.click(within(sendMenu()).getByRole("button", { name: other.label }));
  expect(screen.getByRole("button", { name: /Выбрать счёт: Все счета/ })).toBeInTheDocument();
  expect(sendMenu().getAttribute("style")).toBe(before);
  const otherRoute = () => within(sendMenu()).getByRole("button", { name: /USDC.*Ethereum.*Другой счёт/ });
  const otherKey = otherRoute().getAttribute("data-product-route-key");
  fireEvent.click(otherRoute());
  await screen.findByRole("textbox", { name: "Получатель" });
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  await waitFor(() => expect(otherRoute()).toHaveFocus());
  expect(otherRoute()).toHaveAttribute("data-product-route-key", otherKey);
  expect(within(sendMenu()).getByRole("button", { name: other.label })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(sendMenu()).getByRole("button", { name: "Основной" }));
  const key = routeButton("Solana").getAttribute("data-product-route-key");
  fireEvent.click(routeButton("Solana"));
  await screen.findByRole("textbox", { name: "Получатель" });
  expect(screen.getByRole("button", { name: "О валюте USDC в сети Solana" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  await waitFor(() => expect(routeButton("Solana")).toHaveFocus());
  expect(routeButton("Solana")).toHaveAttribute("data-product-route-key", key);
});

it("accepts only exact current Send routes, and keeps a placement direct with its previous Back path", () => {
  const { result } = renderHook(() => useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false }));
  act(() => result.current.commands.openIntent("send"));
  const route = result.current.view.intent!.routes.find(candidate => candidate.assetId === "usdc" && candidate.networkId === "solana")!;
  for (const forged of [{ ...route, action: "receive", receiveMode: "external-address" },
    { ...route, accountId: "all" }, { ...route, networkId: "foreign-network" }] as ProductActionRoute[]) {
    act(() => result.current.commands.selectRoute(forged));
    expect(result.current.view.sheet).toMatchObject({ route: null });
  }
  act(() => result.current.commands.selectRoute(route));
  expect(result.current.view.sheet).toMatchObject({ route });
  act(() => result.current.commands.backToRoutes(route));
  expect(result.current.view.sheet).toMatchObject({ route: null, focusRouteKey: productRouteKey(route) });
  act(() => result.current.commands.openAsset("usdc"));
  act(() => result.current.commands.selectAssetHolding("demo-usdc-sol"));
  act(() => result.current.commands.openPlacementAction("demo-usdc-sol", "send"));
  expect(result.current.view.sheet).toMatchObject({ placementId: "demo-usdc-sol", route });
  act(() => result.current.commands.backToRoutes(route));
  expect(result.current.view.sheet).toBeNull();
  expect(result.current.view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: "demo-usdc-sol" });
  expect(result.current.view.context).toEqual({ kind: "all" });
});

function PlacementScene() {
  const { view, commands } = useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false });
  return <div data-mono-preview><button data-mono-product-placement-id="demo-usdc-sol" data-mono-product-placement-action="send"
    onClick={() => commands.openPlacementAction("demo-usdc-sol", "send")}>Отправить из размещения</button>
    <ProductOverlay view={view} commands={commands} /></div>;
}
it("returns focus to the exact placement launcher on close", async () => {
  render(<PlacementScene />);
  const trigger = screen.getByRole("button", { name: "Отправить из размещения" });
  fireEvent.click(trigger);
  await screen.findByRole("textbox", { name: "Получатель" });
  expect(sendMenu()).toHaveAttribute("aria-modal", "true");
  fireEvent.click(within(sendMenu()).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it("keeps unavailable accounts empty without inventing a route", async () => {
  const adapter = singleRouteAdapter();
  await home({ ...adapter, snapshot: { ...adapter.snapshot,
    accounts: adapter.snapshot.accounts.map(account => ({ ...account, status: "inactive" })) } });
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  expect(sendMenu()).not.toHaveAttribute("aria-modal", "true");
  expect(sendMenu().querySelectorAll("[data-product-route-key]")).toHaveLength(0);
  expect(sendMenu()).toHaveTextContent(/не активирован|маршрутов.*нет/);
});

it("does not mark a laboratory Send button as a product launcher", () => {
  render(<MonoQuickActionFeedback label="Отправить" path="M0 0" preset={MONO_QUICK_ACTION_DEFAULT} onActivate={vi.fn()} />);
  const action = screen.getByRole("button", { name: /Отправить/ });
  expect(action).not.toHaveAttribute("data-mono-product-send-trigger");
  expect(action).not.toHaveAttribute("aria-haspopup");
  expect(action).not.toHaveAttribute("aria-expanded");
});
