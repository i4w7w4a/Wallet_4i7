import { canonicalMonoAppearance, normalizeMonoAppearanceEnvelope, type MonoAppearanceEnvelope } from "./mono-preset-envelope";
import { decodeMonoSharePayload, encodeMonoSharePayload, MonoShareError } from "./mono-share-transport";

export { MonoShareError } from "./mono-share-transport";
export const MONO_SHARE_MAX_URL_LENGTH = 16_384;

export async function createMonoShareUrl(envelope: MonoAppearanceEnvelope, origin: string): Promise<string> {
  let base: URL;
  try { base = new URL(origin); } catch { throw new MonoShareError("invalid", "Некорректный адрес сайта."); }
  if ((base.protocol !== "https:" && base.protocol !== "http:") || base.username || base.password)
    throw new MonoShareError("invalid", "Для ссылки нужен адрес сайта по HTTP или HTTPS.");
  const data = normalizeMonoAppearanceEnvelope(envelope);
  const token = await encodeMonoSharePayload(canonicalMonoAppearance(data));
  const link = new URL("/mono/view", base.origin);
  link.hash = `mono=${token}`;
  if (link.href.length > MONO_SHARE_MAX_URL_LENGTH)
    throw new MonoShareError("too-large", "Оформление слишком велико для ссылки. Сохраните его в JSON.");
  return link.href;
}

export async function readMonoShareFragment(fragment: string): Promise<MonoAppearanceEnvelope> {
  if (!fragment.startsWith("#mono=")) throw new MonoShareError("invalid", "В ссылке нет сохранённого оформления.");
  const json = await decodeMonoSharePayload(fragment.slice(6));
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new MonoShareError("corrupt", "Ссылка содержит повреждённое оформление."); }
  return normalizeMonoAppearanceEnvelope(value);
}
