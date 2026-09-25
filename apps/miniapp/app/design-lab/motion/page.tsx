import type { Metadata } from "next";
import { DesignLab } from "../../../src/design-lab/design-lab";
import { LabRouteNavigation } from "../../../src/design-lab/lab-route-navigation";

export const metadata: Metadata = {
  title: "Novex · Отклик / Motion Lab",
  description: "Локальная мастерская отклика кнопок",
};

export default function MotionLabPage() {
  return <><LabRouteNavigation active="motion" /><DesignLab /></>;
}
