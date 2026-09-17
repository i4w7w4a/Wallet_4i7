import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { PresetRepository } from "./preset-types";

const COST = 16_384;
const COOKIE_NAME = "wallet4i7_preset_owner";
const COOKIE_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export { COOKIE_NAME as PRESET_OWNER_COOKIE_NAME };

async function secretHash(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(secret, salt, 32, { N: COST, r: 8, p: 1 }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export async function resolvePresetOwner(repository: PresetRepository, cookieValue: string | null | undefined): Promise<string | null> {
  const match = cookieValue?.match(COOKIE_PATTERN);
  if (!match) return null;
  const owner = await repository.findOwner(match[1]);
  if (!owner) return null;
  const parts = owner.secretHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== String(COST) || parts[2] !== "8" || parts[3] !== "1") return null;
  const salt = Buffer.from(parts[4], "base64url"), expected = Buffer.from(parts[5], "base64url");
  if (salt.length !== 16 || expected.length !== 32) return null;
  const supplied = await secretHash(match[2], salt);
  return timingSafeEqual(supplied, expected) ? owner.id : null;
}

export async function getOrCreatePresetOwner(repository: PresetRepository, cookieValue: string | null | undefined): Promise<{ ownerId: string; cookieValue: string; issued: boolean }> {
  const existing = await resolvePresetOwner(repository, cookieValue);
  if (existing) return { ownerId: existing, cookieValue: cookieValue!, issued: false };
  const ownerId = randomUUID(), secret = randomBytes(32).toString("base64url"), salt = randomBytes(16);
  const hash = await secretHash(secret, salt);
  await repository.insertOwner({ id: ownerId, secretHash: `scrypt$${COST}$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`, createdAt: new Date().toISOString() });
  return { ownerId, cookieValue: `${ownerId}.${secret}`, issued: true };
}

export function ownerCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true as const,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/api/skin-presets",
    maxAge: 60 * 60 * 24 * 365,
  };
}
