import postgres from "postgres";
import type { PresetRepository, PresetOwnerRow, PresetRevisionRow, PresetRow } from "./preset-types";

type SqlValue = string | number | boolean | null;

export interface PresetSqlPort {
  query(statement: string, params: SqlValue[]): Promise<Record<string, unknown>[]>;
  transaction<T>(body: (tx: PresetSqlPort) => Promise<T>): Promise<T>;
}

const timestamp = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);

function presetRow(value: Record<string, unknown>): PresetRow {
  return {
    id: String(value.id), slug: String(value.slug), ownerId: String(value.owner_id),
    sourcePresetId: value.source_preset_id === null ? null : String(value.source_preset_id),
    currentRevision: Number(value.current_revision), createdAt: timestamp(value.created_at),
    deletedAt: value.deleted_at === null ? null : timestamp(value.deleted_at),
  };
}

function revisionRow(value: Record<string, unknown>): PresetRevisionRow {
  return {
    presetId: String(value.preset_id), revision: Number(value.revision), name: String(value.name),
    description: String(value.description), visibility: value.visibility as PresetRevisionRow["visibility"],
    preset: value.envelope as PresetRevisionRow["preset"], contentHash: String(value.content_hash),
    createdAt: timestamp(value.created_at),
  };
}

export class PostgresPresetRepository implements PresetRepository {
  constructor(private readonly port: PresetSqlPort) {}
  async insertOwner(owner: PresetOwnerRow): Promise<void> {
    await this.port.query(
      "INSERT INTO skin_preset_owners (id, secret_hash, created_at) VALUES ($1, $2, $3)",
      [owner.id, owner.secretHash, owner.createdAt],
    );
  }
  async insertPreset(row: PresetRow, revision: PresetRevisionRow): Promise<void> {
    await this.port.transaction(async tx => {
      await tx.query(
        "INSERT INTO skin_presets (id, slug, owner_id, source_preset_id, current_revision, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [row.id, row.slug, row.ownerId, row.sourcePresetId, row.currentRevision, row.createdAt, row.deletedAt],
      );
      await insertRevision(tx, revision);
    });
  }
  async findOwner(id: string): Promise<PresetOwnerRow | null> {
    const rows = await this.port.query("SELECT id, secret_hash, created_at FROM skin_preset_owners WHERE id = $1", [id]);
    const row = rows[0];
    return row ? { id: String(row.id), secretHash: String(row.secret_hash), createdAt: timestamp(row.created_at) } : null;
  }
  async findById(id: string): Promise<PresetRow | null> {
    const rows = await this.port.query("SELECT id, slug, owner_id, source_preset_id, current_revision, created_at, deleted_at FROM skin_presets WHERE id = $1", [id]);
    return rows[0] ? presetRow(rows[0]) : null;
  }
  async findBySlug(slug: string): Promise<PresetRow | null> {
    const rows = await this.port.query("SELECT id, slug, owner_id, source_preset_id, current_revision, created_at, deleted_at FROM skin_presets WHERE slug = $1", [slug]);
    return rows[0] ? presetRow(rows[0]) : null;
  }
  async listByOwner(ownerId: string): Promise<PresetRow[]> {
    const rows = await this.port.query("SELECT id, slug, owner_id, source_preset_id, current_revision, created_at, deleted_at FROM skin_presets WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY created_at, id", [ownerId]);
    return rows.map(presetRow);
  }
  async getRevision(presetId: string, revision: number): Promise<PresetRevisionRow | null> {
    const rows = await this.port.query("SELECT preset_id, revision, name, description, visibility, envelope, content_hash, created_at FROM skin_preset_revisions WHERE preset_id = $1 AND revision = $2", [presetId, revision]);
    return rows[0] ? revisionRow(rows[0]) : null;
  }
  async listRevisions(presetId: string): Promise<PresetRevisionRow[]> {
    const rows = await this.port.query("SELECT preset_id, revision, name, description, visibility, envelope, content_hash, created_at FROM skin_preset_revisions WHERE preset_id = $1 ORDER BY revision", [presetId]);
    return rows.map(revisionRow);
  }
  async countRecentWrites(ownerId: string, since: string): Promise<number> {
    const rows = await this.port.query(
      "SELECT count(*)::integer AS count FROM skin_preset_revisions r JOIN skin_presets p ON p.id = r.preset_id WHERE p.owner_id = $1 AND r.created_at >= $2",
      [ownerId, since],
    );
    return Number(rows[0]?.count ?? 0);
  }
  async appendRevision(id: string, ownerId: string, expectedRevision: number, revision: PresetRevisionRow): Promise<"ok" | "not-found" | "forbidden" | "conflict"> {
    return this.port.transaction(async tx => {
      const rows = await tx.query("SELECT id, owner_id, current_revision, deleted_at FROM skin_presets WHERE id = $1 FOR UPDATE", [id]);
      const row = rows[0];
      if (!row || row.deleted_at) return "not-found";
      if (row.owner_id !== ownerId) return "forbidden";
      if (row.current_revision !== expectedRevision) return "conflict";
      if (revision.revision !== expectedRevision + 1 || revision.presetId !== id) throw new Error("Invalid revision sequence");
      await insertRevision(tx, revision);
      await tx.query("UPDATE skin_presets SET current_revision = $2 WHERE id = $1", [id, revision.revision]);
      return "ok";
    });
  }
  async softDelete(id: string, ownerId: string, deletedAt: string): Promise<"ok" | "not-found" | "forbidden"> {
    const changed = await this.port.query("UPDATE skin_presets SET deleted_at = $3 WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id", [id, ownerId, deletedAt]);
    if (changed.length) return "ok";
    const rows = await this.port.query("SELECT owner_id, deleted_at FROM skin_presets WHERE id = $1", [id]);
    if (!rows[0] || rows[0].deleted_at) return "not-found";
    return rows[0].owner_id === ownerId ? "not-found" : "forbidden";
  }
}

async function insertRevision(tx: PresetSqlPort, revision: PresetRevisionRow): Promise<void> {
  await tx.query(
    "INSERT INTO skin_preset_revisions (preset_id, revision, name, description, visibility, envelope, content_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)",
    [revision.presetId, revision.revision, revision.name, revision.description, revision.visibility,
      JSON.stringify(revision.preset), revision.contentHash, revision.createdAt],
  );
}

function portFor(sql: postgres.Sql): PresetSqlPort {
  return {
    async query(statement, params) { return await sql.unsafe(statement, params); },
    async transaction<T>(body: (tx: PresetSqlPort) => Promise<T>): Promise<T> {
      return await sql.begin(tx => body(portFor(tx))) as T;
    },
  };
}

export function createPostgresPresetRepository(env: NodeJS.ProcessEnv = process.env): PostgresPresetRepository {
  const password = env.PRESET_DB_PASSWORD;
  if (!password || password.length < 12) throw new Error("PRESET_DB_PASSWORD must be configured with at least 12 characters");
  const sql = postgres({
    host: env.PRESET_DB_HOST || "127.0.0.1",
    port: Number(env.PRESET_DB_PORT || 5432),
    database: env.PRESET_DB_NAME || "wallet_presets",
    username: env.PRESET_DB_USER || "wallet_preset",
    password,
    max: 5,
    idle_timeout: 30,
    connect_timeout: 5,
  });
  return new PostgresPresetRepository(portFor(sql));
}
