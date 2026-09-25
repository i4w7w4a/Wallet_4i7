import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockWalletRepository } from "@wallet/core";
import { MonoFontLab } from "../../../src/mono-preview/mono-font-lab";
import { LabRouteNavigation } from "../../../src/design-lab/lab-route-navigation";

export const metadata: Metadata = { title: "Novex · Font Lab", description: "Живая примерка типографики MONO" };

export default async function FontLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <><LabRouteNavigation active="type" />
    <MonoFontLab snapshot={await new MockWalletRepository().getSnapshot()} /></>;
}
