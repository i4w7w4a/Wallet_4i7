import type { Metadata } from "next";
import { MockWalletRepository } from "@wallet/core";
import { MonoAtmosphereLabWithScene } from "../../../src/design-lab/mono-atmosphere-lab-scene";

export const metadata: Metadata = { title: "MONO · Atmosphere Lab", description: "Локальная примерка двух материалов и исходного фона" };

export default async function AtmosphereLabPage() {
  return <MonoAtmosphereLabWithScene snapshot={await new MockWalletRepository().getSnapshot()} />;
}
