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
  expect(screen.getByRole("button", { name: "Отправить", exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Отправить", exact: true }));
  expect(onOpenAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Получить", exact: true }));
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
