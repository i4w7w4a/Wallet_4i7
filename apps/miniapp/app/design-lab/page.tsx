import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DesignLab } from "../../src/design-lab/design-lab";

export const metadata: Metadata = {
  title: "Novex Motion Lab · CONTROL-FEEDBACK-01",
  description: "Локальная примерка отклика одной кнопки",
};

export default function DesignLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DesignLab />;
}
