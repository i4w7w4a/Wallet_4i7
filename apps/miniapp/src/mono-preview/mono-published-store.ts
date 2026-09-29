import { randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, stat, unlink, type FileHandle } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import type { MonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MAX_PUBLISH_BODY_BYTES, MonoPublishedError, parsePublishBody, parsePublishedRecord,
  type MonoPublishedRecord, type MonoPublishedSlot } from "./mono-published-contract";

const MAX_RECORD_BYTES = MAX_PUBLISH_BODY_BYTES + 2_048;
const LOCK_WAIT_MS = 3_000;

function unavailable(): MonoPublishedError { return new MonoPublishedError("Хранилище публикаций недоступно.", 503); }

async function syncDirectory(path: string): Promise<void> {
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try { await directory.sync(); } finally { await directory.close(); }
}

/** Write a complete temporary file on the same volume before the rename. */
export async function writePublishedAtomic(path: string, text: string): Promise<void> {
  const temporary = `${path}.tmp-${randomUUID()}`;
  let file: FileHandle | null = null;
  try {
    file = await open(temporary, "wx", 0o600);
    await file.writeFile(text, "utf8");
    await file.sync();
    await file.close(); file = null;
    await rename(temporary, path);
    await syncDirectory(dirname(path));
  } finally {
    await file?.close().catch(() => {});
    await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; });
  }
}

export class MonoPublishedStore {
  constructor(private readonly root: string | undefined) {}

  async dataDirectory(): Promise<string> {
    if (!this.root || !isAbsolute(this.root)) throw unavailable();
    try {
      const directory = await realpath(this.root);
      const checkout = await realpath(process.cwd());
      const insideCheckout = relative(checkout, directory);
      if (insideCheckout === "" || (!insideCheckout.startsWith("..") && !isAbsolute(insideCheckout))) throw unavailable();
      if (!(await stat(directory)).isDirectory()) throw unavailable();
      return directory;
    } catch { throw unavailable(); }
  }

  async withLock<T>(work: (directory: string) => Promise<T>): Promise<T> {
    const directory = await this.dataDirectory();
    const lockPath = join(directory, ".mono-publish.lock");
    const deadline = Date.now() + LOCK_WAIT_MS;
    let lock: FileHandle;
    while (true) {
      try { lock = await open(lockPath, "wx", 0o600); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST" || Date.now() >= deadline) throw unavailable();
        await new Promise(resolve => setTimeout(resolve, 35));
      }
    }
    try {
      await lock.writeFile(`${process.pid} ${new Date().toISOString()}\n`, "utf8");
      await lock.sync();
      return await work(directory);
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }

  private async readFrom(directory: string, slot: MonoPublishedSlot): Promise<MonoPublishedRecord | null> {
    const path = join(directory, `slot-${slot}.json`);
    let file: FileHandle;
    try { file = await open(path, "r"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw unavailable();
    }
    try {
      if ((await file.stat()).size > MAX_RECORD_BYTES) throw unavailable();
      return parsePublishedRecord(JSON.parse(await file.readFile("utf8")), slot);
    } catch { throw unavailable(); }
    finally { await file.close(); }
  }

  async read(slot: MonoPublishedSlot): Promise<MonoPublishedRecord | null> {
    return this.readFrom(await this.dataDirectory(), slot);
  }

  async publish(slot: MonoPublishedSlot, expectedRevision: number, value: MonoAppearanceEnvelope): Promise<MonoPublishedRecord> {
    const { snapshot } = parsePublishBody({ expectedRevision, snapshot: value });
    return this.withLock(async directory => {
      const previous = await this.readFrom(directory, slot);
      if ((previous?.revision ?? 0) !== expectedRevision)
        throw new MonoPublishedError("Публикация изменилась. Обновите статус перед повторной попыткой.", 409);
      const next: MonoPublishedRecord = { slot, revision: expectedRevision + 1,
        updatedAt: new Date().toISOString(), snapshot };
      const serialized = JSON.stringify(next);
      if (new TextEncoder().encode(serialized).byteLength > MAX_RECORD_BYTES) throw new MonoPublishedError("Снимок слишком велик.", 413);
      const historyDirectory = join(directory, "history", `slot-${slot}`);
      await mkdir(historyDirectory, { recursive: true, mode: 0o700 });
      await writePublishedAtomic(join(historyDirectory,
        `revision-${String(next.revision).padStart(8, "0")}-${randomUUID()}.json`), serialized);
      await writePublishedAtomic(join(directory, `slot-${slot}.json`), serialized);
      return next;
    });
  }
}
