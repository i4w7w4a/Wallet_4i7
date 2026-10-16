"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ChartPeriod } from "@wallet/core";
import { MaterialSceneSurface, createMonoOpticalHost, createMonoOpticalOverlay } from "@wallet/ui";
import type { MonoMaterialDirection } from "./mono-material-preset";
import { actionButtonRadii, visibleActionBindings } from "./mono-action-geometry";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { MonoScene, matchesProfileInspectionOrigin, type MonoSceneProps, type MonoSection,
  type MonoSectionChangeIntent, type MonoProfileInspectionOrigin } from "./mono-scene";
import { createDefaultActionArtworkMap } from "./action-artwork/model";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "../mono-product/demo-adapter";
import { useMonoProductController } from "../mono-product/product-controller";
import { useViewerTheme } from "../mono-product/profile/use-viewer-theme";
import styles from "./mono-product-scene.module.css";

const DEFAULT_ACTION_ARTWORK = createDefaultActionArtworkMap();

export function MonoProductScene({ material, productAdapter = MONO_PRODUCT_DEMO_ADAPTER, themePreference = "restore", ...scene }:
  MonoSceneProps & { material: MonoMaterialDirection; productAdapter?: MonoProductAdapter;
    /** Fixed presentations skip only theme preference, preserving ordinary visitor state/pins. */
    themePreference?: "restore" | "fixed" }) {
  // A supplied session is editor/host-owned; only standalone visitors restore a preference.
  const visitorTheme = useViewerTheme(scene.appearance.environment.theme,
    scene.session === undefined && themePreference === "restore");
  const appearance = visitorTheme.theme === scene.appearance.environment.theme ? scene.appearance : {
    ...scene.appearance, environment: { ...scene.appearance.environment, theme: visitorTheme.theme },
  };
  const product = useMonoProductController(productAdapter, {
    initialHidden: scene.snapshot.balance.hidden,
    hidden: scene.session?.balanceHidden,
    onHiddenChange: scene.session?.onBalanceHiddenChange,
  }, { viewerPreferencesEnabled: scene.session === undefined });
  const [localPeriod, setLocalPeriod] = useState<ChartPeriod>("1D");
  const [localSection, setLocalSection] = useState<MonoSection>("overview");
  const section = scene.session?.section ?? localSection;
  const sectionRef = useRef(section);
  const workspaceTransition = useRef<
    { kind: "account-history"; from: MonoSection; to: MonoSection;
      workspace: NonNullable<typeof product.view.accountsWorkspace> } |
    { kind: "profile-inspection"; from: MonoSection; to: MonoSection; origin: MonoProfileInspectionOrigin } | null>(null);
  const closeAsset = product.commands.closeAsset;
  const closeAccountsWorkspace = product.commands.closeAccountsWorkspace;
  const requestContextChange = product.commands.requestContextChange;
  const onSectionChange = scene.session?.onSectionChange ?? setLocalSection;
  const changeSection = useCallback((next: MonoSection, intent?: MonoSectionChangeIntent) => {
    if (scene.active === false || !requestContextChange()) return;
    const workspace = product.view.accountsWorkspace;
    const preserveAccount = intent?.kind === "account-history" && workspace && workspace.accountId !== null &&
      intent.workspace === workspace && (next === "history" || section === "history");
    const preserveProfile = intent?.kind === "profile-inspection" && intent.origin.owner === onSectionChange &&
      ((next === "profile" && section === intent.origin.section) || (section === "profile" && next === intent.origin.section)) &&
      matchesProfileInspectionOrigin(intent.origin, product.view);
    workspaceTransition.current = preserveProfile ? { kind: "profile-inspection", from: section, to: next, origin: intent.origin }
      : preserveAccount ? { kind: "account-history", from: section, to: next, workspace } : null;
    if (!preserveProfile && !preserveAccount) closeAccountsWorkspace();
    if (!preserveProfile) closeAsset();
    onSectionChange(next);
  }, [closeAccountsWorkspace, closeAsset, onSectionChange, requestContextChange, product.view, section, scene.active]);
  useEffect(() => {
    // Consume once per host commit; later external section changes still close the workspace.
    const transition = workspaceTransition.current;
    workspaceTransition.current = null;
    if (sectionRef.current === section) return;
    const previous = sectionRef.current;
    sectionRef.current = section;
    const sameEndpoints = transition?.from === previous && transition.to === section;
    if (sameEndpoints && transition.kind === "profile-inspection" && scene.active !== false &&
      transition.origin.owner === onSectionChange && matchesProfileInspectionOrigin(transition.origin, product.view)) return;
    if (!sameEndpoints || transition.kind !== "account-history" ||
      transition.workspace !== product.view.accountsWorkspace) closeAccountsWorkspace();
    closeAsset();
  });
  const productScene: MonoSceneProps = { ...scene, appearance, product, sectionOwner: onSectionChange,
    session: { balanceHidden: product.view.balanceHidden, onBalanceHiddenChange: product.commands.setBalanceHidden,
      period: scene.session?.period ?? localPeriod, onPeriodChange: scene.session?.onPeriodChange ?? setLocalPeriod,
      section, onSectionChange: scene.session?.section !== undefined && !scene.session.onSectionChange ? undefined : changeSection,
      onThemeChange: themePreference === "fixed" ? undefined
        : scene.session ? scene.session.onThemeChange : visitorTheme.onThemeChange } };
  const actionFrameMode = material.buttons?.version === 2 || material.buttons?.version === 3
    ? material.buttons.frameMode : "group";
  const actionArtwork = material.buttons?.version === 3 ? material.buttons.artwork : DEFAULT_ACTION_ARTWORK;
  const actionRadii = actionButtonRadii(material.buttons?.bindings ?? []);
  const bindings = visibleActionBindings(actionFrameMode, material.buttons?.bindings ?? [], actionArtwork);
  if (!material.background && !bindings.length) return <MonoScene {...productScene} actionFrameMode={actionFrameMode}
    actionRadii={actionRadii} actionArtwork={actionArtwork} />;
  // Keep the material host mounted, but release passes for DOM targets absent from the subview.
  return <ActiveMaterialScene material={material}
    bindings={section === "overview" && !product.view.assetWorkspace && !product.view.accountsWorkspace ? bindings : []}
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
