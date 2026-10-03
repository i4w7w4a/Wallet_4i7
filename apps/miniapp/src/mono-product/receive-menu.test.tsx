import "@testing-library/jest-dom/vitest";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProductActionRoute } from "@wallet/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReceiveMenu, type ReceiveMenuProps } from "./receive-menu";

const bitcoin: ProductActionRoute = {
  action: "receive", receiveMode: "external-address", accountId: "main", accountLabel: "Основной", accountKind: "custodial",
  assetId: "btc", symbol: "BTC", name: "Bitcoin", networkId: "bitcoin", networkLabel: "Bitcoin",
};
const ethereum: ProductActionRoute = { ...bitcoin, assetId: "usdc", symbol: "USDC", name: "USD Coin",
  networkId: "ethereum", networkLabel: "Ethereum" };
const solana: ProductActionRoute = { ...ethereum, networkId: "solana", networkLabel: "Solana" };
const ether: ProductActionRoute = { ...ethereum, assetId: "eth", symbol: "ETH", name: "Ethereum" };
const internal: ProductActionRoute = { ...ethereum, accountId: "vault", accountLabel: "Хранилище", accountKind: "depositary",
  receiveMode: "internal-transfer" };
const routes = [bitcoin, ether, ethereum, solana, internal];
let sceneRect: DOMRect;
let anchorRect: DOMRect;
let reduced = false;
const disconnected = vi.fn();

beforeEach(() => {
  sceneRect = new DOMRect(80, 20, 390, 740);
  anchorRect = new DOMRect(280, 220, 56, 56);
  reduced = false;
  vi.stubGlobal("innerWidth", 600);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query === "(prefers-reduced-motion: reduce)",
    media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() { disconnected(); } });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return sceneRect;
    if (this.hasAttribute("data-mono-product-receive-trigger")) return anchorRect;
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); disconnected.mockClear(); });

function Scene({ anchor = "visible", motion = "ready", onTrigger, children, ...props }: ReceiveMenuProps & {
  anchor?: "visible" | "missing" | "hidden"; motion?: "ready" | "static"; onTrigger?(): void; children?: ReactNode;
}) {
  return <div className="mono-page" data-mono-preview data-mono-motion={motion}>
    {anchor !== "missing" && <button type="button" data-mono-product-receive-trigger
      style={anchor === "hidden" ? { visibility: "hidden" } : undefined} onClick={onTrigger}>Получить</button>}
    <button type="button">Отправить</button>
    <ReceiveMenu {...props} />
    {children}
  </div>;
}

function FullReceiveScreen() {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  return <input ref={input} aria-label="Полный сценарий получения" />;
}

function LiveScene({ onClose = vi.fn(), onSelectRoute = vi.fn(), ...props }: Partial<ReceiveMenuProps> & { motion?: "ready" | "static" }) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(false);
  return <Scene routes={routes} {...props} open={open} onTrigger={() => setOpen(value => !value)}
    onClose={() => { onClose(); setOpen(false); }}
    onSelectRoute={route => { onSelectRoute(route); setOpen(false); setSelected(true); }}>
    {selected && <FullReceiveScreen />}
  </Scene>;
}

function menu() { return screen.getByRole("dialog", { name: "Получить" }); }
function routeButtons() { return menu().querySelectorAll<HTMLButtonElement>("[data-product-route-key]"); }

it("clamps the shared chooser inside the visible frame between lab controls and bottom navigation", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("mono-preview-frame")) return new DOMRect(80, 54, 230, 600);
    if (this.classList.contains("mono-nav")) return new DOMRect(80, 300, 230, 56);
    if (this.hasAttribute("data-mono-preview")) return sceneRect;
    if (this.hasAttribute("data-mono-product-receive-trigger")) return anchorRect;
    return new DOMRect();
  });
  render(<div data-mono-workbench style={{ paddingTop: 54 }}><div className="mono-preview-frame">
    <Scene open anchor="missing" routes={routes} onClose={vi.fn()} onSelectRoute={vi.fn()}>
      <nav className="mono-nav" />
    </Scene>
  </div></div>);
  expect(menu()).toHaveStyle({ width: "206px" });
  const top = sceneRect.top + parseFloat(menu().style.top);
  expect(top).toBeGreaterThanOrEqual(66);
  expect(top + parseFloat(menu().style.height)).toBeLessThanOrEqual(292);
});

it("keeps same-symbol networks separate and emits the exact route and receive method", () => {
  const select = vi.fn();
  render(<Scene open routes={routes} onClose={vi.fn()} onSelectRoute={select} />);
  expect(routeButtons()).toHaveLength(4);
  expect(within(menu()).queryAllByText("Извне")).toHaveLength(0);
  fireEvent.click(within(menu()).getByRole("button", { name: /USDC.*Ethereum.*Основной.*Внешнее получение/ }));
  expect(select).toHaveBeenLastCalledWith(ethereum);
  fireEvent.click(within(menu()).getByRole("button", { name: /USDC.*Solana.*Основной.*Внешнее получение/ }));
  expect(select).toHaveBeenLastCalledWith(solana);
  fireEvent.click(within(menu()).getByRole("button", { name: "Хранилище" }));
  expect(select).toHaveBeenCalledTimes(2);
  expect(routeButtons()).toHaveLength(1);
  fireEvent.click(within(menu()).getByRole("button", { name: /USDC.*Ethereum.*Хранилище.*Между счетами/ }));
  expect(select).toHaveBeenLastCalledWith(internal);
  expect(select).toHaveBeenCalledTimes(3);
});

it("uses real local currency SVGs by asset identity, sharing USDC artwork across networks and keeping unknown assets generic", () => {
  const unknown: ProductActionRoute = { ...ethereum, assetId: "unlisted-usdc", name: "Unlisted asset" };
  render(<Scene open routes={[...routes, unknown]} onClose={vi.fn()} onSelectRoute={vi.fn()} />);
  const expected = [
    { name: /BTC.*Bitcoin.*Основной/, file: "btc.svg" },
    { name: /ETH.*Ethereum.*Основной/, file: "eth.svg" },
    { name: /USDC · USD Coin.*Ethereum.*Основной/, file: "usdc.svg" },
    { name: /USDC · USD Coin.*Solana.*Основной/, file: "usdc.svg" },
  ];
  for (const { name, file } of expected) {
    const icon = within(menu()).getByRole("button", { name }).querySelector("img");
    expect(icon).toHaveAttribute("src", `/media/currency-logos/${file}`);
    expect(icon).toHaveAttribute("alt", "");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    const source = readFileSync(resolve(process.cwd(), "public/media/currency-logos", file), "utf8");
    const svg = new DOMParser().parseFromString(source, "image/svg+xml");
    expect(svg.documentElement.localName).toBe("svg");
    expect(svg.querySelector("path, circle")).not.toBeNull();
    expect(svg.querySelector("script, foreignObject, image, use")).toBeNull();
  }
  const fallback = within(menu()).getByRole("button", { name: /Unlisted asset/ });
  expect(fallback.querySelector("img")).toBeNull();
  expect(fallback.querySelector("[data-currency-logo='generic']")).toBeInTheDocument();
});

it("moves one account indicator to the latest selection and settles it immediately on resize", () => {
  const select = vi.fn();
  render(<Scene open routes={routes} onClose={vi.fn()} onSelectRoute={select} />);
  const indicator = menu().querySelector<HTMLElement>("[data-receive-account-indicator]")!;
  expect(indicator).toHaveAttribute("data-account-id", "main");
  expect(indicator).toHaveAttribute("data-animate", "false");
  expect(indicator.style.transform).toBe("translate(4px, 6px)");
  const main = within(menu()).getByRole("button", { name: "Основной" });
  const vault = within(menu()).getByRole("button", { name: "Хранилище" });
  fireEvent.click(vault);
  fireEvent.click(main);
  fireEvent.click(vault);
  expect(menu().querySelectorAll("[data-receive-account-indicator]")).toHaveLength(1);
  expect(menu().querySelector("[data-receive-account-indicator]")).toBe(indicator);
  expect(indicator).toHaveAttribute("data-account-id", "vault");
  expect(indicator).toHaveAttribute("data-animate", "true");
  expect(indicator.style.transform).toBe("translate(126px, 6px)");
  expect(vault).toHaveAttribute("aria-pressed", "true");
  expect(routeButtons()).toHaveLength(1);
  expect(select).not.toHaveBeenCalled();
  sceneRect = new DOMRect(0, 20, 248, 740);
  fireEvent(window, new Event("resize"));
  expect(indicator).toHaveAttribute("data-animate", "false");
  expect(indicator.style.transform).toBe("translate(108px, 6px)");
  expect(vault).toHaveAttribute("aria-pressed", "true");
});

it("keeps the 4-versus-1 account menu, grid and anchor position stable", () => {
  render(<Scene open routes={routes} onClose={vi.fn()} onSelectRoute={vi.fn()} />);
  const panel = menu();
  const grid = panel.querySelector<HTMLElement>("[data-receive-menu-grid]")!;
  const initial = { top: panel.style.top, left: panel.style.left, height: panel.style.height,
    side: panel.dataset.side, gridHeight: grid.style.height };
  expect(parseFloat(panel.style.width)).toBe(260);
  expect(parseFloat(panel.style.height)).toBeGreaterThanOrEqual(190);
  expect(parseFloat(panel.style.height)).toBeLessThanOrEqual(220);
  expect(grid.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  fireEvent.click(within(panel).getByRole("button", { name: "Хранилище" }));
  expect({ top: panel.style.top, left: panel.style.left, height: panel.style.height,
    side: panel.dataset.side, gridHeight: grid.style.height }).toEqual(initial);
});

it.each([320, 390])("clamps a %ipx scene to the visible viewport and repositions on resize", width => {
  sceneRect = new DOMRect(20, -180, width, 780);
  anchorRect = new DOMRect(width - 35, 210, 44, 44);
  vi.stubGlobal("innerWidth", width + 40);
  vi.stubGlobal("innerHeight", 240);
  const pageScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<Scene open routes={routes} onClose={vi.fn()} onSelectRoute={vi.fn()} />);
  const panel = menu();
  const top = parseFloat(panel.style.top) + sceneRect.top;
  const left = parseFloat(panel.style.left) + sceneRect.left;
  expect(left).toBeGreaterThanOrEqual(sceneRect.left + 12);
  expect(left + parseFloat(panel.style.width)).toBeLessThanOrEqual(sceneRect.right - 12);
  expect(top).toBeGreaterThanOrEqual(12);
  expect(top + parseFloat(panel.style.height)).toBeLessThanOrEqual(228);
  expect(panel).toHaveAttribute("data-side", "above");
  anchorRect = new DOMRect(100, 20, 44, 44);
  fireEvent(window, new Event("resize"));
  expect(panel).toHaveAttribute("data-side", "below");
  expect(pageScroll).not.toHaveBeenCalled();
});

it.each(["missing", "hidden"] as const)("uses a visible compact fallback for a %s anchor", anchor => {
  render(<Scene anchor={anchor} open routes={routes} onClose={vi.fn()} onSelectRoute={vi.fn()} />);
  const panel = menu();
  expect(panel).toHaveAttribute("data-side", "fallback");
  expect(panel).not.toHaveStyle({ visibility: "hidden" });
  expect(parseFloat(panel.style.width)).toBe(260);
  expect(parseFloat(panel.style.top) + sceneRect.top).toBeGreaterThanOrEqual(sceneRect.top + 12);
  expect(routeButtons()[0]).toHaveFocus();
});

it("reveals an exact Back route without selecting it, while later local switching stays local", () => {
  const select = vi.fn();
  const { rerender } = render(<Scene open routes={routes} onClose={vi.fn()} onSelectRoute={select} />);
  rerender(<Scene open routes={routes} focusRouteKey="receive:vault:usdc:ethereum:internal-transfer"
    onClose={vi.fn()} onSelectRoute={select} />);
  expect(within(menu()).getByRole("button", { name: "Хранилище" })).toHaveAttribute("aria-pressed", "true");
  expect(within(menu()).getByRole("button", { name: /Между счетами/ })).toHaveFocus();
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(within(menu()).getByRole("button", { name: "Основной" }));
  rerender(<Scene open routes={[...routes]} focusRouteKey="receive:vault:usdc:ethereum:internal-transfer"
    onClose={vi.fn()} onSelectRoute={select} />);
  expect(within(menu()).getByRole("button", { name: "Основной" })).toHaveAttribute("aria-pressed", "true");
  expect(routeButtons()).toHaveLength(4);
  expect(select).not.toHaveBeenCalled();
});

it("closes on an outside pointer without stealing that target's focus and lets the trigger toggle itself", () => {
  const close = vi.fn();
  render(<LiveScene onClose={close} />);
  const trigger = screen.getByRole("button", { name: "Получить" });
  fireEvent.pointerDown(trigger);
  expect(close).not.toHaveBeenCalled();
  const outside = screen.getByRole("button", { name: "Отправить" });
  outside.focus();
  fireEvent.pointerDown(outside);
  expect(close).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(outside).toHaveFocus();
});

it.each(["Escape", "Tab"])("returns keyboard %s exit to the trigger with preventScroll", key => {
  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  render(<LiveScene />);
  const last = [...routeButtons()].at(-1)!;
  last.focus();
  fireEvent.keyDown(last, { key });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Получить" })).toHaveFocus();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

it("removes the menu immediately on route selection and leaves focus in the new Receive screen", () => {
  const select = vi.fn();
  render(<LiveScene onSelectRoute={select} />);
  fireEvent.click(within(menu()).getByRole("button", { name: /USDC.*Solana/ }));
  expect(select).toHaveBeenCalledWith(solana);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.querySelector("[data-receive-menu]")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Полный сценарий получения" })).toHaveFocus();
});

it("owns no active pointer, keyboard, resize or scroll subscriptions while closed", () => {
  const add = vi.spyOn(document, "addEventListener"), remove = vi.spyOn(document, "removeEventListener");
  const addWindow = vi.spyOn(window, "addEventListener"), removeWindow = vi.spyOn(window, "removeEventListener");
  const close = vi.fn();
  const { rerender } = render(<Scene open={false} routes={routes} onClose={close} onSelectRoute={vi.fn()} />);
  expect(add.mock.calls.filter(([event]) => ["pointerdown", "keydown", "scroll"].includes(event))).toHaveLength(0);
  rerender(<Scene open routes={routes} onClose={close} onSelectRoute={vi.fn()} />);
  const active = add.mock.calls.filter(([event]) => ["pointerdown", "keydown", "scroll"].includes(event));
  expect(active.map(([event]) => event)).toEqual(expect.arrayContaining(["pointerdown", "keydown", "scroll"]));
  const resize = addWindow.mock.calls.find(([event]) => event === "resize")!;
  rerender(<Scene open={false} routes={routes} onClose={close} onSelectRoute={vi.fn()} />);
  for (const call of active) expect(remove).toHaveBeenCalledWith(...call);
  expect(removeWindow).toHaveBeenCalledWith(...resize);
  expect(disconnected).toHaveBeenCalled();
  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
});

it.each([{ motion: "static" as const, reduce: false }, { motion: "ready" as const, reduce: true }])(
  "keeps open/focus/cancel immediate in $motion mode with reduced=$reduce", ({ motion, reduce }) => {
    reduced = reduce;
    render(<LiveScene motion={motion} />);
    expect(menu()).not.toHaveStyle({ visibility: "hidden" });
    expect(routeButtons()[0]).toHaveFocus();
    fireEvent.click(within(menu()).getByRole("button", { name: "Закрыть получение" }));
    expect(document.querySelector("[data-receive-menu]")).toBeNull();
    expect(screen.getByRole("button", { name: "Получить" })).toHaveFocus();
  },
);

it("bounds additional icon rows and displays a host-owned empty reason without inventing routes", () => {
  const extra = Array.from({ length: 13 }, (_, index) => ({ ...ethereum, networkId: `network-${index}`, networkLabel: `Сеть ${index}` }));
  const { rerender } = render(<Scene open routes={[...extra, internal]} onClose={vi.fn()} onSelectRoute={vi.fn()} />);
  expect(routeButtons()).toHaveLength(13);
  expect(parseFloat(menu().style.height)).toBeLessThanOrEqual(320);
  const height = menu().style.height;
  fireEvent.click(within(menu()).getByRole("button", { name: "Хранилище" }));
  expect(menu().style.height).toBe(height);
  rerender(<Scene open routes={[]} emptyMessage="Для этого счёта получение пока недоступно."
    onClose={vi.fn()} onSelectRoute={vi.fn()} />);
  expect(menu()).toHaveTextContent("Для этого счёта получение пока недоступно.");
  expect(routeButtons()).toHaveLength(0);
});
