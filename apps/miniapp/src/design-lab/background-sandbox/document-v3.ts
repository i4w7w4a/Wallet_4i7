import { DEFAULT_BACKGROUND_EDGE_FINISH, normalizeBackgroundEdgeFinish, type BackgroundEdgeFinishV1 } from "@wallet/ui";
import { isV2Recipe, type SandboxRecipe } from "./recipes";
import { exactObject, type RecipeParser, type SavedTrial, type StoragePort } from "./storage";
import { parseLibraryV2, V2_LIBRARY_KEY, V2_WORKSPACE_KEY } from "./storage-v2";
import { parseWorkspaceV2 } from "./workspace-v2";
import type { EditorFrame, SandboxSlot, SandboxWorkspace } from "./model";
import type { TrialLibraryV3 } from "./storage-v3";

/** Lab-owned full snapshot. Finish is presentation data, never a MaterialRecipeV2 parameter. */
export type BackgroundLabDocumentV1 = Readonly<{
  kind: "novex-background-lab";
  version: 1;
  material: SandboxRecipe;
  edgeFinish: BackgroundEdgeFinishV1;
}>;

export function createBackgroundDocument(material: SandboxRecipe): BackgroundLabDocumentV1 {
  return { kind: "novex-background-lab", version: 1, material, edgeFinish: DEFAULT_BACKGROUND_EDGE_FINISH };
}

export function parseBackgroundDocument(input: unknown, parseMaterial: RecipeParser<SandboxRecipe>): BackgroundLabDocumentV1 {
  const data = exactObject(input, ["kind", "version", "material", "edgeFinish"]);
  if (data.kind !== "novex-background-lab" || data.version !== 1) throw new Error("Версия документа фона не поддерживается.");
  let edge: Record<string, unknown>;
  try { edge = exactObject(data.edgeFinish, ["version", "sideDarkening", "inset", "softness"]); }
  catch { throw new Error("Недопустимая отделка краёв: нужен полный набор полей."); }
  if (edge.version !== 1) throw new Error("Версия отделки краёв не поддерживается.");
  if ([edge.sideDarkening, edge.inset, edge.softness].some(value => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error("Недопустимая отделка краёв: нужны конечные числовые значения.");
  }
  const material = parseMaterial(data.material);
  const edgeFinish = normalizeBackgroundEdgeFinish(edge);
  if (!isV2Recipe(material) && [edgeFinish.sideDarkening, edgeFinish.inset, edgeFinish.softness].some(value => value !== 0)) {
    throw new Error("Отделка краёв доступна только для материалов v2.");
  }
  return { kind: "novex-background-lab", version: 1, material, edgeFinish };
}

/** Raw material JSON from older exports remains an explicit import, with finish off. */
export function parseBackgroundDocumentImport(input: unknown, parseMaterial: RecipeParser<SandboxRecipe>): BackgroundLabDocumentV1 {
  return input && typeof input === "object" && "kind" in input && input.kind === "novex-background-lab"
    ? parseBackgroundDocument(input, parseMaterial)
    : createBackgroundDocument(parseMaterial(input));
}

function liftTrial(trial: SavedTrial<SandboxRecipe>): SavedTrial<BackgroundLabDocumentV1> {
  return { ...trial, recipe: createBackgroundDocument(trial.recipe) };
}

/** No writes on migration read: previous named trials stay available in Open. */
export function readV2LibraryAsV3(store: StoragePort, parseMaterial: RecipeParser<SandboxRecipe>): TrialLibraryV3<BackgroundLabDocumentV1> | null {
  const raw = store.getItem(V2_LIBRARY_KEY);
  if (raw === null) return null;
  const source = parseLibraryV2(raw, parseMaterial);
  return { ...source, version: 3, trials: source.trials.map(liftTrial) };
}

function liftFrame(frame: EditorFrame<SandboxRecipe>): EditorFrame<BackgroundLabDocumentV1> {
  return { ...frame, recipe: createBackgroundDocument(frame.recipe), baseline: createBackgroundDocument(frame.baseline) };
}
function liftSlot(slot: SandboxSlot<SandboxRecipe>): SandboxSlot<BackgroundLabDocumentV1> {
  return { present: liftFrame(slot.present), drafts: slot.drafts.map(liftFrame),
    past: slot.past.map(liftFrame), future: slot.future.map(liftFrame) };
}
export function liftV2Workspace(source: SandboxWorkspace<SandboxRecipe>): SandboxWorkspace<BackgroundLabDocumentV1> {
  return { ...source, slots: [liftSlot(source.slots[0]), liftSlot(source.slots[1]), liftSlot(source.slots[2])],
    pinned: source.pinned ? liftTrial(source.pinned) : null };
}
export function readV2WorkspaceAsV3(store: StoragePort, parseMaterial: RecipeParser<SandboxRecipe>): SandboxWorkspace<BackgroundLabDocumentV1> | null {
  const raw = store.getItem(V2_WORKSPACE_KEY);
  return raw === null ? null : liftV2Workspace(parseWorkspaceV2(raw, parseMaterial));
}
