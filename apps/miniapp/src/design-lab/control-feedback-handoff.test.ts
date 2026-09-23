import { describe, expect, it } from "vitest";

import {
  CHANNEL_NAME,
  createApplyRequest,
  matchesApplyAck,
  parseApplyAck,
  parseApplyLaunch,
  parseApplyRequest,
} from "./control-feedback-handoff";
import type { ControlFeedbackPreset } from "./control-feedback-model";

const sessionId = "c470be42-a482-4eac-b61b-bcfa3aa42110";
const requestId = "db5370a9-b1f6-49e6-a4b8-c18bca884c11";
const launch = {
  sessionId,
  targetId: "mono.quick-settings-launcher",
  workingPresetId: "recovered-mono-preview",
};
const preset: ControlFeedbackPreset = {
  schemaVersion: 1,
  sceneId: "control-feedback-01",
  implementationVersion: 1,
  effectId: "material",
  view: "context",
  previewWidth: 390,
  status: "draft",
  config: { pressDepth: 2, magneticTravel: 5, settleMs: 190 },
};

describe("control feedback handoff", () => {
  it("accepts only a bounded launch context from the MONO opener", () => {
    expect(parseApplyLaunch(launch)).toEqual(launch);
    expect(parseApplyLaunch({ ...launch, sessionId: "not-a-session" })).toBeNull();
    expect(parseApplyLaunch({ ...launch, targetId: "wallet.transfer" })).toBeNull();
    expect(parseApplyLaunch({ ...launch, unexpected: "extra" })).toBeNull();
    expect(parseApplyLaunch({ ...launch, workingPresetId: null })).toEqual({ ...launch, workingPresetId: null });
  });

  it("round-trips a full validated preset with target and request identity", () => {
    const request = createApplyRequest(launch, requestId, preset);
    expect(CHANNEL_NAME).toBe("novex.motion-lab.control-feedback-01.v1");
    expect(parseApplyRequest(request)).toEqual(request);
    expect(request).toMatchObject({ version: 1, kind: "apply-request", requestId, ...launch, preset });
  });

  it("rejects unknown request fields and altered preset values", () => {
    const request = createApplyRequest(launch, requestId, preset);
    expect(() => parseApplyRequest({ ...request, css: "body { display:none }" })).toThrow();
    expect(() => parseApplyRequest({ ...request, preset: { ...preset, config: { ...preset.config, pressDepth: 50 } } })).toThrow();
    expect(() => parseApplyRequest({ ...request, version: 2 })).toThrow();
  });

  it("accepts only a matching, allowlisted acknowledgement", () => {
    const request = createApplyRequest(launch, requestId, preset);
    const ack = { version: 1, kind: "apply-ack", requestId, ...launch, outcome: "applied" };
    expect(parseApplyAck(ack)).toEqual(ack);
    expect(matchesApplyAck(request, ack)).toBe(true);
    expect(matchesApplyAck(request, { ...ack, requestId: sessionId })).toBe(false);
    expect(matchesApplyAck(request, { ...ack, targetId: "mono.other" })).toBe(false);
    expect(matchesApplyAck(request, { ...ack, sessionId: requestId })).toBe(false);
    expect(matchesApplyAck(request, { ...ack, workingPresetId: "another-preset" })).toBe(false);
    expect(() => parseApplyAck({ ...ack, outcome: "published" })).toThrow();
    expect(() => parseApplyAck({ ...ack, extra: "value" })).toThrow();
  });
});
