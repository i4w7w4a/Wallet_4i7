import { validateControlFeedbackPreset, type ControlFeedbackPreset } from "./control-feedback-model";

export const CHANNEL_NAME = "novex.motion-lab.control-feedback-01.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGET = /^mono\.[a-z][a-z0-9-]{0,63}$/;
const WORKING_PRESET_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_MESSAGE_LENGTH = 8192;

export type ApplyLaunch = {
  sessionId: string;
  targetId: string;
  workingPresetId: string | null;
};

export type ApplyRequest = ApplyLaunch & {
  version: 1;
  kind: "apply-request";
  requestId: string;
  preset: ControlFeedbackPreset;
};

export type ApplyOutcome = "applied" | "stale-session" | "target-mismatch" | "preset-changed" | "invalid-preset";
export type ApplyAck = ApplyLaunch & {
  version: 1;
  kind: "apply-ack";
  requestId: string;
  outcome: ApplyOutcome;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function smallMessage(value: unknown) {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); } catch { /* Cyclic or unsupported input. */ }
  return typeof serialized === "string" && serialized.length <= MAX_MESSAGE_LENGTH;
}

export function parseApplyLaunch(value: unknown): ApplyLaunch | null {
  if (!isRecord(value) || !exactKeys(value, ["sessionId", "targetId", "workingPresetId"]) ||
      typeof value.sessionId !== "string" || !UUID.test(value.sessionId) ||
      typeof value.targetId !== "string" || !TARGET.test(value.targetId) ||
      !(value.workingPresetId === null ||
        (typeof value.workingPresetId === "string" && WORKING_PRESET_ID.test(value.workingPresetId)))) {
    return null;
  }
  return {
    sessionId: value.sessionId,
    targetId: value.targetId,
    workingPresetId: value.workingPresetId as string | null,
  };
}

export function parseApplyRequest(value: unknown): ApplyRequest {
  if (!smallMessage(value) || !isRecord(value) || !exactKeys(value, [
    "version", "kind", "requestId", "sessionId", "targetId", "workingPresetId", "preset",
  ]) || value.version !== 1 || value.kind !== "apply-request" ||
      typeof value.requestId !== "string" || !UUID.test(value.requestId)) {
    throw new Error("Запрос применения повреждён.");
  }
  const launch = parseApplyLaunch({
    sessionId: value.sessionId,
    targetId: value.targetId,
    workingPresetId: value.workingPresetId,
  });
  if (!launch) throw new Error("Сеанс или цель применения неизвестны.");
  return {
    version: 1,
    kind: "apply-request",
    requestId: value.requestId,
    ...launch,
    preset: validateControlFeedbackPreset(value.preset),
  };
}

export function createApplyRequest(launch: ApplyLaunch, requestId: string, preset: ControlFeedbackPreset): ApplyRequest {
  return parseApplyRequest({ version: 1, kind: "apply-request", requestId, ...launch, preset });
}

export function parseApplyAck(value: unknown): ApplyAck {
  if (!smallMessage(value) || !isRecord(value) || !exactKeys(value, [
    "version", "kind", "requestId", "sessionId", "targetId", "workingPresetId", "outcome",
  ]) || value.version !== 1 || value.kind !== "apply-ack" ||
      typeof value.requestId !== "string" || !UUID.test(value.requestId) ||
      (value.outcome !== "applied" && value.outcome !== "stale-session" &&
       value.outcome !== "target-mismatch" && value.outcome !== "preset-changed" &&
       value.outcome !== "invalid-preset")) {
    throw new Error("Ответ применения повреждён.");
  }
  const launch = parseApplyLaunch({
    sessionId: value.sessionId,
    targetId: value.targetId,
    workingPresetId: value.workingPresetId,
  });
  if (!launch) throw new Error("Ответ пришёл от другого сеанса.");
  return { version: 1, kind: "apply-ack", requestId: value.requestId, ...launch,
    outcome: value.outcome as ApplyOutcome };
}

export function matchesApplyAck(request: ApplyRequest, value: unknown): value is ApplyAck {
  try {
    const ack = parseApplyAck(value);
    return ack.requestId === request.requestId && ack.sessionId === request.sessionId &&
      ack.targetId === request.targetId && ack.workingPresetId === request.workingPresetId;
  } catch {
    return false;
  }
}
