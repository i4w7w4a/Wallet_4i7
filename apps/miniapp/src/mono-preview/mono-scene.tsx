"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent,
  type ReactNode, type RefObject } from "react";
import type { ChartPeriod, WalletSnapshot } from "@wallet/core";
import { MonoOpticalGlass, type MonoGlassSettings, type MonoPaletteConfigV1, type MonoSharedOpticalHost } from "@wallet/ui";
import { MonoLogo } from "./mono-logo";
import { resolveMonoLogoColors, type MonoLogoPreview } from "./mono-logo-preview";
import { monoPaletteStyle } from "./mono-palette-tokens";
import type { MonoShapePreset, MonoShapeSettings } from "./mono-shape-preview";
import { MONO_QUICK_ACTION_DEFAULT, MonoQuickActionFeedback } from "./mono-quick-action-feedback";
import { stepTideMotion, type TideMotionState } from "./mono-tide-motion";
import { MonoBalance } from "./mono-balance";
import { MonoChart } from "./mono-chart";
import { MonoAssetList } from "./mono-asset-list";
import type { MonoSceneAppearance } from "./mono-scene-lab-contract";
import { MonoBackgroundRecipes } from "./mono-background-recipes-view";
import type { MonoBackgroundRecipeConfig } from "./mono-background-recipes";
import { monoTypographyStyle, type MonoTypographyConfigV1 } from "./mono-typography";
import { useMonoTypographyPreview } from "./mono-typography-preview";

import "./mono-fonts.css";
import "./mono-font-candidates.css";
import "./mono-preview.css";
import "./mono-atmosphere.css";
import "./mono-motion.css";
import "./mono-interactions.css";
import "./mono-environment.css";
import "./mono-theme.css";
import "./mono-scene-layout.css";
import "./mono-typography-scene.css";

/** Normalized presentation only. Storage envelopes and editor history stay at the host. */
export type MonoScenePresentation = {
  preset: MonoShapePreset;
  palette: { enabled: boolean; config: MonoPaletteConfigV1 };
  shape: MonoShapeSettings;
  optics: MonoGlassSettings;
  environment: { theme: "dark" | "light"; background: "iris" | "tide" | "strata" };
  logo: MonoLogoPreview;
  typography?: MonoTypographyConfigV1 | null;
  background?: MonoBackgroundRecipeConfig | null;
} & Partial<MonoSceneAppearance>;

export type MonoSceneProps = {
  snapshot: WalletSnapshot;
  appearance: Readonly<MonoScenePresentation>;
  viewport?: 320 | 390 | 430 | 480;
  /** Initial host document restore; the scene never reads editor storage itself. */
  ready?: boolean;
  paletteReady?: boolean;
  paletteTransitionEnabled?: boolean;
  quickActionPreset?: ComponentProps<typeof MonoQuickActionFeedback>["preset"];
  active?: boolean;
  /** Host-owned adapter replaces the legacy ambient layer and its pointer reactions. */
  atmosphere?: ReactNode;
  surfaceRef?: RefObject<HTMLElement | null>;
  /** Optional lab composition; absence preserves the standard private optical runtime. */
  opticalHost?: MonoSharedOpticalHost;
};

const FIELD_NODES = [
  [19, 26], [47, 21], [76, 30],
  [28, 46], [62, 51], [87, 58],
  [13, 71], [43, 76], [71, 83],
] as const;

const ACTIONS = [
  { label: "Отправить", path: "M5 18 19 4M8 4h11v11" },
  { label: "Получить", path: "M19 6 5 20M16 20H5V9" },
  { label: "Обмен", path: "M4 8h16m0 0-4-4m4 4-4 4M20 16H4m0 0 4-4m-4 4 4 4" },
  { label: "Купить", path: "M12 4v16M4 12h16" },
] as const;

const NAV_ITEMS = [
  { label: "Обзор", path: "m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7" },
  { label: "Активы", path: "M4 18h16M5 14l5-5 4 3 5-7" },
  { label: "История", path: "M4 12a8 8 0 1 0 3-6M4 4v5h5m3-2v5l3 2" },
  { label: "Профиль", path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
] as const;

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const assetFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function MonoScene(props: MonoSceneProps) {
  const ready = props.ready ?? true;
  const typography = useMonoTypographyPreview(ready ? props.appearance.typography ?? null : null);
  const [hasPresented, setHasPresented] = useState(false);
  const canPresent = ready && (hasPresented || typography.status !== "loading");
  if (canPresent && !hasPresented) setHasPresented(true);
  if (!canPresent) return <div className="mono-scene-loading" role="status"
    data-mono-theme={ready ? props.appearance.environment.theme : undefined}>Загрузка оформления…</div>;
  return <MonoSceneContent {...props} typography={typography} />;
}

function MonoSceneContent({ snapshot, appearance, viewport = 480, paletteReady = true,
  paletteTransitionEnabled = false, quickActionPreset = MONO_QUICK_ACTION_DEFAULT, active = true,
  atmosphere, surfaceRef, typography, opticalHost,
}: MonoSceneProps & { typography: ReturnType<typeof useMonoTypographyPreview> }) {
  const customAtmosphere = atmosphere !== undefined || Boolean(appearance.background);
  const { preset, palette, shape, optics, logo: logoPreview } = appearance;
  const fullScene = Boolean(appearance.balance && appearance.chart && appearance.layout && appearance.assets);
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const moneyFormat = { locale: "ru-RU", currency: snapshot.balance.currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const { theme, background } = appearance.environment;
  const paletteStyle = useMemo(() => palette.enabled
    ? monoPaletteStyle(palette.config.themes[theme]) : {}, [palette.enabled, palette.config, theme]);
  const logoColors = useMemo(() => resolveMonoLogoColors(logoPreview.hue), [logoPreview.hue]);
  const [balanceHidden, setBalanceHidden] = useState(snapshot.balance.hidden);
  const [quickActionStatus, setQuickActionStatus] = useState("Демо · операции недоступны");
  const pageRef = useRef<HTMLElement>(null);
  const paletteCrossfadeRef = useRef<HTMLDivElement>(null);
  const previousPaletteBackgroundRef = useRef<string | null>(null);
  const paletteAnimationRef = useRef<Animation | null>(null);
  const rippleRootRef = useRef<HTMLDivElement>(null);
  const tideMotionRef = useRef<TideMotionState | null>(null);
  const balance = currencyFormatter.format(snapshot.balance.amount);
  const change = `${snapshot.balance.change24h >= 0 ? "+" : ""}${currencyFormatter.format(snapshot.balance.change24h)}%`;
  const values = snapshot.chart["1D"];
  const low = Math.min(...values);
  const span = Math.max(1, Math.max(...values) - low);
  const chartPoints = values
    .map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${74 - ((value - low) / span) * 54}`)
    .join(" ");

  const stopAtmosphere = useCallback((clearRipples: boolean) => {
    const host = pageRef.current;
    if (!host) return;
    host.dataset.pointerActive = "false";
    for (const property of [
      "--mono-pointer-x", "--mono-pointer-y", "--mono-pointer-shift-x", "--mono-pointer-shift-y",
      "--mono-pointer-tilt-x", "--mono-pointer-tilt-y",
    ]) host.style.removeProperty(property);
    host.querySelectorAll<HTMLElement>(".mono-atmosphere__node")
      .forEach((node) => { node.style.transform = "translate3d(0px, 0px, 0)"; });
    tideMotionRef.current = null;
    if (clearRipples) rippleRootRef.current?.replaceChildren();
  }, []);

  useLayoutEffect(() => {
    const host = pageRef.current;
    const layer = paletteCrossfadeRef.current;
    if (!host || !layer) return;
    const next = getComputedStyle(host).background;
    const previous = previousPaletteBackgroundRef.current;
    previousPaletteBackgroundRef.current = next;
    paletteAnimationRef.current?.cancel();
    paletteAnimationRef.current = null;
    layer.style.opacity = "0";
    if (!previous || previous === next || !paletteReady || !palette.enabled ||
        !paletteTransitionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      layer.style.background = "";
      return;
    }
    layer.style.background = previous;
    const animation = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 380, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards",
    });
    paletteAnimationRef.current = animation;
    animation.onfinish = () => {
      if (paletteAnimationRef.current !== animation) return;
      paletteAnimationRef.current = null;
      layer.style.background = "";
      layer.style.opacity = "0";
      animation.cancel();
    };
  }, [paletteStyle, paletteReady, palette.enabled, paletteTransitionEnabled, theme, background, preset]);

  useEffect(() => () => paletteAnimationRef.current?.cancel(), []);

  useEffect(() => {
    if (customAtmosphere || !active) {
      stopAtmosphere(true);
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onCapabilityChange = () => {
      if (reducedMotion.matches || !finePointer.matches) stopAtmosphere(true);
    };
    reducedMotion.addEventListener("change", onCapabilityChange);
    finePointer.addEventListener("change", onCapabilityChange);
    onCapabilityChange();
    return () => {
      reducedMotion.removeEventListener("change", onCapabilityChange);
      finePointer.removeEventListener("change", onCapabilityChange);
    };
  }, [stopAtmosphere, customAtmosphere, active]);

  useEffect(() => {
    if (background !== "tide") {
      rippleRootRef.current?.replaceChildren();
      tideMotionRef.current = null;
    }
    if (background !== "strata") {
      pageRef.current?.querySelectorAll<HTMLElement>(".mono-atmosphere__node")
        .forEach((node) => { node.style.transform = "translate3d(0px, 0px, 0)"; });
    }
  }, [background]);

  function rippleAt(x: number, y: number, angle: number, energy: number) {
    const host = rippleRootRef.current;
    if (!host) return;
    const pulse = document.createElement("span");
    pulse.dataset.monoRipple = "";
    pulse.className = "mono-atmosphere__ripple";
    pulse.style.setProperty("--mono-ripple-x", `${x}px`);
    pulse.style.setProperty("--mono-ripple-y", `${y}px`);
    pulse.style.setProperty("--mono-ripple-angle", `${angle}rad`);
    pulse.style.setProperty("--mono-ripple-width", `${Math.round(116 + 68 * energy)}px`);
    pulse.style.setProperty("--mono-ripple-height", `${Math.round(78 + 44 * energy)}px`);
    pulse.style.setProperty("--mono-ripple-opacity", (0.12 + 0.3 * energy).toFixed(3));
    pulse.style.setProperty("--mono-ripple-tail-opacity", (0.04 + 0.09 * energy).toFixed(3));
    pulse.style.setProperty("--mono-ripple-scale", (1.15 + 0.42 * energy).toFixed(3));
    pulse.style.setProperty("--mono-ripple-duration", `${Math.round(1450 - 260 * energy)}ms`);
    const remove = () => pulse.remove();
    pulse.addEventListener("animationend", remove, { once: true });
    pulse.addEventListener("animationcancel", remove, { once: true });
    while (host.childElementCount >= 6) host.firstElementChild?.remove();
    host.appendChild(pulse);
  }

  function repelNodes(x: number, y: number, width: number, height: number) {
    const nodes = pageRef.current?.querySelectorAll<HTMLElement>(".mono-atmosphere__node");
    nodes?.forEach((node, index) => {
      const [px, py] = FIELD_NODES[index];
      const dx = x - (px / 100) * width;
      const dy = y - (py / 100) * height;
      const distance = Math.hypot(dx, dy);
      const force = Math.max(0, 1 - distance / 138) ** 2;
      const xUnit = distance > 0.5 ? -dx / distance : 0;
      const yUnit = distance > 0.5 ? -dy / distance : -1;
      node.style.transform = `translate3d(${(xUnit * force * 19).toFixed(2)}px, ${(yUnit * force * 19).toFixed(2)}px, 0)`;
    });
  }

  function moveAtmosphere(event: ReactPointerEvent<HTMLElement>) {
    const view = event.currentTarget.ownerDocument.defaultView;
    if (
      !view || event.pointerType === "touch" ||
      view.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !view.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) return;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.round(Math.min(rect.width, Math.max(0, event.clientX - rect.left)));
    const y = Math.round(Math.min(view.innerHeight, Math.max(0, event.clientY)));
    const normalizedX = (x / rect.width - 0.5) * 2;
    const normalizedY = (y / Math.max(1, view.innerHeight) - 0.5) * 2;
    const style = event.currentTarget.style;
    style.setProperty("--mono-pointer-x", `${x}px`);
    style.setProperty("--mono-pointer-y", `${y}px`);
    style.setProperty("--mono-pointer-shift-x", `${(normalizedX * 11).toFixed(2)}px`);
    style.setProperty("--mono-pointer-shift-y", `${(normalizedY * 7).toFixed(2)}px`);
    style.setProperty("--mono-pointer-tilt-x", `${(-normalizedY * 2.4).toFixed(2)}deg`);
    style.setProperty("--mono-pointer-tilt-y", `${(normalizedX * 3.2).toFixed(2)}deg`);
    event.currentTarget.dataset.pointerActive = "true";
    if (background === "tide") {
      const step = stepTideMotion(tideMotionRef.current, { x, y, time: event.timeStamp });
      tideMotionRef.current = step.state;
      if (step.pulse) rippleAt(x, y, step.pulse.angle, step.pulse.energy);
    }
    if (background === "strata") repelNodes(x, y, rect.width, view.innerHeight);
  }

  function restAtmosphere() {
    stopAtmosphere(false);
  }

  const shapeStyle = {
    ...paletteStyle,
    ...(logoPreview.customColor ? {
      "--mono-logo-custom-dark-primary": logoColors.dark.primary,
      "--mono-logo-custom-dark-depth": logoColors.dark.depth,
      "--mono-logo-custom-dark-gradient-start": logoColors.dark.gradientStart,
      "--mono-logo-custom-dark-gradient-end": logoColors.dark.gradientEnd,
      "--mono-logo-custom-light-primary": logoColors.light.primary,
      "--mono-logo-custom-light-depth": logoColors.light.depth,
      "--mono-logo-custom-light-gradient-start": logoColors.light.gradientStart,
      "--mono-logo-custom-light-gradient-end": logoColors.light.gradientEnd,
    } : {}),
    "--mono-actions-radius": `${shape["quick-actions"]}px`,
    "--mono-nav-radius": `${shape["bottom-navigation"]}px`,
    ...(typography.active ? monoTypographyStyle(typography.active) : {}),
  } as CSSProperties;
  const chart = fullScene && appearance.chart && <MonoChart values={snapshot.chart[period]} format={moneyFormat}
    hidden={balanceHidden} period={period} onPeriodChange={setPeriod} appearance={appearance.chart} />;
  return (
        <main ref={node => { pageRef.current = node; if (surfaceRef) surfaceRef.current = node; }}
          className="mono-page" data-mono-preview data-mono-preset={preset}
          data-mono-logo-variant={logoPreview.variant} data-mono-logo-custom={logoPreview.customColor}
          data-palette-enabled={Boolean(palette.enabled)} data-palette-ready={paletteReady} style={shapeStyle}
          data-mono-theme={theme} data-mono-background={background} data-mono-viewport={viewport}
          data-mono-typography={typography.active ? "true" : "false"}
          data-mono-font-status={typography.status}
          data-mono-atmosphere-source={customAtmosphere ? "adapter" : "legacy"}
          data-pointer-active="false" onPointerMove={customAtmosphere || !active ? undefined : moveAtmosphere}
          onPointerLeave={customAtmosphere || !active ? undefined : restAtmosphere}>
          <div ref={paletteCrossfadeRef} className="mono-palette-crossfade" data-mono-palette-crossfade aria-hidden="true" />
          {atmosphere !== undefined ? atmosphere : appearance.background ?
            <MonoBackgroundRecipes config={appearance.background} surfaceRef={pageRef} theme={theme} active={active} /> :
          <div className="mono-atmosphere" data-mono-atmosphere aria-hidden="true">
            <span className="mono-atmosphere__focus" />
            <span className="mono-atmosphere__ribbon" />
            <span className="mono-atmosphere__grid" />
            <span className="mono-atmosphere__iridescence" />
            <div className="mono-atmosphere__wake" ref={rippleRootRef} />
            <div className="mono-atmosphere__nodes">
              {FIELD_NODES.map(([x, y]) => (
                <span className="mono-atmosphere__node" key={`${x}-${y}`}
                  style={{ left: `${x}%`, top: `${y}%` }} />
              ))}
            </div>
          </div>}

      <div className="mono-scene">
        <header className="mono-app-header">
          <div className="mono-app-header__mark">
            <MonoLogo />
          </div>
          <div className="mono-app-header__person">
            <strong>{snapshot.profile.name}</strong>
          </div>
          <div className="mono-app-header__signal" aria-label="Визуальный прототип, демо-данные">
            <span className="mono-app-header__signal-dot" />
            DEMO
          </div>
        </header>

        {fullScene && appearance.balance ? <section className="mono-hero">
          <div className="mono-hero__eyebrow"><span>ЛИЧНЫЙ СЧЁТ</span><span>01 / 03</span></div>
          <div className="mono-scene-domain">
            <MonoBalance value={snapshot.balance.amount} format={moneyFormat} change24h={snapshot.balance.change24h}
              hidden={balanceHidden} onHiddenChange={setBalanceHidden} appearance={appearance.balance} />
            {appearance.layout?.chartPosition === "top" && chart}
          </div>
        </section> : <section className="mono-hero" aria-labelledby="mono-balance-title">
          <div className="mono-hero__eyebrow">
            <span>ЛИЧНЫЙ СЧЁТ</span>
            <span>01 / 03</span>
          </div>
          <div className="mono-hero__heading-row">
            <h1 id="mono-balance-title">Общий баланс</h1>
            <button
              className="mono-hero__privacy"
              type="button"
              aria-label={balanceHidden ? "Показать баланс" : "Скрыть баланс"}
              aria-pressed={balanceHidden}
              onClick={() => setBalanceHidden((hidden) => !hidden)}
            >
              {balanceHidden ? "○" : "◉"}
            </button>
          </div>
          <div className="mono-hero__amount" aria-label={balanceHidden ? "Баланс скрыт" : `${balance} долларов США`}>
            {balanceHidden ? <span className="mono-hero__masked">••••••</span> : <><span>{balance}</span><small>$</small></>}
          </div>
          <div className="mono-hero__change" aria-label={balanceHidden ? "Изменение скрыто" : `Изменение за день ${change}`}>
            <span className="mono-hero__change-symbol" aria-hidden="true">↗</span>
            <strong>{balanceHidden ? "••••" : change}</strong>
            <span>за 24 часа</span>
          </div>

          <div className="mono-chart" role="img" aria-label={balanceHidden ? "График баланса скрыт" : "Динамика баланса за один день"}>
            {balanceHidden ? <div className="mono-chart__hidden" /> : (
              <svg viewBox="0 0 100 82" preserveAspectRatio="none" aria-hidden="true">
                <path className="mono-chart__grid" d="M0 25H100M0 60H100" />
                <polyline className="mono-chart__line" points={chartPoints} />
                <circle className="mono-chart__terminal" cx="100" cy={74 - ((values[values.length - 1] - low) / span) * 54} r="1.8" />
              </svg>
            )}
          </div>
          <div className="mono-hero__chart-footer">
            <span>00:00</span>
            <div className="mono-periods" aria-label="Период графика: день">
              <span className="mono-periods__active">1Д</span><span>1Н</span><span>1М</span><span>1Г</span><span>Всё</span>
            </div>
            <span>Сейчас</span>
          </div>
        </section>}

        <section className="mono-actions" aria-label="Действия — визуальный прототип">
          {ACTIONS.map((action) => (
            <MonoQuickActionFeedback
              key={`${action.label}:${quickActionPreset?.effectId ?? "baseline"}:${quickActionPreset?.config.magneticTravel ?? 0}`}
              label={action.label} path={action.path} preset={quickActionPreset}
              onActivate={() => setQuickActionStatus(`${action.label} — операция недоступна в демо.`)} />
          ))}
          <p id="mono-actions-status" className="mono-actions__status" role="status"
            aria-label="Статус быстрых действий" aria-live="polite">{quickActionStatus}</p>
        </section>

        <div className="mono-promo-frame">
          <MonoOpticalGlass preset={preset} settings={optics} active={active} className="mono-promo" sharedHost={opticalHost}>
            <div className="mono-promo__content">
              <span className="mono-promo__overline">NOVEX WALLET / PRIVATE</span>
              <strong>Контроль<br />без шума.</strong>
              <span className="mono-promo__foot">МАТЕРИАЛ / 001 <span aria-hidden="true">↗</span></span>
            </div>
            <div className="mono-promo__seal" aria-hidden="true" />
          </MonoOpticalGlass>
        </div>

        {fullScene && appearance.assets ? <div className="mono-assets mono-scene-domain">
          <MonoAssetList assets={snapshot.assets} format={moneyFormat} hidden={balanceHidden} appearance={appearance.assets} />
          <p className="mono-assets__disclaimer">Демонстрационные данные. Операции здесь недоступны.</p>
        </div> : <section className="mono-assets" aria-labelledby="mono-assets-title">
          <div className="mono-assets__heading"><h2 id="mono-assets-title">Активы</h2><span>{snapshot.assets.length.toString().padStart(2, "0")}</span></div>
          <div className="mono-assets__list">
            {snapshot.assets.map((asset) => (
              <div className="mono-assets__row" key={asset.symbol}>
                <span className="mono-assets__symbol" aria-hidden="true">{asset.symbol.slice(0, 1)}</span>
                <span className="mono-assets__name"><strong>{asset.name}</strong><small>{assetFormatter.format(asset.amount)} {asset.symbol}</small></span>
                <span className="mono-assets__value"><strong>{currencyFormatter.format(asset.value)} $</strong><small>{asset.change24h >= 0 ? "+" : ""}{assetFormatter.format(asset.change24h)}%</small></span>
              </div>
            ))}
          </div>
          <p className="mono-assets__disclaimer">Демонстрационные данные. Операции здесь недоступны.</p>
        </section>}
        {fullScene && appearance.layout?.chartPosition === "bottom" && <div className="mono-scene-domain mono-scene-domain--chart">{chart}</div>}
      </div>

      <div className="mono-nav" aria-label="Предпросмотр нижней навигации">
        {NAV_ITEMS.map((item, index) => (
          <div className="mono-nav__item" data-active={index === 0 ? "true" : "false"} key={item.label}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.path} /></svg>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
        </main>
  );
}
