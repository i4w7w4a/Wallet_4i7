// @vitest-environment node
import { renderToString } from "react-dom/server";
import { TelegramPlatformAdapter, type PlatformBridge } from "@wallet/platform";
import { expect, it, vi } from "vitest";
import { useMonoSceneActivity } from "./mono-scene-activity";

function Probe({ platform }: { platform?: PlatformBridge }) {
  return <span>{useMonoSceneActivity(platform) ? "active" : "inactive"}</span>;
}

it("renders the browser fallback on the server without window, host detection or subscriptions", () => {
  expect(typeof window).toBe("undefined");
  expect(renderToString(<Probe />)).toBe("<span>active</span>");
});

it("keeps a supplied known inactive snapshot on the server without subscribing", () => {
  const platform = new TelegramPlatformAdapter({ onEvent(event, handler) { if (event === "deactivated") handler(); } });
  platform.subscribeActivity(() => undefined)();
  const subscribe = vi.spyOn(platform, "subscribeActivity");
  expect(renderToString(<Probe platform={platform} />)).toBe("<span>inactive</span>");
  expect(subscribe).not.toHaveBeenCalled();
  subscribe.mockRestore();
});
