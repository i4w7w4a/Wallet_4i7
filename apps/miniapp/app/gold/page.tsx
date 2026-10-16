import type { Metadata } from "next";
import { MockWalletRepository } from "@wallet/core";
import { MonoGoldViewer } from "../../src/mono-preview/mono-gold-viewer";

export const metadata: Metadata = {
  title: "Novex Wallet — Gold",
  description: "Золотое оформление Novex Wallet на демонстрационных данных",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GoldPage() {
  const snapshot = await new MockWalletRepository().getSnapshot();
  return <MonoGoldViewer snapshot={snapshot} />;
}
