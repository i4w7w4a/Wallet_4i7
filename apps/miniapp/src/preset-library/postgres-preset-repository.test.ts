import { describe, expect, it } from "vitest";
import { PostgresPresetRepository, type PresetSqlPort } from "./postgres-preset-repository";
import type { PresetOwnerRow, PresetRevisionRow, PresetRow } from "./preset-types";
import { normalizeMonoPaletteConfig } from "@wallet/ui";
import { exportMonoPalettePreset, importMonoPalettePreset } from "../mono-preview/mono-preset-codec";

const owner: PresetOwnerRow = { id: "11111111-1111-4111-8111-111111111111", secretHash: "scrypt$test'; DROP TABLE skin_presets;--", createdAt: "2026-09-17T00:00:00.000Z" };

function recorder(responses: unknown[][] = []) {
  const calls: Array<{ statement: string; params: unknown[]; transaction: boolean }> = [];
  let inside = false;
  const port: PresetSqlPort = {
    async query(statement, params) {
      calls.push({ statement, params, transaction: inside });
      return (responses.shift() ?? []) as never;
    },
    async transaction<T>(body: (tx: PresetSqlPort) => Promise<T>): Promise<T> {
      inside = true;
      try { return await body(port); }
      finally { inside = false; }
    },
  };
  return { port, calls };
}

describe("PostgreSQL preset repository boundary", () => {
  it("keeps untrusted owner secrets in parameters, never SQL text", async () => {
    const { port, calls } = recorder();
    await new PostgresPresetRepository(port).insertOwner(owner);

    expect(calls).toHaveLength(1);
    expect(calls[0].statement).toContain("$2");
    expect(calls[0].statement).not.toContain(owner.secretHash);
    expect(calls[0].params).toContain(owner.secretHash);
  });

  it("writes a preset and its immutable first revision in one transaction", async () => {
    const { port, calls } = recorder();
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(normalizeMonoPaletteConfig()));
    const row: PresetRow = { id: "22222222-2222-4222-8222-222222222222", slug: "unguessable-slug", ownerId: owner.id,
      sourcePresetId: null, currentRevision: 1, createdAt: owner.createdAt, deletedAt: null };
    const revision: PresetRevisionRow = { presetId: row.id, revision: 1, name: "Graphite", description: "",
      visibility: "unlisted", preset, contentHash: preset.contentHash, createdAt: owner.createdAt };

    await new PostgresPresetRepository(port).insertPreset(row, revision);

    expect(calls).toHaveLength(2);
    expect(calls.every(call => call.transaction)).toBe(true);
    expect(calls[1].params).toContain(preset.contentHash);
    expect(calls[1].statement).not.toContain(preset.contentHash);
  });

  it("serializes revision updates and reports a stale writer without inserting a revision", async () => {
    const { port, calls } = recorder([[{ id: owner.id, owner_id: owner.id, current_revision: 2, deleted_at: null }]]);
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(normalizeMonoPaletteConfig()));
    const revision: PresetRevisionRow = { presetId: owner.id, revision: 2, name: "A", description: "", visibility: "unlisted",
      preset, contentHash: preset.contentHash, createdAt: owner.createdAt };

    const result = await new PostgresPresetRepository(port).appendRevision(owner.id, owner.id, 1, revision);

    expect(result).toBe("conflict");
    expect(calls).toHaveLength(1);
    expect(calls[0].statement).toMatch(/FOR UPDATE/i);
    expect(calls[0].transaction).toBe(true);
  });

  it("maps database rows to safe domain records without changing the stored envelope", async () => {
    const preset = await importMonoPalettePreset(await exportMonoPalettePreset(normalizeMonoPaletteConfig()));
    const { port, calls } = recorder([
      [{ id: owner.id, slug: "unguessable-slug", owner_id: owner.id, source_preset_id: null,
        current_revision: 1, created_at: new Date(owner.createdAt), deleted_at: null }],
      [{ preset_id: owner.id, revision: 1, name: "Graphite", description: "", visibility: "unlisted",
        envelope: preset, content_hash: preset.contentHash, created_at: new Date(owner.createdAt) }],
    ]);
    const repository = new PostgresPresetRepository(port);

    expect((await repository.findBySlug("unguessable-slug"))?.createdAt).toBe(owner.createdAt);
    expect((await repository.getRevision(owner.id, 1))?.preset).toEqual(preset);
    expect(calls[0].params).toEqual(["unguessable-slug"]);
    expect(calls[1].params).toEqual([owner.id, 1]);
  });

  it("soft-deletes only an owned live row and does not touch the revisions table", async () => {
    const { port, calls } = recorder([[{ id: owner.id }]]);
    const repository = new PostgresPresetRepository(port);

    expect(await repository.softDelete(owner.id, owner.id, owner.createdAt)).toBe("ok");
    expect(calls[0].statement).toMatch(/UPDATE skin_presets/i);
    expect(calls.every(call => !/skin_preset_revisions/i.test(call.statement))).toBe(true);
    expect(calls[0].params).toEqual([owner.id, owner.id, owner.createdAt]);
  });

  it("counts recent owner writes with parameterized bounds", async () => {
    const since = "2026-09-17T00:00:00.000Z";
    const { port, calls } = recorder([[{ count: 12 }]]);
    expect(await new PostgresPresetRepository(port).countRecentWrites(owner.id, since)).toBe(12);
    expect(calls[0].statement).toMatch(/created_at >= \$2/);
    expect(calls[0].params).toEqual([owner.id, since]);
  });
});
