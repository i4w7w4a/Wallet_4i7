import "@testing-library/jest-dom/vitest";
import { MULTI_ACCOUNT_DEMO, resolveActionRoutes, type ProductHolding } from "@wallet/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CustodyAccountView, type CustodyAccountViewProps } from "../custody-slice";

afterEach(cleanup);

const account = MULTI_ACCOUNT_DEMO.accounts.find(item => item.id === "demo-custody")!;
const holdings = MULTI_ACCOUNT_DEMO.holdings.filter(item => item.accountId === account.id);
const context = { kind: "account", accountId: "demo-custody" } as const;
const receiveRoutes = resolveActionRoutes(MULTI_ACCOUNT_DEMO, context, "receive").routes;

function props(patch: Partial<CustodyAccountViewProps> = {}): CustodyAccountViewProps {
  return { account, holdings, estimateMinor: 123456, current: true, contextLabel: "Все счета", balanceHidden: false,
    permittedRoutes: receiveRoutes, expandedHoldingId: null, onExpandedHoldingChange: vi.fn(), onUseAccount: vi.fn(),
    onOpenAction: vi.fn(), onOpenHolding: vi.fn(), ...patch };
}

it("uses the chosen route identity after reordering and reports a rejected callback", () => {
  const onOpenAction = vi.fn<CustodyAccountViewProps["onOpenAction"]>(() => false);
  render(<CustodyAccountView {...props({ permittedRoutes: [...receiveRoutes].reverse(), onOpenAction })} />);
  expect(screen.getByRole("button", { name: "Отправить" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
  expect(onOpenAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  expect(onOpenAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {
    name: "Подготовить получение USDC · Основной · Ethereum · Внешнее получение",
  }));
  expect(onOpenAction).toHaveBeenCalledOnce();
  expect(onOpenAction.mock.calls[0]?.[0]).toMatchObject({
    accountId: "demo-custody", assetId: "usdc", networkId: "ethereum", action: "receive", receiveMode: "external-address",
  });
  expect(onOpenAction.mock.calls[0]?.[1]).toEqual({
    kind: "account-quick-action", action: "receive", routeKey: "receive:demo-custody:usdc:ethereum:external-address",
  });
  expect(screen.getByRole("status")).toHaveTextContent(/недоступна/i);
});

it("returns focus to the holding launcher when its controlled disclosure closes", () => {
  const holding = holdings.find(item => item.id === "demo-usdc-eth")!;
  const input = props({ expandedHoldingId: holding.id });
  const { rerender } = render(<CustodyAccountView {...input} />);
  const launcher = screen.getByRole("button", { name: /Действия: USD Coin · USDC · Ethereum/ });
  const details = screen.getByRole("button", { name: /Подробнее: USD Coin · USDC · Ethereum/ });
  details.focus();
  expect(details).toHaveFocus();
  rerender(<CustodyAccountView {...input} expandedHoldingId={null} />);
  expect(launcher).toHaveFocus();
  expect(launcher).toHaveAttribute("aria-expanded", "false");
});

it("explains a holding's unavailable send and zero available without blocking permitted receive or leaking zero in privacy", () => {
  const original = holdings.find(item => item.id === "demo-usdc-eth")!;
  const holding: ProductHolding = { ...original, availableQuantity: "0" };
  const receive = receiveRoutes.filter(route => route.assetId === "usdc" && route.networkId === "ethereum");
  const input = props({ holdings: [holding], permittedRoutes: receive, expandedHoldingId: holding.id });
  const { rerender } = render(<CustodyAccountView {...input} />);
  const launcher = screen.getByRole("button", { name: /Действия: USD Coin · USDC · Ethereum/ });
  expect(launcher).toHaveAccessibleDescription(/Отправка недоступна/);
  expect(launcher).toHaveAccessibleDescription(/Доступных средств пока нет/);
  const actions = screen.getByRole("group", { name: /Операции: USDC · Ethereum/ });
  fireEvent.click(within(actions).getByRole("button", { name: "Получить" }));
  expect(input.onOpenAction).toHaveBeenCalledOnce();
  rerender(<CustodyAccountView {...input} balanceHidden />);
  expect(launcher).toHaveAccessibleDescription(/Отправка недоступна/);
  expect(launcher).not.toHaveAccessibleDescription(/Доступных средств пока нет/);
  expect(screen.queryByText(/Доступных средств пока нет/)).not.toBeInTheDocument();
});

it("connects a holding's multi-route disclosure to its actual choices region", () => {
  const holding = holdings.find(item => item.id === "demo-usdc-eth")!;
  const external = receiveRoutes.find(route => route.assetId === "usdc" && route.networkId === "ethereum")!;
  if (external.action !== "receive") throw new Error("Expected a receive route");
  const internal = { ...external, receiveMode: "internal-transfer" as const };
  render(<CustodyAccountView {...props({ holdings: [holding], permittedRoutes: [external, internal], expandedHoldingId: holding.id })} />);
  const actions = screen.getByRole("group", { name: /Операции: USDC · Ethereum/ });
  const launcher = within(actions).getByRole("button", { name: "Получить" });
  expect(launcher).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(launcher);
  const choices = screen.getByRole("group", { name: /Выбор способа операции/ });
  expect(launcher).toHaveAttribute("aria-expanded", "true");
  expect(launcher).toHaveAttribute("aria-controls", choices.id);
  expect(choices.id).not.toBe("");
});

it("returns focus and clears an open account choice when route updates leave a single option", () => {
  const input = props();
  const { rerender } = render(<CustodyAccountView {...input} />);
  const launcher = screen.getByRole("button", { name: "Получить" });
  fireEvent.click(launcher);
  const choice = screen.getByRole("button", {
    name: "Подготовить получение USDC · Основной · Ethereum · Внешнее получение",
  });
  choice.focus();
  expect(choice).toHaveFocus();
  const onlyEthereum = receiveRoutes.filter(route => route.assetId === "usdc" && route.networkId === "ethereum");
  rerender(<CustodyAccountView {...input} permittedRoutes={onlyEthereum} />);
  expect(launcher).toHaveFocus();
  expect(launcher).not.toHaveAttribute("aria-expanded");
  expect(launcher).not.toHaveAttribute("aria-controls");
  rerender(<CustodyAccountView {...input} />);
  expect(launcher).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", {
    name: "Подготовить получение USDC · Основной · Ethereum · Внешнее получение",
  })).not.toBeInTheDocument();
});

it("explains an unsupported holding even when the account has routes for another network", () => {
  const holding = holdings.find(item => item.id === "demo-usdc-eth")!;
  const bitcoinRoutes = receiveRoutes.filter(route => route.assetId === "btc");
  expect(bitcoinRoutes.length).toBeGreaterThan(0);
  render(<CustodyAccountView {...props({ holdings: [holding], permittedRoutes: bitcoinRoutes })} />);
  const launcher = screen.getByRole("button", { name: /Сведения: USD Coin · USDC · Ethereum/ });
  expect(launcher).toHaveAccessibleDescription(/Операции сейчас недоступны/);
});

it("does not turn USD into an unknown available quantity and masks values in privacy mode", () => {
  const original = holdings.find(item => item.id === "demo-usdc-eth")!;
  const holding: ProductHolding = { ...original, quantity: "98.765", availableQuantity: undefined, fiatMinor: 7654321 };
  const input = props({ holdings: [holding], expandedHoldingId: holding.id, estimateMinor: 7654321 });
  const { container, rerender } = render(<CustodyAccountView {...input} />);
  expect(within(screen.getByRole("group", { name: /Доступное количество USDC · Ethereum/ })).getByText("Нет данных")).toBeVisible();
  expect(screen.getByText(/98[.,]765/)).toBeVisible();
  rerender(<CustodyAccountView {...input} balanceHidden />);
  expect(container.textContent).not.toMatch(/98[.,]765|76[\s\u00a0\u202f,.]*543/);
  for (const element of container.querySelectorAll("[aria-label], [aria-describedby], [title]")) {
    expect(`${element.getAttribute("aria-label")} ${element.getAttribute("aria-describedby")} ${element.getAttribute("title")}`).not.toMatch(/98[.,]765|76[\s\u00a0\u202f,.]*543/);
  }
  expect(screen.getByRole("button", { name: /Действия: USD Coin · USDC · Ethereum/ })).toBeVisible();
});

it("presents the scoped assets wallet and opens the exact USDC Ethereum receive route", () => {
  const scopedAccount = { ...account, label: "Кастодиальный" };
  const allRoutes = (["receive", "send", "buy", "swap"] as const).flatMap(action =>
    resolveActionRoutes(MULTI_ACCOUNT_DEMO, context, action).routes.map(route => ({ ...route, accountLabel: scopedAccount.label })));
  const onOpenAction = vi.fn<CustodyAccountViewProps["onOpenAction"]>();
  render(<CustodyAccountView {...props({ account: scopedAccount, presentation: "assets", permittedRoutes: allRoutes, onOpenAction })} />);

  expect(screen.getByRole("heading", { name: "Кастодиальный", level: 1 })).toHaveAttribute("data-mono-product-accounts-title");
  expect(screen.getByRole("region", { name: "Оценка активов счёта" })).toHaveTextContent(/1\s?234,56/);
  expect(screen.getByRole("heading", { name: "Активы" })).toBeVisible();
  expect(screen.getByRole("button", { name: /Действия: USD Coin · USDC · Ethereum/ })).toBeVisible();
  for (const name of ["Получить", "Отправить", "Купить", "Обменять"]) {
    expect(screen.getByRole("button", { name })).toBeEnabled();
  }
  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  expect(onOpenAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Подготовить получение USDC · Кастодиальный · Ethereum · Внешнее получение" }));
  expect(onOpenAction).toHaveBeenCalledOnce();
  expect(onOpenAction.mock.calls[0]?.[0]).toMatchObject({ accountId: "demo-custody", accountLabel: "Кастодиальный",
    action: "receive", assetId: "usdc", networkId: "ethereum", receiveMode: "external-address" });
  expect(onOpenAction.mock.calls[0]?.[1]).toEqual({ kind: "account-quick-action", action: "receive",
    routeKey: "receive:demo-custody:usdc:ethereum:external-address" });
});

it("keeps secondary account control and its unavailability reason available in assets presentation", () => {
  const onUseAccount = vi.fn();
  const input = props({ account: { ...account, label: "Кастодиальный" }, presentation: "assets", current: false,
    contextLabel: "Общий обзор", useAccountUnavailableReason: "Выбор сейчас недоступен", onUseAccount });
  const { rerender } = render(<CustodyAccountView {...input} />);
  expect(screen.queryByText("В кошельке сейчас: Общий обзор.")).not.toBeVisible();
  expect(screen.getByRole("button", { name: "Отправить" })).toBeDisabled();
  fireEvent.click(screen.getByText("Управление счётом"));
  const use = screen.getByRole("button", { name: /Выбрать счёт в кошельке/ });
  expect(use).toBeDisabled();
  expect(use).toHaveAccessibleDescription("Выбор сейчас недоступен");
  rerender(<CustodyAccountView {...input} useAccountUnavailableReason={undefined} />);
  fireEvent.click(screen.getByRole("button", { name: /Выбрать счёт в кошельке/ }));
  expect(onUseAccount).toHaveBeenCalledOnce();
  expect(onUseAccount).toHaveBeenCalledWith("demo-custody");
});

it("restores holding focus and masks scoped amounts in assets presentation", () => {
  const holding = holdings.find(item => item.id === "demo-usdc-eth")!;
  const input = props({ account: { ...account, label: "Кастодиальный" }, presentation: "assets", holdings: [holding], expandedHoldingId: holding.id });
  const { container, rerender } = render(<CustodyAccountView {...input} />);
  const launcher = screen.getByRole("button", { name: /Действия: USD Coin · USDC · Ethereum/ });
  screen.getByRole("button", { name: /Подробнее: USD Coin · USDC · Ethereum/ }).focus();
  rerender(<CustodyAccountView {...input} expandedHoldingId={null} balanceHidden />);
  expect(launcher).toHaveFocus();
  expect(launcher).toHaveAttribute("aria-expanded", "false");
  expect(container.textContent).not.toMatch(/1[\s\u00a0\u202f]?234[.,]56|500/);
  for (const element of container.querySelectorAll("[aria-label], [aria-describedby], [title]")) {
    expect(`${element.getAttribute("aria-label")} ${element.getAttribute("aria-describedby")} ${element.getAttribute("title")}`).not.toMatch(/1[\s\u00a0\u202f]?234[.,]56|500/);
  }
});


it("retains the existing catalogue presentation when the new prop is omitted", () => {
  render(<CustodyAccountView {...props({ current: false, contextLabel: "Общий обзор" })} />);
  expect(screen.getByRole("heading", { name: "Основной · Демо", level: 1 })).toBeVisible();
  expect(screen.getByText("В кошельке сейчас: Общий обзор.")).toBeVisible();
  expect(screen.getByRole("button", { name: /Выбрать счёт в кошельке/ })).toBeVisible();
});
