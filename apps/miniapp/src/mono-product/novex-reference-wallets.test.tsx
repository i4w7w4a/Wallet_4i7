import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { ProductAccountChooser } from "./product-account-chooser";

afterEach(cleanup);

const snapshot: ProductSnapshot = {
  fiatCurrency: "USD",
  accounts: [
    { id: "custody-exact-17", kind: "custodial", label: "Старый кошелёк альфа", status: "active", capabilities: [] },
    { id: "deposit-exact-42", kind: "depositary", label: "Прежний сейф бета", status: "active", capabilities: [] },
    { id: "private-secret-93", kind: "private", label: "Тайный архив гамма", status: "active", capabilities: [] },
  ],
  holdings: [
    { id: "custody-holding", accountId: "custody-exact-17", assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "eth", networkLabel: "Ethereum", quantity: "34.123456789", fiatMinor: 123456 },
    { id: "deposit-holding", accountId: "deposit-exact-42", assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "eth", networkLabel: "Ethereum", quantity: "56.987654321", fiatMinor: 78901 },
    { id: "private-secret-holding", accountId: "private-secret-93", assetId: "secret-asset", symbol: "SECRET", name: "Secret asset", networkId: "eth", networkLabel: "Ethereum", quantity: "987654321.123456789", fiatMinor: 9900123 },
  ],
};

function show(value = snapshot, hidden = false) {
  const select = vi.fn();
  const rendered = render(<ProductAccountChooser snapshot={value} context={{ kind: "all" }}
    balanceHidden={hidden} onSelectContext={select} />);
  return { ...rendered, select };
}

it("shows the overview and three canonical types without leaking legacy labels", () => {
  const { container } = show();
  const overview = screen.getByRole("button", { name: /Общий обзор/i });
  expect(overview).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: /Кастодиальн/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Депозитарн/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Приватн/i })).toBeDisabled();
  expect(screen.getAllByRole("button")).toHaveLength(4);
  expect(container.innerHTML).not.toMatch(/Старый кошелёк альфа|Прежний сейф бета|Тайный архив гамма|Закрытый/);
  for (const button of screen.getAllByRole("button")) {
    expect(button).not.toHaveAccessibleName(/Старый кошелёк альфа|Прежний сейф бета|Тайный архив гамма|Закрытый/);
  }
});

it("selects the exact underlying account for each available type and the aggregate context", () => {
  const { select } = show();
  fireEvent.click(screen.getByRole("button", { name: /Кастодиальн/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "custody-exact-17" });
  fireEvent.click(screen.getByRole("button", { name: /Депозитарн/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "deposit-exact-42" });
  fireEvent.click(screen.getByRole("button", { name: /Общий обзор/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "all" });
});

it("never exposes a private account's identifier, holding or value on its disabled card", () => {
  const { container, select } = show();
  const privateCard = screen.getByRole("button", { name: /Приватн/i });
  expect(privateCard).toBeDisabled();
  expect(privateCard.outerHTML).not.toMatch(/private-secret|SECRET|987654321|99\s?001|\$/i);
  expect(container.innerHTML).not.toMatch(/private-secret|SECRET|987654321/i);
  fireEvent.click(privateCard);
  expect(select).not.toHaveBeenCalled();
});

it("removes visible and accessible estimates when privacy is enabled", () => {
  const { container } = show(snapshot, true);
  expect(container.innerHTML).not.toMatch(/101(?:\s|&nbsp;)?024[,.]80|99(?:\s|&nbsp;)?001[,.]23|1(?:\s|&nbsp;)?234[,.]56|789[,.]01|34[.,]123456789|56[.,]987654321/);
  for (const button of screen.getAllByRole("button").filter(button => !button.hasAttribute("disabled"))) {
    expect(button).toHaveAccessibleName(/Значения скрыты/i);
  }
});

it("does not choose the first account when a kind maps to multiple accounts", () => {
  const ambiguous: ProductSnapshot = { ...snapshot, accounts: [
    ...snapshot.accounts,
    { id: "another-custody-88", kind: "custodial", label: "Ещё один старый счёт", status: "active", capabilities: [] },
  ] };
  const { select } = show(ambiguous);
  const custody = screen.getByRole("button", { name: /Кастодиальн/i });
  expect(custody).toBeDisabled();
  expect(within(custody).getByText(/неоднознач|несколько/i)).toBeInTheDocument();
  fireEvent.click(custody);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Депозитарн/i }));
  expect(select).toHaveBeenCalledOnce();
  expect(select).toHaveBeenCalledWith({ kind: "account", accountId: "deposit-exact-42" });
});



it("never selects an ID shared by accounts of different kinds", () => {
  const duplicateId: ProductSnapshot = { ...snapshot, accounts: snapshot.accounts.map(account =>
    account.kind === "depositary" ? { ...account, id: "custody-exact-17" } : account) };
  const { select } = show(duplicateId);
  for (const name of [/Кастодиальн/i, /Депозитарн/i]) {
    const card = screen.getByRole("button", { name });
    expect(card).toBeDisabled();
    fireEvent.click(card);
  }
  expect(select).not.toHaveBeenCalled();
});
