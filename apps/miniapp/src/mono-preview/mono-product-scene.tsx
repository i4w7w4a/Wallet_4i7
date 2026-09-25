"use client";

import { useMemo, type CSSProperties } from "react";
import { MaterialSceneSurface, createMonoOpticalHost, createMonoOpticalOverlay } from "@wallet/ui";
import type { MonoMaterialDirection } from "./mono-material-preset";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { MonoScene, type MonoSceneProps } from "./mono-scene";
import styles from "./mono-product-scene.module.css";

export function MonoProductScene({ material, ...scene }: MonoSceneProps & { material: MonoMaterialDirection }) {
  if (!material.background && !material.buttons?.bindings.length) return <MonoScene {...scene} />;
  return <ActiveMaterialScene material={material} scene={scene} />;
}

function ActiveMaterialScene({ material, scene }: { material: MonoMaterialDirection; scene: MonoSceneProps }) {
  const opticalHost = useMemo(() => createMonoOpticalHost(), []);
  const overlay = useMemo(() => createMonoOpticalOverlay(opticalHost), [opticalHost]);
  const { appearance } = scene;
  const hasBackgroundMaterial = Boolean(material.background);
  const theme = appearance.environment.theme;
  const fallback = theme === "light"
    ? appearance.environment.background === "tide" ? "#e5e9e8" : appearance.environment.background === "strata" ? "#e9e4d9" : "#e9e5dd"
    : appearance.preset === "frost" ? "#0a0a0a" : appearance.preset === "mercury" ? "#000000" : "#050505";
  const palette = appearance.palette.enabled ? monoPaletteStyle(appearance.palette.config.themes[theme]) : {};
  const style = { ...palette, "--mono-product-canvas": fallback } as CSSProperties;
  const bindings = material.buttons?.bindings ?? [];
  return <div className={styles.stage} style={style} data-mono-product-material
    data-mono-effect-background={hasBackgroundMaterial}
    data-mono-theme={theme} data-mono-background={appearance.environment.background}>
    <MaterialSceneSurface background={material.background?.recipe ?? null}
      edgeFinish={material.background?.edgeFinish} bindings={bindings} quality="balanced"
      paused={false} restartKey={0} hostActive={scene.active ?? true} overlay={overlay}
      canvasAboveContent={!hasBackgroundMaterial}
      emptyBackgroundColor="transparent">
      <div className={styles.content}>
        <MonoScene {...scene} atmosphere={material.background ? null : scene.atmosphere}
          opticalHost={opticalHost.binding} materialTargets={bindings.length > 0} />
      </div>
    </MaterialSceneSurface>
  </div>;
}
