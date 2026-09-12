import type { WalletSnapshot } from "./models";

export interface WalletRepository {
  getSnapshot(): Promise<WalletSnapshot>;
}
