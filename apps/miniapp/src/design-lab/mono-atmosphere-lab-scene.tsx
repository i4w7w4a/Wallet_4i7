"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import type { WalletSnapshot } from "@wallet/core";
import { MONO_GLASS_DEFAULTS, normalizeMonoPaletteConfig, BackgroundGpuSurface,
  backgroundMaterials, backgroundMaterialDescriptors, parseBackgroundRecipe,
  type BackgroundSandboxBindings } from "@wallet/ui";
import { MonoScene, type MonoScenePresentation } from "../mono-preview/mono-scene";
import { MonoBackgroundRecipes } from "../mono-preview/mono-background-recipes-view";
import { MONO_LOGO_PREVIEW_DEFAULTS } from "../mono-preview/mono-logo-preview";
import { createMonoShapeDefaults } from "../mono-preview/mono-shape-preview";
import { useMonoSceneActivity } from "../mono-preview/mono-scene-activity";
import { MonoAtmosphereLab, type MonoAtmosphereSceneInput } from "./mono-atmosphere-lab";
import styles from "./mono-atmosphere-lab-scene.module.css";

const BASE_PALETTE = normalizeMonoPaletteConfig();
const BASE_SHAPE = createMonoShapeDefaults().ledger;

function AtmosphereContext({ snapshot, config, theme, width }: MonoAtmosphereSceneInput & { snapshot: WalletSnapshot }) {
  const surfaceRef = useRef<HTMLElement>(null);
  const appearance = useMemo<MonoScenePresentation>(() => ({
    preset: "ledger", palette: { enabled: false, config: BASE_PALETTE },
    shape: BASE_SHAPE, optics: MONO_GLASS_DEFAULTS.ledger,
    environment: { theme, background: "iris" }, logo: MONO_LOGO_PREVIEW_DEFAULTS,
  }), [theme]);
  return <div className={`mono-preview-frame ${styles.frame}`} style={{ "--mono-preview-width": `${width}px` } as CSSProperties}>
    <MonoScene snapshot={snapshot} appearance={appearance} viewport={width as 320 | 390 | 430 | 480}
      paletteTransitionEnabled={false} active={!config.calm} surfaceRef={surfaceRef}
      atmosphere={<MonoBackgroundRecipes surfaceRef={surfaceRef} config={config} theme={theme} />} />
  </div>;
}

/** One canonical wallet renderer; this host supplies only trusted demo data and appearance. */
export function MonoAtmosphereLabWithScene({ snapshot }: { snapshot: WalletSnapshot }) {
  const hostActive = useMonoSceneActivity();
  const bindings = useMemo<BackgroundSandboxBindings>(() => ({
    materials: backgroundMaterialDescriptors,
    parseRecipe: parseBackgroundRecipe,
    fittingAvailable: false,
    fittingUnavailableReason: "GPU-примерка MONO ожидает проверки общего прохода с Promo. Самостоятельная сцена готова к работе.",
    renderStage(request) {
      const material = backgroundMaterials.find(item => item.descriptor.id === request.recipe.effectId);
      if (!material) return <p role="status">Материал не установлен.</p>;
      return <BackgroundGpuSurface material={material} recipe={request.recipe} paused={request.paused}
        restartKey={request.restartKey} hostActive={hostActive} onStatus={request.onStatus} />;
    },
  }), [hostActive]);
  return <MonoAtmosphereLab bindings={bindings} renderScene={input => <AtmosphereContext {...input} snapshot={snapshot} />} />;
}
