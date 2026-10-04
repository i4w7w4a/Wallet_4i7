import { expect, it } from "vitest";
import type { ProductActivity } from "./demo-activity";
import { scopeProductActivities } from "./product-activity-scope";
import { filterHistoryActivities } from "./history-filters";
import { createBuyActivityFixture, createSwapActivityFixture, createSwapSimulationFixture } from "./commerce-test-fixtures";

it("searches public asset, account and network labels from both swap legs", () => {
  const commerce = createSwapSimulationFixture();
  commerce.quote.credit = {
    ...commerce.quote.credit, name: "Эфириум", accountId: "demo-depositary", accountKind: "depositary", accountLabel: "Хранилище",
    networkId: "solana", networkLabel: "Solana",
  };
  commerce.quote.request.destination = { ...commerce.quote.credit };
  const record = createSwapActivityFixture({ commerce });

  expect(filterHistoryActivities([record], {
    query: " usdc USD Coin основной Ethereum ETH Эфириум Хранилище Solana ", direction: "exchange", status: "completed",
  }).map(({ id }) => id)).toEqual(["commerce-swap-fixture"]);
});

it("can find a buy by its public fiat currency and crypto name without searching its money", () => {
  const record = createBuyActivityFixture();

  expect(filterHistoryActivities([record], { query: "USD USD Coin", direction: "incoming", status: "completed" })
    .map(({ id }) => id)).toEqual(["commerce-buy-fixture"]);
});

it.each([
  "101", "100", "0.04", "2500", "0.0004", "2000000000000", "commerce-swap-fixture",
  "swap-attempt-fixture", "swap-quote-fixture", "swap-port-fixture", "demo-custody", "demo-usdc-eth-ethereum",
])("does not search commerce quantities, rates, timestamps or identifiers: %s", query => {
  expect(filterHistoryActivities([createSwapActivityFixture(), createBuyActivityFixture()], {
    query, direction: "all", status: "all",
  })).toEqual([]);
});

const ethereum: ProductActivity = {
  id: "eth-main", accountId: "main", accountLabel: "Основной счёт", assetId: "usdc", assetSymbol: "USDC",
  networkId: "ethereum", networkLabel: "Ethereum", direction: "incoming", status: "pending",
  quantity: "31.456789", feeLabel: "0.004321 ETH", occurredAt: "2026-10-03T10:00:00Z",
};
const solana: ProductActivity = { ...ethereum, id: "sol-main", networkId: "solana", networkLabel: "Solana", status: "failed" };
const completed: ProductActivity = { ...ethereum, id: "eth-completed", status: "completed", direction: "outgoing" };
const foreign: ProductActivity = { ...solana, id: "sol-foreign", accountId: "foreign", accountLabel: "Другой счёт" };
const activities = [solana, ethereum, completed, foreign];

it("ANDs normalized words across only currency, network and account labels after account scoping", () => {
  const scoped = scopeProductActivities(activities, ["main"]);
  const matches = filterHistoryActivities(scoped, { query: "  uSdC\tETHereum  основной\u00a0счёт ", direction: "all", status: "all" });
  expect(matches.map(activity => activity.id)).toEqual(["eth-main", "eth-completed"]);
  expect(filterHistoryActivities(scoped, { query: "USDC Solana", direction: "incoming", status: "failed" })
    .map(activity => activity.id)).toEqual(["sol-main"]);
  expect(filterHistoryActivities(scoped, { query: "USDC Ethereum", direction: "incoming", status: "completed" })).toEqual([]);
  expect(activities.map(activity => activity.id)).toEqual(["sol-main", "eth-main", "eth-completed", "sol-foreign"]);
});

it("does not search financial values, keys, dates or nested transfer metadata", () => {
  const record: ProductActivity = { ...solana, id: "secret-record-key", accountId: "secret-account-key",
    internalTransfer: { sourceAccountId: "source", sourceAccountLabel: "Чужой участник",
      destinationAccountId: "destination", destinationAccountLabel: "Приватный получатель" } };
  for (const query of ["31.456789", "0.004321", "secret-record-key", "secret-account-key", "2026-10-03", "Приватный получатель"]) {
    expect(filterHistoryActivities([record], { query, direction: "all", status: "all" }), query).toEqual([]);
  }
});

it("filters an internal transfer after its account-specific direction and label have been projected", () => {
  const transfer: ProductActivity = { ...completed, id: "internal", accountId: "main", accountLabel: "Основной",
    internalTransfer: { sourceAccountId: "main", sourceAccountLabel: "Основной",
      destinationAccountId: "vault", destinationAccountLabel: "Хранилище" } };
  const scoped = scopeProductActivities([transfer, foreign], ["vault"]);
  const matches = filterHistoryActivities(scoped, { query: "usdc хранилище", direction: "incoming", status: "completed" });
  expect(matches.map(activity => ({ id: activity.id, accountId: activity.accountId, direction: activity.direction })))
    .toEqual([{ id: "internal", accountId: "vault", direction: "incoming" }]);
  expect(filterHistoryActivities(scoped, { query: "Основной", direction: "all", status: "all" })).toEqual([]);
});
