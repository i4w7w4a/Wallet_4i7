import { Fragment } from "react";
import type { BackgroundSandboxBindings } from "@wallet/ui";
import { MONO_BACKGROUND_CONTROLS } from "../../mono-preview/mono-background-recipes";
import { isGpuRecipe, type SandboxRecipe } from "./recipes";
import styles from "../mono-atmosphere-lab.module.css";

export function RecipeSummary({ recipe, bindings }: { recipe: SandboxRecipe; bindings?: BackgroundSandboxBindings }) {
  const rows = isGpuRecipe(recipe)
    ? bindings?.materials.find(item => item.id === recipe.effectId)?.readControls(recipe).map(({ control, value }) => ({
      key: control.key, label: control.label,
      value: control.kind === "select" ? control.options.find(option => option.value === value)?.label ?? String(value)
        : typeof value === "boolean" ? value ? "Да" : "Нет" : `${value}${control.kind === "range" && control.unit ? ` ${control.unit}` : ""}`,
    })) ?? []
    : [...MONO_BACKGROUND_CONTROLS.map(control => ({ key: control.key, label: control.label, value: `${Math.round(recipe[control.key] * 100)}%` })),
      { key: "calm", label: "Покой", value: recipe.calm ? "Да" : "Нет" }];
  return <dl className={styles.diagnostics}>{rows.map(row => <Fragment key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></Fragment>)}</dl>;
}
