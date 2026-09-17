import { describe, expect, it } from "vitest";
import { MemoryPresetRepository } from "./preset-service";

describe("anonymous preset owner", () => {
  it("issues a high-entropy secret cookie while storing only a slow hash", async () => {
    const { getOrCreatePresetOwner, resolvePresetOwner } = await import("./preset-owner");
    const repository = new MemoryPresetRepository();
    const issued = await getOrCreatePresetOwner(repository, null);
    const stored = await repository.findOwner(issued.ownerId);

    expect(issued.cookieValue).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(stored?.secretHash).toMatch(/^scrypt\$/);
    expect(stored?.secretHash).not.toContain(issued.cookieValue.split(".")[1]);
    expect(await resolvePresetOwner(repository, issued.cookieValue)).toBe(issued.ownerId);
    const last = issued.cookieValue.at(-1);
    expect(await resolvePresetOwner(repository, `${issued.cookieValue.slice(0, -1)}${last === "A" ? "B" : "A"}`)).toBeNull();
  });

  it("does not mint a new owner during read and sets a scoped, HttpOnly cookie", async () => {
    const { ownerCookieOptions, resolvePresetOwner } = await import("./preset-owner");
    const repository = new MemoryPresetRepository();

    expect(await resolvePresetOwner(repository, null)).toBeNull();
    expect(ownerCookieOptions("production")).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/api/skin-presets" });
    expect(ownerCookieOptions("development").secure).toBe(false);
  });
});
