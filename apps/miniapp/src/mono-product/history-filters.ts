import type { ProductActivity } from "./demo-activity";

export type HistoryFilters = {
  query: string;
  direction: "all" | ProductActivity["direction"];
  status: "all" | ProductActivity["status"];
};
export const HISTORY_QUERY_LIMIT = 80;
export const DEFAULT_HISTORY_FILTERS: Readonly<HistoryFilters> = { query: "", direction: "all", status: "all" };

export function matchesHistoryFilters(activity: ProductActivity, filters: HistoryFilters): boolean {
  if (filters.direction !== "all" && activity.direction !== filters.direction) return false;
  if (filters.status !== "all" && activity.status !== filters.status) return false;
  const words = normalizeText(filters.query.slice(0, HISTORY_QUERY_LIMIT)).split(" ").filter(Boolean);
  // Search only the three public labels; receipt, money and internal keys never enter this text.
  const labels = [activity.assetSymbol, activity.networkLabel, activity.accountLabel].map(normalizeText).join(" ");
  return words.every(word => labels.includes(word));
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function filterHistoryActivities(activities: readonly ProductActivity[], filters: HistoryFilters): ProductActivity[] {
  return activities.filter(activity => matchesHistoryFilters(activity, filters));
}
