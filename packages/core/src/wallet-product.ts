export type ProductAccountKind = "custodial" | "depositary" | "private";
export type ProductAccountStatus = "active" | "inactive" | "unavailable";
export type ProductActionKind = "send" | "receive" | "swap" | "buy" | "withdraw";
export type ReceiveMode = "external-address" | "internal-transfer" | "unavailable";

type AssetNetwork = {
  assetId: string;
  symbol: string;
  name: string;
  networkId: string;
  networkLabel: string;
};

type NonReceiveCapability = AssetNetwork & {
  action: Exclude<ProductActionKind, "receive">;
};

type ReceiveCapability = AssetNetwork & {
  action: "receive";
  receiveMode: ReceiveMode;
};

export type ProductCapability = NonReceiveCapability | ReceiveCapability;

export type ProductAccount = {
  id: string;
  kind: ProductAccountKind;
  label: string;
  status: ProductAccountStatus;
  capabilities: readonly ProductCapability[];
};

export type ProductHolding = AssetNetwork & {
  id: string;
  accountId: string;
  quantity: string;
  fiatMinor: number;
  availableQuantity?: string;
};

export type BatteryPool = {
  id: string;
  networkId: string;
  networkLabel: string;
  eligibleAccountIds: readonly string[];
  action: ProductActionKind;
  remainingTransfers: number | "unknown";
};

export type ProductSnapshot = {
  fiatCurrency: "USD";
  accounts: readonly ProductAccount[];
  holdings: readonly ProductHolding[];
  batteryPools?: readonly BatteryPool[];
};

export type AccountContext = { kind: "all" } | { kind: "account"; accountId: string };

type AvailableCapability =
  | NonReceiveCapability
  | (AssetNetwork & {
      action: "receive";
      receiveMode: Exclude<ReceiveMode, "unavailable">;
    });

export type ProductActionRoute = AvailableCapability & {
  accountId: string;
  accountLabel: string;
  accountKind: ProductAccountKind;
};

export type RouteUnavailableReason =
  | "account-not-found"
  | "account-inactive"
  | "account-unavailable"
  | "capability-unavailable";

export type ActionRouteResolution = {
  routes: readonly ProductActionRoute[];
  reason: RouteUnavailableReason | null;
};

export type AssetHoldingGroup = Pick<ProductHolding, "assetId" | "symbol" | "name"> & {
  fiatMinor: number;
  placements: readonly ProductHolding[];
};

export type BatteryCoverage = {
  status: "covered" | "exhausted" | "not-applicable" | "unknown";
  pool: BatteryPool | null;
};

export function selectHoldings(
  snapshot: Pick<ProductSnapshot, "holdings">,
  context: AccountContext,
): ProductHolding[] {
  return context.kind === "all"
    ? [...snapshot.holdings]
    : snapshot.holdings.filter((holding) => holding.accountId === context.accountId);
}

// Fiat totals describe value only. They say nothing about spendable quantity.
export function selectFiatBalanceMinor(holdings: readonly ProductHolding[]): number {
  return holdings.reduce((total, holding) => addFiatMinor(total, holding.fiatMinor), 0);
}

export function groupHoldingsByAsset(holdings: readonly ProductHolding[]): AssetHoldingGroup[] {
  const groups = new Map<string, AssetHoldingGroup>();

  for (const holding of holdings) {
    const group = groups.get(holding.assetId);
    if (group) {
      groups.set(holding.assetId, {
        ...group,
        fiatMinor: addFiatMinor(group.fiatMinor, holding.fiatMinor),
        placements: [...group.placements, holding],
      });
    } else {
      groups.set(holding.assetId, {
        assetId: holding.assetId,
        symbol: holding.symbol,
        name: holding.name,
        fiatMinor: addFiatMinor(0, holding.fiatMinor),
        placements: [holding],
      });
    }
  }

  return [...groups.values()];
}

export function resolveActionRoutes(
  snapshot: Pick<ProductSnapshot, "accounts">,
  context: AccountContext,
  action: ProductActionKind,
): ActionRouteResolution {
  const accounts =
    context.kind === "all"
      ? snapshot.accounts
      : snapshot.accounts.filter((account) => account.id === context.accountId);

  if (context.kind === "account" && accounts.length === 0) {
    return { routes: [], reason: "account-not-found" };
  }

  const selected = accounts[0];
  if (context.kind === "account" && selected?.status !== "active") {
    return {
      routes: [],
      reason: selected?.status === "inactive" ? "account-inactive" : "account-unavailable",
    };
  }

  const routes = accounts
    .filter((account) => account.status === "active")
    .flatMap((account) =>
      account.capabilities
        .filter((capability): capability is AvailableCapability =>
          capability.action === action && isAvailableCapability(capability),
        )
        .map((capability) => ({
          ...capability,
          accountId: account.id,
          accountLabel: account.label,
          accountKind: account.kind,
        })),
    );

  return {
    routes,
    reason: routes.length > 0 ? null : "capability-unavailable",
  };
}

export function selectBatteryPools(
  pools: readonly BatteryPool[] | undefined,
  context: AccountContext,
): BatteryPool[] {
  if (!pools) return [];
  return context.kind === "all"
    ? [...pools]
    : pools.filter((pool) => pool.eligibleAccountIds.includes(context.accountId));
}

// A battery pool is scoped to a resolved route. It is not a fee quote.
export function resolveBatteryCoverage(
  pools: readonly BatteryPool[] | undefined,
  route: ProductActionRoute,
): BatteryCoverage {
  if (!pools) return { status: "unknown", pool: null };

  const matching = pools.filter(
    (pool) =>
      pool.networkId === route.networkId &&
      pool.action === route.action &&
      pool.eligibleAccountIds.includes(route.accountId),
  );
  if (matching.length === 0) return { status: "not-applicable", pool: null };
  if (matching.length !== 1) return { status: "unknown", pool: null };

  const pool = matching[0]!;
  if (pool.remainingTransfers === "unknown") return { status: "unknown", pool };
  if (!Number.isSafeInteger(pool.remainingTransfers) || pool.remainingTransfers < 0) {
    return { status: "unknown", pool };
  }
  return { status: pool.remainingTransfers === 0 ? "exhausted" : "covered", pool };
}

function isAvailableCapability(capability: ProductCapability): capability is AvailableCapability {
  return capability.action !== "receive" || capability.receiveMode !== "unavailable";
}

function addFiatMinor(total: number, next: number): number {
  if (!Number.isSafeInteger(next) || next < 0 || !Number.isSafeInteger(total + next)) {
    throw new RangeError("fiatMinor must be a non-negative safe integer sum");
  }
  return total + next;
}
