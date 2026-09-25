import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockWalletRepository } from "@wallet/core";
import { MonoButtonsLabWithScene } from "../../../src/design-lab/mono-buttons-lab-scene";

export const metadata: Metadata = { title: "MONO · Button Materials Lab",
  description: "Локальная мастерская материалов четырёх быстрых кнопок" };

export default async function ButtonsLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MonoButtonsLabWithScene snapshot={await new MockWalletRepository().getSnapshot()} />;
}
