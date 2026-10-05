"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent,
  type ReactNode, type RefObject } from "react";
import { resolveActionRoutes, type ChartPeriod, type ProductActionRoute, type WalletSnapshot } from "@wallet/core";
import { MATERIAL_VIEWPORT_MOTION_REBASE_EVENT, MonoOpticalGlass, monoActionIconPath,
  type ButtonTargetId, type MonoGlassSettings, type MonoPaletteConfigV1, type MonoSharedOpticalHost } from "@wallet/ui";
import { MonoLogo } from "./mono-logo";
import { resolveMonoLogoColors, type MonoLogoPreview } from "./mono-logo-preview";
import { monoPaletteStyle } from "./mono-palette-tokens";
import type { MonoShapePreset, MonoShapeSettings } from "./mono-shape-preview";
import { MONO_QUICK_ACTION_DEFAULT, MonoQuickActionFeedback } from "./mono-quick-action-feedback";
import { createDefaultActionArtworkMap, type MonoActionArtworkMap } from "./action-artwork/model";
import { stepTideMotion, type TideMotionState } from "./mono-tide-motion";
import { MonoBalance } from "./mono-balance";
import { MonoChart } from "./mono-chart";
import { MonoAssetList } from "./mono-asset-list";
import { MONO_ASSET_LIST_DEFAULT, MONO_BALANCE_LEGACY, type MonoSceneAppearance } from "./mono-scene-lab-contract";
import { MonoBackgroundRecipes } from "./mono-background-recipes-view";
import type { MonoBackgroundRecipeConfig } from "./mono-background-recipes";
import { monoTypographyStyle, type MonoTypographyConfigV1 } from "./mono-typography";
import { useMonoTypographyPreview } from "./mono-typography-preview";
import { MONO_EYE_DEFAULT, MONO_NAVIGATION_DEFAULT, type MonoEyeAppearance,
  type MonoNavigationAppearance } from "./mono-interface-appearance";
import { ProductBalance, ProductContextLine, ProductHoldings } from "../mono-product/product-home";
import { ProductOverlay } from "../mono-product/product-sheet";
import { ProductAssetWorkspace } from "../mono-product/asset-workspace";
import { ProductAccountsWorkspace } from "../mono-product/accounts-workspace";
import { ProductGlassProvider } from "../mono-product/product-glass-surface";
import { formatFiatMinor } from "../mono-product/product-format";
import { productRouteKey, type MonoProductController } from "../mono-product/product-controller";
import { ProductHistory } from "../mono-product/product-history";
import { ProductRecentActivity } from "../mono-product/product-recent-activity";
import { ProductProfile, type ProductProfileOpenSectionRequest } from "../mono-product/product-profile";
import type { ProductHelpAction, ProductHelpActions, ProductHelpTopicId } from "../mono-product/product-help";
import { ProfileQuickMenu, type ProfileQuickMenuDismissReason } from "../mono-product/profile-quick-menu";
import { AvatarControl, MONO_DEMO_AVATAR } from "../mono-product/avatar-control";
import profileMenuStyles from "../mono-product/profile-quick-menu/profile-quick-menu.module.css";
import { useProductViewMotion } from "../mono-product/motion/product-view-motion";

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
import "./mono-interface.css";
import "../mono-product/motion/product-view-motion.css";

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
  eye?: MonoEyeAppearance;
  navigation?: MonoNavigationAppearance;
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
  actionArtwork?: MonoActionArtworkMap;
  artworkPreview?: { targetId: ButtonTargetId; trigger: number };
  /** Dev-only material workshop can identify the existing four DOM action targets. */
  materialTargets?: boolean;
  actionFrameMode?: "group" | "separate" | "icons";
  actionRadii?: Partial<Record<ButtonTargetId, number>>;
  active?: boolean;
  effectsDisabled?: boolean;
  /** Host-owned adapter replaces the legacy ambient layer and its pointer reactions. */
  atmosphere?: ReactNode;
  surfaceRef?: RefObject<HTMLElement | null>;
  /** Optional lab composition; absence preserves the standard private optical runtime. */
  opticalHost?: MonoSharedOpticalHost;
  /** Host session state survives a decorative renderer swap without entering the saved preset. */
  session?: { balanceHidden: boolean; onBalanceHiddenChange: (hidden: boolean) => void;
    period: ChartPeriod; onPeriodChange: (period: ChartPeriod) => void;
    section?: MonoSection; onSectionChange?: (section: MonoSection) => void;
    onThemeChange?: (theme: "dark" | "light") => void };
  product?: MonoProductController;
};

export type MonoSection = "overview" | "assets" | "history" | "profile";

const FIELD_NODES = [
  [19, 26], [47, 21], [76, 30],
  [28, 46], [62, 51], [87, 58],
  [13, 71], [43, 76], [71, 83],
] as const;

const ACTIONS = [
  { id: "quick.send", kind: "send", label: "Отправить", path: monoActionIconPath("quick.send") },
  { id: "quick.receive", kind: "receive", label: "Получить", path: monoActionIconPath("quick.receive") },
  { id: "quick.swap", kind: "swap", label: "Обмен", path: monoActionIconPath("quick.swap") },
  { id: "quick.buy", kind: "buy", label: "Купить", path: monoActionIconPath("quick.buy") },
] as const;

const NAV_ITEMS = [
  { id: "overview", label: "Обзор", path: "m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7" },
  { id: "assets", label: "Активы", path: "M4 18h16M5 14l5-5 4 3 5-7" },
  { id: "history", label: "История", path: "M4 12a8 8 0 1 0 3-6M4 4v5h5m3-2v5l3 2" },
  { id: "profile", label: "Профиль", path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
] as const;
const DEFAULT_ACTION_ARTWORK = createDefaultActionArtworkMap();
type AccountsFocusTarget = { kind: "title" } | { kind: "launcher" } | { kind: "context" }
  | { kind: "account" | "holding" | "route"; id: string };
type HelpEntryRequest = {
  action: ProductHelpTopicId;
  context: MonoProductController["view"]["context"];
  snapshot: MonoProductController["view"]["snapshot"];
  ports: MonoProductController["view"]["flowPorts"];
};

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
  paletteTransitionEnabled = false, quickActionPreset = MONO_QUICK_ACTION_DEFAULT, active = true, effectsDisabled = false,
  atmosphere, surfaceRef, typography, opticalHost, materialTargets = false, actionFrameMode = "group", actionRadii,
  actionArtwork = DEFAULT_ACTION_ARTWORK, artworkPreview, session, product,
}: MonoSceneProps & { typography: ReturnType<typeof useMonoTypographyPreview> }) {
  const customAtmosphere = atmosphere !== undefined || Boolean(appearance.background);
  const { preset, palette, shape, optics, logo: logoPreview } = appearance;
  const eye = appearance.eye ?? MONO_EYE_DEFAULT;
  const navigation = appearance.navigation ?? MONO_NAVIGATION_DEFAULT;
  const fullScene = Boolean(appearance.balance && appearance.chart && appearance.layout && appearance.assets);
  const [localPeriod, setLocalPeriod] = useState<ChartPeriod>("1D");
  const [localSection, setLocalSection] = useState<MonoSection>("overview");
  const section = session?.section ?? localSection;
  const [profileMenuOrigin, setProfileMenuOrigin] = useState<{
    section: MonoSection; context: MonoProductController["view"]["context"];
  } | null>(null);
  const profileMenuAnchor = useRef<HTMLButtonElement>(null);
  const profileMenuId = useId();
  const profileRequestRevision = useRef(0);
  const [profileSectionRequest, setProfileSectionRequest] = useState<ProductProfileOpenSectionRequest>();
  const canOpenProfileMenu = Boolean(product && active && !product.view.sheet && !product.view.commerceBusy);
  const profileMenuVisible = Boolean(profileMenuOrigin && canOpenProfileMenu &&
    profileMenuOrigin.section === section && profileMenuOrigin.context === product?.view.context);
  if (profileMenuOrigin && !profileMenuVisible) setProfileMenuOrigin(null);
  const accountsWorkspace = product?.view.accountsWorkspace ?? null;
  const assetWorkspace = accountsWorkspace || section === "overview" || section === "assets" ? product?.view.assetWorkspace ?? null : null;
  const assetWorkspaceId = assetWorkspace?.assetId ?? null;
  const accountsOrigin = useRef<MonoSection | null>(null);
  const accountsFocusRequest = useRef<AccountsFocusTarget | null>(null);
  const accountsChildReturn = useRef<AccountsFocusTarget | null>(null);
  const accountsLive = useRef({ accountsWorkspace, assetWorkspace, section, active, sheet: product?.view.sheet });
  accountsLive.current = { accountsWorkspace, assetWorkspace, section, active, sheet: product?.view.sheet };
  const previousAccountsView = useRef({ accountsWorkspace, assetWorkspace, sheet: product?.view.sheet, ports: product?.view.flowPorts });
  const allowedAccountActions = useMemo(() => {
    const source = product?.view.snapshot, accountId = accountsWorkspace?.accountId;
    if (!source || !accountId || source.accounts.filter(account => account.id === accountId).length !== 1) return [];
    return (["receive", "send", "buy", "swap"] as const).flatMap(action =>
      resolveActionRoutes(source, { kind: "account", accountId }, action).routes);
  }, [product?.view.snapshot, accountsWorkspace?.accountId]);
  const setSection = session?.onSectionChange ?? setLocalSection;
  const canChangeSection = session?.section === undefined || typeof session.onSectionChange === "function";
  const [helpEntryRequest, setHelpEntryRequest] = useState<HelpEntryRequest | null>(null);
  const helpEntryRef = useRef(helpEntryRequest);
  helpEntryRef.current = helpEntryRequest;
  const [helpReadinessRevision, setHelpReadinessRevision] = useState(0);
  const period = session?.period ?? localPeriod;
  const setPeriod = session?.onPeriodChange ?? setLocalPeriod;
  const moneyFormat = { locale: "ru-RU", currency: snapshot.balance.currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const { theme, background } = appearance.environment;
  const paletteStyle = useMemo(() => palette.enabled
    ? monoPaletteStyle(palette.config.themes[theme]) : {}, [palette.enabled, palette.config, theme]);
  const logoColors = useMemo(() => resolveMonoLogoColors(logoPreview.hue), [logoPreview.hue]);
  const [localBalanceHidden, setLocalBalanceHidden] = useState(snapshot.balance.hidden);
  const balanceHidden = session?.balanceHidden ?? localBalanceHidden;
  const setBalanceHidden = session?.onBalanceHiddenChange ?? setLocalBalanceHidden;
  const dismissProfileMenu = useCallback((reason: ProfileQuickMenuDismissReason) => {
    if (reason === "close" || reason === "escape") profileMenuAnchor.current?.focus({ preventScroll: true });
    setProfileMenuOrigin(null);
  }, []);
  function headerContextAllowed() {
    if (!active || (product && !product.commands.requestContextChange())) return false;
    return !product?.view.sheet;
  }
  function openProfile() {
    if (!headerContextAllowed() || !leaveAccountsWorkspace()) return;
    setProfileMenuOrigin(null);
    setProfileSectionRequest(undefined);
    setSection("profile");
  }
  function openProfileHelp() {
    if (!headerContextAllowed() || !product || !leaveAccountsWorkspace()) return;
    setProfileMenuOrigin(null);
    setProfileSectionRequest({ section: "help", revision: ++profileRequestRevision.current });
    setSection("profile");
  }
  function leaveAccountsWorkspace() {
    if (accountsWorkspace && !product?.commands.closeAccountsWorkspace()) return false;
    cancelHelpEntry();
    accountsOrigin.current = null; accountsFocusRequest.current = null; accountsChildReturn.current = null;
    return true;
  }
  function openAccountsWorkspace() {
    if (!headerContextAllowed() || !product?.commands.openAccountsWorkspace()) return;
    cancelHelpEntry();
    accountsOrigin.current = section; accountsFocusRequest.current = { kind: "title" }; accountsChildReturn.current = null;
    setProfileMenuOrigin(null); setProfileSectionRequest(undefined);
  }
  function inspectAccount(accountId: string) {
    if (active && product?.commands.inspectAccount(accountId)) accountsFocusRequest.current = { kind: "title" };
  }
  function backAccountsWorkspace() {
    if (!active || !accountsWorkspace || !product?.commands.backAccountsWorkspace()) return;
    accountsFocusRequest.current = accountsWorkspace.accountId === null
      ? { kind: "launcher" } : { kind: "account", id: accountsWorkspace.accountId };
    accountsChildReturn.current = null;
  }
  function useAccount(accountId: string) {
    if (!active || !product?.commands.useAccount(accountId)) return;
    accountsOrigin.current = null; accountsChildReturn.current = null;
    accountsFocusRequest.current = { kind: "context" };
    setSection("overview");
  }
  function openAccountRoute(route: ProductActionRoute) {
    if (active && product?.commands.openAccountRoute(route)) {
      accountsChildReturn.current = { kind: "route", id: productRouteKey(route) };
    }
  }
  function openAccountHolding(holdingId: string) {
    const accountId = accountsWorkspace?.accountId;
    if (active && accountId && product?.commands.openAccountHolding(accountId, holdingId)) {
      accountsChildReturn.current = { kind: "holding", id: holdingId };
    }
  }
  function cancelHelpEntry() {
    if (!helpEntryRef.current) return;
    helpEntryRef.current = null; setHelpEntryRequest(null);
  }
  function queueHelpEntry(action: ProductHelpTopicId) {
    if (!active || !product || section !== "profile" || !canChangeSection || product.view.sheet ||
      !product.commands.requestContextChange() || !resolveActionRoutes(product.view.snapshot, product.view.context, action).routes.length) return;
    const request: HelpEntryRequest = { action, context: product.view.context,
      snapshot: product.view.snapshot, ports: product.view.flowPorts };
    helpEntryRef.current = request; setHelpEntryRequest(request);
    setProfileMenuOrigin(null); setProfileSectionRequest(undefined);
    setSection("overview");
  }
  function helpAction(action: ProductHelpTopicId): ProductHelpAction {
    if (!active || !product) return { allowed: false, reason: "Открытие операции сейчас недоступно." };
    if (!canChangeSection) return { allowed: false, reason: "Переход к операциям сейчас недоступен." };
    if (product.view.sheet || product.view.commerceBusy) return { allowed: false, reason: "Завершите текущий сценарий, чтобы открыть другой." };
    const resolved = resolveActionRoutes(product.view.snapshot, product.view.context, action);
    if (!resolved.routes.length) return { allowed: false, reason: resolved.reason === "account-inactive"
      ? "Счёт неактивен. Операции недоступны."
      : resolved.reason === "account-not-found" || resolved.reason === "account-unavailable" ? "Текущий счёт недоступен."
        : "Доступных маршрутов для этой операции сейчас нет." };
    return { allowed: true, onOpen: () => queueHelpEntry(action) };
  }
  const productHelpActions: ProductHelpActions = {
    receive: helpAction("receive"), send: helpAction("send"), buy: helpAction("buy"), swap: helpAction("swap"),
  };
  const [quickActionStatus, setQuickActionStatus] = useState("Демо · операции недоступны");
  const pageRef = useRef<HTMLElement>(null);
  const productContentRef = useRef<HTMLDivElement>(null);
  const previousSection = useRef(section);
  const previousAsset = useRef<{ assetId: string; section: MonoSection } | null>(null);
  const activityFocusRequest = useRef<string | null>(null);
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

  useProductViewMotion({ surfaceRef: pageRef, contentRef: productContentRef,
    view: { section, assetId: assetWorkspaceId },
    enabled: Boolean(product) && active && !effectsDisabled && !appearance.background?.calm });

  useLayoutEffect(() => {
    const request = helpEntryRef.current, root = pageRef.current;
    if (!request || request !== helpEntryRequest) return;
    if (!active || !product || !canChangeSection || !root || root.ownerDocument.visibilityState === "hidden" ||
      request.context !== product.view.context || request.snapshot !== product.view.snapshot || request.ports !== product.view.flowPorts ||
      (section !== "profile" && section !== "overview") || product.view.sheet || product.view.commerceBusy ||
      product.view.assetWorkspace || product.view.accountsWorkspace ||
      !resolveActionRoutes(product.view.snapshot, product.view.context, request.action).routes.length) {
      cancelHelpEntry(); return;
    }
    if (section !== "overview") return;
    const action = ACTIONS.find(candidate => candidate.kind === request.action)!;
    const anchor = root.querySelector<HTMLElement>(`[data-mono-product-${request.action}-trigger]`)
      ?? root.querySelector<HTMLElement>(`.mono-actions__item[aria-label="${action.label}"]`);
    if (!anchor || anchor.closest("[hidden], [inert]")) { cancelHelpEntry(); return; }
    const entering = anchor.closest<HTMLElement>("[data-product-view-motion-target]");
    const animations = entering?.getAnimations?.().filter(animation =>
      (animation.playState === "running" || animation.pending) && animation.effect?.getTiming().iterations !== Infinity) ?? [];
    if (animations.length) {
      // Reuse the existing finite view-motion completion boundary; no polling or extra animation loop.
      void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        if (helpEntryRef.current === request) setHelpReadinessRevision(current => current + 1);
      });
      return;
    }
    const bounds = anchor.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || !product.commands.requestContextChange()) { cancelHelpEntry(); return; }
    helpEntryRef.current = null; setHelpEntryRequest(null);
    anchor.focus({ preventScroll: true });
    product.commands.openIntent(request.action);
  }, [helpEntryRequest, helpReadinessRevision, active, section, canChangeSection, product?.view.context,
    product?.view.snapshot, product?.view.flowPorts, product?.view.sheet, product?.view.commerceBusy,
    product?.view.assetWorkspace, product?.view.accountsWorkspace]);
  useEffect(() => () => { helpEntryRef.current = null; }, []);

  useLayoutEffect(() => {
    if (previousSection.current === section) return;
    previousSection.current = section;
    const root = pageRef.current;
    const scrollport = root?.closest<HTMLElement>("[data-material-scrollport]") ?? root?.ownerDocument.scrollingElement;
    if (scrollport) {
      scrollport.scrollTop = 0;
      scrollport.dispatchEvent(new Event(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT));
    }
  }, [section]);

  useLayoutEffect(() => {
    const previous = previousAsset.current;
    const root = pageRef.current;
    previousAsset.current = assetWorkspaceId ? { assetId: assetWorkspaceId, section } : null;
    if (assetWorkspaceId && previous?.assetId !== assetWorkspaceId) {
      root?.querySelector<HTMLElement>("[data-mono-product-asset-title]")?.focus({ preventScroll: true });
      const scrollport = root?.closest<HTMLElement>("[data-material-scrollport]") ?? root?.ownerDocument.scrollingElement;
      if (scrollport) {
        scrollport.scrollTop = 0;
        scrollport.dispatchEvent(new Event(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT));
      }
    } else if (!assetWorkspaceId && previous?.section === section) {
      [...(root?.querySelectorAll<HTMLElement>("[data-mono-product-asset-trigger]") ?? [])]
        .find(element => element.dataset.monoProductAssetTrigger === previous.assetId)?.focus();
    }
  }, [assetWorkspaceId, section]);

  useLayoutEffect(() => {
    const previous = previousAccountsView.current;
    previousAccountsView.current = { accountsWorkspace, assetWorkspace, sheet: product?.view.sheet, ports: product?.view.flowPorts };
    if (!active || product?.view.sheet || assetWorkspace) return;
    let target = accountsFocusRequest.current;
    if (!target && accountsWorkspace) {
      if (!previous.accountsWorkspace || previous.accountsWorkspace.accountId !== accountsWorkspace.accountId) target = { kind: "title" };
      else if (previous.assetWorkspace || previous.sheet) target = accountsChildReturn.current ?? { kind: "title" };
    }
    if (!target && previous.accountsWorkspace && !accountsWorkspace && accountsOrigin.current !== null &&
      previous.ports !== product?.view.flowPorts) target = { kind: "launcher" };
    if (!target) return;
    accountsFocusRequest.current = null;
    const focusTarget = target;
    const focus = () => {
      const current = accountsLive.current, root = pageRef.current;
      if (!root || !current.active || current.sheet || current.assetWorkspace ||
        current.accountsWorkspace !== accountsWorkspace || current.section !== section) return;
      let element: HTMLElement | null | undefined;
      if (focusTarget.kind === "launcher") element = profileMenuAnchor.current;
      else if (focusTarget.kind === "context") element = root.querySelector<HTMLElement>("[data-mono-product-context-trigger]")
        ?? root.querySelector<HTMLElement>('.mono-nav__item[aria-current="page"]');
      else if (focusTarget.kind !== "title") {
        const attribute = focusTarget.kind === "account" ? "data-product-account-id"
          : focusTarget.kind === "holding" ? "data-product-holding-id" : "data-product-account-route-key";
        element = [...root.querySelectorAll<HTMLElement>(`[${attribute}]`)]
          .find(candidate => candidate.getAttribute(attribute) === focusTarget.id && !candidate.closest("[hidden], [inert]"));
      }
      (element ?? root.querySelector<HTMLElement>("[data-mono-product-accounts-title]") ?? profileMenuAnchor.current)
        ?.focus({ preventScroll: true });
      if (!accountsWorkspace) accountsOrigin.current = null;
    };
    // Existing flow cleanup restores its own launcher in a microtask; the exact account origin wins afterwards.
    if (previous.sheet) queueMicrotask(focus); else focus();
  }, [accountsWorkspace, assetWorkspace, section, active, product?.view.sheet, product?.view.flowPorts]);

  useEffect(() => {
    if (!active || !accountsWorkspace || !product || profileMenuVisible || product.view.sheet) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing ||
        (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']"))) return;
      const origin = event.target;
      if (origin instanceof Node && origin !== document && origin !== document.body && !pageRef.current?.contains(origin)) return;
      event.preventDefault(); event.stopPropagation();
      if (assetWorkspace) product.commands.closeAsset(); else backAccountsWorkspace();
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  });

  function openActivity(id: string) {
    if (!product || !product.commands.requestContextChange()) return;
    if (!leaveAccountsWorkspace()) return;
    activityFocusRequest.current = id;
    product.commands.expandActivity(id);
    product.commands.closeSheet();
    setSection("history");
  }

  useLayoutEffect(() => {
    const id = activityFocusRequest.current;
    if (!id || section !== "history") return;
    activityFocusRequest.current = null;
    // Run after the removed modal's focus-return microtask. Never refocus on ordinary renders.
    queueMicrotask(() => {
      const root = pageRef.current;
      if (root?.dataset.monoSection !== "history") return;
      [...root.querySelectorAll<HTMLElement>("[data-product-activity-id]")]
        .find(element => element.dataset.productActivityId === id && !element.closest("[hidden], [inert]"))?.focus();
    });
  }, [section, product?.view.expandedActivityId, product?.view.sheet]);

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
    const surface = pageRef.current;
    if (!surface) return;
    const doc = surface.ownerDocument, view = doc.defaultView;
    const staticMotion = () => { surface.dataset.monoMotion = "static"; };
    if (!view || !active || effectsDisabled || appearance.background?.calm) { staticMotion(); return staticMotion; }
    const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (view.navigator as Navigator & { connection?: EventTarget & { readonly saveData?: boolean } }).connection;
    let intersecting = typeof view.IntersectionObserver !== "function";
    const sync = () => {
      surface.dataset.monoMotion = doc.visibilityState !== "hidden" && !reduced.matches &&
        !connection?.saveData && intersecting ? "ready" : "static";
    };
    const observer = typeof view.IntersectionObserver === "function" ? new view.IntersectionObserver(entries => {
      intersecting = entries[0]?.isIntersecting ?? false;
      sync();
    }) : null;
    observer?.observe(surface);
    doc.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    sync();
    return () => { observer?.disconnect(); doc.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync); connection?.removeEventListener("change", sync); staticMotion(); };
  }, [active, effectsDisabled, appearance.background?.calm]);

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
    "--mono-nav-glow": `${navigation.glowPercent}%`,
    "--mono-nav-glow-alpha": `${Math.round(navigation.glowPercent * 0.3)}%`,
    "--mono-nav-softness": `${navigation.softnessPx}px`,
    "--mono-nav-period": `${navigation.periodSeconds}s`,
    ...(typography.active ? monoTypographyStyle(typography.active) : {}),
  } as CSSProperties;
  const chart = (!product || (product.view.usesDefaultDemoChart && product.view.context.kind === "all")) && fullScene && appearance.chart &&
    <MonoChart values={snapshot.chart[period]} format={moneyFormat}
    hidden={balanceHidden} period={period} onPeriodChange={setPeriod} appearance={appearance.chart} />;
  const receiveMenuOpen = product?.view.sheet?.kind === "intent" && product.view.sheet.action === "receive" && !product.view.sheet.route;
  const sendMenuOpen = product?.view.sheet?.kind === "intent" && product.view.sheet.action === "send" &&
    !product.view.sheet.route && !product.view.sheet.placementId;
  const productModalOpen = Boolean(product?.view.sheet && product.view.sheet.kind !== "battery" && !receiveMenuOpen && !sendMenuOpen);
  return (
      <ProductGlassProvider sharedHost={opticalHost} preset={preset} settings={optics}
        active={active && !effectsDisabled} opaque={effectsDisabled}>
        <main ref={node => { pageRef.current = node; if (surfaceRef) surfaceRef.current = node; }}
          className="mono-page" data-mono-preview data-mono-preset={preset}
          data-mono-logo-variant={logoPreview.variant} data-mono-logo-custom={logoPreview.customColor}
          data-palette-enabled={Boolean(palette.enabled)} data-palette-ready={paletteReady} style={shapeStyle}
          data-mono-theme={theme} data-mono-background={background} data-mono-viewport={viewport}
          data-mono-section={section}
          data-mono-product={product ? "true" : undefined}
          data-mono-motion="static" data-nav-indicator={navigation.indicator}
          data-nav-shimmer={navigation.shimmerEnabled}
          data-mono-typography={typography.active ? "true" : "false"}
          data-mono-font-status={typography.status}
          data-mono-atmosphere-source={customAtmosphere ? "adapter" : "legacy"}
          data-pointer-active="false" onPointerMove={customAtmosphere || !active ? undefined : moveAtmosphere}
          onPointerLeave={customAtmosphere || !active ? undefined : restAtmosphere}>
          <div ref={paletteCrossfadeRef} className="mono-palette-crossfade" data-mono-palette-crossfade aria-hidden="true" />
          {atmosphere !== undefined ? atmosphere : appearance.background ?
            <MonoBackgroundRecipes config={appearance.background} surfaceRef={pageRef} theme={theme} active={active}
              effectsDisabled={effectsDisabled} /> :
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

      <div ref={productContentRef} className="mono-scene" data-product-view-motion={product ? "" : undefined}
        inert={productModalOpen}>
        <header className="mono-app-header">
          <div className="mono-app-header__mark">
            <MonoLogo />
          </div>
          <div className="mono-app-header__person">
            <strong>{snapshot.profile.name}</strong>
          </div>
          <div className={profileMenuStyles.headerControls} inert={!active} aria-hidden={!active || undefined}>
          <AvatarControl aria-label="Открыть профиль"
            aria-current={section === "profile" ? "page" : undefined}
            avatarSrc={product?.view.flowPorts.buy.mode === "demo" && product.view.flowPorts.swap.mode === "demo"
              ? MONO_DEMO_AVATAR.src : undefined}
            fallback={snapshot.profile.name} motionEnabled={active && !effectsDisabled && !appearance.background?.calm}
            onClick={openProfile} />
          {product && <button ref={profileMenuAnchor} className={profileMenuStyles.trigger} type="button"
            aria-label="Быстрые настройки" aria-haspopup="dialog" aria-expanded={profileMenuVisible}
            aria-controls={profileMenuId} data-profile-quick-menu-trigger
            onClick={() => {
              if (!headerContextAllowed()) return;
              cancelHelpEntry();
              setProfileMenuOrigin(current => current ? null : { section, context: product.view.context });
            }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" focusable="false">
              <path d="M4 8h14M4 14h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>}
          </div>
        </header>
        {product && <ProductContextLine {...product} />}

        {product && accountsWorkspace && !assetWorkspace && <div className="mono-product-section" inert={!active}>
          <ProductAccountsWorkspace snapshot={product.view.snapshot} selectedAccountId={accountsWorkspace.accountId}
            context={product.view.context} balanceHidden={product.view.balanceHidden} allowedActions={allowedAccountActions}
            onInspectAccount={inspectAccount} onBack={backAccountsWorkspace} onUseAccount={useAccount}
            onOpenAction={openAccountRoute} onOpenHolding={openAccountHolding} />
        </div>}
        {product && assetWorkspace && <div className="mono-product-section"><ProductAssetWorkspace
          view={product.view} assetId={assetWorkspace.assetId} selectedHoldingId={assetWorkspace.holdingId}
          onSelectHolding={product.commands.selectAssetHolding} onBack={product.commands.closeAsset}
          onPlacementAction={product.commands.openPlacementAction} onExpandActivity={product.commands.expandActivity}
          onRetryActivities={product.commands.retryActivities} /></div>}
        {section === "overview" && !assetWorkspace && !accountsWorkspace && <>
        {product ? <section className="mono-hero">
          <div className="mono-scene-domain">
            <ProductBalance {...product} appearance={appearance.balance ?? MONO_BALANCE_LEGACY}
              blinkEnabled={eye.blinkEnabled} />
          </div>
        </section> : fullScene && appearance.balance ? <section className="mono-hero">
          <div className="mono-hero__eyebrow"><span>ЛИЧНЫЙ СЧЁТ</span></div>
          <div className="mono-scene-domain">
            <MonoBalance value={snapshot.balance.amount} format={moneyFormat} change24h={snapshot.balance.change24h}
              hidden={balanceHidden} onHiddenChange={setBalanceHidden} blinkEnabled={eye.blinkEnabled} appearance={appearance.balance} />
            {appearance.layout?.chartPosition === "top" && chart}
          </div>
        </section> : <section className="mono-hero" aria-labelledby="mono-balance-title">
          <div className="mono-hero__eyebrow">
            <span>ЛИЧНЫЙ СЧЁТ</span>
          </div>
          <div className="mono-hero__heading-row">
            <h1 id="mono-balance-title">Общий баланс</h1>
            <button
              className="mono-hero__privacy"
              type="button"
              aria-label={balanceHidden ? "Показать баланс" : "Скрыть баланс"}
              aria-pressed={balanceHidden}
              data-eye-blink={eye.blinkEnabled && !balanceHidden}
              onClick={() => setBalanceHidden(!balanceHidden)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="2.5" />{balanceHidden && <path d="m4 4 16 16" />}</svg>
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

        <section className="mono-actions" data-frame-mode={actionFrameMode}
          aria-label={product ? "Действия" : "Действия — визуальный прототип"}>
          {ACTIONS.map((action) => (
            <MonoQuickActionFeedback
              key={`${action.label}:${quickActionPreset?.effectId ?? "baseline"}:${quickActionPreset?.config.magneticTravel ?? 0}`}
              label={action.label} path={action.path} preset={quickActionPreset}
              accessibleLabel={product ? action.label : undefined}
              productPrimary={Boolean(product && (action.kind === "send" || action.kind === "receive"))}
              productReceiveExpanded={product && action.kind === "receive" ? Boolean(receiveMenuOpen) : undefined}
              productSendExpanded={product && action.kind === "send" ? Boolean(sendMenuOpen) : undefined}
              actionId={action.id} artwork={actionArtwork[action.id]} active={active && !effectsDisabled}
              manualPreviewTrigger={artworkPreview?.targetId === action.id ? artworkPreview.trigger : 0}
              materialTargetId={materialTargets ? action.id : undefined}
              materialRadiusCss={actionFrameMode === "separate" ? actionRadii?.[action.id] : undefined}
              onActivate={() => product ? product.commands.openIntent(action.kind)
                : setQuickActionStatus(`${action.label} — операция недоступна в демо.`)} />
          ))}
          <p id="mono-actions-status" className="mono-actions__status" role="status"
            aria-label="Статус быстрых действий" aria-live="polite">{product
              ? "Демо · операции не выполняются" : quickActionStatus}</p>
        </section>

        {product && appearance.layout?.chartPosition === "top" && chart &&
          <div className="mono-scene-domain mono-scene-domain--chart mono-product-chart">{chart}</div>}
        {product && <ProductHoldings {...product} overview onPlacementAction={product.commands.openPlacementAction}
          onOpenAsset={product.commands.openAsset}
          appearance={appearance.assets ?? MONO_ASSET_LIST_DEFAULT} />}
        {product?.view.activityStatus === "ready" && <div className="mono-product-recent"><ProductRecentActivity
          activities={product.view.activities} balanceHidden={product.view.balanceHidden}
          accountId={product.view.context.kind === "account" ? product.view.context.accountId : undefined}
          onOpenActivity={openActivity} /></div>}

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

        {!product && fullScene && appearance.assets ? <div className="mono-assets mono-scene-domain">
          <MonoAssetList assets={snapshot.assets} format={moneyFormat} hidden={balanceHidden} appearance={appearance.assets} />
          <p className="mono-assets__disclaimer">Демонстрационные данные. Операции здесь недоступны.</p>
        </div> : !product && <section className="mono-assets" aria-labelledby="mono-assets-title">
          <div className="mono-assets__heading"><h2 id="mono-assets-title">Активы</h2></div>
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
        {fullScene && appearance.layout?.chartPosition === "bottom" && chart &&
          <div className="mono-scene-domain mono-scene-domain--chart">{chart}</div>}
        </>}
        {section === "assets" && !assetWorkspace && !accountsWorkspace && <section className="mono-section-view" aria-labelledby="mono-all-assets-title">
          <div className="mono-section-view__eyebrow">ПОРТФЕЛЬ / DEMO</div>
          <h1 id="mono-all-assets-title">Все активы</h1>
          <div className="mono-section-view__balance"><span>{product?.view.context.kind === "account" ? "Баланс счёта" :
            product ? "Общая стоимость" : "Общий баланс"}</span>
            <strong>{balanceHidden ? "••••••" : product ? formatFiatMinor(product.view.balanceMinor) : `${balance} $`}</strong></div>
          {product ? <ProductHoldings {...product} overview={false} onPlacementAction={product.commands.openPlacementAction}
            onOpenAsset={product.commands.openAsset}
            appearance={appearance.assets ?? MONO_ASSET_LIST_DEFAULT} /> : <div className="mono-section-view__assets mono-scene-domain">
            <MonoAssetList assets={snapshot.assets} format={moneyFormat} hidden={balanceHidden}
              appearance={appearance.assets ?? MONO_ASSET_LIST_DEFAULT} />
          </div>}
          <p className="mono-section-view__note">{product ? "Демонстрационные данные. Операции не выполняются."
            : "Демонстрационные данные. Операции недоступны."}</p>
        </section>}
        {section === "history" && product && !accountsWorkspace && <div className="mono-product-section"><ProductHistory
          activities={product.view.activities} balanceHidden={product.view.balanceHidden}
          accountId={product.view.context.kind === "account" ? product.view.context.accountId : undefined}
          accountLabel={product.view.account?.label} expandedActivityId={product.view.expandedActivityId}
          onExpandedActivityChange={product.commands.expandActivity} status={product.view.activityStatus}
          onRetry={product.commands.retryActivities} /></div>}
        {section === "history" && !product && <section className="mono-section-view" aria-labelledby="mono-history-title">
          <div className="mono-section-view__eyebrow">ОПЕРАЦИИ / DEMO</div>
          <h1 id="mono-history-title">История операций</h1>
          <div className="mono-section-view__empty"><span aria-hidden="true">↗</span>
            <strong>История операций пока не подключена</strong>
            <p>Эта демо-сцена не загружает операции. Быстрые действия не совершают переводы.</p></div>
        </section>}
        {section === "profile" && product && !accountsWorkspace && <div className="mono-product-section"><ProductProfile
          profile={snapshot.profile} balanceHidden={product.view.balanceHidden}
          onBalanceHiddenChange={product.commands.setBalanceHidden}
          helpActions={productHelpActions}
          theme={theme} onThemeChange={session?.onThemeChange} openSectionRequest={profileSectionRequest} /></div>}
        {section === "profile" && !product && <section className="mono-section-view" aria-labelledby="mono-profile-title">
          <div className="mono-section-view__eyebrow">АККАУНТ / DEMO</div>
          <h1 id="mono-profile-title">Профиль</h1>
          <div className="mono-section-view__profile"><span className="mono-section-view__avatar" aria-hidden="true">{snapshot.profile.name.slice(0, 1)}</span>
            <div><strong>{snapshot.profile.name}</strong><small>Демонстрационный профиль</small></div></div>
          <div className="mono-section-view__detail"><span>Адрес в демо</span><strong>{snapshot.profile.shortAddress}</strong></div>
          <button className="mono-section-view__privacy" type="button" aria-pressed={balanceHidden}
            aria-label={balanceHidden ? "Показать суммы" : "Скрыть суммы"}
            onClick={() => setBalanceHidden(!balanceHidden)}>
            <span>Скрывать суммы</span><span>{balanceHidden ? "Включено" : "Выключено"}</span>
          </button>
          <p className="mono-section-view__note">Данные и действия этого экрана служат только для визуальной примерки.</p>
        </section>}
      </div>

      <nav className="mono-nav" aria-label="Разделы кошелька" inert={productModalOpen}>
        {NAV_ITEMS.map(item => (
          <button className="mono-nav__item" type="button" data-active={section === item.id ? "true" : "false"}
            aria-current={section === item.id ? "page" : undefined} key={item.id}
            onClick={() => {
              if (product && !product.commands.requestContextChange()) return;
              if (!leaveAccountsWorkspace()) return;
              setProfileMenuOrigin(null);
              setProfileSectionRequest(undefined);
              setSection(item.id);
            }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.path} /></svg>
            <span>{item.label}</span>
            <span className="mono-nav__indicator" aria-hidden="true"><i className="mono-nav__glint" /></span>
          </button>
        ))}
      </nav>
      {product && <ProfileQuickMenu id={profileMenuId} open={profileMenuVisible} anchorRef={profileMenuAnchor}
        theme={theme} onThemeChange={session?.onThemeChange} balanceHidden={product.view.balanceHidden}
        onBalanceHiddenChange={product.commands.setBalanceHidden} onOpenHelp={openProfileHelp} onDismiss={dismissProfileMenu}
        onOpenAccounts={openAccountsWorkspace}
        motionEnabled={active && !effectsDisabled && !appearance.background?.calm} />}
      {product && <ProductOverlay {...product} onOpenActivity={openActivity} />}
        </main>
      </ProductGlassProvider>
  );
}
