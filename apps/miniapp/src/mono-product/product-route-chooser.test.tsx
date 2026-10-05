import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProductActionRoute, ProductHolding } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { ProductRouteChooser } from "./product-route-chooser";

afterEach(cleanup);

const ethereum: ProductActionRoute = {
  action: "send", accountId: "main", accountLabel: "Основной", accountKind: "custodial",
  assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum",
};
const solana: ProductActionRoute = { ...ethereum, networkId: "solana", networkLabel: "Solana" };
const bridged: ProductActionRoute = { ...ethereum, assetId: "bridged-usdc", name: "Bridged USD Coin" };
const reserve: ProductActionRoute = { ...ethereum, accountId: "reserve", accountLabel: "Резерв" };
const routes = [ethereum, solana, bridged, reserve];
const holdings: ProductHolding[] = [
  { id: "main-eth", accountId: "main", assetId: "usdc", symbol: "USDC", name: "USD Coin",
    networkId: "ethereum", networkLabel: "Ethereum", quantity: "900.123456789", availableQuantity: "12.340000000000000019", fiatMinor: 876543 },
  { id: "main-sol", accountId: "main", assetId: "usdc", symbol: "USDC", name: "USD Coin",
    networkId: "solana", networkLabel: "Solana", quantity: "77.999999", fiatMinor: 765432 },
];

it("emits the exact account, asset and network route only after a route click", () => {
  const select = vi.fn();
  render(<ProductRouteChooser routes={routes} holdings={holdings} action="send" balanceHidden={false} onSelectRoute={select} />);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /USDC.*Solana.*Основной/ }));
  expect(select).toHaveBeenLastCalledWith(solana);
  fireEvent.click(screen.getByRole("button", { name: /Bridged USD Coin.*Ethereum.*Основной/ }));
  expect(select).toHaveBeenLastCalledWith(bridged);
  fireEvent.click(screen.getByRole("button", { name: "Резерв" }));
  expect(select).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: /USDC.*Solana/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /USDC.*Ethereum.*Резерв/ }));
  expect(select).toHaveBeenLastCalledWith(reserve);
});

it("shows exact available crypto only, never quantity, fiat or a same-symbol holding on another route", () => {
  render(<ProductRouteChooser routes={[ethereum, solana, bridged]} holdings={holdings} action="send"
    balanceHidden={false} onSelectRoute={vi.fn()} />);
  const known = screen.getByRole("button", { name: /USDC · USD Coin.*Ethereum.*Основной/ });
  expect(known).toHaveTextContent("12,340000000000000019 USDC");
  const unknown = screen.getByRole("button", { name: /USDC.*Solana.*Основной/ });
  expect(unknown).toHaveTextContent(/Нет данных/);
  expect(unknown).not.toHaveTextContent(/77[.,]999999|12[.,]34|7\s?654[.,]32/);
  const sameSymbol = screen.getByRole("button", { name: /Bridged USD Coin.*Ethereum/ });
  expect(sameSymbol).toHaveTextContent(/Нет данных/);
  expect(sameSymbol).not.toHaveTextContent("12,340000000000000019");
});

it("distinguishes external and internal receive on an empty account without requiring a holding", () => {
  const external: ProductActionRoute = { ...ethereum, action: "receive", receiveMode: "external-address",
    accountId: "vault", accountLabel: "Хранилище", accountKind: "depositary" };
  const internal: ProductActionRoute = { ...external, receiveMode: "internal-transfer" };
  const select = vi.fn();
  render(<ProductRouteChooser routes={[external, internal]} holdings={[]} action="receive"
    balanceHidden={false} onSelectRoute={select} />);
  const outside = screen.getByRole("button", { name: /Внешнее получение/ });
  const between = screen.getByRole("button", { name: /Между счетами/ });
  expect(outside).toHaveAttribute("data-product-route-key", "receive:vault:usdc:ethereum:external-address");
  expect(between).toHaveAttribute("data-product-route-key", "receive:vault:usdc:ethereum:internal-transfer");
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByText(/Доступно|Нет данных/)).not.toBeInTheDocument();
  fireEvent.click(outside);
  expect(select).toHaveBeenLastCalledWith(external);
  fireEvent.click(between);
  expect(select).toHaveBeenLastCalledWith(internal);
});

it("keeps available quantities out of visible and accessible labels under privacy", () => {
  const { container } = render(<ProductRouteChooser routes={[ethereum, solana]} holdings={holdings} action="send"
    balanceHidden onSelectRoute={vi.fn()} />);
  expect(container.innerHTML).not.toMatch(/12[.,]340000000000000019|900[.,]123456789|77[.,]999999|876543|765432/);
  for (const row of screen.getAllByRole("button")) {
    expect(row).toHaveAccessibleName(/Сумма скрыта/);
  }
});

it("reveals and focuses an exact Back route across account groups without selecting it or pinning the picker", () => {
  const select = vi.fn();
  const { rerender } = render(<ProductRouteChooser routes={routes} holdings={holdings} action="send"
    balanceHidden={false} onSelectRoute={select} />);
  rerender(<ProductRouteChooser routes={routes} holdings={holdings} action="send" balanceHidden={false}
    focusRouteKey="send:reserve:usdc:ethereum:" onSelectRoute={select} />);
  expect(screen.getByRole("button", { name: /USDC.*Ethereum.*Резерв/ })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Резерв" })).toHaveAttribute("aria-pressed", "true");
  expect(select).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Основной" }));
  rerender(<ProductRouteChooser routes={[...routes]} holdings={holdings} action="send" balanceHidden={false}
    focusRouteKey="send:reserve:usdc:ethereum:" onSelectRoute={select} />);
  expect(screen.getByRole("button", { name: "Основной" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("button", { name: /USDC.*Ethereum.*Резерв/ })).not.toBeInTheDocument();

  rerender(<ProductRouteChooser routes={routes} holdings={holdings} action="send" balanceHidden={false}
    focusRouteKey="send:main:usdc:solana:" onSelectRoute={select} />);
  expect(screen.getByRole("button", { name: /USDC.*Solana.*Основной/ })).toHaveFocus();
  expect(select).not.toHaveBeenCalled();
});

it("leaves a single route directly clickable while the host owns automatic opening and empty reasons", () => {
  const select = vi.fn();
  const { container, rerender } = render(<ProductRouteChooser routes={[ethereum]} holdings={holdings} action="send"
    balanceHidden={false} onSelectRoute={select} />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /USDC.*Ethereum/ }));
  expect(select).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenLastCalledWith(ethereum);
  rerender(<ProductRouteChooser routes={[]} holdings={holdings} action="send" balanceHidden={false} onSelectRoute={select} />);
  expect(within(container).queryByRole("button")).not.toBeInTheDocument();
  expect(select).toHaveBeenCalledTimes(1);
});
