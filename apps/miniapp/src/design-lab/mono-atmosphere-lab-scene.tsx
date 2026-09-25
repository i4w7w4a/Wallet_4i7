"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import type { WalletSnapshot } from "@wallet/core";
import { MONO_GLASS_DEFAULTS, normalizeMonoPaletteConfig, BackgroundGpuSurface, MaterialSceneSurface,
  backgroundMaterials, backgroundMaterialDescriptors, parseBackgroundRecipe,
  materialCatalogV2,
  createMonoOpticalHost, createMonoOpticalOverlay,
  type BackgroundSandboxBindings, type BackgroundStageRequest, type MaterialStageRequestV2 } from "@wallet/ui";
import { MonoScene, type MonoScenePresentation } from "../mono-preview/mono-scene";
import { MonoBackgroundRecipes } from "../mono-preview/mono-background-recipes-view";
import { MONO_LOGO_PREVIEW_DEFAULTS } from "../mono-preview/mono-logo-preview";
import { createMonoShapeDefaults } from "../mono-preview/mono-shape-preview";
import { useMonoSceneActivity } from "../mono-preview/mono-scene-activity";
import { MONO_SCENE_DEFAULT } from "../mono-preview/mono-scene-lab-contract";
import { MonoAtmosphereLab, type MonoAtmosphereSceneInput } from "./mono-atmosphere-lab";
import styles from "./mono-atmosphere-lab-scene.module.css";

const BASE_PALETTE = normalizeMonoPaletteConfig();
const BASE_SHAPE = createMonoShapeDefaults().ledger;
const GPU_APPEARANCE: MonoScenePresentation = {
  ...MONO_SCENE_DEFAULT, preset: "ledger", palette: { enabled: false, config: BASE_PALETTE },
  shape: BASE_SHAPE, optics: MONO_GLASS_DEFAULTS.ledger,
  environment: { theme: "dark", background: "iris" }, logo: MONO_LOGO_PREVIEW_DEFAULTS,
};

function GpuStage({ request, snapshot, hostActive }: {
  request: BackgroundStageRequest; snapshot: WalletSnapshot; hostActive: boolean;
}) {
  const opticalHost = useMemo(() => createMonoOpticalHost(), []);
  const overlay = useMemo(() => createMonoOpticalOverlay(opticalHost), [opticalHost]);
  const material = backgroundMaterials.find(item => item.descriptor.id === request.recipe.effectId);
  if (!material) return <p role="status">Материал не установлен.</p>;
  const width = request.presentation.mode === "mono" ? request.presentation.width : null;
  return <BackgroundGpuSurface material={material} recipe={request.recipe} paused={request.paused}
    restartKey={request.restartKey} hostActive={hostActive} overlay={width ? overlay : undefined}
    onStatus={status => request.onStatus?.({ ...status, message: width
      ? `${status.message} · Техническая примерка: контраст MONO ещё не согласован.` : status.message })}>
    {width && <div className={`mono-preview-frame ${styles.frame} ${styles.gpuFrame}`}
      style={{ "--mono-preview-width": `${width}px` } as CSSProperties}>
      <MonoScene snapshot={snapshot} appearance={GPU_APPEARANCE} viewport={width}
        active={hostActive && !request.paused} atmosphere={null} opticalHost={opticalHost.binding} />
    </div>}
  </BackgroundGpuSurface>;
}

function MaterialGpuStage({ request, snapshot, hostActive }: {
  request: MaterialStageRequestV2; snapshot: WalletSnapshot; hostActive: boolean;
}) {
  const opticalHost = useMemo(() => createMonoOpticalHost(), []);
  const overlay = useMemo(() => createMonoOpticalOverlay(opticalHost), [opticalHost]);
  if (request.recipe.kind !== "novex-material") return <p role="status">Материал v2 не установлен.</p>;
  const width = request.presentation.mode === "mono" ? request.presentation.width : null;
  return <MaterialSceneSurface background={request.recipe} edgeFinish={request.edgeFinish}
    quality={request.quality} paused={request.paused}
    restartKey={request.restartKey} hostActive={hostActive} overlay={width ? overlay : undefined}
    transientAction={request.transientAction}
    onStatus={status => request.onStatus?.({ ...status, message: width
      ? `${status.message} · Техническая примерка: контраст MONO ещё не согласован.` : status.message })}>
    {width && <div className={`mono-preview-frame ${styles.frame} ${styles.gpuFrame}`}
      style={{ "--mono-preview-width": `${width}px` } as CSSProperties}>
      <MonoScene snapshot={snapshot} appearance={GPU_APPEARANCE} viewport={width}
        active={hostActive && !request.paused} atmosphere={null} opticalHost={opticalHost.binding} />
    </div>}
  </MaterialSceneSurface>;
}

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
    materialCatalogV2,
    renderMaterialStageV2(request) {
      return <MaterialGpuStage request={request} snapshot={snapshot} hostActive={hostActive} />;
    },
    fittingAvailable: true,
    renderStage(request) {
      return <GpuStage request={request} snapshot={snapshot} hostActive={hostActive} />;
    },
  }), [hostActive, snapshot]);
  return <MonoAtmosphereLab bindings={bindings} renderScene={input => <AtmosphereContext {...input} snapshot={snapshot} />} />;
}
