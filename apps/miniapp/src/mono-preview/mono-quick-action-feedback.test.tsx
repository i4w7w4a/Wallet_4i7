import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MONO_QUICK_ACTION_DEFAULT, MonoQuickActionFeedback } from "./mono-quick-action-feedback";
import { createDefaultActionArtwork } from "./action-artwork/model";
import { resolveActionRoutes } from "@wallet/core";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../mono-product/demo-adapter";

vi.mock("./action-artwork/mono-action-artwork", () => ({
  MonoActionArtwork: ({ trigger }: { trigger: number }) => <output data-testid="energy-trigger" data-trigger={trigger} />,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("exposes unavailable product actions as disabled and never activates them", () => {
  const onActivate = vi.fn();
  const { rerender } = render(<MonoQuickActionFeedback label="Обмен" accessibleLabel="Обмен" path="M0 0"
    preset={MONO_QUICK_ACTION_DEFAULT} onActivate={onActivate} productAction disabled />);
  const button = screen.getByRole("button", { name: "Обмен" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onActivate).not.toHaveBeenCalled();
  rerender(<MonoQuickActionFeedback label="Обмен" accessibleLabel="Обмен" path="M0 0"
    preset={MONO_QUICK_ACTION_DEFAULT} onActivate={onActivate} productAction disabled={false} />);
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(onActivate).toHaveBeenCalledOnce();
});

it("keeps all four overview demo actions available under the controller's all-wallet scope", () => {
  for (const action of ["send", "receive", "swap", "buy"] as const) {
    const routes = resolveActionRoutes(MONO_PRODUCT_DEMO_ADAPTER.snapshot, { kind: "all" }, action).routes;
    expect(routes.length, action).toBeGreaterThan(0);
    expect(routes.every(route => route.action === action)).toBe(true);
  }
});

it("settles and does not trigger visual feedback when a product action becomes unavailable", () => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? ""; }
  });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("pointer: fine"),
    addEventListener() {}, removeEventListener() {} }));
  const artwork = { ...createDefaultActionArtwork(), packId: "volume-v1" as const };
  const props = { label: "Обмен", accessibleLabel: "Обмен", path: "M0 0", preset: MONO_QUICK_ACTION_DEFAULT,
    actionId: "quick.swap" as const, artwork, onActivate: vi.fn() };
  const view = render(<MonoQuickActionFeedback {...props} />);
  const button = screen.getByRole("button", { name: "Обмен" });
  fireEvent.keyDown(button, { key: " " });
  expect(button).toHaveAttribute("data-key-pressed", "true");
  view.rerender(<MonoQuickActionFeedback {...props} disabled manualPreviewTrigger={1} />);
  expect(button).toHaveAttribute("data-key-pressed", "false");
  fireEvent.pointerEnter(button, { pointerType: "mouse" });
  fireEvent.keyDown(button, { key: " " });
  expect(button).toHaveAttribute("data-key-pressed", "false");
  expect(screen.getByTestId("energy-trigger")).toHaveAttribute("data-trigger", "0");
});

it("clears the decorative keyboard press when the page becomes hidden", () => {
  const onActivate = vi.fn();
  render(<MonoQuickActionFeedback label="Отправить" path="M0 0" preset={MONO_QUICK_ACTION_DEFAULT} onActivate={onActivate} />);
  const button = screen.getByRole("button", { name: /Отправить/ });
  fireEvent.keyDown(button, { key: " " });
  expect(button).toHaveAttribute("data-key-pressed", "true");

  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(button).toHaveAttribute("data-key-pressed", "false");
  expect(onActivate).not.toHaveBeenCalled();
});

it("activates only on the native completed click, once", () => {
  const onActivate = vi.fn();
  render(<MonoQuickActionFeedback label="Отправить" path="M0 0" preset={MONO_QUICK_ACTION_DEFAULT} onActivate={onActivate} />);
  const button = screen.getByRole("button", { name: /Отправить/ });
  fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch" });
  fireEvent.pointerCancel(button, { pointerId: 1, pointerType: "touch" });
  expect(onActivate).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(onActivate).toHaveBeenCalledTimes(1);
});

it("starts light only for fine enter, completed click and a fresh manual request", () => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "";
    }
  });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("pointer: fine"),
    addEventListener() {}, removeEventListener() {} }));
  const onActivate = vi.fn();
  const artwork = { ...createDefaultActionArtwork(), packId: "volume-v1" as const };
  const props = { label: "Отправить", path: "M0 0", preset: MONO_QUICK_ACTION_DEFAULT,
    actionId: "quick.send" as const, artwork, onActivate };
  const view = render(<MonoQuickActionFeedback {...props} />);
  const button = screen.getByRole("button", { name: /Отправить/ });
  const trigger = screen.getByTestId("energy-trigger");
  expect(trigger).toHaveAttribute("data-trigger", "0");
  fireEvent.pointerEnter(button, { pointerType: "touch" });
  expect(trigger).toHaveAttribute("data-trigger", "0");
  fireEvent.pointerEnter(button, { pointerType: "mouse" });
  expect(trigger).toHaveAttribute("data-trigger", "1");
  fireEvent.pointerCancel(button, { pointerType: "touch" });
  expect(trigger).toHaveAttribute("data-trigger", "1");
  fireEvent.click(button);
  expect(trigger).toHaveAttribute("data-trigger", "2");
  expect(onActivate).toHaveBeenCalledTimes(1);
  view.rerender(<MonoQuickActionFeedback {...props} manualPreviewTrigger={5} />);
  expect(trigger).toHaveAttribute("data-trigger", "3");
  view.rerender(<MonoQuickActionFeedback {...props} manualPreviewTrigger={0} />);
  expect(trigger).toHaveAttribute("data-trigger", "3");
});
