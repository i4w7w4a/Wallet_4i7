import "@testing-library/jest-dom/vitest";
import { MULTI_ACCOUNT_DEMO, resolveActionRoutes } from "@wallet/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductAccountsWorkspace } from "../accounts-workspace";

afterEach(cleanup);

it("offers the four custody actions and opens the chosen USDC Ethereum receive route", () => {
  const context = { kind: "account", accountId: "demo-custody" } as const;
  const allowedActions = (["receive", "send", "buy", "swap"] as const).flatMap(
    action => resolveActionRoutes(MULTI_ACCOUNT_DEMO, context, action).routes,
  );
  const onOpenAction = vi.fn();
  render(<ProductAccountsWorkspace snapshot={MULTI_ACCOUNT_DEMO} selectedAccountId="demo-custody"
    context={{ kind: "all" }} balanceHidden={false} allowedActions={allowedActions}
    onInspectAccount={vi.fn()} onBack={vi.fn()} onUseAccount={vi.fn()}
    onOpenAction={onOpenAction} onOpenHolding={vi.fn()} />);

  expect(screen.getByRole("heading", { name: /Основной/ })).toBeVisible();
  for (const name of ["Получить", "Отправить", "Купить", "Обменять"]) {
    expect(screen.getByRole("button", { name })).toBeVisible();
  }

  fireEvent.click(screen.getByRole("button", { name: "Получить" }));
  expect(onOpenAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {
    name: "Подготовить получение USDC · Основной · Ethereum · Внешнее получение",
  }));
  expect(onOpenAction).toHaveBeenCalledOnce();
  expect(onOpenAction.mock.calls[0]?.[0]).toMatchObject({
    action: "receive", accountId: "demo-custody", assetId: "usdc",
    networkId: "ethereum", receiveMode: "external-address",
  });
});
