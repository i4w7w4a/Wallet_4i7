import { materialCatalogV2, parseTargetBindings, type ButtonTargetId,
  type MaterialTargetBinding } from "@wallet/ui";
import original from "./first-iridescence.v1.json";
import { createMonoWorkingDocument, type MonoWorkingDocument } from "./mono-working-presets";
import type { MonoLogoPreview } from "./mono-logo-preview";

// Owner export, 2026-09-26. Original UTF-8 SHA-256: f64e54194a9c7dd5ea300680af9fce5495ddbff50e953a28ffe2c164ea4ee126.
export const FIRST_BUTTON_PRESET_NAME = "Первый · перелив";
const TARGETS: readonly ButtonTargetId[] = ["quick.send", "quick.receive", "quick.swap", "quick.buy"];
type FirstButtonDocument = { version: 1; actions: Record<ButtonTargetId, {
  fill: null; icon: null; border: MaterialTargetBinding;
}> };

/** The bundled data is an exact copy of the owner's V1 export. Callers receive independent copies. */
export function createFirstButtonDocument(): FirstButtonDocument {
  return structuredClone(original) as FirstButtonDocument;
}

export function firstButtonBindings(): readonly MaterialTargetBinding[] {
  const document = createFirstButtonDocument();
  const bindings = TARGETS.map(target => document.actions[target].border);
  const parsed = parseTargetBindings(bindings, materialCatalogV2);
  if (!parsed.ok) throw new Error("Встроенная проба кнопок повреждена.");
  return parsed.value;
}

export function createFirstMonoWorkingDocument(legacyLogo?: MonoLogoPreview): MonoWorkingDocument {
  const document = createMonoWorkingDocument(legacyLogo);
  document.materials.ledger = { ...document.materials.ledger,
    buttons: { version: 1, bindings: firstButtonBindings() } };
  return document;
}
