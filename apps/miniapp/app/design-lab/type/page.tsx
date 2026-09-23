import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockWalletRepository } from "@wallet/core";
import { MonoFontLab } from "../../../src/mono-preview/mono-font-lab";

export const metadata: Metadata = { title: "Novex · Font Lab", description: "Живая примерка типографики MONO" };

export default async function FontLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MonoFontLab snapshot={await new MockWalletRepository().getSnapshot()} />;
}
