import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MONO_QUICK_ACTION_DEFAULT, MonoQuickActionFeedback } from "./mono-quick-action-feedback";
import { createDefaultActionArtwork } from "./action-artwork/model";

vi.mock("./action-artwork/mono-action-artwork", () => ({
  MonoActionArtwork: ({ trigger }: { trigger: number }) => <output data-testid="energy-trigger" data-trigger={trigger} />,
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
