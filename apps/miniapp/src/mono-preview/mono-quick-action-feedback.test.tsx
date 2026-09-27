import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MONO_QUICK_ACTION_DEFAULT, MonoQuickActionFeedback } from "./mono-quick-action-feedback";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
