import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MockWalletRepository } from "@wallet/core";
import { parsePublishedSlot } from "../../../src/mono-preview/mono-published-contract";
import { MonoPublishedStore } from "../../../src/mono-preview/mono-published-store";
import { MonoPublishedViewer } from "../../../src/mono-preview/mono-published-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Novex Wallet — готовый кошелёк",
  description: "Опубликованное оформление Novex Wallet на демонстрационных данных",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PublishedMonoPage({ params }: { params: Promise<{ slot: string }> }) {
  await connection();
  const raw = (await params).slot;
  let slot: ReturnType<typeof parsePublishedSlot>;
  try { slot = parsePublishedSlot(raw); }
  catch { notFound(); }
  const published = await new MonoPublishedStore(process.env.MONO_PUBLISHED_DATA_DIR).read(slot);
  if (!published) notFound();
  const wallet = await new MockWalletRepository().getSnapshot();
  return <MonoPublishedViewer wallet={wallet} published={published.snapshot} />;
}
