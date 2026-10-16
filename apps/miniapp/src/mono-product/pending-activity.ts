import type { ProductActivity } from "./demo-activity";
import { scopeProductActivities } from "./product-activity-scope";

export type PendingActivityOpenResult = "opened" | "blocked" | "unavailable";
type PendingActivityEntry = { kind: "single"; activityId: string; status: "pending" | "all" }
  | { kind: "many" } | { kind: "unavailable" };

function hasKnownIdentityAndStatus(activity: ProductActivity): boolean {
  return Boolean(activity && typeof activity.id === "string" && activity.id.trim() &&
    typeof activity.accountId === "string" && activity.accountId.trim() &&
    (activity.status === "pending" || activity.status === "completed" || activity.status === "failed"));
}

export function selectPendingActivityIds(activities: readonly ProductActivity[]): readonly string[] | null {
  const scoped = scopeProductActivities(activities);
  if (scoped.some(activity => !hasKnownIdentityAndStatus(activity))) return null;
  return [...new Set(scoped.filter(activity => activity.status === "pending").map(activity => activity.id))];
}

export function resolvePendingActivityEntry(activities: readonly ProductActivity[], activityId: string | null): PendingActivityEntry {
  if (activities.some(activity => !hasKnownIdentityAndStatus(activity))) return { kind: "unavailable" };
  if (activityId === null) {
    const ids = selectPendingActivityIds(activities);
    return ids?.length && new Set(activities.map(activity => activity.id)).size === activities.length
      ? { kind: "many" } : { kind: "unavailable" };
  }
  const matches = activities.filter(activity => activity.id === activityId);
  if (matches.length !== 1 || !hasKnownIdentityAndStatus(matches[0]!)) return { kind: "unavailable" };
  return { kind: "single", activityId, status: matches[0]!.status === "pending" ? "pending" : "all" };
}
