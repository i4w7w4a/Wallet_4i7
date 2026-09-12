import { afterEach, describe, expect, it, vi } from "vitest";

import { MockWalletRepository } from "./mock-wallet-repository";

describe("MockWalletRepository", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("возвращает детерминированный согласованный снимок", async () => {
    const repository = new MockWalletRepository();

    const first = await repository.getSnapshot();
    const second = await repository.getSnapshot();
    const assetsTotal = first.assets.reduce((total, asset) => total + asset.value, 0);

    expect(Object.keys(first.chart)).toEqual(["1D", "1W", "1M", "1Y", "ALL"]);
    expect(first.assets.map(({ symbol, value }) => ({ symbol, value }))).toEqual([
      { symbol: "BTC", value: 8040.25 },
      { symbol: "ETH", value: 3900.5 },
      { symbol: "USDC", value: 900 },
    ]);
    expect(assetsTotal).toBeCloseTo(first.balance.amount, 2);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("не позволяет изменению полученного снимка повредить fixtures", async () => {
    const repository = new MockWalletRepository();
    const changed = await repository.getSnapshot();

    changed.assets[0]!.value = 0;
    changed.chart["1D"].push(0);

    const fresh = await repository.getSnapshot();

    expect(fresh.assets[0]!.value).toBe(8040.25);
    expect(fresh.chart["1D"]).toEqual([12540, 12610, 12588, 12735, 12840.75]);
  });

  it("не создаёт искусственный таймер по умолчанию", async () => {
    vi.useFakeTimers();
    const snapshotPromise = new MockWalletRepository().getSnapshot();

    expect(vi.getTimerCount()).toBe(0);
    expect((await snapshotPromise).balance.amount).toBe(12840.75);
  });

  it("применяет искусственную задержку только при явном latencyMs", async () => {
    vi.useFakeTimers();
    const delayed = new MockWalletRepository({ latencyMs: 25 });
    let resolved = false;
    const snapshotPromise = delayed.getSnapshot().then((snapshot) => {
      resolved = true;
      return snapshot;
    });

    await vi.advanceTimersByTimeAsync(24);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect((await snapshotPromise).profile.name).toBe("Демо пользователь");
  });
});
