export type ChartPeriod = "1D" | "1W" | "1M" | "1Y" | "ALL";

export type WalletProfile = {
  name: string;
  shortAddress: string;
  avatarUrl: string | null;
};

export type WalletBalance = {
  amount: number;
  currency: "USD";
  change24h: number;
  hidden: boolean;
};

export type WalletAsset = {
  symbol: string;
  name: string;
  amount: number;
  value: number;
  change24h: number;
  sparkline: number[];
};

export type WalletNotification = {
  id: string;
  title: string;
  unread: boolean;
};

export type WalletSnapshot = {
  profile: WalletProfile;
  balance: WalletBalance;
  chart: Record<ChartPeriod, number[]>;
  assets: WalletAsset[];
  notifications: WalletNotification[];
};
