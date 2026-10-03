"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ChartPeriod } from "@wallet/core";
import { MaterialSceneSurface, createMonoOpticalHost, createMonoOpticalOverlay } from "@wallet/ui";
import type { MonoMaterialDirection } from "./mono-material-preset";
import { actionButtonRadii, visibleActionBindings } from "./mono-action-geometry";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { MonoScene, type MonoSceneProps, type MonoSection } from "./mono-scene";
import { createDefaultActionArtworkMap } from "./action-artwork/model";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "../mono-product/demo-adapter";
import { useMonoProductController } from "../mono-product/product-controller";
import styles from "./mono-product-scene.module.css";

const DEFAULT_ACTION_ARTWORK = createDefaultActionArtworkMap();

export function MonoProductScene({ material, productAdapter = MONO_PRODUCT_DEMO_ADAPTER, ...scene }:
  MonoSceneProps & { material: MonoMaterialDirection; productAdapter?: MonoProductAdapter }) {
  const product = useMonoProductController(productAdapter, {
    initialHidden: scene.snapshot.balance.hidden,
    hidden: scene.session?.balanceHidden,
    onHiddenChange: scene.session?.onBalanceHiddenChange,
  });
  const [localPeriod, setLocalPeriod] = useState<ChartPeriod>("1D");
  const [localSection, setLocalSection] = useState<MonoSection>("overview");
  const section = scene.session?.section ?? localSection;
  const sectionRef = useRef(section);
  const closeAsset = product.commands.closeAsset;
  const onSectionChange = scene.session?.onSectionChange ?? setLocalSection;
  const changeSection = useCallback((next: MonoSection) => {
    closeAsset(); onSectionChange(next);
  }, [closeAsset, onSectionChange]);
  useEffect(() => {
    if (sectionRef.current !== section) { sectionRef.current = section; closeAsset(); }
  }, [section, closeAsset]);
  const productScene: MonoSceneProps = { ...scene, product,
    session: { balanceHidden: product.view.balanceHidden, onBalanceHiddenChange: product.commands.setBalanceHidden,
      period: scene.session?.period ?? localPeriod, onPeriodChange: scene.session?.onPeriodChange ?? setLocalPeriod,
      section, onSectionChange: changeSection } };
  const actionFrameMode = material.buttons?.version === 2 || material.buttons?.version === 3
    ? material.buttons.frameMode : "group";
  const actionArtwork = material.buttons?.version === 3 ? material.buttons.artwork : DEFAULT_ACTION_ARTWORK;
  const actionRadii = actionButtonRadii(material.buttons?.bindings ?? []);
  const bindings = visibleActionBindings(actionFrameMode, material.buttons?.bindings ?? [], actionArtwork);
  if (!material.background && !bindings.length) return <MonoScene {...productScene} actionFrameMode={actionFrameMode}
    actionRadii={actionRadii} actionArtwork={actionArtwork} />;
  // Keep the material host mounted, but release passes for DOM targets absent from the subview.
  return <ActiveMaterialScene material={material}
    bindings={section === "overview" && !product.view.assetWorkspace ? bindings : []}
    scene={{ ...productScene, actionFrameMode, actionRadii, actionArtwork }} />;
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
      edgeFinish={material.background?.edgeFinish}
      viewportResponse={material.background?.version === 2 ? material.background.viewportResponse : undefined}
      bindings={bindings} quality="balanced"
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
