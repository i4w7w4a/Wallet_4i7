import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockWalletRepository } from "@wallet/core";
import { MonoSceneLab } from "../../../src/mono-preview/mono-scene-lab";

export const metadata: Metadata = { title: "Novex · Сцена счёта", description: "Локальная примерка баланса, графика и активов" };

export default async function MonoSceneLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MonoSceneLab snapshot={await new MockWalletRepository().getSnapshot()} />;
}
