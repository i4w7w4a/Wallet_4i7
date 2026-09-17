import type { Metadata } from "next";
import { MockWalletRepository } from "@wallet/core";

import { MonoPreview } from "../../src/mono-preview/mono-preview";

export const metadata: Metadata = {
  title: "MONO LEDGER — Wallet_4i7",
  description: "Чёрно-белый визуальный прототип Wallet_4i7",
};

export default async function MonoPage() {
  const snapshot = await new MockWalletRepository().getSnapshot();

  return <MonoPreview snapshot={snapshot} />;
}
