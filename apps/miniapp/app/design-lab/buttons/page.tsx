import type { Metadata } from "next";
import { MockWalletRepository } from "@wallet/core";
import { MonoButtonsLabWithScene } from "../../../src/design-lab/mono-buttons-lab-scene";

export const metadata: Metadata = { title: "MONO · Button Materials Lab",
  description: "Локальная мастерская материалов четырёх быстрых кнопок" };

export default async function ButtonsLabPage() {
  return <MonoButtonsLabWithScene snapshot={await new MockWalletRepository().getSnapshot()} />;
}
