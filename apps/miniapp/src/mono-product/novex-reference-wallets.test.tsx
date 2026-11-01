import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { ProductAccountChooser } from "./product-account-chooser";
import { MONO_PRODUCT_DEMO_ADAPTER } from "./demo-adapter";
import { useMonoProductController } from "./product-controller";
import { ProductContextLine } from "./product-home";

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

it("shows canonical cards and overview for the actual default demo adapter", () => {
  const { container, select } = show(MONO_PRODUCT_DEMO_ADAPTER.snapshot);
  expect(screen.getByRole("button", { name: /Общий обзор/i })).toHaveAttribute("aria-current", "true");
  fireEvent.click(screen.getByRole("button", { name: /Кастодиальный/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "demo-custody" });
  fireEvent.click(screen.getByRole("button", { name: /Депозитарный/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "demo-depositary" });
  const privateCard = screen.getByRole("button", { name: /Приватный/i });
  expect(privateCard).toBeDisabled();
  expect(privateCard.outerHTML).not.toMatch(/demo-private|\$|0,00/i);
  expect(container.innerHTML).not.toMatch(/Закрытый|Фиатный/);
  expect(screen.getAllByRole("button")).toHaveLength(4);
  for (const button of screen.getAllByRole("button")) {
    expect(button).not.toHaveAccessibleName(/Основной|Хранилище|Размещение|Закрытый|Фиатный/);
  }
  fireEvent.click(screen.getByRole("button", { name: /Общий обзор/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "all" });
});

it("shows custom names and selects the exact available account IDs", () => {
  const { select } = show();
  fireEvent.click(screen.getByRole("button", { name: /Старый кошелёк альфа/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "custody-exact-17" });
  fireEvent.click(screen.getByRole("button", { name: /Прежний сейф бета/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "deposit-exact-42" });
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

it("offers each distinct account of the same kind with its own label and exact ID", () => {
  const custom: ProductSnapshot = { ...snapshot, accounts: [
    ...snapshot.accounts,
    { id: "another-custody-88", kind: "custodial", label: "Второй личный кошелёк", status: "active", capabilities: [] },
  ] };
  const { select } = show(custom);
  fireEvent.click(screen.getByRole("button", { name: /Старый кошелёк альфа/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "custody-exact-17" });
  fireEvent.click(screen.getByRole("button", { name: /Второй личный кошелёк/i }));
  expect(select).toHaveBeenLastCalledWith({ kind: "account", accountId: "another-custody-88" });
  expect(select).toHaveBeenCalledTimes(2);
});

it("never selects an ID shared by accounts of different kinds", () => {
  const duplicateId: ProductSnapshot = { ...snapshot, accounts: snapshot.accounts.map(account =>
    account.kind === "depositary" ? { ...account, id: "custody-exact-17" } : account) };
  const { select } = show(duplicateId);
  for (const name of [/Старый кошелёк альфа/i, /Прежний сейф бета/i]) {
    const card = screen.getByRole("button", { name });
    expect(card).toBeDisabled();
    fireEvent.click(card);
  }
  expect(select).not.toHaveBeenCalled();
});


it("context trigger shows the selected custom account label without changing its identity", () => {
  function Host() {
    const { view, commands } = useMonoProductController({ ...MONO_PRODUCT_DEMO_ADAPTER, snapshot }, { initialHidden: false });
    return <><button onClick={() => commands.selectContext({ kind: "account", accountId: "custody-exact-17" })}>Выбрать альфу</button>
      <ProductContextLine view={view} commands={commands} /></>;
  }
  render(<Host />);
  fireEvent.click(screen.getByRole("button", { name: "Выбрать альфу" }));
  expect(screen.getByRole("button", { name: "Выбрать счёт: Старый кошелёк альфа" })).toBeInTheDocument();
});
