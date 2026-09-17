import { describe, expect, it } from "vitest";
import { normalizeMonoPaletteConfig } from "@wallet/ui";
import { exportMonoPalettePreset } from "../mono-preview/mono-preset-codec";

async function validPreset(): Promise<unknown> {
  return JSON.parse(await exportMonoPalettePreset(normalizeMonoPaletteConfig()));
}

describe("preset service", () => {
  it("creates an unlisted named preset and reads its full snapshot by an unguessable link", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const service = createPresetService(new MemoryPresetRepository());
    const preset = await validPreset();

    const created = await service.create({ ownerId: "owner-a", name: "Графит", preset });
    const byLink = await service.read(created.slug);

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.slug).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    expect(created.name).toBe("Графит");
    expect(created.visibility).toBe("unlisted");
    expect(created.revision).toBe(1);
    expect(byLink?.preset).toEqual(preset);
  });

  it("does not expose the anonymous owner identifier on a public link", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const service = createPresetService(new MemoryPresetRepository());
    const created = await service.create({ ownerId: "private-owner-id", name: "Туман", preset: await validPreset() });

    expect(JSON.stringify(await service.read(created.slug))).not.toContain("private-owner-id");
  });

  it("allows duplicate display names, while listing only the owner's presets", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const service = createPresetService(new MemoryPresetRepository());
    const preset = await validPreset();
    const first = await service.create({ ownerId: "owner-a", name: "Один", preset });
    const second = await service.create({ ownerId: "owner-b", name: "Один", preset });

    expect(first.id).not.toBe(second.id);
    expect(first.slug).not.toBe(second.slug);
    expect((await service.listMine("owner-a")).map(item => item.id)).toEqual([first.id]);
  });

  it("rejects invalid names, descriptions and non-allowlisted preset payloads before storage", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const service = createPresetService(new MemoryPresetRepository());
    const preset = await validPreset();
    await expect(service.create({ ownerId: "owner-a", name: "   ", preset })).rejects.toThrow(/name/i);
    await expect(service.create({ ownerId: "owner-a", name: "x".repeat(81), preset })).rejects.toThrow(/name/i);
    await expect(service.create({ ownerId: "owner-a", name: "Valid", description: "x".repeat(501), preset })).rejects.toThrow(/description/i);
    await expect(service.create({ ownerId: "owner-a", name: "Valid", preset: { ...(preset as object), css: "body{}" } })).rejects.toThrow(/unknown field/i);
    await expect(service.create({ ownerId: "owner-a", name: "Valid", preset: { ...(preset as object), padding: "x".repeat(132_000) } }))
      .rejects.toMatchObject({ status: 413 });
    expect(await service.listMine("owner-a")).toEqual([]);
  });

  it("creates immutable revisions with optimistic concurrency and denies a foreign owner", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const service = createPresetService(new MemoryPresetRepository());
    const preset = await validPreset();
    const created = await service.create({ ownerId: "owner-a", name: "Original", preset });

    await expect(service.revise({ id: created.id, ownerId: "owner-b", expectedRevision: 1, name: "Stolen", preset })).rejects.toMatchObject({ status: 403 });
    const revised = await service.revise({ id: created.id, ownerId: "owner-a", expectedRevision: 1, name: "Revised", preset });
    expect(revised.revision).toBe(2);
    expect((await service.read(created.slug))?.name).toBe("Revised");
    expect((await service.read(created.slug, 1))?.name).toBe("Original");
    await expect(service.revise({ id: created.id, ownerId: "owner-a", expectedRevision: 1, name: "Stale", preset })).rejects.toMatchObject({ status: 409 });
    expect((await service.history(created.slug)).map(item => item.revision)).toEqual([1, 2]);
  });

  it("lets another visitor fork an unlisted link but never gains overwrite rights to source", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const service = createPresetService(new MemoryPresetRepository());
    const preset = await validPreset();
    const original = await service.create({ ownerId: "owner-a", name: "Source", preset });

    const fork = await service.fork({ slug: original.slug, ownerId: "owner-b", name: "My variation" });
    expect(fork.sourcePresetId).toBe(original.id);
    expect(fork.id).not.toBe(original.id);
    expect(fork.preset).toEqual(preset);
    expect((await service.listMine("owner-b")).map(item => item.id)).toEqual([fork.id]);
    await expect(service.revise({ id: original.id, ownerId: "owner-b", expectedRevision: 1, name: "Stolen", preset })).rejects.toMatchObject({ status: 403 });
  });

  it("soft-deletes only an owned preset without erasing its revision history", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const repository = new MemoryPresetRepository();
    const service = createPresetService(repository);
    const created = await service.create({ ownerId: "owner-a", name: "Transient", preset: await validPreset() });

    await expect(service.remove({ id: created.id, ownerId: "owner-b" })).rejects.toMatchObject({ status: 403 });
    await service.remove({ id: created.id, ownerId: "owner-a" });
    expect(await service.read(created.slug)).toBeNull();
    expect(await service.listMine("owner-a")).toEqual([]);
    expect((await repository.getRevision(created.id, 1))?.revision).toBe(1);
  });

  it("rejects an owner's excessive write frequency before storing another revision", async () => {
    const { createPresetService, MemoryPresetRepository } = await import("./preset-service");
    const repository = new MemoryPresetRepository();
    repository.countRecentWrites = async () => 30;
    const service = createPresetService(repository);
    await expect(service.create({ ownerId: "owner-a", name: "Too fast", preset: await validPreset() }))
      .rejects.toMatchObject({ status: 429 });
    expect(await service.listMine("owner-a")).toEqual([]);
  });
});
