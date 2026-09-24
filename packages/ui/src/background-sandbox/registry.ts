import type { BackgroundRecipe, ParseResult } from "./contracts";
import { bindMaterial, type MaterialBinding } from "./material-binding";
import { silkDefinition } from "./effects/silk/definition";
import type { SilkParams } from "./effects/silk/schema";
import { fluidDefinition, type FluidParams } from "./effects/fluid";

/** This union grows only when the real adapter and its schema have been integrated. */
export type RegisteredBackgroundRecipe = BackgroundRecipe<"silk", SilkParams> | BackgroundRecipe<"fluid", FluidParams>;
export const backgroundMaterials: readonly MaterialBinding[] = [bindMaterial(silkDefinition), bindMaterial(fluidDefinition)];
export const backgroundMaterialDescriptors = backgroundMaterials.map(material => material.descriptor);

export function parseBackgroundRecipe(input: unknown): ParseResult<BackgroundRecipe> {
  const id = typeof input === "object" && input !== null && "effectId" in input ? input.effectId : null;
  const material = backgroundMaterials.find(item => item.descriptor.id === id);
  return material ? material.descriptor.parseRecipe(input)
    : { ok: false, issues: [{ code: "unknown-effect", message: "Материал не установлен. Проба не изменена." }] };
}
