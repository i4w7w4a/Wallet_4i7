import type { MonoPalettePresetV1 } from "../mono-preview/mono-preset-codec";

export type PresetVisibility = "unlisted" | "public";
export type PresetOwnerRow = { id: string; secretHash: string; createdAt: string };
export type PresetRow = {
  id: string; slug: string; ownerId: string; sourcePresetId: string | null;
  currentRevision: number; createdAt: string; deletedAt: string | null;
};
export type PresetRevisionRow = {
  presetId: string; revision: number; name: string; description: string;
  visibility: PresetVisibility; preset: MonoPalettePresetV1;
  contentHash: string; createdAt: string;
};
export type PresetView = Omit<PresetRow, "ownerId" | "deletedAt"> & Omit<PresetRevisionRow, "presetId">;
export type AppendRevisionResult = "ok" | "not-found" | "forbidden" | "conflict";

export interface PresetRepository {
  insertOwner(owner: PresetOwnerRow): Promise<void>;
  findOwner(id: string): Promise<PresetOwnerRow | null>;
  insertPreset(row: PresetRow, revision: PresetRevisionRow): Promise<void>;
  findById(id: string): Promise<PresetRow | null>;
  findBySlug(slug: string): Promise<PresetRow | null>;
  listByOwner(ownerId: string): Promise<PresetRow[]>;
  getRevision(presetId: string, revision: number): Promise<PresetRevisionRow | null>;
  listRevisions(presetId: string): Promise<PresetRevisionRow[]>;
  countRecentWrites(ownerId: string, since: string): Promise<number>;
  appendRevision(id: string, ownerId: string, expectedRevision: number, revision: PresetRevisionRow): Promise<AppendRevisionResult>;
  softDelete(id: string, ownerId: string, deletedAt: string): Promise<"ok" | "not-found" | "forbidden">;
}

export class PresetServiceError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503) {
    super(message);
    this.name = "PresetServiceError";
  }
}
