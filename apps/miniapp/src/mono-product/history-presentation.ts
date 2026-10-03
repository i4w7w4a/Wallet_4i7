import { getProductActivityLabels, type ProductActivity } from "./demo-activity";

const compactSimulationStatus: Record<ProductActivity["status"], string> = {
  pending: "В процессе", completed: "Завершено", failed: "Сбой",
};

/** Keep complete semantics for assistive text; the demo direction already identifies a simulation visually. */
export function getHistoryPresentation(activity: ProductActivity) {
  const labels = getProductActivityLabels(activity);
  return {
    directionLabel: labels.directionLabel,
    statusLabel: activity.mode === "simulation" ? compactSimulationStatus[activity.status] : labels.statusLabel,
    accessibleStatusLabel: labels.statusLabel,
  };
}
