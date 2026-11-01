import { parseApplyLaunch, type ApplyLaunch } from "./control-feedback-handoff";

export function parseMotionLabSearch(search: string): ApplyLaunch | null {
  const params = new URLSearchParams(search);
  const keys = [...params.keys()];
  if (keys.length < 2 || keys.length > 3 || new Set(keys).size !== keys.length ||
    keys.some(key => key !== "session" && key !== "target" && key !== "working")) return null;
  return parseApplyLaunch({ sessionId: params.get("session"), targetId: params.get("target"), workingPresetId: params.get("working") });
}
