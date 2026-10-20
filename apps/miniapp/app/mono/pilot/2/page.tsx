import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { MockWalletRepository } from "@wallet/core";
import preset2 from "../../../../../../checkpoints/mono-published/2026-10-17/slot-2.appearance.json";
import { parsePublishedRecord } from "../../../../src/mono-preview/mono-published-contract";
import { MonoCompactPilotViewer } from "../../../../src/mono-preview/mono-compact-pilot-viewer";

export const metadata: Metadata = {
  title: "Novex Wallet — компактная композиция / 2",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function MonoCompactPilotPage() {
  await connection();
  // Server-only, request-time and default off. Never a published preset/editor route.
  if (process.env.MONO_COMPACT_LOCAL_PREVIEW !== "1") notFound();
  const archived = parsePublishedRecord({ slot: 2, revision: 5,
    updatedAt: "2026-10-04T17:38:16.900Z", snapshot: preset2 }, 2);
  const wallet = await new MockWalletRepository().getSnapshot();
  return <MonoCompactPilotViewer wallet={wallet} published={archived.snapshot} />;
}
