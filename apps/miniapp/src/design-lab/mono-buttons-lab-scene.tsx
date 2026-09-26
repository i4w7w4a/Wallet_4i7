"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { ChartPeriod, WalletSnapshot } from "@wallet/core";
import { MONO_GLASS_DEFAULTS, MaterialSceneSurface, createMonoOpticalHost,
  createMonoOpticalOverlay, materialCatalogV2, normalizeMonoPaletteConfig,
  type ButtonStageRequest, type ButtonWorkshopBindings } from "@wallet/ui";
import { MonoScene, type MonoScenePresentation, type MonoSceneProps, type MonoSection } from "../mono-preview/mono-scene";
import { actionButtonRadii } from "../mono-preview/mono-action-geometry";
import { MONO_LOGO_PREVIEW_DEFAULTS } from "../mono-preview/mono-logo-preview";
import { createMonoShapeDefaults } from "../mono-preview/mono-shape-preview";
import { MONO_SCENE_DEFAULT } from "../mono-preview/mono-scene-lab-contract";
import { useMonoSceneActivity } from "../mono-preview/mono-scene-activity";
import { MonoButtonsLab } from "./mono-buttons-lab";
import styles from "./mono-buttons-lab-scene.module.css";

const APPEARANCE: MonoScenePresentation = {
  ...MONO_SCENE_DEFAULT, preset: "ledger",
  palette: { enabled: false, config: normalizeMonoPaletteConfig() },
  shape: createMonoShapeDefaults().ledger,
  optics: MONO_GLASS_DEFAULTS.ledger,
  environment: { theme: "dark", background: "iris" },
  logo: MONO_LOGO_PREVIEW_DEFAULTS,
};

function ButtonStage({ request, snapshot, hostActive, session }: {
  request: ButtonStageRequest; snapshot: WalletSnapshot; hostActive: boolean; session: NonNullable<MonoSceneProps["session"]>;
}) {
  const opticalHost = useMemo(() => createMonoOpticalHost(), []);
  const overlay = useMemo(() => createMonoOpticalOverlay(opticalHost), [opticalHost]);
  const background = request.previewBackground?.kind === "novex-material" ? request.previewBackground : null;
  return <MaterialSceneSurface background={background} bindings={request.bindings} quality={request.quality}
    paused={request.paused} restartKey={request.restartKey} hostActive={hostActive} overlay={overlay}
    onStatus={status => request.onStatus?.(request.previewBackground?.kind === "novex-background"
      ? { ...status, message: `${status.message} · Проба фона v1 сохранена отдельно; совместная сцена пока показывает только материалы кнопок.` }
      : status)}>
    <div className={`mono-preview-frame ${styles.frame}`} style={{ "--mono-preview-width": `${request.width}px` } as CSSProperties}>
      <MonoScene snapshot={snapshot} appearance={APPEARANCE} viewport={request.width}
        active={hostActive && !request.paused} atmosphere={null} opticalHost={opticalHost.binding}
        materialTargets actionFrameMode={request.frameMode} actionRadii={actionButtonRadii(request.bindings)} session={session} />
    </div>
  </MaterialSceneSurface>;
}

export function MonoButtonsLabWithScene({ snapshot }: { snapshot: WalletSnapshot }) {
  const hostActive = useMonoSceneActivity();
  const [section, setSection] = useState<MonoSection>("overview");
  const [balanceHidden, setBalanceHidden] = useState(snapshot.balance.hidden);
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const session = useMemo(() => ({ section, onSectionChange: setSection,
    balanceHidden, onBalanceHiddenChange: setBalanceHidden, period, onPeriodChange: setPeriod }),
    [section, balanceHidden, period]);
  const bindings = useMemo<ButtonWorkshopBindings>(() => ({
    materialCatalog: materialCatalogV2,
    renderStage(request) { return <ButtonStage request={request} snapshot={snapshot} hostActive={hostActive} session={session} />; },
  }), [hostActive, snapshot, session]);
  return <MonoButtonsLab bindings={bindings} onShowActions={() => setSection("overview")} />;
}
