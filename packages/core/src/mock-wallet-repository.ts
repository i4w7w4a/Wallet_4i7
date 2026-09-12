import type { WalletSnapshot } from "./models";
import type { WalletRepository } from "./wallet-repository";

export type MockWalletRepositoryOptions = {
  latencyMs?: number;
};

const WALLET_FIXTURE = deepFreeze({
  profile: {
    name: "Демо пользователь",
    shortAddress: "0x4i7…A91F",
    avatarUrl: null,
  },
  balance: {
    amount: 12840.75,
    currency: "USD",
    change24h: 2.34,
    hidden: false,
  },
  chart: {
    "1D": [12540, 12610, 12588, 12735, 12840.75],
    "1W": [11980, 12150, 12070, 12390, 12520, 12695, 12840.75],
    "1M": [11240, 11680, 11420, 12010, 12360, 12190, 12620, 12840.75],
    "1Y": [8360, 9120, 8840, 10110, 10980, 11740, 12420, 12840.75],
    ALL: [4200, 5180, 4760, 6390, 7210, 8980, 10420, 11780, 12840.75],
  },
  assets: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      amount: 0.12,
      value: 8040.25,
      change24h: 2.8,
      sparkline: [64, 67, 65, 70, 72, 74],
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      amount: 1.1,
      value: 3900.5,
      change24h: 1.7,
      sparkline: [42, 45, 44, 48, 47, 51],
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      amount: 900,
      value: 900,
      change24h: 0,
      sparkline: [30, 30, 30, 30, 30, 30],
    },
  ],
  notifications: [
    { id: "welcome", title: "Добро пожаловать в Wallet_4i7", unread: true },
    { id: "demo", title: "Все операции работают в деморежиме", unread: false },
  ],
} satisfies WalletSnapshot);

export class MockWalletRepository implements WalletRepository {
  readonly #latencyMs: number | undefined;

  constructor(options: MockWalletRepositoryOptions = {}) {
    this.#latencyMs = options.latencyMs;
  }

  async getSnapshot(): Promise<WalletSnapshot> {
    if (this.#latencyMs !== undefined && this.#latencyMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.#latencyMs));
    }

    return cloneSnapshot(WALLET_FIXTURE);
  }
}

function cloneSnapshot(snapshot: Readonly<WalletSnapshot>): WalletSnapshot {
  return {
    profile: { ...snapshot.profile },
    balance: { ...snapshot.balance },
    chart: {
      "1D": [...snapshot.chart["1D"]],
      "1W": [...snapshot.chart["1W"]],
      "1M": [...snapshot.chart["1M"]],
      "1Y": [...snapshot.chart["1Y"]],
      ALL: [...snapshot.chart.ALL],
    },
    assets: snapshot.assets.map((asset) => ({
      ...asset,
      sparkline: [...asset.sparkline],
    })),
    notifications: snapshot.notifications.map((notification) => ({ ...notification })),
  };
}

function deepFreeze<T extends object>(value: T): Readonly<T> {
  for (const nested of Object.values(value)) {
    if (typeof nested === "object" && nested !== null) {
      deepFreeze(nested);
    }
  }

  return Object.freeze(value);
}
