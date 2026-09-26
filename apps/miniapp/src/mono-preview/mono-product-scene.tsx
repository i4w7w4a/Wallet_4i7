"use client";

import { useMemo, type CSSProperties } from "react";
import { MaterialSceneSurface, createMonoOpticalHost, createMonoOpticalOverlay } from "@wallet/ui";
import type { MonoMaterialDirection } from "./mono-material-preset";
import { actionButtonRadii, visibleActionBindings } from "./mono-action-geometry";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { MonoScene, type MonoSceneProps } from "./mono-scene";
import styles from "./mono-product-scene.module.css";

export function MonoProductScene({ material, ...scene }: MonoSceneProps & { material: MonoMaterialDirection }) {
  const actionFrameMode = material.buttons?.version === 2 ? material.buttons.frameMode : "group";
  const actionRadii = actionButtonRadii(material.buttons?.bindings ?? []);
  const bindings = visibleActionBindings(actionFrameMode, material.buttons?.bindings ?? []);
  if (!material.background && !bindings.length) return <MonoScene {...scene} actionFrameMode={actionFrameMode} actionRadii={actionRadii} />;
  return <ActiveMaterialScene material={material} bindings={bindings} scene={{ ...scene, actionFrameMode, actionRadii }} />;
}

function ActiveMaterialScene({ material, bindings, scene }: { material: MonoMaterialDirection;
  bindings: ReturnType<typeof visibleActionBindings>; scene: MonoSceneProps }) {
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
