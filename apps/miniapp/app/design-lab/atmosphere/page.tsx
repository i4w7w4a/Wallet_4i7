import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonoAtmosphereLab } from "../../../src/design-lab/mono-atmosphere-lab";

export const metadata: Metadata = { title: "MONO · Atmosphere Lab", description: "Локальная примерка двух материалов и исходного фона" };

export default function AtmosphereLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MonoAtmosphereLab />;
}
