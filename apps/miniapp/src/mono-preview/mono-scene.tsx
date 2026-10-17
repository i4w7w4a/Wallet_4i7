"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent,
  type ReactNode, type RefObject } from "react";
import { resolveActionRoutes, type AccountContext, type ChartPeriod, type ProductAccountKind, type ProductActionRoute, type ProductHolding, type WalletSnapshot } from "@wallet/core";
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
import { MonoGoldAccountDeck } from "./mono-gold-account-deck";
import { MonoChart } from "./mono-chart";
import { MonoAssetList } from "./mono-asset-list";
import { MONO_ASSET_LIST_DEFAULT, MONO_BALANCE_LEGACY, type MonoSceneAppearance } from "./mono-scene-lab-contract";
import { MonoBackgroundRecipes } from "./mono-background-recipes-view";
import type { MonoBackgroundRecipeConfig } from "./mono-background-recipes";
import { monoTypographyStyle, type MonoTypographyConfigV1 } from "./mono-typography";
import { useMonoTypographyPreview } from "./mono-typography-preview";
import { MONO_EYE_DEFAULT, MONO_NAVIGATION_DEFAULT, type MonoEyeAppearance,
  type MonoNavigationAppearance } from "./mono-interface-appearance";
import { ProductOverview, ProductContextLine, ProductHoldings } from "../mono-product/product-home";
import { ProductOverlay } from "../mono-product/product-sheet";
import { ProductAssetWorkspace } from "../mono-product/asset-workspace";
import { ProductAccountsWorkspace } from "../mono-product/accounts-workspace";
import type { AccountsActionOrigin } from "../mono-product/accounts-workspace/account-placement-actions";
import { ProductGlassProvider } from "../mono-product/product-glass-surface";
import { formatFiatMinor } from "../mono-product/product-format";
import { ALL_WALLET_CONTEXT, productRouteKey, productViewForScope, type MonoProductController } from "../mono-product/product-controller";
import { ProductHistory } from "../mono-product/product-history";
import { ProductRecentActivity } from "../mono-product/product-recent-activity";
import { ProductPendingActivity } from "../mono-product/product-pending-activity";
import { resolvePendingActivityEntry, selectPendingActivityIds, type PendingActivityOpenResult } from "../mono-product/pending-activity";
import { scopeProductActivities } from "../mono-product/product-activity-scope";
import type { HistoryFilterRequest } from "../mono-product/history-filters";
import { ProductProfile } from "../mono-product/product-profile";
import { createDemoProfileResource, useProfileDemoSession, type ProductProfileResource } from "../mono-product/profile";
import type { ProductHelpAction, ProductHelpActions, ProductHelpTopicId } from "../mono-product/product-help";
import { ProfileQuickMenu, type ProfileQuickMenuDismissReason } from "../mono-product/profile-quick-menu";
import { MenuIcon } from "../mono-product/profile-quick-menu/menu-icons";
import type { ProductBalanceDynamicsControl } from "../mono-product/product-profile-content";
import { WalletIcon } from "../../../../packages/ui/src/icons/wallet-icon";
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

export type MonoProfileInspectionOrigin = {
  section: MonoSection;
  owner: MonoSceneProps["sectionOwner"];
  context: MonoProductController["view"]["context"];
  snapshot: MonoProductController["view"]["snapshot"]; ports: MonoProductController["view"]["flowPorts"];
  accounts: MonoProductController["view"]["accountsWorkspace"]; asset: MonoProductController["view"]["assetWorkspace"];
};

export function matchesProfileInspectionOrigin(origin: MonoProfileInspectionOrigin, view: MonoProductController["view"]) {
  if (view.sheet || view.commerceBusy || origin.context !== view.context || origin.snapshot !== view.snapshot ||
    origin.ports !== view.flowPorts || origin.accounts !== view.accountsWorkspace || origin.asset !== view.assetWorkspace) return false;
  if (origin.accounts?.accountId) {
    const matches = view.snapshot.accounts.filter(account => account.id === origin.accounts!.accountId);
    if (matches.length !== 1 || (origin.accounts.groupKind && matches[0]!.kind !== origin.accounts.groupKind)) return false;
  }
  return true;
}

export type MonoSectionChangeIntent = {
  kind: "account-history";
  workspace: NonNullable<MonoProductController["view"]["accountsWorkspace"]>;
} | { kind: "profile-inspection"; origin: MonoProfileInspectionOrigin };

export type MonoSceneProps = {
  /** Host-only presentation marker; never enters saved appearance/preset schema. */
  presentation?: "gold";
  /** Optional display-only control supplied by the Gold host. */
  balanceDynamics?: ProductBalanceDynamicsControl;
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
    section?: MonoSection; onSectionChange?: (section: MonoSection, intent?: MonoSectionChangeIntent) => void;
    onThemeChange?: (theme: "dark" | "light") => void };
  product?: MonoProductController;
  profileResource?: ProductProfileResource;
  /** Stable owner of the host section, excluding its wrapped navigation handler. */
  sectionOwner?: NonNullable<MonoSceneProps["session"]>["onSectionChange"];
};

export type MonoSection = "overview" | "assets" | "history" | "profile";

const MONO_PRODUCT_QUICK_ACTION_DEFAULT: ComponentProps<typeof MonoQuickActionFeedback>["preset"] = {
  effectId: "material",
  config: { pressDepth: 1, magneticTravel: 5, settleMs: 190 },
};

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

// Existing WalletIcon strokes, combined into paths for the existing feedback host.
const GOLD_ACTION_PATHS = {
  "quick.receive": "M12 5.2v9.2 m-3.8-3.6 3.8 3.8 3.8-3.8 M5.6 16.4v1.6A1.4 1.4 0 0 0 7 19.4h10a1.4 1.4 0 0 0 1.4-1.4v-1.6",
  "quick.swap": "M7 8.2h10 m-2.6-2.6 3.2 2.6-3.2 2.6 M17 15.8H7 m2.6-2.6-3.2 2.6 3.2 2.6",
  "quick.buy": "M7.2 8.6h9.6l-.8 10.2H8Z M9.2 8.6V7.4a2.8 2.8 0 0 1 5.6 0v1.2",
} as const;

const NAV_ITEMS = [
  { id: "overview", label: "Обзор", path: "m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7" },
  { id: "assets", label: "Активы", path: "M4 18h16M5 14l5-5 4 3 5-7" },
  { id: "history", label: "История", path: "M4 12a8 8 0 1 0 3-6M4 4v5h5m3-2v5l3 2" },
  { id: "profile", label: "Профиль", path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
] as const;
const DEFAULT_ACTION_ARTWORK = createDefaultActionArtworkMap();
type AccountsFocusTarget = { kind: "title" } | { kind: "launcher" } | { kind: "context" }
  | { kind: "pin"; groupKind: ProductAccountKind }
  | { kind: "account" | "holding" | "holding-detail"; id: string } | AccountsActionOrigin;
type AccountsHoldingIdentity = Pick<ProductHolding, "id" | "accountId" | "assetId" | "networkId">;
type AccountsChildReturn = {
  accountId: string; target: AccountsFocusTarget; holding: AccountsHoldingIdentity | null;
};
type HistoryInspection = {
  scope: AccountContext; workingContext: AccountContext;
  snapshot: MonoProductController["view"]["snapshot"]; ports: MonoProductController["view"]["flowPorts"];
  filterRequest?: HistoryFilterRequest; origin?: "pending-home" | "pending-account" | "gold-home"; unavailable?: boolean;
  homeActivityId?: string;
  accountOrigin?: { workspace: NonNullable<MonoProductController["view"]["accountsWorkspace"]>;
    section: MonoSection; scrollTop: number };
};

function exactAccountHolding(snapshot: MonoProductController["view"]["snapshot"] | undefined,
  accountId: string, holdingId: string): ProductHolding | null {
  const matches = snapshot?.holdings.filter(holding => holding.id === holdingId) ?? [];
  return matches.length === 1 && matches[0]!.accountId === accountId ? matches[0]! : null;
}

function sameHoldingIdentity(holding: ProductHolding | null, identity: AccountsHoldingIdentity): boolean {
  return Boolean(holding && holding.id === identity.id && holding.accountId === identity.accountId &&
    holding.assetId === identity.assetId && holding.networkId === identity.networkId);
}

function holdingIdentity(holding: ProductHolding): AccountsHoldingIdentity {
  return { id: holding.id, accountId: holding.accountId, assetId: holding.assetId, networkId: holding.networkId };
}

function revealAccountsTarget(root: HTMLElement, element: HTMLElement) {
  const doc = root.ownerDocument;
  const scrollport = root.closest<HTMLElement>("[data-material-scrollport]") ?? doc.scrollingElement;
  if (!scrollport) return;
  const view = doc.defaultView, bounds = scrollport.getBoundingClientRect();
  const documentScroll = scrollport === doc.scrollingElement;
  const top = documentScroll ? 0 : Math.max(0, bounds.top + scrollport.clientTop);
  let bottom = documentScroll ? view?.innerHeight ?? 0
    : Math.min(bounds.top + scrollport.clientTop + scrollport.clientHeight, view?.innerHeight ?? bounds.bottom);
  const navigation = root.querySelector<HTMLElement>(".mono-nav")?.getBoundingClientRect();
  if (navigation?.height && navigation.top > top) bottom = Math.min(bottom, navigation.top);
  if (bottom <= top) return;
  const target = element.getBoundingClientRect();
  const offset = target.top < top ? target.top - top : target.bottom > bottom ? target.bottom - bottom : 0;
  if (!offset) return;
  const previous = scrollport.scrollTop;
  scrollport.scrollTop += offset;
  if (scrollport.scrollTop !== previous) scrollport.dispatchEvent(new Event(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT));
}
type HelpEntryRequest = {
  action: ProductHelpTopicId;
  context: MonoProductController["view"]["context"];
  snapshot: MonoProductController["view"]["snapshot"];
  ports: MonoProductController["view"]["flowPorts"];
};

type AvatarProfileOrigin = MonoProfileInspectionOrigin & {
  scrollTop: number;
};
type ProfileMenuOrigin = {
  launcher: "menu" | "support"; section: MonoSection;
  context: MonoProductController["view"]["context"];
  snapshot: MonoProductController["view"]["snapshot"]; ports: MonoProductController["view"]["flowPorts"];
  accounts: MonoProductController["view"]["accountsWorkspace"]; asset: MonoProductController["view"]["assetWorkspace"];
};

function matchesProfileMenuOrigin(origin: ProfileMenuOrigin | null, product: MonoProductController | undefined,
  section: MonoSection, active: boolean) {
  if (!origin || !product || !active || product.view.sheet || product.view.commerceBusy || origin.section !== section ||
    origin.context !== product.view.context || origin.snapshot !== product.view.snapshot || origin.ports !== product.view.flowPorts ||
    origin.accounts !== product.view.accountsWorkspace || origin.asset !== product.view.assetWorkspace) return false;
  const accountId = origin.accounts?.accountId;
  if (accountId && product.view.snapshot.accounts.filter(account => account.id === accountId).length !== 1) return false;
  return origin.launcher !== "support" || (section === "overview" && !origin.accounts && !origin.asset);
}

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
  actionArtwork = DEFAULT_ACTION_ARTWORK, artworkPreview, session, product, profileResource, sectionOwner,
  presentation: propsPresentation, balanceDynamics,
}: MonoSceneProps & { typography: ReturnType<typeof useMonoTypographyPreview> }) {
  const customAtmosphere = atmosphere !== undefined || Boolean(appearance.background);
  const { preset, palette, shape, optics, logo: logoPreview } = appearance;
  const eye = appearance.eye ?? MONO_EYE_DEFAULT;
  const navigation = appearance.navigation ?? MONO_NAVIGATION_DEFAULT;
  const goldBalanceDynamics = propsPresentation === "gold" ? balanceDynamics : undefined;
  const fullScene = Boolean(appearance.balance && appearance.chart && appearance.layout && appearance.assets);
  const [localPeriod, setLocalPeriod] = useState<ChartPeriod>("1D");
  const [localSection, setLocalSection] = useState<MonoSection>("overview");
  const section = session?.section ?? localSection;
  const navigationOwner = sectionOwner ?? session?.onSectionChange;
  const [avatarProfileOrigin, setAvatarProfileOrigin] = useState<AvatarProfileOrigin | null>(null);
  const avatarOriginRef = useRef(avatarProfileOrigin); avatarOriginRef.current = avatarProfileOrigin;
  const avatarAnchor = useRef<HTMLButtonElement>(null);
  const avatarReturn = useRef<AvatarProfileOrigin | null>(null);
  const avatarProfileActive = Boolean(avatarProfileOrigin && section === "profile");
  if (avatarProfileOrigin && section !== "profile") setAvatarProfileOrigin(null);
  const [profileMenuOrigin, setProfileMenuOrigin] = useState<ProfileMenuOrigin | null>(null);
  const profileMenuOriginRef = useRef(profileMenuOrigin);
  profileMenuOriginRef.current = profileMenuOrigin;
  const profileMenuAnchor = useRef<HTMLButtonElement>(null);
  const supportAnchor = useRef<HTMLButtonElement>(null);
  const profileMenuId = useId();
  const accountChooserId = useId();
  const fallbackProfileResource = useMemo(createDemoProfileResource, []);
  const currentProfileResource = profileResource ?? fallbackProfileResource;
  const profileAvatarSrc = snapshot.profile.avatarUrl?.trim() ||
    (product?.view.flowPorts.buy.mode === "demo" && product.view.flowPorts.swap.mode === "demo" ? MONO_DEMO_AVATAR.src : null);
  const profileDemoSession = useProfileDemoSession({ profile: snapshot.profile, resource: currentProfileResource,
    identityKey: snapshot.profile.shortAddress, avatarSrc: profileAvatarSrc });
  const canOpenProfileMenu = Boolean(product && active && !product.view.sheet && !product.view.commerceBusy);
  const profileMenuVisible = matchesProfileMenuOrigin(profileMenuOrigin, product, section, active);
  if (profileMenuOrigin && !profileMenuVisible) setProfileMenuOrigin(null);
  const accountsWorkspace = product?.view.accountsWorkspace ?? null;
  const assetWorkspace = accountsWorkspace || avatarProfileActive || section === "overview" || section === "assets" ? product?.view.assetWorkspace ?? null : null;
  const assetWorkspaceId = assetWorkspace?.assetId ?? null;
  const rootOverview = section === "overview" && !accountsWorkspace && !assetWorkspace;
  const overviewProduct: MonoProductController | undefined = product ? { ...product,
    view: productViewForScope(product.view, ALL_WALLET_CONTEXT),
    commands: { ...product.commands,
      openIntent: (action, scope = ALL_WALLET_CONTEXT) => product.commands.openIntent(action, scope),
      openAsset: (assetId, scope = ALL_WALLET_CONTEXT) => product.commands.openAsset(assetId, scope),
    } } : undefined;
  const [goldAssetsScope, setGoldAssetsScope] = useState<AccountContext>(ALL_WALLET_CONTEXT);
  const goldFundsFocusRequest = useRef<"assets" | "overview" | null>(null);
  const assetsProduct: MonoProductController | undefined = product && propsPresentation === "gold" ? { ...product,
    view: productViewForScope(product.view, goldAssetsScope),
    commands: { ...product.commands,
      openIntent: (action, scope = goldAssetsScope) => product.commands.openIntent(action, scope),
      openAsset: (assetId, scope = goldAssetsScope) => product.commands.openAsset(assetId, scope),
    } } : product;
  const assetView = product ? productViewForScope(product.view, assetWorkspace?.scope) : undefined;
  const [historyInspection, setHistoryInspection] = useState<HistoryInspection | null>(null);
  const currentHistoryInspection = historyInspection && product && historyInspection.workingContext === product.view.context &&
    historyInspection.snapshot === product.view.snapshot && historyInspection.ports === product.view.flowPorts &&
    (historyInspection.origin !== "pending-account" || (historyInspection.accountOrigin &&
      accountsWorkspace === historyInspection.accountOrigin.workspace && accountsWorkspace.accountId !== null &&
      product.view.snapshot.accounts.filter(account => account.id === accountsWorkspace.accountId).length === 1))
    ? historyInspection : null;
  const accountHistoryOpen = historyInspection?.origin === "pending-account";
  const historyScope = currentHistoryInspection?.scope;
  const historyFilterRevision = useRef(0);
  const pendingReturnFocus = useRef<typeof historyInspection>(null);
  const historyView = product ? productViewForScope(product.view, historyScope) : undefined;
  const [expandedHoldingId, setExpandedHoldingId] = useState<string | null>(null);
  const expandedHoldingSource = useRef<AccountsHoldingIdentity | null>(null);
  const inspectedAccountId = accountsWorkspace?.accountId ?? null;
  const inspectedAccountMatches = product?.view.snapshot.accounts.filter(account => account.id === inspectedAccountId) ?? [];
  const inspectedAccount = inspectedAccountMatches.length === 1 ? inspectedAccountMatches[0]! : null;
  const expandedHolding = expandedHoldingId && inspectedAccountId
    ? exactAccountHolding(product?.view.snapshot, inspectedAccountId, expandedHoldingId) : null;
  const currentExpandedHoldingId = inspectedAccount && expandedHoldingSource.current &&
    sameHoldingIdentity(expandedHolding, expandedHoldingSource.current) ? expandedHoldingId : null;
  const accountsOrigin = useRef<{ section: MonoSection; target: AccountsFocusTarget } | null>(null);
  const accountsFocusRequest = useRef<AccountsFocusTarget | null>(null);
  const accountsChildReturn = useRef<AccountsChildReturn | null>(null);
  const accountsLive = useRef({ accountsWorkspace, assetWorkspace, section, active, sheet: product?.view.sheet,
    snapshot: product?.view.snapshot, ports: product?.view.flowPorts });
  accountsLive.current = { accountsWorkspace, assetWorkspace, section, active, sheet: product?.view.sheet,
    snapshot: product?.view.snapshot, ports: product?.view.flowPorts };
  const previousInspectedAccount = useRef(inspectedAccountId);
  useLayoutEffect(() => {
    const changedAccount = previousInspectedAccount.current !== inspectedAccountId;
    previousInspectedAccount.current = inspectedAccountId;
    if (changedAccount || (expandedHoldingId !== null && currentExpandedHoldingId === null)) {
      expandedHoldingSource.current = null; setExpandedHoldingId(null);
    }
    if (changedAccount) accountsChildReturn.current = null;
  }, [inspectedAccountId, expandedHoldingId, currentExpandedHoldingId]);
  const previousAccountsView = useRef({ accountsWorkspace, assetWorkspace, sheet: product?.view.sheet, ports: product?.view.flowPorts });
  const allowedAccountActions = useMemo(() => {
    const source = product?.view.snapshot, accountId = accountsWorkspace?.accountId;
    if (!source || !accountId || source.accounts.filter(account => account.id === accountId).length !== 1) return [];
    return (["receive", "send", "buy", "swap"] as const).flatMap(action =>
      resolveActionRoutes(source, { kind: "account", accountId }, action).routes);
  }, [product?.view.snapshot, accountsWorkspace?.accountId]);
  const setSection: (section: MonoSection, intent?: MonoSectionChangeIntent) => void = session?.onSectionChange ?? setLocalSection;
  const canChangeSection = session?.section === undefined || typeof session.onSectionChange === "function";
  const pendingLive = useRef({ product, rootOverview, active, section, accountsWorkspace, accountHistoryOpen, canChangeSection });
  pendingLive.current = { product, rootOverview, active, section, accountsWorkspace, accountHistoryOpen, canChangeSection };
  const accountDestination = propsPresentation === "gold" ? "assets" : "overview";
  const canUseAccount = section === accountDestination || canChangeSection;
  const [helpEntryRequest, setHelpEntryRequest] = useState<HelpEntryRequest | null>(null);
  const helpEntryRef = useRef(helpEntryRequest);
  helpEntryRef.current = helpEntryRequest;
  const helpOverviewCommitted = useRef(false);
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
    const origin = profileMenuOriginRef.current, live = pendingLive.current;
    if ((reason === "close" || reason === "escape" || reason === "outside" || reason === "back") &&
      matchesProfileMenuOrigin(origin, live.product, live.section, live.active)) {
      (origin?.launcher === "support" ? supportAnchor.current : profileMenuAnchor.current)?.focus({ preventScroll: true });
    }
    setProfileMenuOrigin(null);
  }, []);
  function headerContextAllowed() {
    if (!active || (product && !product.commands.requestContextChange())) return false;
    return !product?.view.sheet;
  }
  function openProfile() {
    if (!headerContextAllowed() || !canChangeSection) return;
    const origin = avatarOriginRef.current;
    const showingProfile = section === "profile" && (avatarProfileActive || (!accountsWorkspace && !assetWorkspace));
    if (showingProfile) {
      if (origin && product && origin.owner === navigationOwner && matchesProfileInspectionOrigin(origin, product.view)) {
        avatarReturn.current = origin; setAvatarProfileOrigin(null); setProfileMenuOrigin(null); cancelHelpEntry();
        setSection(origin.section, { kind: "profile-inspection", origin }); return;
      }
      if (navigateSection("overview")) avatarAnchor.current?.focus({ preventScroll: true });
      return;
    }
    if (!product) { navigateSection("profile"); return; }
    const root = pageRef.current;
    const scrollport = root?.closest<HTMLElement>("[data-material-scrollport]") ?? root?.ownerDocument.scrollingElement;
    const next: AvatarProfileOrigin = { section, context: product.view.context, snapshot: product.view.snapshot,
      ports: product.view.flowPorts, accounts: product.view.accountsWorkspace, asset: product.view.assetWorkspace,
      scrollTop: scrollport?.scrollTop ?? 0, owner: navigationOwner };
    cancelHelpEntry(); setProfileMenuOrigin(null); setAvatarProfileOrigin(next);
    setSection("profile", { kind: "profile-inspection", origin: next });
  }
  function toggleProfileMenu() {
    if (!product || !canOpenProfileMenu) return;
    if (profileMenuVisible && profileMenuOrigin?.launcher === "menu") { dismissProfileMenu("close"); return; }
    if (!headerContextAllowed()) return;
    cancelHelpEntry();
    setProfileMenuOrigin({ launcher: "menu", section, context: product.view.context,
      snapshot: product.view.snapshot, ports: product.view.flowPorts,
      accounts: product.view.accountsWorkspace, asset: product.view.assetWorkspace });
  }
  function openOverviewHelp() {
    if (!product || !rootOverview || !canOpenProfileMenu) return;
    if (profileMenuVisible && profileMenuOrigin?.launcher === "support") { dismissProfileMenu("close"); return; }
    if (!headerContextAllowed()) return;
    cancelHelpEntry();
    setProfileMenuOrigin({ launcher: "support", section, context: product.view.context,
      snapshot: product.view.snapshot, ports: product.view.flowPorts,
      accounts: product.view.accountsWorkspace, asset: product.view.assetWorkspace });
  }
  function requestProfileMenuTransition() {
    const live = pendingLive.current;
    return matchesProfileMenuOrigin(profileMenuOriginRef.current, live.product, live.section, live.active) &&
      Boolean(live.product?.commands.requestContextChange());
  }
  function navigateSection(next: MonoSection) {
    if (!active || (next !== section && !canChangeSection) ||
      (product && !product.commands.requestContextChange()) || !leaveAccountsWorkspace()) return false;
    product?.commands.closeAsset();
    if (historyInspection?.origin === "pending-account") product?.commands.expandActivity(null);
    pendingReturnFocus.current = next === "overview" &&
      (currentHistoryInspection?.origin === "pending-home" || currentHistoryInspection?.origin === "gold-home") ? currentHistoryInspection : null;
    setHistoryInspection(null);
    setProfileMenuOrigin(null); setAvatarProfileOrigin(null); avatarReturn.current = null;
    if (propsPresentation === "gold") {
      if (next === "assets") setGoldAssetsScope(ALL_WALLET_CONTEXT);
      goldFundsFocusRequest.current = next === "overview" && section === "assets" ? "overview" : null;
    }
    if (next !== section) setSection(next);
    return true;
  }
  function goHome() {
    if (headerContextAllowed()) navigateSection("overview");
  }
  function leaveAccountsWorkspace() {
    if (accountsWorkspace && !product?.commands.closeAccountsWorkspace()) return false;
    cancelHelpEntry();
    accountsOrigin.current = null; accountsFocusRequest.current = null; accountsChildReturn.current = null;
    resetAccountsDisclosure();
    return true;
  }
  function openAccountsWorkspace(groupKind?: ProductAccountKind, launcher: AccountsFocusTarget = { kind: "launcher" }) {
    if (!headerContextAllowed() || !product?.commands.openAccountsWorkspace(groupKind)) return;
    cancelHelpEntry();
    accountsOrigin.current = { section, target: groupKind ? { kind: "pin", groupKind } : launcher };
    accountsFocusRequest.current = { kind: "title" }; accountsChildReturn.current = null;
    resetAccountsDisclosure();
    setProfileMenuOrigin(null); setAvatarProfileOrigin(null); avatarReturn.current = null;
  }
  function inspectAccount(accountId: string) {
    if (active && product?.commands.inspectAccount(accountId)) {
      if (accountsWorkspace?.accountId !== accountId) resetAccountsDisclosure();
      accountsFocusRequest.current = { kind: "title" };
    }
  }
  function selectGoldAssetsContext(next: AccountContext) {
    if (!product || propsPresentation !== "gold" || section !== "assets" || accountsWorkspace || assetWorkspace ||
      !active || product.view.sheet?.kind !== "accounts" || !product.commands.requestContextChange()) return;
    product.commands.selectContext(next);
    setGoldAssetsScope(next);
  }
  function backAccountsWorkspace() {
    if (!active || !accountsWorkspace || !product?.commands.backAccountsWorkspace()) return;
    accountsFocusRequest.current = accountsWorkspace.accountId === null
      ? accountsOrigin.current?.target ?? { kind: "launcher" } : { kind: "account", id: accountsWorkspace.accountId };
    accountsChildReturn.current = null;
    resetAccountsDisclosure();
  }
  function useAccount(accountId: string) {
    if (!active || !canUseAccount || !product?.commands.useAccount(accountId)) return;
    accountsOrigin.current = null; accountsChildReturn.current = null;
    resetAccountsDisclosure();
    accountsFocusRequest.current = { kind: "context" };
    if (propsPresentation === "gold") setGoldAssetsScope({ kind: "account", accountId });
    if (section !== accountDestination) setSection(accountDestination);
  }
  function resetAccountsDisclosure() {
    expandedHoldingSource.current = null; setExpandedHoldingId(null);
  }
  function currentAccountsSource() {
    const current = accountsLive.current;
    return Boolean(active && product && accountsWorkspace && current.active &&
      current.accountsWorkspace === accountsWorkspace && current.section === section &&
      current.snapshot === product.view.snapshot && current.ports === product.view.flowPorts &&
      !current.sheet && !current.assetWorkspace);
  }
  function changeExpandedHolding(holdingId: string | null) {
    if (!currentAccountsSource() || !inspectedAccount) return;
    if (holdingId === null) { resetAccountsDisclosure(); return; }
    const holding = exactAccountHolding(product?.view.snapshot, inspectedAccount.id, holdingId);
    if (!holding) return;
    expandedHoldingSource.current = holdingIdentity(holding); setExpandedHoldingId(holdingId);
  }
  function openAccountRoute(route: ProductActionRoute, origin?: AccountsActionOrigin): boolean {
    if (!currentAccountsSource() || !product || !inspectedAccount || route.accountId !== inspectedAccount.id) return false;
    const key = productRouteKey(route);
    const matches = allowedAccountActions.filter(candidate => productRouteKey(candidate) === key);
    if (matches.length !== 1 || (origin && (origin.routeKey !== key || origin.action !== route.action))) return false;
    let holding: ProductHolding | null = null;
    if (origin?.kind === "holding-action") {
      holding = exactAccountHolding(product.view.snapshot, inspectedAccount.id, origin.holdingId);
      if (!holding || holding.assetId !== route.assetId || holding.networkId !== route.networkId) return false;
    } else if (origin?.kind === "account-action") {
      const placed = product.view.snapshot.holdings.some(candidate => candidate.accountId === route.accountId &&
        candidate.assetId === route.assetId && candidate.networkId === route.networkId);
      if (origin.entry === "receive" ? route.action !== "receive" : route.action === "receive" || placed) return false;
    }
    if (!product.commands.openAccountRoute(matches[0]!)) return false;
    accountsChildReturn.current = { accountId: inspectedAccount.id, target: origin ? { ...origin } : { kind: "title" },
      holding: holding ? holdingIdentity(holding) : null };
    return true;
  }
  function openAccountHolding(holdingId: string) {
    if (!currentAccountsSource() || !product || !inspectedAccount) return;
    const holding = exactAccountHolding(product.view.snapshot, inspectedAccount.id, holdingId);
    if (!holding || !product.commands.openAccountHolding(inspectedAccount.id, holdingId)) return;
    accountsChildReturn.current = { accountId: inspectedAccount.id, target: { kind: "holding-detail", id: holdingId },
      holding: holdingIdentity(holding) };
  }
  function cancelHelpEntry() {
    if (!helpEntryRef.current) return;
    helpEntryRef.current = null; helpOverviewCommitted.current = false; setHelpEntryRequest(null);
  }
  function queueHelpEntry(action: ProductHelpTopicId) {
    if (!active || !product || (section !== "profile" && !profileMenuVisible) || !canChangeSection || product.view.sheet ||
      !product.commands.requestContextChange() || !resolveActionRoutes(product.view.snapshot, product.view.context, action).routes.length) return;
    if (profileMenuVisible && !requestProfileMenuTransition()) return;
    const request: HelpEntryRequest = { action, context: product.view.context,
      snapshot: product.view.snapshot, ports: product.view.flowPorts };
    if (!navigateSection("overview")) return;
    helpOverviewCommitted.current = false; helpEntryRef.current = request; setHelpEntryRequest(request);
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
  const activityFocusRequest = useRef<{
    target: { kind: "activity"; id: string } | { kind: "pending-filter" };
    workingContext: AccountContext;
    snapshot: MonoProductController["view"]["snapshot"]; ports: MonoProductController["view"]["flowPorts"];
  } | null>(null);
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
      (section !== "overview" && (section !== "profile" || helpOverviewCommitted.current)) || product.view.sheet || product.view.commerceBusy ||
      product.view.assetWorkspace || product.view.accountsWorkspace ||
      !resolveActionRoutes(product.view.snapshot, product.view.context, request.action).routes.length) {
      cancelHelpEntry(); return;
    }
    if (section !== "overview") return;
    helpOverviewCommitted.current = true;
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
    helpEntryRef.current = null; helpOverviewCommitted.current = false; setHelpEntryRequest(null);
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
    const destination = goldFundsFocusRequest.current;
    if (!destination || section !== destination || !active || product?.view.sheet || accountsWorkspace || assetWorkspace) return;
    goldFundsFocusRequest.current = null;
    const root = pageRef.current;
    const target = root?.querySelector<HTMLElement>(destination === "assets"
      ? ".mono-gold-assets-back" : "[data-mono-gold-funds-trigger]");
    if (root && target) {
      target.focus({ preventScroll: true });
      revealAccountsTarget(root, target);
    }
  }, [section, active, product?.view.sheet, accountsWorkspace, assetWorkspace]);

  useLayoutEffect(() => {
    const request = avatarReturn.current;
    if (request && section === request.section) {
      avatarReturn.current = null;
      if (!active || !product || request.owner !== navigationOwner || !matchesProfileInspectionOrigin(request, product.view)) return;
      const root = pageRef.current;
      const scrollport = root?.closest<HTMLElement>("[data-material-scrollport]") ?? root?.ownerDocument.scrollingElement;
      if (scrollport) {
        scrollport.scrollTop = request.scrollTop;
        scrollport.dispatchEvent(new Event(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT));
      }
      avatarAnchor.current?.focus({ preventScroll: true });
    } else if (avatarProfileActive && active && !profileMenuVisible) {
      pageRef.current?.querySelector<HTMLElement>("[data-profile-title]")?.focus({ preventScroll: true });
    }
  }, [section, avatarProfileOrigin, active, navigationOwner]);

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
    let childReturn: AccountsChildReturn | null = null;
    if (!target && accountsWorkspace) {
      if (!previous.accountsWorkspace || previous.accountsWorkspace.accountId !== accountsWorkspace.accountId) target = { kind: "title" };
      else if (previous.assetWorkspace || previous.sheet) {
        childReturn = accountsChildReturn.current;
        target = childReturn?.accountId === accountsWorkspace.accountId ? childReturn.target : { kind: "title" };
      }
    }
    if (!target && previous.accountsWorkspace && !accountsWorkspace && accountsOrigin.current !== null &&
      previous.ports !== product?.view.flowPorts) target = accountsOrigin.current.target;
    if (!target) return;
    accountsFocusRequest.current = null;
    const focusTarget = target;
    const focus = () => {
      const current = accountsLive.current, root = pageRef.current;
      if (!root || !current.active || current.sheet || current.assetWorkspace ||
        current.accountsWorkspace !== accountsWorkspace || current.section !== section) return;
      const visible = (candidate: HTMLElement | null | undefined): candidate is HTMLElement => Boolean(candidate?.isConnected &&
        !candidate.closest("[hidden], [inert], [aria-hidden='true']") && !candidate.matches(":disabled") &&
        getComputedStyle(candidate).display !== "none" && getComputedStyle(candidate).visibility !== "hidden");
      const byAttribute = (attribute: string, value: string) => [...root.querySelectorAll<HTMLElement>(`[${attribute}]`)]
        .find(candidate => candidate.getAttribute(attribute) === value && visible(candidate));
      const holding = childReturn?.holding;
      const currentHolding = childReturn && holding && childReturn.accountId === current.accountsWorkspace?.accountId
        ? exactAccountHolding(current.snapshot, childReturn.accountId, holding.id) : null;
      const validHolding = Boolean(holding && sameHoldingIdentity(currentHolding, holding));
      let requested = focusTarget;
      if (holding && !validHolding) requested = { kind: "title" };
      else if (requested.kind === "holding-action" || requested.kind === "account-action") {
        const origin = requested;
        const matchingRoutes = current.snapshot && current.accountsWorkspace?.accountId
          ? resolveActionRoutes(current.snapshot, { kind: "account", accountId: current.accountsWorkspace.accountId }, origin.action)
            .routes.filter(route => productRouteKey(route) === origin.routeKey) : [];
        if (matchingRoutes.length !== 1) requested = validHolding && holding
          ? { kind: "holding", id: holding.id } : { kind: "title" };
      }
      let element: HTMLElement | null | undefined;
      if (requested.kind === "launcher") element = profileMenuAnchor.current;
      else if (requested.kind === "pin") element = byAttribute("data-product-account-group-trigger", requested.groupKind);
      else if (requested.kind === "context") element = root.querySelector<HTMLElement>("[data-mono-product-context-trigger]")
        ?? root.querySelector<HTMLElement>('.mono-nav__item[aria-current="page"]');
      else if (requested.kind === "holding-action") {
        const holdingId = requested.holdingId;
        const actionTarget = (action: string) => [...root.querySelectorAll<HTMLElement>("[data-product-holding-action-id]")]
          .find(candidate => candidate.dataset.productHoldingActionId === holdingId &&
            candidate.dataset.productHoldingAction === action && visible(candidate));
        element = actionTarget(requested.action);
        if (!element && (requested.action === "buy" || requested.action === "swap")) element = actionTarget("more");
      } else if (requested.kind === "account-action") element = byAttribute("data-product-account-entry", requested.entry);
      else if (requested.kind !== "title") {
        const attribute = requested.kind === "account" ? "data-product-account-id"
          : requested.kind === "holding-detail" ? "data-product-holding-detail-id" : "data-product-holding-id";
        element = byAttribute(attribute, requested.id);
      }
      if (!visible(element) && validHolding && holding) element = byAttribute("data-product-holding-id", holding.id);
      if (!visible(element)) element = [...root.querySelectorAll<HTMLElement>("[data-mono-product-accounts-title]")].find(visible);
      if (!visible(element)) element = root.querySelector<HTMLElement>("[data-mono-product-overview-title]");
      if (!visible(element) && visible(profileMenuAnchor.current)) element = profileMenuAnchor.current;
      if (visible(element)) { element.focus({ preventScroll: true }); revealAccountsTarget(root, element); }
      if (!accountsWorkspace) accountsOrigin.current = null;
    };
    // Existing flow cleanup restores its own launcher in a microtask; the exact account origin wins afterwards.
    if (previous.sheet) queueMicrotask(focus); else focus();
  }, [accountsWorkspace, assetWorkspace, section, active, product?.view.sheet, product?.view.flowPorts, product?.view.snapshot]);

  useEffect(() => {
    if (!active || avatarProfileActive || !accountsWorkspace || !product || profileMenuVisible || product.view.sheet) return;
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

  function openActivity(id: string, pendingStatus?: HistoryFilterRequest["status"]) {
    if (!product) return false;
    const scope = product.view.sheet?.kind === "intent" ? product.view.sheet.scope
      ?? (product.view.sheet.route ? { kind: "account" as const, accountId: product.view.sheet.route.accountId } : assetWorkspace?.scope)
      : rootOverview ? ALL_WALLET_CONTEXT : assetWorkspace?.scope;
    return enterHistory(id, scope, pendingStatus);
  }

  function enterHistory(id: string | null, scope?: AccountContext, pendingStatus?: HistoryFilterRequest["status"]) {
    if (!product || (section !== "history" && !canChangeSection) || !product.commands.requestContextChange()) return false;
    if (!leaveAccountsWorkspace()) return false;
    setHistoryInspection(scope ? { scope, workingContext: product.view.context,
      snapshot: product.view.snapshot, ports: product.view.flowPorts,
      ...(pendingStatus ? { origin: "pending-home" as const,
        filterRequest: { revision: ++historyFilterRevision.current, status: pendingStatus } }
        : propsPresentation === "gold" && rootOverview ? { origin: "gold-home" as const, ...(id ? { homeActivityId: id } : {}) } : {}) } : null);
    activityFocusRequest.current = { target: id === null ? { kind: "pending-filter" } : { kind: "activity", id },
      workingContext: product.view.context, snapshot: product.view.snapshot, ports: product.view.flowPorts };
    product.commands.expandActivity(id);
    product.commands.closeSheet();
    setSection("history");
    return true;
  }

  function openPendingActivity(activityId: string | null): PendingActivityOpenResult {
    const live = pendingLive.current, current = live.product;
    if (!current || !live.active || !live.rootOverview || current.view.sheet) return "blocked";
    if (!product || current.view.snapshot !== product.view.snapshot || current.view.flowPorts !== product.view.flowPorts ||
      current.view.context !== product.view.context || current.view.activityStatus !== "ready") return "unavailable";
    const gold = propsPresentation === "gold";
    const scope = ALL_WALLET_CONTEXT;
    const activities = current.view.activities;
    const pendingIds = gold && activityId === null ? selectPendingActivityIds(activities) : null;
    const entries = gold && activityId === null
      ? activities.filter(activity => activity.status === "pending" && pendingIds?.includes(activity.id)) : activities;
    const target = resolvePendingActivityEntry(entries, activityId);
    const ids = target.kind === "single" ? [target.activityId] : pendingIds ?? [];
    const invalidGoldSource = gold && ids.some(id => current.view.activities.filter(activity => activity.id === id).length !== 1);
    if (target.kind === "unavailable" || invalidGoldSource) {
      pageRef.current?.querySelector<HTMLElement>("[data-mono-product-overview-title]")?.focus({ preventScroll: true });
      return "unavailable";
    }
    const entered = target.kind === "single" ? openActivity(target.activityId, target.status) : enterHistory(null, scope, "pending");
    return entered ? "opened" : "blocked";
  }

  function openAccountPendingActivity(accountId: string, activityId: string | null): PendingActivityOpenResult {
    const live = pendingLive.current, current = live.product, workspace = live.accountsWorkspace;
    if (!current || !live.active || current.view.sheet || live.accountHistoryOpen) return "blocked";
    if (!product || current.view.snapshot !== product.view.snapshot || current.view.flowPorts !== product.view.flowPorts ||
      current.view.context !== product.view.context || current.view.activityStatus !== "ready" || !workspace || workspace.accountId !== accountId)
      return "unavailable";
    const accounts = current.view.snapshot.accounts.filter(account => account.id === accountId);
    if (accounts.length !== 1 || (workspace.groupKind && accounts[0]!.kind !== workspace.groupKind)) return "unavailable";
    const scoped = scopeProductActivities(current.view.activities, [accountId]);
    const target = resolvePendingActivityEntry(scoped, activityId);
    const ids = activityId === null ? scoped.map(activity => activity.id) : [activityId];
    if (target.kind === "unavailable" || ids.some(id => current.view.activities.filter(activity => activity.id === id).length !== 1))
      return "unavailable";
    if ((live.section !== "history" && !live.canChangeSection) || !current.commands.requestContextChange()) return "blocked";
    const root = pageRef.current, scrollport = root?.closest<HTMLElement>("[data-material-scrollport]") ?? root?.ownerDocument.scrollingElement;
    setHistoryInspection({ scope: { kind: "account", accountId }, workingContext: current.view.context,
      snapshot: current.view.snapshot, ports: current.view.flowPorts, origin: "pending-account",
      accountOrigin: { workspace, section: live.section, scrollTop: scrollport?.scrollTop ?? 0 },
      filterRequest: { revision: ++historyFilterRevision.current, status: target.kind === "single" ? target.status : "pending" } });
    activityFocusRequest.current = { target: target.kind === "single" ? { kind: "activity", id: target.activityId } : { kind: "pending-filter" },
      workingContext: current.view.context, snapshot: current.view.snapshot, ports: current.view.flowPorts };
    current.commands.expandActivity(target.kind === "single" ? target.activityId : null);
    if (live.section === "history" && scrollport) {
      scrollport.scrollTop = 0; scrollport.dispatchEvent(new Event(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT));
    }
    setSection("history", { kind: "account-history", workspace });
    return "opened";
  }

  function backToPendingAccount() {
    const origin = currentHistoryInspection, accountOrigin = origin?.accountOrigin;
    const live = pendingLive.current, current = live.product;
    if (!origin || !accountOrigin || !current || !live.active || current.view.sheet ||
      current.view.snapshot !== origin.snapshot || current.view.flowPorts !== origin.ports || current.view.context !== origin.workingContext ||
      (live.section !== accountOrigin.section && !live.canChangeSection) ||
      live.accountsWorkspace !== accountOrigin.workspace || !current.commands.requestContextChange()) return;
    const matches = current.view.snapshot.accounts.filter(account => account.id === accountOrigin.workspace.accountId);
    if (matches.length === 1) pendingReturnFocus.current = origin;
    else accountsFocusRequest.current = { kind: "title" };
    current.commands.expandActivity(null); setHistoryInspection(null);
    setSection(accountOrigin.section, { kind: "account-history", workspace: accountOrigin.workspace });
  }

  useLayoutEffect(() => {
    if (!accountHistoryOpen || currentHistoryInspection || !historyInspection?.accountOrigin || !product ||
      !product.commands.requestContextChange()) return;
    activityFocusRequest.current = null; pendingReturnFocus.current = null;
    product.commands.expandActivity(null);
    setHistoryInspection(null);
    if (section === "history" && canChangeSection) setSection(historyInspection.accountOrigin.section);
  }, [accountHistoryOpen, currentHistoryInspection, historyInspection, section, canChangeSection, setSection, product]);

  useLayoutEffect(() => {
    const request = activityFocusRequest.current;
    if (!request || section !== "history") return;
    activityFocusRequest.current = null;
    // Run after the removed modal's focus-return microtask. Never refocus on ordinary renders.
    queueMicrotask(() => {
      const root = pageRef.current, live = pendingLive.current;
      if (!root || live.section !== "history" || !live.active || live.product?.view.snapshot !== request.snapshot ||
        live.product.view.flowPorts !== request.ports || live.product.view.context !== request.workingContext || live.product.view.sheet) return;
      let target: HTMLElement | null | undefined;
      if (request.target.kind === "activity") {
        const id = request.target.id;
        const matches = [...root.querySelectorAll<HTMLElement>("[data-product-activity-id]")]
          .filter(element => element.dataset.productActivityId === id && !element.closest("[hidden], [inert]"));
        if (matches.length === 1) target = matches[0];
      } else target = root.querySelector<HTMLElement>("[data-history-status-trigger]");
      target ??= root.querySelector<HTMLElement>("[data-product-history-title]");
      if (target) { target.focus({ preventScroll: true }); revealAccountsTarget(root, target); }
    });
  }, [section, product?.view.expandedActivityId, product?.view.sheet, currentHistoryInspection]);

  useLayoutEffect(() => {
    const origin = pendingReturnFocus.current;
    if (!origin || !active || !product || product.view.sheet) return;
    const accountOrigin = origin.origin === "pending-account" ? origin.accountOrigin : undefined;
    if (accountOrigin ? accountHistoryOpen || accountsWorkspace !== accountOrigin.workspace : !rootOverview) return;
    pendingReturnFocus.current = null;
    if (origin.snapshot !== product.view.snapshot || origin.ports !== product.view.flowPorts || origin.workingContext !== product.view.context) return;
    const root = pageRef.current;
    const accountRoot = accountOrigin && root ? [...root.querySelectorAll<HTMLElement>("[data-mono-product-accounts-workspace]")]
      .find(element => element.getAttribute("data-mono-product-accounts-workspace") === accountOrigin.workspace.accountId && !element.closest("[hidden], [inert]")) : null;
    const target = accountOrigin ? accountRoot?.querySelector<HTMLElement>("[data-product-pending-trigger]")
      ?? accountRoot?.querySelector<HTMLElement>("[data-mono-product-accounts-title]")
      : origin.origin === "gold-home" ? [...root?.querySelectorAll<HTMLElement>("[data-product-activity-id]") ?? []]
        .find(element => element.dataset.productActivityId === origin.homeActivityId && !element.closest("[hidden], [inert]"))
        ?? root?.querySelector<HTMLElement>("[data-mono-product-overview-title]")
      : root?.querySelector<HTMLElement>("[data-product-pending-trigger]") ?? root?.querySelector<HTMLElement>("[data-mono-product-overview-title]");
    if (accountOrigin && root) {
      const scrollport = root.closest<HTMLElement>("[data-material-scrollport]") ?? root.ownerDocument.scrollingElement;
      if (scrollport) { scrollport.scrollTop = accountOrigin.scrollTop; scrollport.dispatchEvent(new Event(MATERIAL_VIEWPORT_MOTION_REBASE_EVENT)); }
    }
    if (root && target) { target.focus({ preventScroll: true }); revealAccountsTarget(root, target); }
  }, [rootOverview, active, product?.view.sheet, product?.view.snapshot, product?.view.flowPorts, product?.view.context,
    accountsWorkspace, accountHistoryOpen, section]);

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
    const staticMotion = () => { surface.dataset.monoMotion = "static"; surface.dataset.monoDisclosureMotion = "static"; };
    if (!view || !active || effectsDisabled) { staticMotion(); return staticMotion; }
    const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (view.navigator as Navigator & { connection?: EventTarget & { readonly saveData?: boolean } }).connection;
    let intersecting = typeof view.IntersectionObserver !== "function";
    const sync = () => {
      const interactionReady = doc.visibilityState !== "hidden" && !reduced.matches && !connection?.saveData && intersecting;
      surface.dataset.monoDisclosureMotion = interactionReady ? "ready" : "static";
      surface.dataset.monoMotion = interactionReady && !appearance.background?.calm ? "ready" : "static";
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
  const chart = (propsPresentation !== "gold" || goldBalanceDynamics?.enabled) &&
    (!product || (product.view.usesDefaultDemoChart && (rootOverview || product.view.context.kind === "all"))) && fullScene && appearance.chart &&
    <MonoChart values={snapshot.chart[period]} format={moneyFormat}
    hidden={balanceHidden} period={period} onPeriodChange={setPeriod} appearance={appearance.chart} />;
  const receiveMenuOpen = product?.view.sheet?.kind === "intent" && product.view.sheet.action === "receive" && !product.view.sheet.route;
  const sendMenuOpen = product?.view.sheet?.kind === "intent" && product.view.sheet.action === "send" &&
    !product.view.sheet.route && !product.view.sheet.placementId;
  const productModalOpen = Boolean(product?.view.sheet && product.view.sheet.kind !== "battery" &&
    product.view.sheet.kind !== "accounts" && !receiveMenuOpen && !sendMenuOpen);
  return (
      <ProductGlassProvider sharedHost={opticalHost} preset={preset} settings={optics}
        active={active && !effectsDisabled} opaque={effectsDisabled}>
        <main ref={node => { pageRef.current = node; if (surfaceRef) surfaceRef.current = node; }}
          className="mono-page" data-mono-preview data-mono-preset={preset} data-mono-presentation={propsPresentation}
          data-mono-logo-variant={logoPreview.variant} data-mono-logo-custom={logoPreview.customColor}
          data-palette-enabled={Boolean(palette.enabled)} data-palette-ready={paletteReady} style={shapeStyle}
          data-mono-theme={theme} data-mono-background={background} data-mono-viewport={viewport}
          data-mono-section={section}
          data-mono-product={product ? "true" : undefined}
          data-mono-motion="static" data-mono-disclosure-motion="static" data-nav-indicator={navigation.indicator}
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
          <div className="mono-header-brand">
          <button type="button" className="mono-app-header__mark" aria-label="На главную" onClick={goHome}
            disabled={!active || Boolean(product?.view.sheet) || (section !== "overview" && !canChangeSection)}
            title={section !== "overview" && !canChangeSection ? "Переход к обзору недоступен." : undefined}>
            <MonoLogo />
          </button>
          {product && rootOverview && <button ref={supportAnchor} type="button" className="mono-support-trigger"
            aria-label="Поддержка" aria-haspopup="dialog" aria-controls={profileMenuId}
            aria-expanded={profileMenuVisible && profileMenuOrigin?.launcher === "support"}
            data-mono-support-trigger data-motion={active && !effectsDisabled && !appearance.background?.calm}
            disabled={!canOpenProfileMenu} onClick={openOverviewHelp}><MenuIcon name="support" /></button>}
          </div>
          <div className={profileMenuStyles.headerControls} inert={!active} aria-hidden={!active || undefined}>
          <AvatarControl ref={avatarAnchor} aria-label={section === "profile" && (avatarProfileActive || (!accountsWorkspace && !assetWorkspace)) ? "Закрыть профиль" : "Открыть профиль"}
            disabled={!active || !canChangeSection || Boolean(product?.view.sheet) || Boolean(product?.view.commerceBusy)}
            aria-current={section === "profile" ? "page" : undefined}
            avatarSrc={profileDemoSession.avatarSrc}
            fallback={profileDemoSession.profile.name} motionEnabled={active && !effectsDisabled && !appearance.background?.calm}
            onClick={openProfile} />
          </div>
        </header>
        {product && !(rootOverview && propsPresentation === "gold") && <ProductContextLine {...product} view={rootOverview ? overviewProduct!.view : assetWorkspace ? assetView!
          : section === "history" ? historyView! : section === "assets" && !accountsWorkspace ? assetsProduct!.view : product.view}
          overview={rootOverview} accountChooserId={accountChooserId} />}

        {product && accountsWorkspace && !assetWorkspace && <div className="mono-product-section" inert={!active || avatarProfileActive || Boolean(currentHistoryInspection && accountHistoryOpen)}
          hidden={avatarProfileActive || Boolean(currentHistoryInspection && accountHistoryOpen)}>
          <ProductAccountsWorkspace snapshot={product.view.snapshot} selectedAccountId={accountsWorkspace.accountId}
            groupKind={accountsWorkspace.groupKind}
            context={product.view.context} balanceHidden={product.view.balanceHidden} allowedActions={allowedAccountActions}
            expandedHoldingId={currentExpandedHoldingId} onExpandedHoldingChange={changeExpandedHolding}
            onInspectAccount={inspectAccount} onBack={backAccountsWorkspace} onUseAccount={useAccount}
            useAccountUnavailableReason={canUseAccount ? undefined : propsPresentation === "gold"
              ? "Переход к активам сейчас недоступен." : "Переход к обзору сейчас недоступен."}
            onOpenAction={openAccountRoute} onOpenHolding={openAccountHolding}
            pendingActivity={inspectedAccount ? { activities: product.view.activities, accountId: inspectedAccount.id,
              status: product.view.activityStatus, disabled: !active || Boolean(product.view.sheet) || product.view.commerceBusy,
              onRetry: product.commands.retryActivities, onOpen: id => openAccountPendingActivity(inspectedAccount.id, id) } : undefined} />
        </div>}
        {product && assetWorkspace && <div className="mono-product-section" hidden={avatarProfileActive} inert={avatarProfileActive || !active}><ProductAssetWorkspace
          presentation={propsPresentation} view={assetView!} assetId={assetWorkspace.assetId} selectedHoldingId={assetWorkspace.holdingId}
          onSelectHolding={product.commands.selectAssetHolding} onBack={product.commands.closeAsset}
          backLabel={accountsWorkspace ? inspectedAccount ? `Назад к счёту ${inspectedAccount.label}` : "Назад к счёту" : undefined}
          onPlacementAction={product.commands.openPlacementAction} onExpandActivity={product.commands.expandActivity}
          onRetryActivities={product.commands.retryActivities} /></div>}
        {section === "overview" && !assetWorkspace && !accountsWorkspace && <>
        {product ? <section className="mono-hero">
          <div className="mono-scene-domain">
            {propsPresentation === "gold" ? <MonoGoldAccountDeck {...overviewProduct!}
              appearance={appearance.balance ?? MONO_BALANCE_LEGACY} blinkEnabled={eye.blinkEnabled} />
              : <ProductOverview {...overviewProduct!} appearance={appearance.balance ?? MONO_BALANCE_LEGACY}
                blinkEnabled={eye.blinkEnabled} onOpenGroup={openAccountsWorkspace} />}
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
              label={action.label} path={propsPresentation === "gold" && action.kind !== "send" &&
                actionArtwork[action.id].packId === "original" && !materialTargets ? GOLD_ACTION_PATHS[action.id] : action.path}
              preset={product && quickActionPreset === MONO_QUICK_ACTION_DEFAULT
                ? MONO_PRODUCT_QUICK_ACTION_DEFAULT : quickActionPreset}
              accessibleLabel={product ? action.label : undefined}
              productAction={Boolean(product)}
              productPrimary={Boolean(product && (action.kind === "send" || action.kind === "receive"))}
              productReceiveExpanded={product && action.kind === "receive" ? Boolean(receiveMenuOpen) : undefined}
              productSendExpanded={product && action.kind === "send" ? Boolean(sendMenuOpen) : undefined}
              actionId={action.id} artwork={actionArtwork[action.id]} active={active && !effectsDisabled}
              manualPreviewTrigger={artworkPreview?.targetId === action.id ? artworkPreview.trigger : 0}
              materialTargetId={materialTargets ? action.id : undefined}
              materialRadiusCss={actionFrameMode === "separate" ? actionRadii?.[action.id] : undefined}
              onActivate={() => product ? overviewProduct!.commands.openIntent(action.kind)
                : setQuickActionStatus(`${action.label} — операция недоступна в демо.`)} />
          ))}
          <p id="mono-actions-status" className="mono-actions__status" role="status"
            aria-label="Статус быстрых действий" aria-live="polite">{product
              ? "Демо · операции не выполняются" : quickActionStatus}</p>
        </section>

        {product && appearance.layout?.chartPosition === "top" && chart &&
          <div className="mono-scene-domain mono-scene-domain--chart mono-product-chart">{chart}</div>}
        {product && propsPresentation === "gold" && <button type="button" className="mono-gold-funds-entry"
          data-mono-gold-funds-trigger disabled={!active || !canChangeSection || Boolean(product.view.sheet) || product.view.commerceBusy}
          onClick={() => { if (navigateSection("assets")) goldFundsFocusRequest.current = "assets"; }}>
          <WalletIcon name="portfolio" /><span>Мои средства</span>
          <svg className="mono-gold-funds-entry__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m6 4 4 4-4 4" /></svg>
        </button>}
        {product && propsPresentation !== "gold" && <ProductHoldings {...overviewProduct!} overview onPlacementAction={product.commands.openPlacementAction}
          onOpenAsset={overviewProduct!.commands.openAsset}
          appearance={appearance.assets ?? MONO_ASSET_LIST_DEFAULT} />}
        {product && (propsPresentation !== "gold" || product.view.activityStatus !== "ready" ||
          selectPendingActivityIds(product.view.activities)?.length !== 0) && <div className="mono-product-recent">
          <ProductPendingActivity activities={product.view.activities} status={product.view.activityStatus} disabled={!active}
            onOpen={openPendingActivity} onRetry={product.commands.retryActivities} />
          {propsPresentation !== "gold" && product.view.activityStatus === "ready" && <ProductRecentActivity
            activities={product.view.activities} balanceHidden={product.view.balanceHidden}
            onOpenActivity={openActivity} />}
        </div>}

        {propsPresentation !== "gold" && <div className="mono-promo-frame">
          <MonoOpticalGlass preset={preset} settings={optics} active={active} className="mono-promo" sharedHost={opticalHost}>
            <div className="mono-promo__content">
              <span className="mono-promo__overline">NOVEX WALLET / PRIVATE</span>
              <strong>Контроль<br />без шума.</strong>
              <span className="mono-promo__foot">МАТЕРИАЛ / 001 <span aria-hidden="true">↗</span></span>
            </div>
            <div className="mono-promo__seal" aria-hidden="true" />
          </MonoOpticalGlass>
        </div>}

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
          {propsPresentation === "gold" && <button type="button" className="mono-gold-assets-back"
            disabled={!active || !canChangeSection} onClick={() => navigateSection("overview")}>Назад в обзор</button>}
          <div className="mono-section-view__eyebrow">ПОРТФЕЛЬ / DEMO</div>
          <h1 id="mono-all-assets-title">{propsPresentation === "gold" && assetsProduct?.view.context.kind === "account"
            ? "Активы счёта" : "Все активы"}</h1>
          <div className="mono-section-view__balance"><span>{assetsProduct?.view.context.kind === "account" ? "Баланс счёта" :
            "Общий баланс"}</span>
            <strong>{balanceHidden ? "••••••" : assetsProduct ? formatFiatMinor(assetsProduct.view.balanceMinor) : `${balance} $`}</strong></div>
          {product ? <ProductHoldings {...assetsProduct!} overview={false} onPlacementAction={product.commands.openPlacementAction}
            onOpenAsset={assetsProduct!.commands.openAsset}
            appearance={appearance.assets ?? MONO_ASSET_LIST_DEFAULT} /> : <div className="mono-section-view__assets mono-scene-domain">
            <MonoAssetList assets={snapshot.assets} format={moneyFormat} hidden={balanceHidden}
              appearance={appearance.assets ?? MONO_ASSET_LIST_DEFAULT} />
          </div>}
          <p className="mono-section-view__note">{product ? "Демонстрационные данные. Операции не выполняются."
            : "Демонстрационные данные. Операции недоступны."}</p>
        </section>}
        {section === "history" && product && (!accountsWorkspace || accountHistoryOpen) && (!accountHistoryOpen || currentHistoryInspection) &&
          <div className="mono-product-section" inert={!active}>
          {currentHistoryInspection?.unavailable && <p role="status">Операция сейчас недоступна</p>}
          <ProductHistory
          presentation={propsPresentation} activities={product.view.activities} balanceHidden={product.view.balanceHidden}
          accountId={historyView!.context.kind === "account" ? historyView!.context.accountId : undefined}
          accountLabel={historyView!.account?.label} expandedActivityId={(historyInspection?.origin === "pending-home" ||
            historyInspection?.origin === "gold-home") && !currentHistoryInspection
            ? null : product.view.expandedActivityId}
          filterRequest={currentHistoryInspection?.filterRequest}
          onBackToOverview={currentHistoryInspection?.origin === "pending-home" || currentHistoryInspection?.origin === "gold-home"
            ? () => navigateSection("overview") : undefined}
          onBackToAccount={currentHistoryInspection?.origin === "pending-account" ? backToPendingAccount : undefined}
          onExpandedActivityChange={id => {
            const live = pendingLive.current, current = live.product;
            if (!active || !live.active || !current) return;
            if (currentHistoryInspection?.origin === "pending-account" &&
              (!live.accountHistoryOpen || current.view.snapshot !== currentHistoryInspection.snapshot ||
                current.view.flowPorts !== currentHistoryInspection.ports || current.view.context !== currentHistoryInspection.workingContext ||
                live.accountsWorkspace !== currentHistoryInspection.accountOrigin?.workspace)) return;
            if (!current.commands.requestContextChange()) return;
            if (currentHistoryInspection?.origin === "pending-account" && id !== null) {
              const accountId = currentHistoryInspection.accountOrigin?.workspace.accountId;
              const scoped = scopeProductActivities(current.view.activities, accountId ? [accountId] : []);
              if (current.view.snapshot.accounts.filter(account => account.id === accountId).length !== 1 ||
                resolvePendingActivityEntry(scoped, id).kind === "unavailable" ||
                current.view.activities.filter(activity => activity.id === id).length !== 1) {
                current.commands.expandActivity(null);
                setHistoryInspection(current => current ? { ...current, unavailable: true } : null); return;
              }
              setHistoryInspection(current => current?.unavailable ? { ...current, unavailable: false } : current);
            }
            if ((historyInspection?.origin === "pending-home" || historyInspection?.origin === "gold-home") && !currentHistoryInspection)
              setHistoryInspection(null);
            current.commands.expandActivity(id);
          }} status={product.view.activityStatus}
          onRetry={product.commands.retryActivities} /></div>}
        {section === "history" && !product && <section className="mono-section-view" aria-labelledby="mono-history-title">
          <div className="mono-section-view__eyebrow">ОПЕРАЦИИ / DEMO</div>
          <h1 id="mono-history-title">История операций</h1>
          <div className="mono-section-view__empty"><span aria-hidden="true">↗</span>
            <strong>История операций пока не подключена</strong>
            <p>Эта демо-сцена не загружает операции. Быстрые действия не совершают переводы.</p></div>
        </section>}
        {section === "profile" && product && (avatarProfileActive || (!accountsWorkspace && !assetWorkspace)) && <div className="mono-product-section"
          inert={profileMenuVisible} aria-hidden={profileMenuVisible || undefined}><ProductProfile
          profile={snapshot.profile} session={profileDemoSession} avatarSrc={profileDemoSession.avatarSrc}
          balanceHidden={product.view.balanceHidden}
          onBalanceHiddenChange={product.commands.setBalanceHidden}
          helpActions={productHelpActions} resource={currentProfileResource} balanceDynamics={goldBalanceDynamics}
          theme={theme} onThemeChange={session?.onThemeChange} /></div>}
        {section === "profile" && !product && <div className="mono-product-section"><ProductProfile
          profile={snapshot.profile} session={profileDemoSession} avatarSrc={profileDemoSession.avatarSrc}
          resource={currentProfileResource} balanceHidden={balanceHidden}
          onBalanceHiddenChange={setBalanceHidden} theme={theme} balanceDynamics={goldBalanceDynamics} /></div>}
      </div>

      <nav className="mono-nav" aria-label="Разделы кошелька" inert={productModalOpen || Boolean(product && !active)}>
        {NAV_ITEMS.map(item => product && item.id === "profile" ? (
          <button ref={profileMenuAnchor} className="mono-nav__item" type="button" key="menu" data-active="false"
            aria-haspopup="dialog" aria-expanded={profileMenuVisible && profileMenuOrigin?.launcher === "menu"} aria-controls={profileMenuId}
            data-profile-quick-menu-trigger disabled={!canOpenProfileMenu} onClick={toggleProfileMenu}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6h14M5 12h14M5 18h14" /></svg>
            <span>Меню</span>
          </button>
        ) : (
          <button className="mono-nav__item" type="button" data-active={section === item.id ? "true" : "false"}
            aria-current={section === item.id ? "page" : undefined} key={item.id}
            onClick={() => navigateSection(item.id)}>
            {propsPresentation === "gold" && (item.id === "overview" || item.id === "assets")
              ? <WalletIcon name={item.id === "overview" ? "home" : "portfolio"} />
              : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.path} /></svg>}
            <span>{item.label}</span>
            <span className="mono-nav__indicator" aria-hidden="true"><i className="mono-nav__glint" /></span>
          </button>
        ))}
      </nav>
      {product && <ProfileQuickMenu key={profileMenuOrigin?.launcher ?? "menu"} id={profileMenuId} open={profileMenuVisible}
        anchorRef={profileMenuOrigin?.launcher === "support" ? supportAnchor : profileMenuAnchor}
        initialDetail={profileMenuOrigin?.launcher === "support" ? "support" : undefined}
        viewerPresentation={profileMenuOrigin?.launcher === "menu" ? propsPresentation ?? "mono" : undefined}
        balanceDynamics={goldBalanceDynamics}
        homePins={propsPresentation === "gold" ? undefined : { groups: product.view.accountGroups, pinnedKinds: product.view.homePinnedKinds,
          totalOnly: product.view.homeTotalOnly, onToggle: product.commands.toggleHomePin, onTotalOnlyChange: product.commands.setHomeTotalOnly }}
        resource={currentProfileResource} helpActions={productHelpActions}
        onRequestDetail={requestProfileMenuTransition} onBackRequest={requestProfileMenuTransition}
        theme={theme} onThemeChange={session?.onThemeChange} balanceHidden={product.view.balanceHidden}
        onBalanceHiddenChange={product.commands.setBalanceHidden} onDismiss={dismissProfileMenu}
        onOpenAccounts={() => openAccountsWorkspace()}
        motionEnabled={active && !effectsDisabled && !appearance.background?.calm} />}
      {product && <ProductOverlay {...product} commands={propsPresentation === "gold" && section === "assets" && !accountsWorkspace && !assetWorkspace
        ? { ...product.commands, selectContext: selectGoldAssetsContext } : product.commands} view={productViewForScope(product.view,
        product.view.sheet?.kind === "intent" || product.view.sheet?.kind === "battery"
          ? product.view.sheet.scope ?? assetWorkspace?.scope : propsPresentation === "gold" && section === "assets" && !accountsWorkspace && !assetWorkspace
            ? goldAssetsScope : undefined)}
        onOpenActivity={openActivity} accountChooserId={accountChooserId} active={active} />}
        </main>
      </ProductGlassProvider>
  );
}
