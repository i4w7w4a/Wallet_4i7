import type { MonoPaletteWorkspace } from "./mono-palette-workspace";
import { monoPaletteChannels } from "./mono-palette-tokens";

// Derived paint cache only. The workspace remains the source of truth after hydration.
export const MONO_PALETTE_PREPAINT_KEY = "wallet4i7.mono.palette-prepaint.v1";

export function saveMonoPalettePrepaint(storage: Pick<Storage, "setItem">, workspace: MonoPaletteWorkspace): void {
  const slot = workspace.slots[workspace.activeSlotId - 1];
  const shown = slot.present;
  const tokens = shown.paletteEnabled ? monoPaletteChannels(shown.config.themes[shown.mode]) : {};
  storage.setItem(MONO_PALETTE_PREPAINT_KEY, JSON.stringify({
    version: 1,
    mode: shown.mode,
    slotId: workspace.activeSlotId,
    paletteEnabled: Boolean(shown.paletteEnabled),
    tokens,
  }));
}
