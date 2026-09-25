import { expect, it } from "vitest";
import { createWorkspace } from "./model";
import { createSandboxSession } from "./session";
import { V2_LIBRARY_KEY, V2_WORKSPACE_KEY } from "./storage-v2";

type Document = { material: string; edge: number };
const initial: Document = { material: "new", edge: 0 };
const old: Document = { material: "saved-v2", edge: 0 };
const parse = (value: unknown): Document => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    !Object.hasOwn(value, "material") || !Object.hasOwn(value, "edge")) throw new Error("Invalid document");
  return value as Document;
};
const locked = async <T,>(task: () => T) => task();
function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
}

it("lifts visible v2 trials and active draft in memory, then writes only v3 on edit and Save", async () => {
  const store = memory();
  const oldLibraryRaw = '{"version":2,"saved":"do not replace"}';
  const oldWorkspaceRaw = '{"version":2,"active":"do not replace"}';
  store.setItem(V2_LIBRARY_KEY, oldLibraryRaw);
  store.setItem(V2_WORKSPACE_KEY, oldWorkspaceRaw);
  const oldLibrary = { version: 3 as const, revision: 4, nextId: 2,
    trials: [{ id: "trial-1", name: "Старая проба", revision: 1, recipe: old }] };
  const oldWorkspace = createWorkspace(old, "material:fluid:2");
  const session = createSandboxSession(initial, "material:fluid:2", parse, 3, {
    readPreviousLibrary: port => port.getItem(V2_LIBRARY_KEY) === oldLibraryRaw ? oldLibrary : null,
    readPreviousWorkspace: port => port.getItem(V2_WORKSPACE_KEY) === oldWorkspaceRaw ? oldWorkspace : null,
  });
  session.connect(store, locked);
  expect(session.getSnapshot().library.trials.map(trial => trial.name)).toEqual(["Старая проба"]);
  expect(session.getSnapshot().workspace.slots[0].present.recipe).toEqual(old);
  expect(store.getItem("wallet4i7.background-sandbox.library.v3")).toBeNull();
  expect(store.getItem("wallet4i7.background-sandbox.workspace.v3")).toBeNull();

  session.edit({ material: "saved-v2", edge: .4 });
  await session.flushRecovery();
  expect(store.getItem("wallet4i7.background-sandbox.workspace.v3")).toContain('"edge":0.4');
  expect(await session.save("Новая", true)).toBe(true);
  expect(session.getSnapshot().library.trials.map(trial => trial.name)).toEqual(["Старая проба", "Новая"]);
  expect(store.getItem("wallet4i7.background-sandbox.library.v3")).toContain("Старая проба");
  expect(store.getItem(V2_LIBRARY_KEY)).toBe(oldLibraryRaw);
  expect(store.getItem(V2_WORKSPACE_KEY)).toBe(oldWorkspaceRaw);
});
