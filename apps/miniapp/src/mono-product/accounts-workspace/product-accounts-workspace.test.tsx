import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProductActionRoute, ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { ProductAccountsWorkspace, type ProductAccountsWorkspaceProps } from "./index";

afterEach(cleanup);

const usdc = { assetId: "usdc", symbol: "USDC", name: "USD Coin", networkId: "ethereum", networkLabel: "Ethereum" };
const solana = { ...usdc, networkId: "solana", networkLabel: "Solana" };
const snapshot: ProductSnapshot = {
  fiatCurrency: "USD",
  accounts: [
    { id: "main", label: "Основной", kind: "custodial", status: "active", capabilities: [
      { ...usdc, action: "send" }, { ...usdc, action: "receive", receiveMode: "external-address" },
      { ...usdc, action: "buy" }, { ...usdc, action: "swap" }, { ...usdc, action: "withdraw" },
    ] },
    { id: "vault", label: "Хранилище", kind: "depositary", status: "active", capabilities: [
      { ...usdc, action: "receive", receiveMode: "internal-transfer" },
      { ...solana, action: "receive", receiveMode: "unavailable" },
    ] },
    { id: "rest", label: "Резерв", kind: "private", status: "inactive", capabilities: [{ ...usdc, action: "send" }] },
    { id: "offline", label: "Архив", kind: "private", status: "unavailable", capabilities: [{ ...usdc, action: "send" }] },
  ],
  holdings: [
    { ...usdc, id: "main-eth", accountId: "main", quantity: "123.45", availableQuantity: "90.25", fiatMinor: 12345 },
    { ...solana, id: "main-sol", accountId: "main", quantity: "6.75", fiatMinor: 675 },
    { ...usdc, id: "vault-eth", accountId: "vault", quantity: "7.25", availableQuantity: "3", fiatMinor: 725 },
    { ...usdc, id: "rest-eth", accountId: "rest", quantity: "9", fiatMinor: 900 },
  ],
};

const sendRoute: ProductActionRoute = { ...usdc, action: "send", accountId: "main", accountLabel: "Основной", accountKind: "custodial" };
const receiveRoute: ProductActionRoute = { ...usdc, action: "receive", receiveMode: "external-address",
  accountId: "main", accountLabel: "Основной", accountKind: "custodial" };
const vaultRoute: ProductActionRoute = { ...usdc, action: "receive", receiveMode: "internal-transfer",
  accountId: "vault", accountLabel: "Хранилище", accountKind: "depositary" };

function props(patch: Partial<ProductAccountsWorkspaceProps> = {}): ProductAccountsWorkspaceProps {
  return { snapshot, selectedAccountId: null, context: { kind: "all" }, balanceHidden: false, allowedActions: [],
    onInspectAccount: vi.fn(), onBack: vi.fn(), onUseAccount: vi.fn(), onOpenAction: vi.fn(), onOpenHolding: vi.fn(), ...patch };
}

it("gives a zero-account snapshot a usable empty list and back path", () => {
  const input = props({ snapshot: { fiatCurrency: "USD", accounts: [], holdings: [] } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByRole("heading", { name: "Мои счета", level: 1 })).toBeInTheDocument();
  expect(screen.getByText(/счетов пока нет/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Открыть счёт/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Назад в кошелёк" }));
  expect(input.onBack).toHaveBeenCalledOnce();
});

it("keeps even one account in the controlled list until the host supplies an inspected ID", () => {
  const input = props({ snapshot: { ...snapshot, accounts: [snapshot.accounts[0]!] } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByRole("heading", { name: "Мои счета", level: 1 })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
  expect(input.onInspectAccount).toHaveBeenCalledWith("main");
  expect(input.onUseAccount).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Мои счета", level: 1 })).toBeInTheDocument();
});

it("shows supplied categories, statuses, per-account value estimates and placement counts", () => {
  render(<ProductAccountsWorkspace {...props({ context: { kind: "account", accountId: "vault" } })} />);
  const main = screen.getByRole("button", { name: "Открыть счёт: Основной" });
  expect(main).toHaveTextContent("Кастодиальный");
  expect(main).toHaveTextContent("Активен");
  expect(main).toHaveTextContent(/≈\s*130,20\s*\$/);
  expect(main).toHaveTextContent("2 размещения");
  expect(main).toHaveAccessibleDescription(/Кастодиальный.*Активен.*2 размещения.*130,20/);
  const vault = screen.getByRole("button", { name: "Открыть счёт: Хранилище" });
  expect(vault).toHaveTextContent("Депозитарный");
  expect(vault).toHaveTextContent("1 размещение");
  expect(vault).toHaveAttribute("aria-current", "true");
  expect(main).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("button", { name: "Открыть счёт: Резерв" })).toHaveTextContent("Приватный");
  expect(screen.getByRole("button", { name: "Открыть счёт: Резерв" })).toHaveTextContent("Неактивен");
  expect(screen.getByRole("button", { name: "Открыть счёт: Архив" })).toHaveTextContent("Недоступен");
  expect(screen.getByText(/оценка.*USD/i)).toBeInTheDocument();
});

it("inspects the exact account independently of context and switches context only on explicit use", () => {
  const input = props({ selectedAccountId: "vault", context: { kind: "account", accountId: "main" } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByRole("heading", { name: "Хранилище", level: 1 })).toHaveAttribute("data-mono-product-accounts-title");
  const placements = screen.getByRole("region", { name: "Размещения" });
  expect(placements).toHaveTextContent("7,25");
  expect(placements).not.toHaveTextContent("123,45");
  expect(input.onUseAccount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Выбрать счёт в кошельке" }));
  expect(input.onUseAccount).toHaveBeenCalledWith("vault");
  expect(input.onInspectAccount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам" }));
  expect(input.onBack).toHaveBeenCalledOnce();
});

it("opens a placement by its exact holding ID and keeps quantity separate from available", () => {
  const input = props({ selectedAccountId: "main" });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByLabelText("Количество USDC · Ethereum")).toHaveTextContent("123,45 USDC");
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).toHaveTextContent("90,25 USDC");
  fireEvent.click(screen.getByRole("button", { name: "Открыть актив: USD Coin · USDC · Solana" }));
  expect(input.onOpenHolding).toHaveBeenCalledWith("main-sol");
  expect(input.onUseAccount).not.toHaveBeenCalled();
});

it.each([undefined, "invalid", "-1"])("keeps missing or invalid available (%s) unknown rather than zero", availableQuantity => {
  const input = props({ selectedAccountId: "main", snapshot: { ...snapshot,
    holdings: [{ ...snapshot.holdings[0]!, availableQuantity }] } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).toHaveTextContent("Нет данных");
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).not.toHaveTextContent("0 USDC");
});

it("preserves a supplied zero available value instead of labelling it unknown", () => {
  render(<ProductAccountsWorkspace {...props({ selectedAccountId: "main", snapshot: { ...snapshot,
    holdings: [{ ...snapshot.holdings[0]!, availableQuantity: "0" }] } })} />);
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).toHaveTextContent("0 USDC");
});

it("masks list and detail financial values including accessible names while preserving identity", () => {
  const input = props({ balanceHidden: true });
  const { container, rerender } = render(<ProductAccountsWorkspace {...input} />);
  const secret = /123[.,]45|90[.,]25|130[.,]20|6[.,]75|7[.,]25/;
  function expectMasked() {
    expect(container.textContent).not.toMatch(secret);
    for (const node of container.querySelectorAll("[aria-label], [aria-valuetext], [title]")) {
      expect([node.getAttribute("aria-label"), node.getAttribute("aria-valuetext"), node.getAttribute("title")].join(" ")).not.toMatch(secret);
    }
  }
  expectMasked();
  expect(screen.getByRole("button", { name: "Открыть счёт: Основной" })).toHaveTextContent("••••");
  expect(screen.getByRole("button", { name: "Открыть счёт: Основной" })).not.toHaveAccessibleDescription(secret);
  rerender(<ProductAccountsWorkspace {...input} selectedAccountId="main" allowedActions={[sendRoute]} />);
  expectMasked();
  expect(screen.getByLabelText("Количество USDC · Ethereum")).toHaveTextContent("••••");
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).toHaveTextContent("••••");
  expect(screen.getByLabelText("Оценка активов счёта в USD")).toHaveTextContent("••••");
  expect(screen.getByRole("heading", { name: "Основной", level: 1 })).toBeInTheDocument();
});

it("offers only host-permitted canonical routes and emits exact identity including receive mode", () => {
  const input = props({ selectedAccountId: "main", allowedActions: [
    { ...sendRoute, accountLabel: "Устаревшее имя", accountKind: "private" }, receiveRoute, vaultRoute,
    { ...sendRoute, networkId: "solana", networkLabel: "Solana" }, { ...sendRoute, action: "withdraw" },
  ] });
  const { rerender } = render(<ProductAccountsWorkspace {...input} />);
  const actions = screen.getByRole("group", { name: "Подготовка операций" });
  expect(within(actions).getAllByRole("button")).toHaveLength(2);
  fireEvent.click(within(actions).getByRole("button", { name: "Подготовить отправку USDC · Основной · Ethereum" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(sendRoute);
  fireEvent.click(within(actions).getByRole("button", { name: "Подготовить получение USDC · Основной · Ethereum · Внешнее получение" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(receiveRoute);
  expect(input.onUseAccount).not.toHaveBeenCalled();
  rerender(<ProductAccountsWorkspace {...input} selectedAccountId="vault" allowedActions={[vaultRoute]} />);
  fireEvent.click(screen.getByRole("button", { name: "Подготовить получение USDC · Хранилище · Ethereum · Перевод между счетами" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(vaultRoute);
});

it("does not convert raw capability into an operation when the host permits none", () => {
  render(<ProductAccountsWorkspace {...props({ selectedAccountId: "main" })} />);
  expect(screen.queryByRole("group", { name: "Подготовка операций" })).not.toBeInTheDocument();
  expect(screen.getByText(/операции.*недоступны/i)).toBeInTheDocument();
});

it.each(["rest", "offline"])("keeps %s account read-only even when stale allowed routes are supplied", selectedAccountId => {
  render(<ProductAccountsWorkspace {...props({ selectedAccountId,
    allowedActions: [{ ...sendRoute, accountId: selectedAccountId }] })} />);
  expect(screen.queryByRole("group", { name: "Подготовка операций" })).not.toBeInTheDocument();
  expect(screen.getByText(/операции.*недоступны/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /активир|создать|повысить/i })).not.toBeInTheDocument();
});

it("still offers a permitted receive route when there are no account holdings", () => {
  const input = props({ selectedAccountId: "vault", allowedActions: [vaultRoute], snapshot: { ...snapshot, holdings: [] } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByText(/размещений пока нет/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Подготовить получение USDC · Хранилище/ }));
  expect(input.onOpenAction).toHaveBeenCalledWith(vaultRoute);
});

it("discards removed selected account data without falling back to another account", () => {
  const input = props({ selectedAccountId: "main", allowedActions: [sendRoute] });
  const { container, rerender } = render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByLabelText("Количество USDC · Ethereum")).toHaveTextContent("123,45");
  rerender(<ProductAccountsWorkspace {...input} snapshot={{ ...snapshot, accounts: snapshot.accounts.slice(1) }} />);
  expect(screen.getByRole("heading", { name: "Счёт недоступен", level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Хранилище", level: 1 })).not.toBeInTheDocument();
  expect(container.textContent).not.toMatch(/123,45|90,25|130,20/);
  expect(screen.queryByRole("button", { name: /Подготовить|Выбрать счёт|Открыть актив/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Назад к счетам" }));
  expect(input.onBack).toHaveBeenCalledOnce();
});
