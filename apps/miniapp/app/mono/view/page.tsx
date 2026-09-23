import type { Metadata } from "next";
import { MockWalletRepository } from "@wallet/core";
import { MonoViewerPage } from "../../../src/mono-preview/mono-viewer-page";

export const metadata: Metadata = {
  title: "Novex Wallet — готовый вид",
  description: "Сохранённое оформление Novex Wallet на демоданных",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function MonoViewPage() {
  const snapshot = await new MockWalletRepository().getSnapshot();
  return <MonoViewerPage snapshot={snapshot} />;
}
