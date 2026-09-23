import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseApplyLaunch } from "../../src/design-lab/control-feedback-handoff";
import { DesignLab } from "../../src/design-lab/design-lab";

export const metadata: Metadata = {
  title: "Novex Motion Lab · CONTROL-FEEDBACK-01",
  description: "Локальная примерка отклика одной кнопки",
};

type Search = Record<string, string | string[] | undefined>;

export default async function DesignLabPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  const keys = Object.keys(query);
  const validQuery = keys.length >= 2 && keys.length <= 3 &&
    keys.every((key) => key === "session" || key === "target" || key === "working");
  const launch = validQuery ? parseApplyLaunch({
    sessionId: query.session,
    targetId: query.target,
    workingPresetId: query.working ?? null,
  }) : null;
  return <DesignLab launch={launch} />;
}
