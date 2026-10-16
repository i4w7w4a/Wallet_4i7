import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MULTI_ACCOUNT_DEMO } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { selectAccountGroups } from "../home-pins";
import { useHomePins } from "../use-home-pins";
import { HomePinSettings } from "./home-pin-settings";

afterEach(() => { cleanup(); localStorage.clear(); });

it("keeps choices while total-only hides pins and explains how manual selection restores them", () => {
  function Host() {
    const pins = useHomePins(MULTI_ACCOUNT_DEMO, false);
    return <HomePinSettings {...pins} onToggle={pins.togglePin} onTotalOnlyChange={pins.setTotalOnly} />;
  }
  render(<Host />);
  const total = screen.getByRole("checkbox", { name: "Только общий баланс" });
  const custody = screen.getByRole("checkbox", { name: "Кастодиальные" });
  fireEvent.click(total);
  expect(total).toBeChecked(); expect(custody).toBeChecked();
  expect(screen.getByText(/Выбор сохранён/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Депозитарные" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Депозитарные" }));
  expect(total).not.toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent(/Показываем выбранные кошельки/);
});

it("renders unavailable closed and fiat slots with no financial values or callbacks", () => {
  const toggle = vi.fn();
  render(<HomePinSettings groups={selectAccountGroups(MULTI_ACCOUNT_DEMO)} pinnedKinds={[]} totalOnly={false}
    onToggle={toggle} onTotalOnlyChange={() => true} />);
  for (const name of ["Закрытый", "Фиатный"]) {
    const choice = screen.getByRole("checkbox", { name });
    expect(choice).toBeDisabled();
    expect(choice).toHaveAccessibleDescription("Пока недоступен");
    expect(choice.closest("label")).not.toHaveTextContent(/0,00|\$/);
    fireEvent.click(choice);
  }
  expect(toggle).not.toHaveBeenCalled();
});
