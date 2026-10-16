import "@testing-library/jest-dom/vitest";
import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMonoOpticalHost } from "@wallet/ui";
import { ProductGlassProvider } from "../product-glass-surface";
import { ProfileQuickMenu } from "./profile-quick-menu";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(80, 40, 320, 900);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(370, 62, 44, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// Theme is a readable disabled row; it owns no preference or privacy command.
it.each([false, true])("keeps theme unavailable and privacy absent when balanceHidden is %s", hidden => {
  const anchorRef = createRef<HTMLButtonElement>();
  const requested: boolean[] = [];
  function Host({ balanceHidden }: { balanceHidden: boolean }) {
    return <main data-mono-preview>
      <button ref={anchorRef} data-profile-quick-menu-trigger>Настройки</button>
      <ProfileQuickMenu id="settings" open anchorRef={anchorRef} theme="dark" balanceHidden={balanceHidden}
        onThemeChange={() => { requested.push(true); }}
        onBalanceHiddenChange={value => { requested.push(value); }} onOpenHelp={() => {}} onDismiss={() => {}} />
    </main>;
  }
  const { rerender } = render(<Host balanceHidden={hidden} />);
  const theme = screen.getByRole("button", { name: "Тема" });
  const artwork = theme.querySelector('svg[viewBox="0 0 24 24"]');
  expect(screen.getByRole("button", { name: "Язык" })).toHaveFocus();
  expect(theme).toBeDisabled(); expect(theme).toHaveAccessibleDescription("Пока недоступно");
  expect(artwork).toBeInTheDocument();
  expect(artwork).toHaveAttribute("aria-hidden", "true");
  expect(artwork).toHaveAttribute("focusable", "false");
  fireEvent.click(artwork!.querySelector("path")!);
  expect(requested).toEqual([]);
  expect(screen.queryByRole("button", { name: "Скрывать суммы" })).toBeNull();
  rerender(<Host balanceHidden={!hidden} />);
  expect(screen.getByRole("button", { name: "Язык" })).toHaveFocus();
  expect(theme).toBeDisabled(); expect(requested).toEqual([]);
});

// Catches artwork routing twice, routing to the wrong destination, or adding focus targets.
it.each([
  { label: "Мои счета", destination: "accounts" },
  { label: "Помощь", destination: "help" },
])("routes $destination once from its leading artwork without extra controls", ({ label, destination }) => {
  const anchorRef = createRef<HTMLButtonElement>();
  const routed: string[] = [];
  render(<main data-mono-preview>
    <button ref={anchorRef} data-profile-quick-menu-trigger>Настройки</button>
    <ProfileQuickMenu id="settings" open anchorRef={anchorRef} theme="dark" balanceHidden={false}
      onBalanceHiddenChange={() => {}} onOpenAccounts={() => { routed.push("accounts"); }}
      onOpenHelp={() => { routed.push("help"); }} onDismiss={() => {}} />
  </main>);
  const panel = screen.getByRole("dialog", { name: "Меню" });
  const row = within(panel).getByRole("button", { name: label });
  const artwork = row.querySelector('svg[viewBox="0 0 24 24"]');
  expect(within(panel).getAllByRole("button")).toHaveLength(7);
  expect(row).toHaveAttribute("type", "button");
  expect(row.tabIndex).toBe(0);
  expect(artwork).toBeInTheDocument();
  expect(artwork).toHaveAttribute("aria-hidden", "true");
  expect(artwork).toHaveAttribute("focusable", "false");
  expect(panel.querySelectorAll('svg [tabindex], span[tabindex], a')).toHaveLength(0);
  fireEvent.click(artwork!.querySelector("path")!);
  expect(routed).toEqual([destination]);
});

it("keeps the anchored panel within a 320px scene and a short visual viewport", () => {
  vi.stubGlobal("visualViewport", { offsetLeft: 0, offsetTop: 0, width: 1024, height: 180,
    addEventListener() {}, removeEventListener() {} });
  const anchorRef = createRef<HTMLButtonElement>();
  render(<main data-mono-preview>
    <button ref={anchorRef} data-profile-quick-menu-trigger>Настройки</button>
    <ProfileQuickMenu id="settings" open anchorRef={anchorRef} theme="dark" balanceHidden={false}
      onBalanceHiddenChange={() => {}} onOpenHelp={() => {}} onDismiss={() => {}} />
  </main>);
  const panel = screen.getByRole("dialog", { name: "Меню" });
  const left = Number.parseFloat(panel.style.left), width = Number.parseFloat(panel.style.width);
  const top = Number.parseFloat(panel.style.top), height = Number.parseFloat(panel.style.maxHeight);
  expect(left).toBeGreaterThanOrEqual(12);
  expect(left + width).toBeLessThanOrEqual(308);
  expect(height).toBeGreaterThan(0);
  expect(top + height + 40).toBeLessThanOrEqual(168);
});

it("releases its shared optical target and removes closed controls immediately", () => {
  const anchorRef = createRef<HTMLButtonElement>();
  const host = createMonoOpticalHost();
  function Host({ open }: { open: boolean }) {
    return <main data-mono-preview>
      <button ref={anchorRef} data-profile-quick-menu-trigger>Настройки</button>
      <ProductGlassProvider sharedHost={host.binding} preset="ledger">
        <ProfileQuickMenu id="settings" open={open} anchorRef={anchorRef} theme="dark" balanceHidden={false}
          onBalanceHiddenChange={() => {}} onOpenHelp={() => {}} onDismiss={() => {}} />
      </ProductGlassProvider>
    </main>;
  }
  const view = render(<Host open />);
  expect(host.getRegions().map(region => region.element)).toEqual([screen.getByRole("dialog", { name: "Меню" })]);
  view.rerender(<Host open={false} />);
  expect(screen.queryByRole("dialog", { name: "Меню", hidden: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Язык", hidden: true })).toBeNull();
  expect(host.getRegions()).toHaveLength(0);
});

it("opens accounts from the anchored menu while skipping disabled theme for initial focus", () => {
  const anchorRef = createRef<HTMLButtonElement>();
  function Host() {
    const [accounts, setAccounts] = useState(false);
    return <main data-mono-preview>
      <button ref={anchorRef} data-profile-quick-menu-trigger>Настройки</button>
      <ProfileQuickMenu id="settings" open={!accounts} anchorRef={anchorRef} theme="light" balanceHidden={false}
        onBalanceHiddenChange={() => {}} onOpenAccounts={() => setAccounts(true)}
        onOpenHelp={() => {}} onDismiss={() => {}} />
      {accounts && <h1>Мои счета</h1>}
    </main>;
  }
  render(<Host />);
  expect(screen.getByRole("button", { name: "Язык" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Тема" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Мои счета" }));
  expect(screen.getByRole("heading", { name: "Мои счета" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Меню" })).toBeNull();
});

it.each([
  { width: 320, viewportHeight: 760, navTop: 680 },
  { width: 390, viewportHeight: 760, navTop: 680 },
  { width: 320, viewportHeight: 240, navTop: 160 },
])("bottom Menu stays above its launcher within $width px wallet and $viewportHeight px viewport", ({ width, viewportHeight, navTop }) => {
  vi.stubGlobal("visualViewport", { offsetLeft: 0, offsetTop: 0, width: 1024, height: viewportHeight,
    addEventListener() {}, removeEventListener() {} });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(80, 40, width, 900);
    if (this.classList.contains("mono-preview-frame")) return new DOMRect(80, 40, width, viewportHeight - 40);
    if (this.classList.contains("mono-nav")) return new DOMRect(80, navTop, width, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(80 + width - 80, navTop + 10, 68, 48);
    return new DOMRect();
  });
  const anchorRef = createRef<HTMLButtonElement>(), dismissed = vi.fn();
  render(<div className="mono-preview-frame"><main data-mono-preview>
    <nav className="mono-nav"><button ref={anchorRef} data-profile-quick-menu-trigger>Меню</button></nav>
    <ProfileQuickMenu id="settings" open anchorRef={anchorRef} theme="dark" balanceHidden={false}
      onBalanceHiddenChange={() => {}} onOpenAccounts={() => {}} onOpenHelp={() => {}} onDismiss={dismissed} />
  </main></div>);
  const panel = screen.getByRole("dialog", { name: "Меню" });
  const left = Number.parseFloat(panel.style.left), panelWidth = Number.parseFloat(panel.style.width);
  const top = Number.parseFloat(panel.style.top), maxHeight = Number.parseFloat(panel.style.maxHeight);
  expect(dismissed).not.toHaveBeenCalled();
  expect(panel).toHaveAttribute("data-side", "above");
  expect(left).toBeGreaterThanOrEqual(12);
  expect(left + panelWidth).toBeLessThanOrEqual(width - 12);
  expect(top).toBeGreaterThanOrEqual(12);
  expect(maxHeight).toBeGreaterThan(0);
  expect(top + Math.min(240, maxHeight) + 40).toBeLessThanOrEqual(navTop - 8);
  expect(within(panel).getByRole("button", { name: "Язык" })).toHaveFocus();
});
