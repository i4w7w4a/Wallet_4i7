import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseApplyLaunch } from "../../src/design-lab/control-feedback-handoff";
import { DesignLab } from "../../src/design-lab/design-lab";
import { LabHome } from "../../src/design-lab/lab-home";
import { enabledLabIds, LabRouteNavigation } from "../../src/design-lab/lab-route-navigation";

export const metadata: Metadata = {
  title: "Novex Design Lab",
  description: "Мастерские фонов, кнопок и отклика Novex",
};

type Search = Record<string, string | string[] | undefined>;

export default async function DesignLabPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  if (!("session" in query) && !("target" in query)) return <LabHome enabled={enabledLabIds()} />;
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_NOVEX_REVIEW_MOTION_LAB !== "1") notFound();
  const keys = Object.keys(query);
  const validQuery = keys.length >= 2 && keys.length <= 3 &&
    keys.every((key) => key === "session" || key === "target" || key === "working");
  const launch = validQuery ? parseApplyLaunch({
    sessionId: query.session,
    targetId: query.target,
    workingPresetId: query.working ?? null,
  }) : null;
  return <><LabRouteNavigation active="motion" /><DesignLab launch={launch} /></>;
}
