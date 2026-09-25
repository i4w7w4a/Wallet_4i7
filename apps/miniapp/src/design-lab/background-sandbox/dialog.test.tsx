import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SandboxDialog } from "./dialog";

afterEach(cleanup);

it("keeps busy and composing input open, then lets ordinary input Escape close", () => {
  const close = vi.fn();
  const body = <input aria-label="Имя пробы" data-initial-focus />;
  const view = render(<SandboxDialog title="Сохранить пробу" close={close} busy>{body}</SandboxDialog>);
  const input = screen.getByRole("textbox", { name: "Имя пробы" });
  expect(input).toHaveFocus();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();

  view.rerender(<SandboxDialog title="Сохранить пробу" close={close}>{body}</SandboxDialog>);
  fireEvent.keyDown(input, { key: "Escape", isComposing: true });
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(1);
});
