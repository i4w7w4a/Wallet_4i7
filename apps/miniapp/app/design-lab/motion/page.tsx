import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockWalletRepository } from "@wallet/core";
import { MotionLabEntry } from "../../../src/design-lab/motion-lab-entry";
import { LabRouteNavigation } from "../../../src/design-lab/lab-route-navigation";

export const metadata: Metadata = {
  title: "Novex · Отклик / Motion Lab",
  description: "Локальная мастерская отклика кнопок",
};

export default async function MotionLabPage() {
  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_NOVEX_REVIEW_MOTION_LAB !== "1") notFound();
  const snapshot = await new MockWalletRepository().getSnapshot();
  return <>{process.env.NODE_ENV === "development" && <LabRouteNavigation active="motion" />}<MotionLabEntry snapshot={snapshot} /></>;
}
