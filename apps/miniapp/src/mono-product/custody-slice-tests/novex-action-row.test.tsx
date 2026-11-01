import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NovexActionRow, type NovexActionItem } from "../novex-layout-preview";

afterEach(cleanup);

it("keeps supplied action order, blocks disabled actions and marks the real focus launcher", () => {
  const receive = vi.fn(), send = vi.fn(), buy = vi.fn(), swap = vi.fn();
  const items: NovexActionItem[] = [
    { action: "swap", label: "Обменять", onClick: swap },
    { action: "receive", label: "Получить", onClick: receive, accountActionFocus: true, expanded: false, controls: "receive-choices" },
    { action: "buy", label: "Купить", onClick: buy, disabled: true },
    { action: "send", label: "Отправить", onClick: send },
  ];
  const { rerender } = render(<NovexActionRow items={items} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons.map(button => button.textContent)).toEqual(["Обменять", "Получить", "Купить", "Отправить"]);
  const receiveButton = screen.getByRole("button", { name: "Получить" });
  expect(receiveButton).toHaveAttribute("data-product-account-quick-action", "receive");
  expect(receiveButton).toHaveAttribute("aria-expanded", "false");
  expect(receiveButton).toHaveAttribute("aria-controls", "receive-choices");
  expect(screen.getByRole("button", { name: "Отправить" })).not.toHaveAttribute("aria-expanded");
  expect(screen.getByRole("button", { name: "Отправить" })).not.toHaveAttribute("aria-controls");
  rerender(<NovexActionRow items={items.map(item => item.action === "receive" ? { ...item, expanded: true } : item)} />);
  expect(receiveButton).toHaveAttribute("aria-expanded", "true");
  receiveButton.focus();
  expect(receiveButton).toHaveFocus();
  fireEvent.click(receiveButton);
  expect(receive).toHaveBeenCalledOnce();
  const disabled = screen.getByRole("button", { name: "Купить" });
  expect(disabled).toBeDisabled();
  fireEvent.click(disabled);
  expect(buy).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  expect(swap).not.toHaveBeenCalled();
});
