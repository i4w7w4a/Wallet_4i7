import type { MonoAppearanceEnvelope } from "./mono-preset-envelope";

export { MonoShareError } from "./mono-share-transport";
export const MONO_SHARE_MAX_URL_LENGTH = 16_384;

export async function createMonoShareUrl(_envelope: MonoAppearanceEnvelope, _origin: string): Promise<string> {
  throw new Error("Share URL is not implemented");
}

export async function readMonoShareFragment(_fragment: string): Promise<MonoAppearanceEnvelope> {
  throw new Error("Share fragment is not implemented");
}
