import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { ProductAccountChooser } from "./product-account-chooser";

afterEach(cleanup);

const snapshot: ProductSnapshot = {
  fiatCurrency: "USD",
  accounts: [
    { id: "main", kind: "custodial", label: "Основной", status: "active", capabilities: [] },
    { id: "vault", kind: "depositary", label: "Хранилище", status: "active", capabilities: [] },
    { id: "archive", kind: "private", label: "Архив", status: "unavailable", capabilities: [] },
  ],
  holdings: [
    { id: "main-usdc", accountId: "main", assetId: "usdc", symbol: "USDC", name: "USD Coin",
      networkId: "ethereum", networkLabel: "Ethereum", quantity: "700.123456789", availableQuantity: "12.456789", fiatMinor: 458901 },
    { id: "vault-usdc", accountId: "vault", assetId: "usdc", symbol: "USDC", name: "USD Coin",
      networkId: "ethereum", networkLabel: "Ethereum", quantity: "91.23456789", fiatMinor: 12099 },
  ],
};

it("selects exact account contexts, including unavailable accounts for viewing, and labels totals as estimates", () => {
  const select = vi.fn();
  const { rerender } = render(<ProductAccountChooser snapshot={snapshot} context={{ kind: "all" }}
    balanceHidden={false} onSelectContext={select} />);
  const all = screen.getByRole("button", { name: /Все счета/ });
  expect(all).toHaveAttribute("aria-current", "true");
  expect(all).toHaveTextContent(/Общая оценка/);
  expect(all).toHaveTextContent(/4\s?710,00/);
  expect(screen.getByText(/не.*остаток.*отправки/i)).toBeInTheDocument();
  expect(all).not.toHaveTextContent(/700[.,]123456789|12[.,]456789|Доступно/);

  fireEvent.click(screen.getByRole("button", { name: /Основной/ }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "main" });
  rerender(<ProductAccountChooser snapshot={snapshot} context={{ kind: "account", accountId: "main" }}
    balanceHidden={false} onSelectContext={select} />);
  expect(screen.getByRole("button", { name: /Основной/ })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: /Все счета/ })).not.toHaveAttribute("aria-current");
  const archive = screen.getByRole("button", { name: /Архив/ });
  expect(archive).toHaveTextContent(/Недоступен/);
  expect(archive).toHaveTextContent(/просмотр/i);
  expect(archive).toBeEnabled();
  fireEvent.click(archive);
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "archive" });
  fireEvent.click(screen.getByRole("button", { name: /Все счета/ }));
  expect(select).toHaveBeenLastCalledWith({ kind: "all" });
});

it("redacts every account estimate from DOM and accessible names under privacy", () => {
  const { container } = render(<ProductAccountChooser snapshot={snapshot} context={{ kind: "all" }}
    balanceHidden onSelectContext={vi.fn()} />);
  expect(container.innerHTML).not.toMatch(/4(?:\s|&nbsp;)?710[.,]00|4(?:\s|&nbsp;)?589[.,]01|120[.,]99|12[.,]456789|700[.,]123456789/);
  for (const button of screen.getAllByRole("button")) {
    expect(button).toHaveAccessibleName(/Значения скрыты/);
  }
});
