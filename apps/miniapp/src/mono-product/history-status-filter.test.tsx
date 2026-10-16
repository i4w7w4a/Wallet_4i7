import "@testing-library/jest-dom/vitest";
import { StrictMode, useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMonoOpticalHost } from "@wallet/ui";
import type { HistoryFilters } from "./history-filters";
import { HistoryStatusFilter } from "./history-status-filter";
import { ProductGlassProvider } from "./product-glass-surface";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  // Layout is a browser responsibility; these rectangles only make the real controls usable in JSDOM.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 800);
    if (this.hasAttribute("data-history-status-trigger")) return new DOMRect(246, 110, 44, 44);
    if (this.hasAttribute("data-history-status-filter")) return new DOMRect(246, 110, 128, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Host({ initial = "all", scopeKey = "main/usdc/ethereum", hidden = false, inert = false,
  overlay = false }: { initial?: HistoryFilters["status"]; scopeKey?: string; hidden?: boolean; inert?: boolean; overlay?: boolean }) {
  const [value, setValue] = useState(initial);
  return <main data-mono-preview data-mono-disclosure-motion="ready">
    <section hidden={hidden} inert={inert}>
      <HistoryStatusFilter value={value} onChange={setValue} scopeKey={scopeKey} />
      <output aria-label="Применённый статус">{value}</output>
    </section>
    <button type="button">Внешняя цель</button>
    {overlay && <div data-product-sheet><div role="dialog" aria-modal="true" aria-label="Отправить">Финансовая панель</div></div>}
  </main>;
}
function openFilter() {
  const trigger = screen.getByRole("button", { name: "Фильтр статуса" });
  trigger.focus();
  fireEvent.click(trigger, { detail: 0 });
  return { trigger, panel: screen.getByRole("dialog", { name: "Статус операций" }) };
}

it("focuses the selected status on keyboard activation and commits only an explicit native button activation", () => {
  render(<Host initial="pending" />);
  const { trigger, panel } = openFilter();
  expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(trigger).toHaveAttribute("aria-controls", panel.id);
  expect(panel).not.toHaveAttribute("aria-modal");
  const selected = within(panel).getByRole("button", { name: "Ожидают", pressed: true });
  expect(selected).toHaveFocus();
  fireEvent.keyDown(selected, { key: "ArrowDown" });
  const completed = within(panel).getByRole("button", { name: "Завершены", pressed: false });
  expect(completed).toHaveFocus();
  expect(screen.getByLabelText("Применённый статус")).toHaveTextContent("pending");
  fireEvent.click(completed, { detail: 0 });
  expect(screen.getByLabelText("Применённый статус")).toHaveTextContent("completed");
  expect(screen.queryByRole("dialog", { name: "Статус операций" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAccessibleDescription("Текущий статус: Завершены");
  const reopened = openFilter();
  expect(within(reopened.panel).getByRole("button", { name: "Завершены", pressed: true })).toHaveFocus();
});

it.each(["normal", "static and opaque"] as const)("reopens after Escape with selected focus in %s mode", mode => {
  const reduced = mode === "static and opaque";
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && (query === "(prefers-reduced-motion: reduce)" || query === "(prefers-reduced-transparency: reduce)"),
    addEventListener() {}, removeEventListener() {},
  }));
  render(<ProductGlassProvider preset="ledger" opaque={reduced}><Host initial="pending" /></ProductGlassProvider>);
  const { trigger, panel } = openFilter();
  const selected = within(panel).getByRole("button", { name: "Ожидают", pressed: true });
  expect(selected).toHaveFocus();
  fireEvent.keyDown(selected, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Статус операций" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  // Native keyboard activation emits click; JSDOM does not model CSS visibility transitions.
  fireEvent.click(trigger, { detail: 0 });
  const reopened = screen.getByRole("dialog", { name: "Статус операций" });
  expect(within(reopened).getByRole("button", { name: "Ожидают", pressed: true })).toHaveFocus();
  expect(screen.getByLabelText("Применённый статус")).toHaveTextContent("pending");
});

it("consumes its own Escape and returns focus without invoking a parent shortcut", () => {
  const parentKeyDown = vi.fn();
  render(<div onKeyDown={parentKeyDown}><Host initial="failed" /></div>);
  const { trigger } = openFilter();
  fireEvent.keyDown(screen.getByRole("button", { name: "Ошибки", pressed: true }), { key: "Escape" });
  expect(parentKeyDown).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog", { name: "Статус операций" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("closes on pointer outside while leaving the external focus target alone", () => {
  render(<Host />);
  openFilter();
  const external = screen.getByRole("button", { name: "Внешняя цель" });
  fireEvent.pointerDown(external);
  act(() => external.focus());
  expect(screen.queryByRole("dialog", { name: "Статус операций" })).not.toBeInTheDocument();
  expect(external).toHaveFocus();
});

it("lets Tab leave the last option and closes after focus moves outside", () => {
  render(<Host />);
  const { panel } = openFilter();
  const last = within(panel).getByRole("button", { name: "Ошибки" });
  act(() => last.focus());
  expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(true);
  const external = screen.getByRole("button", { name: "Внешняя цель" });
  act(() => external.focus());
  expect(screen.queryByRole("dialog", { name: "Статус операций" })).not.toBeInTheDocument();
  expect(external).toHaveFocus();
});

it("provides a visible close action and a separate status reset", () => {
  render(<Host initial="failed" />);
  const { trigger, panel } = openFilter();
  fireEvent.click(within(panel).getByRole("button", { name: "Закрыть фильтр статуса" }));
  expect(trigger).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтр статуса" }));
  expect(screen.getByLabelText("Применённый статус")).toHaveTextContent("all");
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Сбросить фильтр статуса" })).not.toBeInTheDocument();
});

it.each(["hidden", "inert", "overlay", "scope"] as const)("dismisses on %s without restoring focus to an unavailable context", async change => {
  const view = render(<Host />);
  const { trigger } = openFilter();
  const focus = vi.spyOn(trigger, "focus");
  await act(async () => view.rerender(<Host hidden={change === "hidden"} inert={change === "inert"}
    overlay={change === "overlay"} scopeKey={change === "scope" ? "other/usdc/solana" : "main/usdc/ethereum"} />));
  expect(view.container.querySelector('[role="dialog"][aria-labelledby]')).not.toBeInTheDocument();
  expect(focus).not.toHaveBeenCalled();
});

it("does not focus an anchor hidden immediately before Escape", () => {
  const { container } = render(<Host />);
  const { trigger, panel } = openFilter();
  const focus = vi.spyOn(trigger, "focus");
  const section = container.querySelector("section")!;
  const selected = within(panel).getByRole("button", { name: "Все статусы" });
  section.hidden = true;
  fireEvent.keyDown(selected, { key: "Escape" });
  expect(focus).not.toHaveBeenCalled();
  expect(container.querySelector('[role="dialog"][aria-labelledby]')).not.toBeInTheDocument();
});

it("keeps two History filters independent and gives each panel its own control id", () => {
  function Pair() {
    const [first, setFirst] = useState<HistoryFilters["status"]>("pending");
    const [second, setSecond] = useState<HistoryFilters["status"]>("failed");
    return <main data-mono-preview>
      <HistoryStatusFilter value={first} onChange={setFirst} scopeKey="main" />
      <HistoryStatusFilter value={second} onChange={setSecond} scopeKey="asset" />
    </main>;
  }
  render(<Pair />);
  const [first, second] = screen.getAllByRole("button", { name: "Фильтр статуса" });
  expect(first.getAttribute("aria-controls")).not.toBe(second.getAttribute("aria-controls"));
  fireEvent.click(first);
  expect(screen.getByRole("button", { name: "Ожидают", pressed: true })).toHaveFocus();
  fireEvent.pointerDown(second);
  fireEvent.click(second);
  expect(first).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Ошибки", pressed: true })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Завершены" }));
  expect(first).toHaveAccessibleDescription("Текущий статус: Ожидают");
  expect(second).toHaveAccessibleDescription("Текущий статус: Завершены");
  expect(second).toHaveFocus();
});

it("releases the shared optical region and its open-panel event subscriptions on close and unmount", () => {
  const host = createMonoOpticalHost();
  const add = vi.spyOn(document, "addEventListener");
  const remove = vi.spyOn(document, "removeEventListener");
  const view = render(<StrictMode><ProductGlassProvider sharedHost={host.binding} preset="ledger">
    <Host />
  </ProductGlassProvider></StrictMode>);
  const { panel } = openFilter();
  expect(host.getRegions().map(region => region.element)).toEqual([panel]);
  const subscriptions = add.mock.calls.filter(([name]) => ["pointerdown", "focusin", "scroll"].includes(name));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть фильтр статуса" }));
  expect(host.getRegions()).toHaveLength(0);
  for (const subscription of subscriptions) expect(remove.mock.calls).toContainEqual(subscription);
  openFilter();
  view.unmount();
  expect(host.getRegions()).toHaveLength(0);
  for (const subscription of add.mock.calls.filter(([name]) => ["pointerdown", "focusin", "scroll"].includes(name))) {
    expect(remove.mock.calls).toContainEqual(subscription);
  }
});
