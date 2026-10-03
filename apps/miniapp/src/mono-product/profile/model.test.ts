import { describe, expect, it } from "vitest";
import { createDemoProfileResource, isProfileLinkAllowed } from "./model";

describe("profile demo resource", () => {
  it("uses unknown security and absent contacts/links without a customer fixture", () => {
    expect(createDemoProfileResource()).toEqual({ status: "ready", data: {
      email: null, phone: null, languageLabel: "Русский", valuationCurrencyLabel: "USD",
      verification: "unknown", twoFactor: "unknown", addressAllowlist: "unknown", support: null, documents: [],
    } });
  });

  it("creates independent objects and arrays on every call", () => {
    const first = createDemoProfileResource(), second = createDemoProfileResource();
    expect(first).not.toBe(second);
    if (first.status !== "ready" || second.status !== "ready") throw new Error("demo must be ready");
    expect(first.data).not.toBe(second.data);
    expect(first.data.documents).not.toBe(second.data.documents);
    first.data.email = "fixture@example.test";
    first.data.verification = "verified";
    (first.data.documents as { id: string; title: string; href: string }[]).push({
      id: "test-only", title: "Test only", href: "https://example.test/document",
    });
    expect(second).toEqual(createDemoProfileResource());
    expect(second.data.documents).toEqual([]);
    expect(second.data.email).toBeNull();
    expect(second.data.verification).toBe("unknown");
  });
});

describe("profile link scheme guard", () => {
  it.each([
    "https://example.test", "https://example.test/help?topic=account#contacts",
    "HTTPS://EXAMPLE.TEST/docs", "https://example.test:8443/document",
    "https://example.test/docs/a%20b", "https://example.test/a@b?ref=@help",
  ])("allows an absolute HTTPS URL without credentials: %s", href => {
    expect(isProfileLinkAllowed(href)).toBe(true);
  });

  it.each([
    "", "help", "/help", "//example.test/help", "http://example.test",
    "javascript:alert(1)", "data:text/html,hello", "mailto:help@example.test", "file:///document",
    "blob:https://example.test/id", "https:", "https:example.test", "https:/example.test",
    "https:///example.test", "https://", "https://example.test:invalid",
    "https://user:password@example.test", "https://user@example.test", "https://:secret@example.test",
    "https://@example.test", "https://:@example.test", "https://%75ser@example.test",
    " https://example.test", "https://example.test ", "https://example.test\n",
    "https://exam\tple.test", "https://example.test/a b", "https://example.test\\path",
  ])("rejects unsafe, credential-bearing or ambiguous input: %s", href => {
    expect(isProfileLinkAllowed(href)).toBe(false);
  });

  it.each([null, undefined, 42, {}, []])("rejects malformed runtime input without throwing: %s", href => {
    expect(isProfileLinkAllowed(href as unknown as string)).toBe(false);
  });
});
