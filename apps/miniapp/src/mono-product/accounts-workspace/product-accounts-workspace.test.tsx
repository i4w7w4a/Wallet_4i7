import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ProductActionRoute, ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { ProductAccountsWorkspace, type ProductAccountsWorkspaceProps } from "./index";

afterEach(cleanup);

it("shows unavailable Use with its reason and preserves the default enabled callback contract", () => {
  const input = props({ selectedAccountId: "main" });
  const { rerender } = render(<ProductAccountsWorkspace {...input}
    useAccountUnavailableReason="Переход к обзору сейчас недоступен." />);
  const use = screen.getByRole("button", { name: "Выбрать счёт в кошельке" });
  expect(use).toBeDisabled();
  expect(use).toHaveAccessibleDescription("Переход к обзору сейчас недоступен.");
  fireEvent.click(use);
  expect(input.onUseAccount).not.toHaveBeenCalled();
  rerender(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByRole("button", { name: "Выбрать счёт в кошельке" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Выбрать счёт в кошельке" }));
  expect(input.onUseAccount).toHaveBeenCalledOnce();
  expect(input.onUseAccount).toHaveBeenCalledWith("main");
});

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

function disclosure(network = "Ethereum") {
  return screen.getByRole("button", { name: new RegExp(`^(Действия|Сведения): USD Coin · USDC · ${network}$`) });
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

it("discloses one exact holding without changing context and opens Details only explicitly", () => {
  const input = props({ selectedAccountId: "main" });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByLabelText("Количество USDC · Ethereum")).toHaveTextContent("123,45 USDC");
  expect(screen.queryByLabelText("Доступное количество USDC · Ethereum")).not.toBeInTheDocument();
  expect(disclosure()).toHaveAttribute("data-product-holding-id", "main-eth");
  expect(disclosure()).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(disclosure());
  expect(disclosure()).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).toHaveTextContent("90,25 USDC");
  expect(input.onOpenHolding).not.toHaveBeenCalled();
  expect(input.onOpenAction).not.toHaveBeenCalled();
  fireEvent.click(disclosure("Solana"));
  expect(disclosure()).toHaveAttribute("aria-expanded", "false");
  expect(disclosure("Solana")).toHaveAttribute("aria-expanded", "true");
  expect(screen.queryByLabelText("Доступное количество USDC · Ethereum")).not.toBeInTheDocument();
  const details = screen.getByRole("button", { name: "Подробнее: USD Coin · USDC · Solana" });
  expect(details).toHaveAttribute("data-product-holding-detail-id", "main-sol");
  expect(details.closest("button button")).toBeNull();
  fireEvent.click(details);
  expect(input.onOpenHolding).toHaveBeenCalledWith("main-sol");
  expect(input.onUseAccount).not.toHaveBeenCalled();
});

it("lets the host own disclosure state without silently selecting another holding", () => {
  const input = props({ selectedAccountId: "main", expandedHoldingId: null, onExpandedHoldingChange: vi.fn() });
  const { rerender } = render(<ProductAccountsWorkspace {...input} />);
  fireEvent.click(disclosure());
  expect(input.onExpandedHoldingChange).toHaveBeenCalledWith("main-eth");
  expect(disclosure()).toHaveAttribute("aria-expanded", "false");
  rerender(<ProductAccountsWorkspace {...input} expandedHoldingId="main-eth" />);
  expect(disclosure()).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(disclosure());
  expect(input.onExpandedHoldingChange).toHaveBeenLastCalledWith(null);
  rerender(<ProductAccountsWorkspace {...input} expandedHoldingId="vault-eth" />);
  expect(disclosure()).toHaveAttribute("aria-expanded", "false");
  expect(disclosure("Solana")).toHaveAttribute("aria-expanded", "false");
  expect(input.onOpenHolding).not.toHaveBeenCalled();
});

it.each([undefined, "invalid", "-1"])("keeps missing or invalid available (%s) unknown rather than zero", availableQuantity => {
  const input = props({ selectedAccountId: "main", snapshot: { ...snapshot,
    holdings: [{ ...snapshot.holdings[0]!, availableQuantity }] } });
  render(<ProductAccountsWorkspace {...input} />);
  fireEvent.click(disclosure());
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).toHaveTextContent("Нет данных");
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).not.toHaveTextContent("0 USDC");
});

it("keeps zero distinct from unknown without forbidding permitted preparation", () => {
  const input = props({ selectedAccountId: "main", allowedActions: [sendRoute], snapshot: { ...snapshot,
    holdings: [{ ...snapshot.holdings[0]!, availableQuantity: "0" }] } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByText("Доступных средств пока нет.")).toBeInTheDocument();
  fireEvent.click(disclosure());
  expect(screen.getByLabelText("Доступное количество USDC · Ethereum")).toHaveTextContent("0 USDC");
  const send = screen.getByRole("button", { name: "Подготовить отправку USDC · Основной · Ethereum" });
  expect(send).toBeEnabled();
  fireEvent.click(send);
  expect(input.onOpenAction).toHaveBeenCalledWith(sendRoute, {
    kind: "holding-action", holdingId: "main-eth", action: "send", routeKey: "send:main:usdc:ethereum:",
  });
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
  fireEvent.click(disclosure());
  expectMasked();
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
  expect(screen.queryByRole("button", { name: /Подготовить отправку/ })).not.toBeInTheDocument();
  fireEvent.click(disclosure());
  const actions = screen.getByRole("group", { name: "Операции: USDC · Ethereum" });
  expect(within(actions).getAllByRole("button")).toHaveLength(2);
  fireEvent.click(within(actions).getByRole("button", { name: "Подготовить отправку USDC · Основной · Ethereum" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(sendRoute, {
    kind: "holding-action", holdingId: "main-eth", action: "send", routeKey: "send:main:usdc:ethereum:",
  });
  fireEvent.click(within(actions).getByRole("button", { name: "Подготовить получение USDC · Основной · Ethereum · Внешнее получение" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(receiveRoute, {
    kind: "holding-action", holdingId: "main-eth", action: "receive", routeKey: "receive:main:usdc:ethereum:external-address",
  });
  expect(input.onUseAccount).not.toHaveBeenCalled();
  rerender(<ProductAccountsWorkspace {...input} selectedAccountId="vault" allowedActions={[vaultRoute]} />);
  fireEvent.click(screen.getByRole("button", { name: "Получить на счёт" }));
  fireEvent.click(screen.getByRole("button", { name: "Подготовить получение USDC · Хранилище · Ethereum · Перевод между счетами" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(vaultRoute, {
    kind: "account-action", entry: "receive", action: "receive", routeKey: "receive:vault:usdc:ethereum:internal-transfer",
  });
});

it("does not convert raw capability into an operation when the host permits none", () => {
  render(<ProductAccountsWorkspace {...props({ selectedAccountId: "main" })} />);
  expect(screen.queryByRole("group", { name: "Подготовка операций" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Операции" })).getByText(/операции.*недоступны/i)).toBeInTheDocument();
});

it.each(["rest", "offline"])("keeps %s account read-only even when stale allowed routes are supplied", selectedAccountId => {
  render(<ProductAccountsWorkspace {...props({ selectedAccountId,
    allowedActions: [{ ...sendRoute, accountId: selectedAccountId }] })} />);
  expect(screen.queryByRole("group", { name: "Подготовка операций" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Операции" })).getByText(/операции.*недоступны/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /активир|создать|повысить/i })).not.toBeInTheDocument();
});

it("still offers a permitted receive route when there are no account holdings", () => {
  const input = props({ selectedAccountId: "vault", allowedActions: [vaultRoute], snapshot: { ...snapshot, holdings: [] } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.getByText(/размещений пока нет/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Подготовить получение/ })).not.toBeInTheDocument();
  const receive = screen.getByRole("button", { name: "Получить на счёт" });
  expect(receive).toHaveAttribute("data-product-account-entry", "receive");
  fireEvent.click(receive);
  fireEvent.click(screen.getByRole("button", { name: /Подготовить получение USDC · Хранилище/ }));
  expect(input.onOpenAction).toHaveBeenCalledWith(vaultRoute, {
    kind: "account-action", entry: "receive", action: "receive", routeKey: "receive:vault:usdc:ethereum:internal-transfer",
  });
});

it("requires an explicit receive variant and keeps buy and swap behind More", () => {
  const internalReceive: ProductActionRoute = { ...receiveRoute, receiveMode: "internal-transfer" };
  const buy: ProductActionRoute = { ...sendRoute, action: "buy" };
  const swap: ProductActionRoute = { ...sendRoute, action: "swap" };
  const input = props({ selectedAccountId: "main", allowedActions: [sendRoute, receiveRoute, internalReceive, buy, swap],
    snapshot: { ...snapshot, accounts: snapshot.accounts.map(account => account.id === "main"
      ? { ...account, capabilities: [...account.capabilities, { ...usdc, action: "receive", receiveMode: "internal-transfer" }] }
      : account) } });
  render(<ProductAccountsWorkspace {...input} />);
  fireEvent.click(disclosure());
  const receive = screen.getByRole("button", { name: "Получить USDC · Основной · Ethereum: выбрать способ" });
  expect(receive).toHaveAttribute("data-product-holding-action-id", "main-eth");
  expect(receive).toHaveAttribute("data-product-holding-action", "receive");
  expect(screen.queryByRole("button", { name: /Подготовить покупку/ })).not.toBeInTheDocument();
  fireEvent.click(receive);
  expect(input.onOpenAction).not.toHaveBeenCalled();
  expect(receive).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Подготовить получение USDC · Основной · Ethereum · Перевод между счетами" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(internalReceive, {
    kind: "holding-action", holdingId: "main-eth", action: "receive", routeKey: "receive:main:usdc:ethereum:internal-transfer",
  });
  const more = screen.getByRole("button", { name: "Ещё операции USDC · Основной · Ethereum" });
  expect(more).toHaveAttribute("data-product-holding-action-id", "main-eth");
  expect(more).toHaveAttribute("data-product-holding-action", "more");
  fireEvent.click(more);
  expect(receive).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button", { name: "Подготовить обмен USDC · Основной · Ethereum" }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(swap, {
    kind: "holding-action", holdingId: "main-eth", action: "swap", routeKey: "swap:main:usdc:ethereum:",
  });
  fireEvent.click(screen.getByRole("button", { name: "Получить на счёт" }));
  const accountChoices = screen.getByRole("group", { name: "Получение на счёт" });
  expect(within(accountChoices).getAllByRole("button")).toHaveLength(2);
  fireEvent.click(within(accountChoices).getByRole("button", { name: /Внешнее получение/ }));
  expect(input.onOpenAction).toHaveBeenLastCalledWith(receiveRoute, {
    kind: "account-action", entry: "receive", action: "receive", routeKey: "receive:main:usdc:ethereum:external-address",
  });
});

it("keeps permitted operations without holdings reachable through the account entry", () => {
  const unplaced: ProductActionRoute = { ...sendRoute, action: "buy", ...solana };
  const input = props({ selectedAccountId: "main", allowedActions: [unplaced], snapshot: { ...snapshot,
    holdings: [snapshot.holdings[0]!], accounts: [{ ...snapshot.accounts[0]!, capabilities: [{ ...solana, action: "buy" }] }] } });
  render(<ProductAccountsWorkspace {...input} />);
  expect(screen.queryByRole("button", { name: /Подготовить покупку/ })).not.toBeInTheDocument();
  const other = screen.getByRole("button", { name: "Другие операции" });
  expect(other).toHaveAttribute("data-product-account-entry", "other");
  fireEvent.click(other);
  fireEvent.click(screen.getByRole("button", { name: "Подготовить покупку USDC · Основной · Solana" }));
  expect(input.onOpenAction).toHaveBeenCalledWith(unplaced, {
    kind: "account-action", entry: "other", action: "buy", routeKey: "buy:main:usdc:solana:",
  });
});

it("announces a rejected exact preparation without falling back to another route", () => {
  const input = props({ selectedAccountId: "main", allowedActions: [sendRoute, receiveRoute], onOpenAction: vi.fn(() => false) });
  render(<ProductAccountsWorkspace {...input} />);
  fireEvent.click(disclosure());
  fireEvent.click(screen.getByRole("button", { name: "Подготовить отправку USDC · Основной · Ethereum" }));
  expect(input.onOpenAction).toHaveBeenCalledOnce();
  expect(input.onOpenAction).toHaveBeenCalledWith(sendRoute, {
    kind: "holding-action", holdingId: "main-eth", action: "send", routeKey: "send:main:usdc:ethereum:",
  });
  expect(screen.getByRole("status")).toHaveTextContent("Эта операция сейчас недоступна.");
  expect(disclosure()).toHaveAttribute("aria-expanded", "true");
  expect(input.onOpenHolding).not.toHaveBeenCalled();
  expect(input.onUseAccount).not.toHaveBeenCalled();
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
