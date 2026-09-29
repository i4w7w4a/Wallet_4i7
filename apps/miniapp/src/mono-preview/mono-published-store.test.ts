import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND_EDGE_FINISH, materialCatalogV2 } from "@wallet/ui";
import { createFirstMonoWorkingDocument } from "./mono-first-button-preset";
import { createDefaultActionArtworkMap } from "./action-artwork/model";
import { createMonoAppearanceEnvelope, createMonoAppearanceFromDocument } from "./mono-preset-envelope";
import { MonoPublishedStore } from "./mono-published-store";

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "novex-published-test-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe("persistent public MONO revisions", () => {
  it("keeps the same slot path through updates and survives a new store instance", async () => {
    const first = createMonoAppearanceEnvelope("ledger");
    const store = new MonoPublishedStore(root);
    expect(await store.read(1)).toBeNull();
    const published = await store.publish(1, 0, first);
    expect(published).toMatchObject({ slot: 1, revision: 1, snapshot: first });
    const reopened = new MonoPublishedStore(root);
    expect(await reopened.read(1)).toEqual(published);
    const updated = await reopened.publish(1, 1, createMonoAppearanceEnvelope("frost"));
    expect(updated.revision).toBe(2);
    expect((await store.read(1))?.snapshot.appearance.preset).toBe("frost");
    expect(await store.read(2)).toBeNull();
    const history = await readdir(join(root, "history", "slot-1"));
    expect(history).toHaveLength(2);
    expect(JSON.parse(await readFile(join(root, "history", "slot-1", history[0]!), "utf8"))).toHaveProperty("snapshot");
  });

  it("rejects stale and parallel writes without silently replacing a winner", async () => {
    const store = new MonoPublishedStore(root);
    await store.publish(3, 0, createMonoAppearanceEnvelope());
    await expect(store.publish(3, 0, createMonoAppearanceEnvelope("frost"))).rejects.toMatchObject({ status: 409 });
    const results = await Promise.allSettled([
      new MonoPublishedStore(root).publish(3, 1, createMonoAppearanceEnvelope("frost")),
      new MonoPublishedStore(root).publish(3, 1, createMonoAppearanceEnvelope("mercury")),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await store.read(3))?.revision).toBe(2);
  });

  it("fails closed on corruption and leaves full history for recovery", async () => {
    const store = new MonoPublishedStore(root);
    await store.publish(1, 0, createMonoAppearanceEnvelope());
    await writeFile(join(root, "slot-1.json"), "{broken", "utf8");
    await expect(store.read(1)).rejects.toMatchObject({ status: 503 });
    await expect(store.publish(1, 1, createMonoAppearanceEnvelope("frost"))).rejects.toMatchObject({ status: 503 });
    expect(await readdir(join(root, "history", "slot-1"))).toHaveLength(1);
    expect(await readFile(join(root, "slot-1.json"), "utf8")).toBe("{broken");
  });

  it("rejects an unsafe storage root and oversized or untrusted snapshots", async () => {
    await expect(new MonoPublishedStore("relative/data").read(1)).rejects.toMatchObject({ status: 503 });
    const store = new MonoPublishedStore(root);
    await expect(store.publish(1, 0, { ...createMonoAppearanceEnvelope(), privateData: "x" } as never))
      .rejects.toMatchObject({ status: 422 });
    await expect(store.publish(1, 0, { ...createMonoAppearanceEnvelope(), padding: "x".repeat(250_000) } as never))
      .rejects.toMatchObject({ status: 413 });
    expect(await store.read(1)).toBeNull();
  });

  it("persists a complete selected material, artwork and optical snapshot", async () => {
    const document = createFirstMonoWorkingDocument();
    const fluid = materialCatalogV2.materials.find(item => item.id === "fluid")!.presets[0]!.recipe;
    const artwork = createDefaultActionArtworkMap();
    artwork["quick.send"].packId = "volume-v1";
    document.materials.ledger = {
      background: { version: 1, recipe: fluid, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH },
      buttons: { version: 3, frameMode: "separate", bindings: document.materials.ledger.buttons!.bindings, artwork },
    };
    const envelope = createMonoAppearanceFromDocument(document, "ledger");
    await new MonoPublishedStore(root).publish(4, 0, envelope);
    const restored = await new MonoPublishedStore(root).read(4);
    expect(restored?.snapshot).toEqual(envelope);
    expect(restored?.snapshot.material.buttons).toEqual(document.materials.ledger.buttons);
    expect(restored?.snapshot.appearance.optics.ior).toBe(document.optics.ledger.ior);
  });

  it("keeps public reads available with a stranded lock and refuses writes until operator recovery", async () => {
    const store = new MonoPublishedStore(root);
    const first = await store.publish(1, 0, createMonoAppearanceEnvelope());
    await writeFile(join(root, ".mono-publish.lock"), "interrupted writer\n", { flag: "wx" });
    expect(await store.read(1)).toEqual(first);
    await expect(store.publish(1, 1, createMonoAppearanceEnvelope("frost"))).rejects.toMatchObject({ status: 503 });
    expect(await readFile(join(root, ".mono-publish.lock"), "utf8")).toContain("interrupted writer");
    expect((await store.read(1))?.revision).toBe(1);
  });
});
