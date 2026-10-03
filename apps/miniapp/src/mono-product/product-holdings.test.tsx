import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MULTI_ACCOUNT_DEMO, SINGLE_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { MONO_ASSET_LIST_DEFAULT } from "../mono-preview/mono-scene-lab-contract";
import { useMonoProductController } from "./product-controller";
import { ProductHoldings } from "./product-home";

afterEach(cleanup);

function Holdings({ snapshot = MULTI_ACCOUNT_DEMO, hidden = false, onPlacementAction, onOpenAsset }: {
  snapshot?: ProductSnapshot;
  hidden?: boolean;
  onPlacementAction?: (holdingId: string, action: "send" | "receive") => void;
  onOpenAsset?: (assetId: string) => void;
}) {
  const product = useMonoProductController({ kind: "demo", snapshot }, { initialHidden: hidden });
  return <>
    <ProductHoldings {...product} appearance={MONO_ASSET_LIST_DEFAULT} overview={false}
      onPlacementAction={onPlacementAction} onOpenAsset={onOpenAsset} />
    {product.view.sheet?.kind === "intent" && <output aria-label="Открытое действие">
      {product.view.sheet.action} · {product.view.context.kind === "account" ? product.view.context.accountId : "all"}
    </output>}
  </>;
}

it("dispatches the chosen placement and action from an aggregate asset, never its total", () => {
  const action = vi.fn();
  render(<Holdings onPlacementAction={action} />);
  fireEvent.click(screen.getByRole("button", { name: /USD Coin/ }));

  fireEvent.click(screen.getByRole("button", { name: "Отправить USDC · Основной · Ethereum" }));
  fireEvent.click(screen.getByRole("button", { name: "Получить USDC · Основной · Solana" }));

  expect(action.mock.calls).toEqual([
    ["demo-usdc-eth", "send"],
    ["demo-usdc-sol", "receive"],
  ]);
  expect(screen.queryByLabelText("Открытое действие")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /(?:Отправить|Получить).*Размещение/ })).not.toBeInTheDocument();
});

it("shows placement shortcuts only when a consumer is connected", () => {
  render(<Holdings />);
  fireEvent.click(screen.getByRole("button", { name: /USD Coin/ }));
  expect(screen.queryByRole("button", { name: /^(Отправить|Получить)/ })).not.toBeInTheDocument();
});

it.each(["inactive", "unavailable", "missing-account", "wrong-network", "wrong-asset", "unavailable-receive"] as const)(
  "does not offer a placement action when its route is %s",
  condition => {
    const account = SINGLE_ACCOUNT_DEMO.accounts[0];
    const receive = account.capabilities[1];
    const snapshot: ProductSnapshot = {
      ...SINGLE_ACCOUNT_DEMO,
      accounts: condition === "missing-account" ? [] : [{
        ...account,
        status: condition === "inactive" || condition === "unavailable" ? condition : "active",
        capabilities: condition === "wrong-network" ? [{ ...receive, networkId: "solana" }]
          : condition === "wrong-asset" ? [{ ...receive, assetId: "eth" }]
            : condition === "unavailable-receive" ? [{ ...receive, receiveMode: "unavailable" }]
              : account.capabilities,
      }],
    };
    const action = vi.fn();
    render(<Holdings snapshot={snapshot} onPlacementAction={action} />);
    fireEvent.click(screen.getByRole("button", { name: /USD Coin/ }));

    expect(screen.queryByRole("button", { name: /^(Отправить|Получить)/ })).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  },
);

it("hides amounts in expanded rows and action names while keeping exact placement routing", () => {
  const action = vi.fn();
  const { container } = render(<Holdings snapshot={SINGLE_ACCOUNT_DEMO} hidden onPlacementAction={action} />);
  fireEvent.click(screen.getByRole("button", { name: /USD Coin/ }));

  expect(container).toHaveTextContent("••••");
  expect(container.innerHTML).not.toMatch(/1250|1[\s\u00a0\u202f]250/);
  fireEvent.click(screen.getByRole("button", { name: "Отправить USDC · Основной · Ethereum" }));
  expect(action).toHaveBeenCalledWith("demo-single-usdc", "send");
});

it("keeps unknown quantity and availability explicit instead of displaying zero", () => {
  const snapshot: ProductSnapshot = {
    ...SINGLE_ACCOUNT_DEMO,
    holdings: [{ ...SINGLE_ACCOUNT_DEMO.holdings[0], quantity: "unknown", availableQuantity: undefined }],
  };
  render(<Holdings snapshot={snapshot} onPlacementAction={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /USD Coin/ }));

  expect(screen.getByText("Количество неизвестно")).toBeInTheDocument();
  expect(screen.getByText("Доступно: нет данных")).toBeInTheDocument();
  expect(screen.queryByText("0 USDC")).not.toBeInTheDocument();
});

it("offers the available receive flow for an empty account without inventing a holding", () => {
  render(<Holdings snapshot={{ ...SINGLE_ACCOUNT_DEMO, holdings: [] }} />);
  expect(screen.getByText("Активов пока нет")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Получить активы" }));
  expect(screen.getByLabelText("Открытое действие")).toHaveTextContent("receive · demo-single");
});

it("does not promise receiving on an empty inactive account", () => {
  render(<Holdings snapshot={{ ...SINGLE_ACCOUNT_DEMO, holdings: [],
    accounts: [{ ...SINGLE_ACCOUNT_DEMO.accounts[0], status: "inactive" }] }} />);
  expect(screen.getByText("Счёт не активирован")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Получить активы" })).not.toBeInTheDocument();
});

it("opens an asset from its primary row and keeps placement disclosure as a separate action", () => {
  const open = vi.fn();
  const action = vi.fn();
  render(<Holdings onOpenAsset={open} onPlacementAction={action} />);
  const primary = screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" });
  const disclosure = screen.getByRole("button", { name: "Показать размещения USDC" });

  expect(primary).not.toContainElement(disclosure);
  expect(primary).toHaveAccessibleDescription(/900,00/);
  fireEvent.click(primary);
  expect(open).toHaveBeenCalledWith("usdc");
  expect(disclosure).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "Отправить USDC · Основной · Solana" })).not.toBeInTheDocument();

  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Отправить USDC · Основной · Solana" }));
  expect(action).toHaveBeenCalledWith("demo-usdc-sol", "send");
  expect(open).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Свернуть размещения USDC" }));
  expect(screen.queryByRole("button", { name: "Отправить USDC · Основной · Solana" })).not.toBeInTheDocument();
});

it("does not reveal private balances in asset-entry names or inline placements", () => {
  const { container } = render(<Holdings snapshot={SINGLE_ACCOUNT_DEMO} hidden onOpenAsset={vi.fn()} />);
  const primary = screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" });
  expect(primary).toHaveTextContent("••••");
  expect(primary).toHaveAccessibleDescription(/••••/);
  fireEvent.click(screen.getByRole("button", { name: "Показать размещения USDC" }));
  expect(container.innerHTML).not.toMatch(/1250|1[\s\u00a0\u202f]250/);
});
