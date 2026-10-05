import "@testing-library/jest-dom/vitest";
import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

it("keeps the anchored panel within a 320px scene and a short visual viewport", () => {
  vi.stubGlobal("visualViewport", { offsetLeft: 0, offsetTop: 0, width: 1024, height: 180,
    addEventListener() {}, removeEventListener() {} });
  const anchorRef = createRef<HTMLButtonElement>();
  render(<main data-mono-preview>
    <button ref={anchorRef} data-profile-quick-menu-trigger>Настройки</button>
    <ProfileQuickMenu id="settings" open anchorRef={anchorRef} theme="dark" balanceHidden={false}
      onBalanceHiddenChange={() => {}} onOpenHelp={() => {}} onDismiss={() => {}} />
  </main>);
  const panel = screen.getByRole("dialog", { name: "Быстрые настройки" });
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
  expect(host.getRegions().map(region => region.element)).toEqual([screen.getByRole("dialog", { name: "Быстрые настройки" })]);
  view.rerender(<Host open={false} />);
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки", hidden: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Скрывать суммы", hidden: true })).toBeNull();
  expect(host.getRegions()).toHaveLength(0);
});

it("opens accounts from the anchored menu while keeping privacy as its first focus target", () => {
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
  expect(screen.getByRole("button", { name: "Скрывать суммы" })).toHaveFocus();
  expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Мои счета" }));
  expect(screen.getByRole("heading", { name: "Мои счета" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Быстрые настройки" })).toBeNull();
});
