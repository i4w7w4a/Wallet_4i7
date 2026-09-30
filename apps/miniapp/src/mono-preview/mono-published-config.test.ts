import { describe, expect, it } from "vitest";
import { parseMonoPublishRuntimeConfig } from "./mono-published-config";

describe("published MONO runtime configuration", () => {
  it("uses the operator's exact HTTPS origin and local durable store in production without password settings", () => {
    expect(parseMonoPublishRuntimeConfig({ NODE_ENV: "production",
      MONO_PUBLISH_ORIGIN: "https://wallet.95.181.213.4.nip.io" })).toEqual({
      editorOrigin: "https://wallet.95.181.213.4.nip.io",
      publicOrigin: "https://wallet.95.181.213.4.nip.io", remoteOrigin: null,
    });
  });

  it("makes local development send to one fixed HTTPS upstream and never use a local fallback", () => {
    expect(parseMonoPublishRuntimeConfig({ NODE_ENV: "development",
      MONO_PUBLISH_ORIGIN: "http://127.0.0.1:3184",
      MONO_PUBLISHED_REMOTE_ORIGIN: "https://wallet.95.181.213.4.nip.io" })).toEqual({
      editorOrigin: "http://127.0.0.1:3184",
      publicOrigin: "https://wallet.95.181.213.4.nip.io",
      remoteOrigin: "https://wallet.95.181.213.4.nip.io",
    });
    expect(parseMonoPublishRuntimeConfig({ NODE_ENV: "development",
      MONO_PUBLISH_ORIGIN: "http://127.0.0.1:3184" })).toBeNull();
  });

  it("allows an explicit isolated fixture but rejects unsafe or ambiguous origin spellings", () => {
    expect(parseMonoPublishRuntimeConfig({ NODE_ENV: "test",
      MONO_PUBLISH_ORIGIN: "http://127.0.0.1:3184", MONO_PUBLISHED_FIXTURE_MODE: "1" })).toEqual({
      editorOrigin: "http://127.0.0.1:3184", publicOrigin: "http://127.0.0.1:3184", remoteOrigin: null,
    });
    for (const remote of ["http://wallet.example", "https://user@wallet.example", "https://wallet.example/p/2",
      "https://wallet.example?slot=2", "https://wallet.example/#x", "https://localhost", "https://127.0.0.1"])
      expect(parseMonoPublishRuntimeConfig({ NODE_ENV: "development", MONO_PUBLISH_ORIGIN: "http://127.0.0.1:3184",
        MONO_PUBLISHED_REMOTE_ORIGIN: remote })).toBeNull();
    expect(parseMonoPublishRuntimeConfig({ NODE_ENV: "production", MONO_PUBLISH_ORIGIN: "https://wallet.example",
      MONO_PUBLISHED_REMOTE_ORIGIN: "https://other.example" })).toBeNull();
  });
});
