import { notFound } from "next/navigation";
import { MotionPreview } from "../../../src/mono-product/motion-preview/motion-preview";

export default function MotionR1Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MotionPreview />;
}
