import { expect, it } from "vitest";
import { hashMonoPublishPassword, issueMonoPublishSession, monoPublishCsrfToken,
  parseMonoPublishSecurity, verifyMonoPublishCsrf, verifyMonoPublishSession } from "./mono-published-auth";

it("accepts a fixed HTTPS origin and keeps production HTTP loopback closed", async () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production", MONO_PUBLISH_ORIGIN: "https://wallet.example",
    MONO_PUBLISH_PASSWORD_SCRYPT: await hashMonoPublishPassword("a-long-owner-password"),
    MONO_PUBLISH_SESSION_SECRET: Buffer.alloc(32, 9).toString("base64url") };
  expect(parseMonoPublishSecurity(env)?.origin).toBe("https://wallet.example");
  expect(parseMonoPublishSecurity({ ...env, MONO_PUBLISH_ORIGIN: "http://127.0.0.1:3184" })).toBeNull();
  expect(parseMonoPublishSecurity({ ...env, NODE_ENV: "development", MONO_PUBLISH_ORIGIN: "http://127.0.0.1:3184" })?.origin)
    .toBe("http://127.0.0.1:3184");
  expect(parseMonoPublishSecurity({ ...env, NODE_ENV: "development", MONO_PUBLISH_ORIGIN: "http://evil.example" })).toBeNull();
  expect(parseMonoPublishSecurity({ ...env, MONO_PUBLISH_SESSION_SECRET: "short" })).toBeNull();
});

it("binds a CSRF token to an expiring signed session", () => {
  const secret = Buffer.alloc(32, 5).toString("base64url");
  const now = Date.parse("2026-09-29T06:00:00.000Z");
  const { cookie, csrfToken } = issueMonoPublishSession(secret, now);
  expect(verifyMonoPublishSession(secret, cookie, now)).toBe(cookie);
  expect(monoPublishCsrfToken(secret, cookie)).toBe(csrfToken);
  expect(verifyMonoPublishCsrf(secret, cookie, csrfToken)).toBe(true);
  expect(verifyMonoPublishCsrf(secret, cookie, "wrong")).toBe(false);
  expect(verifyMonoPublishSession(secret, cookie, now + 3 * 60 * 60_000)).toBeNull();
  expect(verifyMonoPublishSession(Buffer.alloc(32, 6).toString("base64url"), cookie, now)).toBeNull();
});
