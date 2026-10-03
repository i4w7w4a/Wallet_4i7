import { expect, it } from "vitest";
import { getProductActivityLabels, type ProductActivity } from "./demo-activity";
import { scopeProductActivities } from "./product-activity-scope";

const internalTransfer = Object.freeze({
  sourceAccountId: "demo-custody",
  sourceAccountLabel: "Кастодиальный счёт",
  destinationAccountId: "demo-depositary",
  destinationAccountLabel: "Депозитарный счёт",
});
const receipt = Object.freeze({
  assetDebit: "12.3400",
  networkFee: Object.freeze({ status: "known" as const, amount: "0", symbol: "USDC" }),
  feeFunding: Object.freeze({ kind: "balance" as const }),
  estimatedCompletionSeconds: 5,
});
const internalActivity: ProductActivity = Object.freeze({
  id: "internal-transfer-1",
  accountId: "demo-custody",
  accountLabel: "Кастодиальный счёт",
  direction: "outgoing",
  status: "completed",
  mode: "simulation",
  assetId: "usdc",
  assetSymbol: "USDC",
  quantity: "12.3400",
  networkId: "ethereum",
  networkLabel: "Ethereum",
  occurredAt: "2026-10-03T10:00:00.000Z",
  feeLabel: "0 USDC",
  receipt,
  internalTransfer,
});
const externalActivity: ProductActivity = Object.freeze({
  id: "external-receive-1",
  accountId: "demo-depositary",
  accountLabel: "Депозитарный счёт",
  direction: "incoming",
  status: "pending",
  mode: "simulation",
  assetId: "usdc",
  assetSymbol: "USDC",
  quantity: "9.5",
  networkId: "ethereum",
  networkLabel: "Ethereum",
  occurredAt: "2026-10-02T10:00:00.000Z",
});
const legacyActivity: ProductActivity = Object.freeze({
  id: "legacy-send-1",
  accountId: "third-account",
  accountLabel: "Третий счёт",
  direction: "outgoing",
  status: "failed",
  assetSymbol: "USDC",
  quantity: "2",
  networkLabel: "Ethereum",
  occurredAt: "2026-10-01T10:00:00.000Z",
});
const activities = Object.freeze([legacyActivity, internalActivity, externalActivity]);

it("keeps All as one row per activity in a separate sortable array", () => {
  const all = scopeProductActivities(activities);

  expect(all).toEqual([legacyActivity, internalActivity, externalActivity]);
  expect(all).not.toBe(activities);
  expect(all[1]).toBe(internalActivity);
  expect(all[1]!.internalTransfer).toBe(internalTransfer);
  all.sort((left, right) => left.id.localeCompare(right.id));
  expect(activities.map(({ id }) => id)).toEqual([
    "legacy-send-1", "internal-transfer-1", "external-receive-1",
  ]);
});

it.each([
  { accountId: "demo-custody", accountLabel: "Кастодиальный счёт", direction: "outgoing" },
  { accountId: "demo-depositary", accountLabel: "Депозитарный счёт", direction: "incoming" },
] as const)("projects the same internal activity for $accountId", ({ accountId, accountLabel, direction }) => {
  const projected = scopeProductActivities([internalActivity], [accountId]);

  expect(projected).toEqual([{ ...internalActivity, accountId, accountLabel, direction }]);
  expect(projected[0]!.id).toBe("internal-transfer-1");
  expect(projected[0]!.internalTransfer).toBe(internalTransfer);
  expect(projected[0]!.receipt).toBe(receipt);
});

it("excludes an internal transfer from a third account with the same asset and network", () => {
  expect(scopeProductActivities([internalActivity], ["third-account"])).toEqual([]);
  expect(scopeProductActivities(activities, ["third-account"])).toEqual([legacyActivity]);
});

it("includes both participants once and prefers the source even from a destination projection", () => {
  const destinationProjection: ProductActivity = {
    ...internalActivity,
    accountId: "demo-depositary",
    accountLabel: "Депозитарный счёт",
    direction: "incoming",
  };

  expect(scopeProductActivities([destinationProjection], [
    "demo-depositary", "demo-custody", "demo-depositary", "demo-custody",
  ])).toEqual([internalActivity]);
});

it("treats an empty scope as empty and accepts an empty history", () => {
  expect(scopeProductActivities(activities, [])).toEqual([]);
  expect(scopeProductActivities([])).toEqual([]);
  expect(scopeProductActivities([], ["demo-custody"])).toEqual([]);
});

it("filters external and legacy entries by account ID with their original objects and direction", () => {
  const ordinaryActivities = Object.freeze([legacyActivity, externalActivity]);
  const selected = scopeProductActivities(ordinaryActivities, [
    "demo-depositary", "third-account", "demo-depositary",
  ]);

  expect(selected).toEqual([legacyActivity, externalActivity]);
  expect(selected[0]).toBe(legacyActivity);
  expect(selected[1]).toBe(externalActivity);
  expect(scopeProductActivities(ordinaryActivities, ["demo-depositary"])).toEqual([externalActivity]);
  expect(scopeProductActivities(ordinaryActivities, ["third-account"])).toEqual([legacyActivity]);
  expect(scopeProductActivities(ordinaryActivities, ["demo-custody"])).toEqual([]);
});

it("leaves frozen input, transfer metadata and receipt intact in every projection", () => {
  const before = structuredClone(activities);

  for (const accountIds of [undefined, ["demo-custody"], ["demo-depositary"], [
    "demo-custody", "demo-depositary",
  ]]) {
    const projected = scopeProductActivities(activities, accountIds);
    const transfer = projected.find(({ id }) => id === "internal-transfer-1")!;
    expect(transfer).toBeDefined();
    expect(transfer.internalTransfer).toBe(internalTransfer);
    expect(transfer.receipt).toBe(receipt);
  }
  expect(activities).toEqual(before);
});

it.each([
  { direction: "outgoing", mode: "simulation", status: "completed", statusLabel: "Симуляция завершена" },
  { direction: "incoming", mode: "simulation", status: "pending", statusLabel: "Симуляция выполняется" },
  { direction: "outgoing", mode: undefined, status: "failed", statusLabel: "Не выполнено" },
  { direction: "incoming", mode: "example", status: "completed", statusLabel: "Выполнено" },
] as const)("labels an internal $direction activity in $mode mode as a demo transfer", ({ direction, mode, status, statusLabel }) => {
  expect(getProductActivityLabels({ ...internalActivity, direction, mode, status })).toEqual({
    directionLabel: "Между счетами · демо",
    statusLabel,
  });
});

it.each([
  { activity: externalActivity, directionLabel: "Демо-получение", statusLabel: "Симуляция выполняется" },
  { activity: legacyActivity, directionLabel: "Отправка", statusLabel: "Не выполнено" },
  { activity: { ...legacyActivity, direction: "incoming" as const }, directionLabel: "Получение", statusLabel: "Не выполнено" },
  { activity: { ...externalActivity, direction: "outgoing" as const }, directionLabel: "Демо-отправка", statusLabel: "Симуляция выполняется" },
])("keeps ordinary $directionLabel and status labels", ({ activity, directionLabel, statusLabel }) => {
  expect(getProductActivityLabels(activity)).toEqual({ directionLabel, statusLabel });
});
