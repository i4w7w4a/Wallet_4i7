export const MONO_SHARE_MAX_BYTES = 65_536;
export const MONO_SHARE_MAX_TOKEN_LENGTH = 16_000;

export class MonoShareError extends Error {
  constructor(readonly kind: "corrupt" | "version" | "too-large" | "unsupported" | "invalid", message: string) {
    super(message);
    this.name = "MonoShareError";
  }
}

const corrupt = () => new MonoShareError("corrupt", "Ссылка повреждена. Попросите отправителя создать её заново.");
const tooLarge = () => new MonoShareError("too-large", "Оформление слишком велико для ссылки. Сохраните его в JSON.");

function requireSupport(): void {
  if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined" || !globalThis.crypto?.subtle)
    throw new MonoShareError("unsupported", "Этот браузер не поддерживает ссылки оформления. Откройте ссылку в обновлённом браузере.");
}

async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function boundedBytes(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

/** Transport only. Callers must validate the appearance schema before encoding AND after decoding. */
export async function encodeMonoSharePayload(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > MONO_SHARE_MAX_BYTES) throw tooLarge();
  requireSupport();
  const compressed = await boundedBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")), MONO_SHARE_MAX_BYTES);
  const token = `m1.${await digest(bytes)}.${base64url(compressed)}`;
  if (token.length > MONO_SHARE_MAX_TOKEN_LENGTH) throw tooLarge();
  return token;
}

export async function decodeMonoSharePayload(token: string): Promise<string> {
  if (token.length > MONO_SHARE_MAX_TOKEN_LENGTH) throw tooLarge();
  const [version] = token.split(".");
  if (/^m\d+$/.test(version) && version !== "m1")
    throw new MonoShareError("version", "Эта версия ссылки пока не поддерживается.");
  const match = /^m1\.([a-f0-9]{64})\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!match) throw corrupt();
  requireSupport();
  try {
    const binary = atob(match[2].replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (base64url(bytes) !== match[2]) throw corrupt();
    const decompressed = await boundedBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")), MONO_SHARE_MAX_BYTES);
    if (await digest(decompressed) !== match[1]) throw corrupt();
    return new TextDecoder("utf-8", { fatal: true }).decode(decompressed);
  } catch (error) {
    if (error instanceof MonoShareError) throw error;
    throw corrupt();
  }
}
