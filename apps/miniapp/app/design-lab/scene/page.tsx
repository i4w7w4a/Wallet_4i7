import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockWalletRepository } from "@wallet/core";
import { MonoSceneLab } from "../../../src/mono-preview/mono-scene-lab";

export const metadata: Metadata = { title: "Novex · Сцена счёта", description: "Локальная примерка баланса, графика и активов" };

export default async function MonoSceneLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  return <MonoSceneLab snapshot={await new MockWalletRepository().getSnapshot()} formatProbe={query["format-probe"] === "1"} />;
}
