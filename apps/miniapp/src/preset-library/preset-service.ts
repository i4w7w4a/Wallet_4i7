import { createHash, randomBytes, randomUUID } from "node:crypto";
import { importMonoPalettePreset, type MonoPalettePresetV1 } from "../mono-preview/mono-preset-codec";
import {
  PresetServiceError, type AppendRevisionResult, type PresetOwnerRow, type PresetRepository,
  type PresetRevisionRow, type PresetRow, type PresetView, type PresetVisibility,
} from "./preset-types";

const clone = <T,>(value: T): T => structuredClone(value);
const nodeSha256 = async (bytes: Uint8Array) => new Uint8Array(createHash("sha256").update(bytes).digest());
const MAX_WRITES_PER_HOUR = 30;

/** Deterministic in-process repository for service/route contract tests. */
export class MemoryPresetRepository implements PresetRepository {
  private owners = new Map<string, PresetOwnerRow>();
  private presets = new Map<string, PresetRow>();
  private revisions = new Map<string, PresetRevisionRow[]>();

  async insertOwner(owner: PresetOwnerRow): Promise<void> { this.owners.set(owner.id, clone(owner)); }
  async findOwner(id: string): Promise<PresetOwnerRow | null> { return clone(this.owners.get(id) ?? null); }
  async insertPreset(row: PresetRow, revision: PresetRevisionRow): Promise<void> {
    if (this.presets.has(row.id) || [...this.presets.values()].some(entry => entry.slug === row.slug)) throw new Error("Duplicate preset ID or slug");
    this.presets.set(row.id, clone(row));
    this.revisions.set(row.id, [clone(revision)]);
  }
  async findById(id: string): Promise<PresetRow | null> { return clone(this.presets.get(id) ?? null); }
  async findBySlug(slug: string): Promise<PresetRow | null> {
    return clone([...this.presets.values()].find(row => row.slug === slug) ?? null);
  }
  async listByOwner(ownerId: string): Promise<PresetRow[]> {
    return clone([...this.presets.values()].filter(row => row.ownerId === ownerId && !row.deletedAt));
  }
  async getRevision(presetId: string, revision: number): Promise<PresetRevisionRow | null> {
    return clone(this.revisions.get(presetId)?.find(row => row.revision === revision) ?? null);
  }
  async listRevisions(presetId: string): Promise<PresetRevisionRow[]> { return clone(this.revisions.get(presetId) ?? []); }
  async countRecentWrites(ownerId: string, since: string): Promise<number> {
    return [...this.presets.values()].filter(row => row.ownerId === ownerId)
      .reduce((count, row) => count + (this.revisions.get(row.id) ?? []).filter(revision => revision.createdAt >= since).length, 0);
  }
  async appendRevision(id: string, ownerId: string, expectedRevision: number, revision: PresetRevisionRow): Promise<AppendRevisionResult> {
    const row = this.presets.get(id);
    if (!row || row.deletedAt) return "not-found";
    if (row.ownerId !== ownerId) return "forbidden";
    if (row.currentRevision !== expectedRevision) return "conflict";
    if (revision.revision !== expectedRevision + 1 || revision.presetId !== id) throw new Error("Invalid revision sequence");
    this.revisions.get(id)!.push(clone(revision));
    row.currentRevision = revision.revision;
    return "ok";
  }
  async softDelete(id: string, ownerId: string, deletedAt: string): Promise<"ok" | "not-found" | "forbidden"> {
    const row = this.presets.get(id);
    if (!row || row.deletedAt) return "not-found";
    if (row.ownerId !== ownerId) return "forbidden";
    row.deletedAt = deletedAt;
    return "ok";
  }
}

function textField(value: unknown, label: "name" | "description", max: number, required: boolean): string {
  if (typeof value !== "string") throw new PresetServiceError(`Invalid ${label}`, 400);
  const text = value.normalize("NFC").trim();
  if ((required && !text) || Array.from(text).length > max || /[\u0000-\u001f\u007f]/u.test(text)) throw new PresetServiceError(`Invalid ${label}`, 400);
  return text;
}

function visibility(value: unknown): PresetVisibility {
  if (value === undefined) return "unlisted";
  if (value !== "unlisted" && value !== "public") throw new PresetServiceError("Invalid visibility", 400);
  return value;
}

export function validatePresetMetadata(input: { name?: unknown; description?: unknown; visibility?: unknown }) {
  return {
    name: textField(input.name, "name", 80, true),
    description: textField(input.description ?? "", "description", 500, false),
    visibility: visibility(input.visibility),
  };
}

export async function validatePresetEnvelope(value: unknown): Promise<MonoPalettePresetV1> {
  let text: string;
  try { text = JSON.stringify(value); } catch { throw new PresetServiceError("Invalid preset payload", 400); }
  if (!text) throw new PresetServiceError("Invalid preset payload", 400);
  if (new TextEncoder().encode(text).length > 131_072) throw new PresetServiceError("Palette preset size limit exceeded", 413);
  try { return await importMonoPalettePreset(text, nodeSha256); }
  catch (error) { throw new PresetServiceError(error instanceof Error ? error.message : "Invalid preset payload", 400); }
}

function view(row: PresetRow, revision: PresetRevisionRow): PresetView {
  return {
    id: row.id, slug: row.slug, sourcePresetId: row.sourcePresetId,
    currentRevision: row.currentRevision, createdAt: row.createdAt,
    revision: revision.revision, name: revision.name, description: revision.description,
    visibility: revision.visibility, preset: clone(revision.preset), contentHash: revision.contentHash,
  };
}

function failResult(result: AppendRevisionResult | "ok" | "not-found" | "forbidden"): void {
  if (result === "forbidden") throw new PresetServiceError("This preset belongs to another visitor", 403);
  if (result === "conflict") throw new PresetServiceError("Preset revision conflict", 409);
  if (result === "not-found") throw new PresetServiceError("Preset not found", 404);
}

type CreateInput = { ownerId: string; name: string; description?: string; visibility?: PresetVisibility; preset: unknown; sourcePresetId?: string | null };

export function createPresetService(repository: PresetRepository) {
  async function assertWriteBudget(ownerId: string): Promise<void> {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    if (await repository.countRecentWrites(ownerId, since) >= MAX_WRITES_PER_HOUR)
      throw new PresetServiceError("Preset write limit reached; try again later", 429);
  }

  async function create(input: CreateInput): Promise<PresetView> {
    if (!input.ownerId) throw new PresetServiceError("Owner is required", 401);
    const metadata = validatePresetMetadata(input);
    await assertWriteBudget(input.ownerId);
    const preset = await validatePresetEnvelope(input.preset);
    const id = randomUUID(), slug = randomBytes(24).toString("base64url"), createdAt = new Date().toISOString();
    const row: PresetRow = { id, slug, ownerId: input.ownerId, sourcePresetId: input.sourcePresetId ?? null,
      currentRevision: 1, createdAt, deletedAt: null };
    const revision: PresetRevisionRow = { presetId: id, revision: 1, name: metadata.name, description: metadata.description, visibility: metadata.visibility,
      preset, contentHash: preset.contentHash, createdAt };
    await repository.insertPreset(row, revision);
    return view(row, revision);
  }

  async function read(slug: string, number?: number): Promise<PresetView | null> {
    const row = await repository.findBySlug(slug);
    if (!row || row.deletedAt) return null;
    const revision = await repository.getRevision(row.id, number ?? row.currentRevision);
    return revision ? view(row, revision) : null;
  }

  async function listMine(ownerId: string): Promise<PresetView[]> {
    if (!ownerId) return [];
    const rows = await repository.listByOwner(ownerId);
    const views = await Promise.all(rows.map(async row => {
      const revision = await repository.getRevision(row.id, row.currentRevision);
      if (!revision) throw new Error("Preset current revision is missing");
      return view(row, revision);
    }));
    return views.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function revise(input: { id: string; ownerId: string; expectedRevision: number; name?: string; description?: string; visibility?: PresetVisibility; preset?: unknown }): Promise<PresetView> {
    const row = await repository.findById(input.id);
    if (!row || row.deletedAt) throw new PresetServiceError("Preset not found", 404);
    if (!input.ownerId || row.ownerId !== input.ownerId) throw new PresetServiceError("This preset belongs to another visitor", 403);
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) throw new PresetServiceError("Invalid expected revision", 400);
    if (row.currentRevision !== input.expectedRevision) throw new PresetServiceError("Preset revision conflict", 409);
    await assertWriteBudget(input.ownerId);
    const previous = await repository.getRevision(row.id, row.currentRevision);
    if (!previous) throw new Error("Preset current revision is missing");
    const preset = input.preset === undefined ? previous.preset : await validatePresetEnvelope(input.preset);
    const revision: PresetRevisionRow = {
      presetId: row.id, revision: row.currentRevision + 1,
      name: textField(input.name ?? previous.name, "name", 80, true),
      description: textField(input.description ?? previous.description, "description", 500, false),
      visibility: visibility(input.visibility ?? previous.visibility),
      preset, contentHash: preset.contentHash, createdAt: new Date().toISOString(),
    };
    const result = await repository.appendRevision(row.id, input.ownerId, input.expectedRevision, revision);
    failResult(result);
    return view({ ...row, currentRevision: revision.revision }, revision);
  }

  async function fork(input: { slug: string; ownerId: string; name: string; preset?: unknown }): Promise<PresetView> {
    const source = await read(input.slug);
    if (!source) throw new PresetServiceError("Preset not found", 404);
    return create({ ownerId: input.ownerId, name: input.name, preset: input.preset ?? source.preset, sourcePresetId: source.id });
  }

  async function history(slug: string): Promise<PresetView[]> {
    const row = await repository.findBySlug(slug);
    if (!row || row.deletedAt) throw new PresetServiceError("Preset not found", 404);
    const revisions = await repository.listRevisions(row.id);
    return revisions.map(revision => view(row, revision));
  }

  async function remove(input: { id: string; ownerId: string }): Promise<void> {
    const result = await repository.softDelete(input.id, input.ownerId, new Date().toISOString());
    failResult(result);
  }

  return { create, read, listMine, revise, fork, history, remove };
}
