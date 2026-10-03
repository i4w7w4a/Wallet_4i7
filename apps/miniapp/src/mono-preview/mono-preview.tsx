"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ChartPeriod, WalletSnapshot } from "@wallet/core";
import { CHANNEL_NAME, parseApplyRequest, parseApplyRequestEnvelope, type ApplyAck, type ApplyLaunch } from "../design-lab/control-feedback-handoff";
import type { ControlFeedbackPreset } from "../design-lab/control-feedback-model";
import {
  MONO_GLASS_DEFAULTS,
  normalizeMonoGlassSettings,
  type MonoGlassSettings,
} from "@wallet/ui";

import { MonoGlassTuner } from "./mono-glass-tuner";
import { loadMonoLogoPreview, normalizeMonoLogoHue,
  MONO_LOGO_PREVIEW_DEFAULTS, resolveMonoLogoColors, type MonoLogoPreview } from "./mono-logo-preview";
import { MonoColorLab, MonoColorInspector, useMonoColorLab } from "./mono-color-lab";
import { createMonoPaletteWorkspace, enableMonoPalette, switchMonoPaletteTheme } from "./mono-palette-workspace";
import { MonoPresetLibrary } from "./mono-preset-library";
import { MonoShapeTuner } from "./mono-shape-tuner";
import { MONO_QUICK_ACTION_DEFAULT } from "./mono-quick-action-feedback";
import { MonoWorkingPresetBar } from "./mono-working-preset-bar";
import { createFirstMonoWorkingDocument } from "./mono-first-button-preset";
import { saveMonoPalettePrepaint } from "./mono-palette-prepaint";
import { MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY, loadMonoPaletteLibrary,
  loadMonoPaletteActive, readMonoPaletteWorkspace, saveMonoPaletteWorkspace } from "./mono-palette-storage";
import {
  createLegacyPaletteWorkingRecords,
  createMonoWorkingDocument,
  exportMonoWorkingPreset,
  loadMonoSevenLibrary,
  migrateMonoSevenLibrary,
  MONO_SEVEN_PRESETS_KEY,
  MONO_WORKING_PRESETS_KEY,
  MONO_WORKING_PRESETS_LEGACY_KEY,
  MonoWorkingStoreError,
  replaceMonoSevenSlot,
  restoreMonoArchivedRecord,
  saveMonoSevenLibrary,
  MONO_SEVEN_SLOTS,
  type MonoWorkingDocument,
  type MonoSevenLibrary,
  type MonoSevenSlot,
  type MonoWorkingImport,
} from "./mono-working-presets";
import {
  createMonoShapeDefaults,
  loadMonoShapeCandidateFrom,
  MONO_SHAPE_STORAGE_KEY,
  normalizeMonoShapeMap,
  type MonoShapeGroup,
  type MonoShapeMap,
} from "./mono-shape-preview";
import { MonoProductScene } from "./mono-product-scene";
import type { MonoSection } from "./mono-scene";
import { useMonoSceneActivity } from "./mono-scene-activity";
import { MonoToolDock, MONO_TOOL_LABELS, type MonoToolId } from "./mono-tool-dock";
import { MonoInspectorShell } from "./mono-inspector-shell";
import { MonoLabSection } from "./mono-lab-controls";
import { MonoBalanceControls, MonoAssetListControls, MonoChartControls } from "./mono-scene-lab-controls";
import { MonoNavigationControls } from "./mono-interface-controls";
import { MonoBackgroundRecipeControls } from "./mono-background-recipes-controls";
import { MonoTypographyTuner } from "./mono-typography-tuner";
import { loadMonoTypography } from "./mono-font-loader";
import type { MonoTypographyConfigV1 } from "./mono-typography";
import { createMonoAppearanceFromDocument, type MonoExtendedAppearance } from "./mono-preset-envelope";
import { createMonoShareUrl } from "./mono-share-codec";
import { MonoShareButton } from "./mono-share-button";
import { MonoPublishedPresetControls } from "./mono-published-controls";
import { MonoPreviewSource } from "./mono-preview-source";

import "./mono-workbench.css";
import "./mono-shape-tuner.css";
import "./mono-working-preset-bar.css";

type MonoPreset = "ledger" | "frost" | "mercury";
type MonoSettingsMap = Record<MonoPreset, MonoGlassSettings>;
type MonoTheme = "dark" | "light";
type MonoBackground = "iris" | "tide" | "strata";
type MonoViewport = 320 | 390 | 430 | 480;
type MonoRail = "quick" | "fine";
const activeSevenRecord = (library: MonoSevenLibrary) => library.slots[library.activeSlot - 1];
const TOOL_SLICES: Record<MonoToolId, ReadonlyArray<keyof MonoExtendedAppearance>> = {
  balance: ["balance", "eye"], assets: ["assets"], chart: ["chart", "layout"], typography: ["typography"],
  navigation: ["navigation"], logo: ["logo"], environment: ["background"], shape: [], optics: [], color: [],
};

function workingSaveError(error: unknown): string {
  return error instanceof MonoWorkingStoreError && error.kind === "conflict"
    ? "Изменён в другой вкладке · текущий черновик можно экспортировать"
    : "Не удалось сохранить · Повторить";
}

function workingApplyError(error: unknown, tool: MonoToolId | "all"): string {
  if (error instanceof MonoWorkingStoreError && error.kind === "conflict") return workingSaveError(error);
  return tool === "all"
    ? "Не удалось применить пробы. Повторите «Применить пробы и продолжить» в открытом диалоге."
    : `Не удалось применить. Повторите «Применить» в инструменте «${MONO_TOOL_LABELS[tool]}».`;
}

const OPTICAL_STORAGE_KEY = "wallet4i7.mono.optical-preview.v1";
const ENVIRONMENT_STORAGE_KEY = "wallet4i7.mono.environment-preview.v1";
const PRESETS: ReadonlyArray<{ id: MonoPreset; key: string; label: string }> = [
  { id: "ledger", key: "1", label: "Ledger" },
  { id: "frost", key: "2", label: "Frost" },
  { id: "mercury", key: "3", label: "Mercury" },
];

const BACKGROUNDS: ReadonlyArray<{ id: MonoBackground; label: string }> = [
  { id: "iris", label: "Ирис" },
  { id: "tide", label: "Волна" },
  { id: "strata", label: "Слои" },
];

const VIEWPORTS: ReadonlyArray<{ width: MonoViewport; label: string; note: string }> = [
  { width: 320, label: "Compact", note: "узкий" },
  { width: 390, label: "Standard", note: "база" },
  { width: 430, label: "Wide", note: "широкий" },
  { width: 480, label: "Canvas", note: "максимум" },
];

function makeDefaultOptics(): MonoSettingsMap {
  return {
    ledger: { ...MONO_GLASS_DEFAULTS.ledger },
    frost: { ...MONO_GLASS_DEFAULTS.frost },
    mercury: { ...MONO_GLASS_DEFAULTS.mercury },
  };
}

function loadOpticalCandidate(): MonoSettingsMap {
  const defaults = makeDefaultOptics();
  try {
    const raw = localStorage.getItem(OPTICAL_STORAGE_KEY);
    if (!raw || raw.length > 50_000) return defaults;
    const parsed = JSON.parse(raw) as { version?: unknown; presets?: unknown };
    if (parsed.version !== 1 || !parsed.presets || typeof parsed.presets !== "object") return defaults;
    for (const { id } of PRESETS) {
      const value = (parsed.presets as Record<string, unknown>)[id];
      if (value && typeof value === "object") {
        defaults[id] = normalizeMonoGlassSettings(id, value as Partial<MonoGlassSettings>);
      }
    }
  } catch {
    return defaults;
  }
  return defaults;
}

function loadEnvironmentCandidate(): { theme: MonoTheme; background: MonoBackground } {
  const fallback = { theme: "dark" as const, background: "iris" as const };
  try {
    const raw = localStorage.getItem(ENVIRONMENT_STORAGE_KEY);
    if (!raw || raw.length > 500) return fallback;
    const value = JSON.parse(raw) as { version?: unknown; theme?: unknown; background?: unknown };
    if (value.version !== 1) return fallback;
    return {
      theme: value.theme === "light" ? "light" : "dark",
      background: BACKGROUNDS.some((item) => item.id === value.background)
        ? value.background as MonoBackground : "iris",
    };
  } catch {
    return fallback;
  }
}

function validateLegacyCandidate(key: string, limit: number, kind: "shape" | "optics" | "environment") {
  const raw = localStorage.getItem(key);
  if (raw === null) return;
  let value: unknown;
  try {
    if (raw.length > limit) throw new Error("oversized");
    value = JSON.parse(raw) as unknown;
  } catch { throw new Error("Старые настройки нельзя перенести: повреждённый JSON."); }
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Старые настройки нельзя перенести: неизвестная схема.");
  const source = value as Record<string, unknown>;
  if (source.version !== 1 || (kind === "shape" && source.skinId !== "mono-ledger-v1"))
    throw new Error("Старые настройки нельзя перенести: неизвестная схема.");
  if (kind === "environment") {
    if ((source.theme !== "dark" && source.theme !== "light") ||
      !BACKGROUNDS.some(item => item.id === source.background))
      throw new Error("Старые настройки нельзя перенести: тема или фон неизвестны.");
    return;
  }
  if (source.presets === null || typeof source.presets !== "object" || Array.isArray(source.presets))
    throw new Error("Старые настройки нельзя перенести: набор пресетов повреждён.");
  const presets = source.presets as Record<string, unknown>;
  for (const [id, settings] of Object.entries(presets)) {
    if (!PRESETS.some(item => item.id === id) || settings === null || typeof settings !== "object" || Array.isArray(settings))
      throw new Error("Старые настройки нельзя перенести: параметры неизвестны.");
    const values = settings as Record<string, unknown>;
    const normalized = kind === "shape" ? normalizeMonoShapeMap({ [id]: values })[id as MonoPreset]
      : normalizeMonoGlassSettings(id as MonoPreset, values as Partial<MonoGlassSettings>);
    for (const [name, setting] of Object.entries(values)) {
      if (!(name in normalized))
        throw new Error("Старые настройки нельзя перенести: параметры неизвестны.");
      const expected = normalized[name as keyof typeof normalized];
      if (typeof expected === "number" && typeof setting === "number" && Number.isFinite(setting)) continue;
      if (expected !== setting) throw new Error("Старые настройки нельзя перенести: параметры неизвестны.");
    }
  }
}

function applyDocumentEnvironment(theme: MonoTheme, background: MonoBackground) {
  document.documentElement.dataset.monoPrepaintTheme = theme;
  document.documentElement.dataset.monoPrepaintBackground = background;
}

function focusWorkingSelector() {
  requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.mono-working-preset__numbers button[aria-pressed="true"]')?.focus());
}

function readMaterialOpenTarget(): MonoSevenSlot | null {
  const params = new URLSearchParams(window.location.search);
  const direct = params.get("slot") ?? params.get("working")?.replace(/^mono-seven-slot-/, "");
  const number = Number(direct);
  return MONO_SEVEN_SLOTS.includes(number as MonoSevenSlot) ? number as MonoSevenSlot : null;
}

export function MonoPreview({ snapshot }: { snapshot: WalletSnapshot }) {
  const hostActive = useMonoSceneActivity();
  const [sceneBalanceHidden, setSceneBalanceHidden] = useState(snapshot.balance.hidden);
  const [scenePeriod, setScenePeriod] = useState<ChartPeriod>("1D");
  const [sceneSection, setSceneSection] = useState<MonoSection>("overview");
  const [initialDocument] = useState(() => createMonoWorkingDocument(MONO_LOGO_PREVIEW_DEFAULTS));
  const quickActionLaunchRef = useRef<ApplyLaunch | null>(null);
  const quickActionKnownSessionsRef = useRef<string[]>([]);
  const workingLibraryRef = useRef<MonoSevenLibrary | null>(null);
  const workingDocumentRef = useRef<MonoWorkingDocument>(initialDocument);
  const savedGenerationRef = useRef(0);
  const workingReadyRef = useRef(false);
  const [workingReady, setWorkingReady] = useState(false);
  const workingBlockedRef = useRef(false);
  const workingBlockReasonRef = useRef("");
  const workingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workingSaveFailedRef = useRef(false);
  const materialDirtyRef = useRef(true);
  const [workingLibrary, setWorkingLibrary] = useState<MonoSevenLibrary | null>(null);
  const [workingStatus, setWorkingStatus] = useState("Загрузка рабочего пресета…");

  const persistWorking = useCallback((slot: MonoSevenSlot) => {
    const pending = workingLibraryRef.current;
    if (!pending || pending.activeSlot !== slot) return false;
    const next = { ...pending, generation: savedGenerationRef.current + 1 };
    try {
      saveMonoSevenLibrary(localStorage, next, savedGenerationRef.current);
      workingSaveFailedRef.current = false;
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      setWorkingLibrary(next);
      setWorkingStatus("Сохранено в этом браузере");
      try {
        const document = activeSevenRecord(next).document;
        saveMonoPaletteWorkspace(localStorage, document.palette);
        saveMonoPalettePrepaint(localStorage, document.palette);
        const mode = document.palette.slots[document.palette.activeSlotId - 1].present.mode;
        localStorage.setItem(ENVIRONMENT_STORAGE_KEY,
          JSON.stringify({ version: 1, theme: mode, background: document.background }));
      } catch { /* Legacy paint cache is not the working preset. */ }
      return true;
    } catch (error) {
      workingSaveFailedRef.current = true;
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  }, []);

  const scheduleWorkingSave = useCallback((slot: MonoSevenSlot) => {
    if (workingTimerRef.current !== null) clearTimeout(workingTimerRef.current);
    setWorkingStatus("Сохраняется…");
    workingTimerRef.current = setTimeout(() => {
      workingTimerRef.current = null;
      persistWorking(slot);
    }, 180);
  }, [persistWorking]);

  const onWorkspaceChange = useCallback((palette: MonoWorkingDocument["palette"]) => {
    if (!workingReadyRef.current) return;
    if (palette.slots === workingDocumentRef.current.palette.slots &&
      palette.activeSlotId === workingDocumentRef.current.palette.activeSlotId) return;
    const document = { ...workingDocumentRef.current, palette };
    workingDocumentRef.current = document;
    if (workingBlockedRef.current) {
      setWorkingStatus(workingBlockReasonRef.current);
      return;
    }
    const current = workingLibraryRef.current;
    if (current) {
      const slots = [...current.slots] as MonoSevenLibrary["slots"];
      const selected = slots[current.activeSlot - 1];
      slots[current.activeSlot - 1] = { ...selected, revision: selected.revision + 1, document };
      const next = { ...current, slots };
      workingLibraryRef.current = next;
      setWorkingLibrary(next);
      scheduleWorkingSave(next.activeSlot);
    } else {
      setWorkingStatus("Пресеты не загружены. Черновик остался в памяти.");
    }
  }, [scheduleWorkingSave]);

  const colorLab = useMonoColorLab({ onWorkspaceChange });
  const loadManagedWorkspace = colorLab.loadManagedWorkspace;
  const flushWorking = () => {
    if (workingTimerRef.current === null) return true;
    clearTimeout(workingTimerRef.current);
    workingTimerRef.current = null;
    const slot = workingLibraryRef.current?.activeSlot;
    return slot ? persistWorking(slot) : false;
  };

  const trialsSettled = (next?: () => void, continueAfterCancel = true) => {
    if (allowTransitionRef.current || !hasPendingTrials()) return true;
    setWorkingStatus("Сначала примените или отмените непринятые пробы.");
    if (next) {
      trialReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPendingTransition({ run: next, continueAfterCancel });
    }
    return false;
  };

  const clearTrialWarning = () => setWorkingStatus(current => current.startsWith("Не удалось применить")
    ? "Принятые настройки не изменены."
    : current.startsWith("Сначала примените")
    ? workingTimerRef.current !== null ? "Сохраняется…"
      : workingLibraryRef.current ? "Сохранено в этом браузере" : "Черновик остался в памяти"
    : current);

  const showWorking = (next: MonoSevenLibrary) => {
    const selected = activeSevenRecord(next);
    const document = selected.document;
    workingLibraryRef.current = next;
    workingDocumentRef.current = document;
    setWorkingLibrary(next);
    setAppliedOptics(document.optics);
    setDraftOptics(document.optics);
    setAppliedShapes(document.shapes);
    setDraftShapes(document.shapes);
    restoreAppearance(document);
    setBackground(document.background);
    colorLab.loadManagedWorkspace(document.palette);
    const mode = document.palette.slots[document.palette.activeSlotId - 1].present.mode;
    applyDocumentEnvironment(mode, document.background);
    try {
      saveMonoPalettePrepaint(localStorage, document.palette);
      localStorage.setItem(ENVIRONMENT_STORAGE_KEY,
        JSON.stringify({ version: 1, theme: mode, background: document.background }));
    } catch { /* Derived first-paint cache is secondary. */ }
    setWorkingStatus("Сохранено в этом браузере");
    focusWorkingSelector();
  };

  const selectWorking = (slot: MonoSevenSlot) => {
    if (workingBlockedRef.current) return false;
    const current = workingLibraryRef.current;
    if (!current || current.activeSlot === slot) return Boolean(current);
    if (!MONO_SEVEN_SLOTS.includes(slot)) return false;
    if (!trialsSettled(() => { selectWorking(slot); })) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const latest = workingLibraryRef.current!;
    const next: MonoSevenLibrary = { ...latest, activeSlot: slot, generation: savedGenerationRef.current + 1 };
    try {
      saveMonoSevenLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      showWorking(next);
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const replaceWorking = (target: MonoSevenSlot,
    makeNext: (current: MonoSevenLibrary) => MonoSevenLibrary): boolean => {
    if (!workingReadyRef.current || workingBlockedRef.current || !MONO_SEVEN_SLOTS.includes(target)) return false;
    if (!trialsSettled(() => { replaceWorking(target, makeNext); })) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const current = workingLibraryRef.current;
    if (!current) return false;
    try {
      const next = { ...makeNext(current), generation: savedGenerationRef.current + 1 };
      saveMonoSevenLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      showWorking(next);
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const copyWorking = (target: MonoSevenSlot) => replaceWorking(target, current =>
    replaceMonoSevenSlot(current, target, workingDocumentRef.current,
      `${activeSevenRecord(current).name} · копия`.slice(0, 80)));

  const renameWorking = (name: string) => {
    if (workingBlockedRef.current) return false;
    if (!name) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const current = workingLibraryRef.current;
    if (!current) return false;
    const slots = [...current.slots] as MonoSevenLibrary["slots"];
    slots[current.activeSlot - 1] = { ...slots[current.activeSlot - 1],
      name: name.slice(0, 80), revision: slots[current.activeSlot - 1].revision + 1 };
    const next = { ...current, generation: savedGenerationRef.current + 1, slots };
    try {
      saveMonoSevenLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      setWorkingLibrary(next);
      setWorkingStatus("Сохранено в этом браузере");
      focusWorkingSelector();
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const importWorking = (imported: MonoWorkingImport, target: MonoSevenSlot) =>
    replaceWorking(target, current => replaceMonoSevenSlot(current, target, imported.document, imported.name));
  const restoreWorking = (archiveIndex: number, target: MonoSevenSlot, direction: MonoPreset) =>
    replaceWorking(target, current => restoreMonoArchivedRecord(current, archiveIndex, target, direction));

  const acceptWorkingDocument = (document: MonoWorkingDocument, tool: MonoToolId | "all") => {
    if (!workingReadyRef.current) return false;
    if (workingBlockedRef.current) {
      setWorkingStatus(workingBlockReasonRef.current);
      return false;
    }
    if (!flushWorking()) {
      setWorkingStatus(current => current.startsWith("Изменён в другой вкладке")
        ? current : "Не удалось сохранить палитру · Повторить");
      return false;
    }
    const current = workingLibraryRef.current;
    if (!current) return false;
    const slots = [...current.slots] as MonoSevenLibrary["slots"];
    const selected = slots[current.activeSlot - 1];
    slots[current.activeSlot - 1] = { ...selected, revision: selected.revision + 1, document };
    const next: MonoSevenLibrary = { ...current, generation: savedGenerationRef.current + 1, slots };
    try {
      saveMonoSevenLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      workingDocumentRef.current = document;
      setWorkingLibrary(next);
      setWorkingStatus("Сохранено в этом браузере");
      return true;
    } catch (error) {
      setWorkingStatus(workingApplyError(error, tool));
      return false;
    }
  };
  const preset = PRESETS[colorLab.workspace.activeSlotId - 1].id;
  const [shapeStatus, setShapeStatus] = useState("");
  const [activeTool, setActiveTool] = useState<MonoToolId>("color");
  const [quickActionMotionStatus, setQuickActionMotionStatus] = useState("Стандартный отклик: Материал · 2,7 px / 270 мс.");
  const [quickActionPreview, setQuickActionPreview] = useState<{
    preset: ControlFeedbackPreset;
    workingPresetId: string | null;
  } | null>(null);
  const quickActionOverride = quickActionPreview?.workingPresetId === (workingLibrary ? activeSevenRecord(workingLibrary).id : null)
    ? quickActionPreview?.preset ?? null : null;
  const quickActionPreset = quickActionOverride ?? MONO_QUICK_ACTION_DEFAULT;
  const theme = colorLab.shown.mode;
  const [background, setBackground] = useState<MonoBackground>("iris");
  const [backgroundDraft, setBackgroundDraft] = useState<MonoBackground | null>(null);
  const shownBackground = backgroundDraft ?? background;
  const [appliedAppearance, setAppliedAppearance] = useState(initialDocument.appearance);
  const [draftAppearance, setDraftAppearance] = useState(initialDocument.appearance);
  const [fontCandidate, setFontCandidate] = useState<MonoTypographyConfigV1 | null>(null);
  const [fontLoading, setFontLoading] = useState(false);
  const [fontError, setFontError] = useState("");
  const fontRequestRef = useRef(0);
  useEffect(() => () => { fontRequestRef.current += 1; }, []);
  const [pendingTransition, setPendingTransition] = useState<{ run: () => void; continueAfterCancel: boolean } | null>(null);
  const allowTransitionRef = useRef(false);
  const trialDialogRef = useRef<HTMLDialogElement>(null);
  const trialReturnFocusRef = useRef<HTMLElement | null>(null);
  const restoreAppearance = useCallback((document: MonoWorkingDocument) => {
    setAppliedAppearance(document.appearance);
    setDraftAppearance(structuredClone(document.appearance));
    setBackgroundDraft(null);
    fontRequestRef.current += 1;
    setFontCandidate(null); setFontLoading(false); setFontError("");
  }, []);
  const [viewport, setViewport] = useState<MonoViewport>(480);
  const logoPreview = draftAppearance[preset].logo;
  const logoColors = useMemo(() => resolveMonoLogoColors(logoPreview.hue), [logoPreview.hue]);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [compactChrome, setCompactChrome] = useState(false);
  const [mobileRail, setMobileRail] = useState<MonoRail | null>(null);
  const [appliedOptics, setAppliedOptics] = useState<MonoSettingsMap>(makeDefaultOptics);
  const [draftOptics, setDraftOptics] = useState<MonoSettingsMap>(makeDefaultOptics);
  const [appliedShapes, setAppliedShapes] = useState<MonoShapeMap>(createMonoShapeDefaults);
  const [draftShapes, setDraftShapes] = useState<MonoShapeMap>(createMonoShapeDefaults);
  const quickLauncherRef = useRef<HTMLButtonElement>(null);
  const fineLauncherRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof BroadcastChannel === "undefined") return;
    let channel: BroadcastChannel;
    try { channel = new BroadcastChannel(CHANNEL_NAME); }
    catch { return; }
    channel.onmessage = (event: MessageEvent<unknown>) => {
      let envelope: ReturnType<typeof parseApplyRequestEnvelope>;
      try { envelope = parseApplyRequestEnvelope(event.data); }
      catch { return; }
      if (!quickActionKnownSessionsRef.current.includes(envelope.sessionId)) return;
      const reply = (outcome: ApplyAck["outcome"]) => channel.postMessage({
        version: 1, kind: "apply-ack", requestId: envelope.requestId,
        sessionId: envelope.sessionId, targetId: envelope.targetId,
        workingPresetId: envelope.workingPresetId, outcome,
      } satisfies ApplyAck);
      let request: ReturnType<typeof parseApplyRequest>;
      try { request = parseApplyRequest(event.data); }
      catch { reply("invalid-preset"); return; }
      const launch = quickActionLaunchRef.current;
      const outcome: ApplyAck["outcome"] = request.targetId !== "mono.quick-actions"
        ? "target-mismatch"
        : !launch || request.sessionId !== launch.sessionId
          ? "stale-session"
          : request.workingPresetId !== launch.workingPresetId ||
              request.workingPresetId !== (workingLibraryRef.current ? activeSevenRecord(workingLibraryRef.current).id : null)
            ? "preset-changed"
            : "applied";
      if (outcome === "applied") {
        setQuickActionPreview({ preset: request.preset, workingPresetId: request.workingPresetId });
        setQuickActionMotionStatus("Примерка применена к четырём действиям. После перезагрузки вернётся стандартный отклик.");
      }
      reply(outcome);
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    let alive = true;
    const frame = requestAnimationFrame(() => {
      void (async () => { try {
        let library = loadMonoSevenLibrary(localStorage);
        if (!library) {
          const hasWorkingSource = localStorage.getItem(MONO_WORKING_PRESETS_KEY) !== null ||
            localStorage.getItem(MONO_WORKING_PRESETS_LEGACY_KEY) !== null;
          let freshDocument: MonoWorkingDocument | undefined;
          let legacyRecords: ReturnType<typeof createLegacyPaletteWorkingRecords> = [];
          if (!hasWorkingSource) {
            let document = { ...createMonoWorkingDocument(loadMonoLogoPreview(localStorage)),
              optics: loadOpticalCandidate(), shapes: loadMonoShapeCandidateFrom(() => localStorage),
              background: loadEnvironmentCandidate().background };
          validateLegacyCandidate(MONO_SHAPE_STORAGE_KEY, 5_000, "shape");
          validateLegacyCandidate(OPTICAL_STORAGE_KEY, 50_000, "optics");
          validateLegacyCandidate(ENVIRONMENT_STORAGE_KEY, 500, "environment");
          const workspaceKeys = [MONO_PALETTE_WORKSPACE_KEY, "wallet4i7.mono.palette-workspace.v1"];
          const legacyKeys = [...workspaceKeys,
            OPTICAL_STORAGE_KEY, "wallet4i7.mono.shape-preview.v1", ENVIRONMENT_STORAGE_KEY];
          const legacyStateExists = legacyKeys.some(key => localStorage.getItem(key) !== null);
          if (legacyStateExists) {
            const palette = readMonoPaletteWorkspace(localStorage);
            if (workspaceKeys.some(key => localStorage.getItem(key) !== null) && !palette)
              throw new Error("Старый пресет повреждён.");
            const environment = loadEnvironmentCandidate();
            document = { ...document, palette: palette ?? (environment.theme === "light"
              ? switchMonoPaletteTheme(document.palette, "light") : document.palette) };
          }
          const hasLegacyPresets = localStorage.getItem(MONO_PALETTE_PRESETS_KEY) !== null ||
            localStorage.getItem("wallet4i7.mono.palette-presets.v1") !== null;
          if (hasLegacyPresets) {
            const raw = localStorage.getItem(MONO_PALETTE_PRESETS_KEY) ??
              localStorage.getItem("wallet4i7.mono.palette-presets.v1")!;
            let parsed: unknown;
            try { parsed = JSON.parse(raw) as unknown; }
            catch { throw new Error("Старую библиотеку палитр нельзя перенести: запись повреждена."); }
            const source = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
              ? parsed as Record<string, unknown> : null;
            if (source?.version !== 1 || !Array.isArray(source.presets))
              throw new Error("Старую библиотеку палитр нельзя перенести: неизвестная схема.");
            const entries = await loadMonoPaletteLibrary(localStorage);
            if (entries.length !== source.presets.length)
              throw new Error("Старую библиотеку палитр нельзя перенести: проверьте исходный JSON.");
            legacyRecords = createLegacyPaletteWorkingRecords(entries, loadMonoLogoPreview(localStorage));
          }
            freshDocument = legacyStateExists ? document : legacyRecords[0]?.document ??
              createFirstMonoWorkingDocument(loadMonoLogoPreview(localStorage));
          }
          library = migrateMonoSevenLibrary(localStorage, freshDocument, legacyRecords);
        }
        const openTarget = readMaterialOpenTarget();
        if (openTarget && library.activeSlot !== openTarget) {
          const next: MonoSevenLibrary = { ...library, activeSlot: openTarget,
            generation: library.generation + 1 };
          saveMonoSevenLibrary(localStorage, next, library.generation);
          library = next;
        }
        const document = activeSevenRecord(library).document;
        if (!alive) return;
        workingLibraryRef.current = library;
        workingDocumentRef.current = document;
        savedGenerationRef.current = library.generation;
        setWorkingLibrary(library);
        setAppliedOptics(document.optics);
        setDraftOptics(document.optics);
        setAppliedShapes(document.shapes);
        setDraftShapes(document.shapes);
        restoreAppearance(document);
        setBackground(document.background);
        loadManagedWorkspace(document.palette);
        setWorkingStatus("Сохранено в этом браузере");
        workingReadyRef.current = true;
        setWorkingReady(true);
      } catch (error) {
        if (!alive) return;
        const active = (() => { try { return loadMonoPaletteActive(localStorage); } catch { return null; } })();
        const palette = active
          ? enableMonoPalette(createMonoPaletteWorkspace(active.config), true)
          : workingDocumentRef.current.palette;
        workingDocumentRef.current = { ...workingDocumentRef.current, palette };
        loadManagedWorkspace(palette);
        workingBlockedRef.current = true;
        workingReadyRef.current = true;
        setWorkingReady(true);
        const reason = error instanceof Error &&
          (error.message.startsWith("Старую библиотеку палитр нельзя перенести") ||
           error.message.startsWith("Старые настройки нельзя перенести"))
          ? error.message : "Рабочую библиотеку нельзя прочитать. Изменения только в памяти.";
        workingBlockReasonRef.current = reason;
        setWorkingStatus(reason);
      } })();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      if (workingTimerRef.current !== null) clearTimeout(workingTimerRef.current);
    };
  }, [loadManagedWorkspace, restoreAppearance]);

  useLayoutEffect(() => {
    const saved = loadEnvironmentCandidate();
    applyDocumentEnvironment(saved.theme, saved.background);
    const frame = requestAnimationFrame(() => {
      setBackground(saved.background);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (colorLab.ready) applyDocumentEnvironment(theme, shownBackground);
  }, [colorLab.ready, theme, shownBackground]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1199px)");
    const sync = () => setCompactChrome(query.matches);
    query.addEventListener("change", sync);
    sync();
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileRail || pendingTransition) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const launcher = mobileRail === "quick" ? quickLauncherRef.current : fineLauncherRef.current;
      setMobileRail(null);
      requestAnimationFrame(() => launcher?.focus());
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileRail, pendingTransition]);

  useEffect(() => {
    if (!compactChrome || !panelsVisible || !mobileRail || pendingTransition) return;
    const panel = document.getElementById(mobileRail === "quick" ? "mono-quick-rail" : "mono-fine-rail");
    if (!panel) return;
    const focusable = () => {
      const closedSections = Array.from(panel.querySelectorAll("details:not([open])"));
      return Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      )).filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0 && !node.closest("[hidden], [inert]") &&
        closedSections.every(section => !section.contains(node) || section.querySelector(":scope > summary")?.contains(node)));
    };
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const options = focusable();
      if (!options.length) return;
      const first = options[0];
      const last = options[options.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trapTab);
    };
  }, [compactChrome, mobileRail, panelsVisible, pendingTransition]);

  function selectEnvironment(nextTheme: MonoTheme, nextBackground: MonoBackground) {
    if (theme !== nextTheme) colorLab.switchTheme(nextTheme);
    setBackgroundDraft(nextBackground === background ? null : nextBackground);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (pendingTransition || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
        document.querySelector('dialog[open], [role="dialog"]:not([data-mono-rail])')) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) return;

      const number = Number(event.key);
      if (event.key.length === 1 && MONO_SEVEN_SLOTS.includes(number as MonoSevenSlot)) {
        event.preventDefault(); selectWorking(number as MonoSevenSlot);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function updateDraft(next: Partial<MonoGlassSettings>) {
    setDraftOptics((current) => ({
      ...current,
      [preset]: normalizeMonoGlassSettings(preset, { ...current[preset], ...next }),
    }));
  }

  function resetDraft() {
    setDraftOptics((current) => ({ ...current, [preset]: { ...MONO_GLASS_DEFAULTS[preset] } }));
  }

  function cancelDraft() {
    setDraftOptics((current) => ({ ...current, [preset]: { ...appliedOptics[preset] } }));
    clearTrialWarning();
  }

  function applyDraft() {
    const next = { ...appliedOptics, [preset]: { ...draftOptics[preset] } };
    colorLab.end();
    if (acceptWorkingDocument({ ...workingDocumentRef.current, optics: next }, "optics")) setAppliedOptics(next);
  }

  function updateShape(group: MonoShapeGroup, radius: number) {
    setShapeStatus("");
    setDraftShapes((current) => ({
      ...current,
      [preset]: { ...current[preset], [group]: radius },
    }));
  }

  function resetShape() {
    const defaults = createMonoShapeDefaults();
    setShapeStatus("");
    setDraftShapes((current) => ({ ...current, [preset]: { ...defaults[preset] } }));
  }

  function cancelShape() {
    setDraftShapes((current) => ({ ...current, [preset]: { ...appliedShapes[preset] } }));
    setShapeStatus("Проба формы отменена.");
    clearTrialWarning();
  }

  function applyShape() {
    const candidate = { ...appliedShapes, [preset]: { ...draftShapes[preset] } };
    colorLab.end();
    if (acceptWorkingDocument({ ...workingDocumentRef.current, shapes: candidate }, "shape")) {
      setAppliedShapes(candidate);
      setDraftShapes((current) => ({ ...current, [preset]: { ...candidate[preset] } }));
      setShapeStatus("Форма применена.");
    } else {
      setShapeStatus("Не удалось сохранить форму. Черновик остался в предпросмотре.");
    }
  }

  function updateLogoPreview(next: MonoLogoPreview) { updateAppearance("logo", next); }

  function togglePanels() {
    if (panelsVisible) setMobileRail(null);
    setPanelsVisible(!panelsVisible);
  }

  function toggleMobileRail(rail: MonoRail) {
    setMobileRail((current) => current === rail ? null : rail);
  }

  function closeMobileRail() {
    const launcher = mobileRail === "quick" ? quickLauncherRef.current : fineLauncherRef.current;
    setMobileRail(null);
    requestAnimationFrame(() => launcher?.focus());
  }

  const workbenchStyle = { "--mono-preview-width": `${viewport}px` } as CSSProperties;
  const shapeDirty = JSON.stringify(draftShapes[preset]) !== JSON.stringify(appliedShapes[preset]);
  const openQuickActionMotionLab = (anchor: HTMLAnchorElement) => {
    const launch: ApplyLaunch = {
      sessionId: crypto.randomUUID(),
      targetId: "mono.quick-actions",
      workingPresetId: workingLibraryRef.current ? activeSevenRecord(workingLibraryRef.current).id : null,
    };
    quickActionLaunchRef.current = launch;
    quickActionKnownSessionsRef.current = [...quickActionKnownSessionsRef.current.slice(-7), launch.sessionId];
    const url = new URL("/design-lab", window.location.href);
    url.searchParams.set("session", launch.sessionId);
    url.searchParams.set("target", launch.targetId);
    if (launch.workingPresetId) url.searchParams.set("working", launch.workingPresetId);
    anchor.href = url.toString();
    setQuickActionMotionStatus("Лаборатория открыта. Применение останется временной примеркой.");
  };
  const quickRailHidden = !panelsVisible || (compactChrome && mobileRail !== "quick");
  const fineRailHidden = !panelsVisible || (compactChrome && mobileRail !== "fine");


  function updateAppearance<K extends keyof MonoExtendedAppearance>(key: K, value: MonoExtendedAppearance[K]) {
    setDraftAppearance(current => ({ ...current, [preset]: { ...current[preset], [key]: value } }));
  }
  function updateTypography(config: MonoTypographyConfigV1) {
    const request = ++fontRequestRef.current;
    const direction = preset;
    setFontCandidate(config); setFontLoading(true); setFontError("");
    void loadMonoTypography(config).then(ready => {
      if (request !== fontRequestRef.current) return;
      setDraftAppearance(current => ({ ...current, [direction]: { ...current[direction], typography: ready } }));
      setFontCandidate(null); setFontLoading(false);
    }).catch(() => {
      if (request !== fontRequestRef.current) return;
      setFontLoading(false); setFontError("Шрифты не загрузились. Прежний вид сохранён; повторите выбор или отмените пробу.");
    });
  }
  function hasPendingTrials() {
    return Boolean(fontCandidate || colorLab.pending || backgroundDraft ||
      JSON.stringify(draftAppearance) !== JSON.stringify(appliedAppearance) ||
      JSON.stringify(draftShapes) !== JSON.stringify(appliedShapes) ||
      JSON.stringify(draftOptics) !== JSON.stringify(appliedOptics));
  }
  const activeWorking = workingLibraryRef.current ? activeSevenRecord(workingLibraryRef.current) : null;
  materialDirtyRef.current = hasPendingTrials() || workingTimerRef.current !== null || workingSaveFailedRef.current ||
    Boolean(activeWorking && JSON.stringify(workingDocumentRef.current) !== JSON.stringify(activeWorking.document));
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(MONO_SEVEN_PRESETS_KEY);
    channel.onmessage = event => {
      const request = event.data as { kind?: unknown; requestId?: unknown; targetId?: unknown };
      if (request?.kind !== "material-apply-check" || typeof request.requestId !== "string" ||
        request.requestId.length > 100 || request.targetId !==
          (workingLibraryRef.current ? activeSevenRecord(workingLibraryRef.current).id : null)) return;
      channel.postMessage({ kind: "material-apply-status", requestId: request.requestId,
        targetId: request.targetId, dirty: !workingReadyRef.current || materialDirtyRef.current });
    };
    return () => channel.close();
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== MONO_SEVEN_PRESETS_KEY || !workingReadyRef.current) return;
      try {
        const latest = loadMonoSevenLibrary(localStorage);
        if (latest?.generation === savedGenerationRef.current) return;
      } catch { /* A damaged external write must not be applied over this draft. */ }
      workingBlockedRef.current = true;
      setWorkingStatus("Изменён в другой вкладке · Перезагрузите MONO перед новой записью.");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  function toolDirty(tool: MonoToolId) {
    if (tool === "shape") return shapeDirty;
    if (tool === "optics") return JSON.stringify(draftOptics[preset]) !== JSON.stringify(appliedOptics[preset]);
    if (tool === "color") return Boolean(colorLab.pending);
    if (tool === "typography" && fontCandidate) return true;
    if (tool === "environment" && backgroundDraft) return true;
    return TOOL_SLICES[tool].some(key => JSON.stringify(draftAppearance[preset][key]) !== JSON.stringify(appliedAppearance[preset][key]));
  }
  function applyTool(tool: MonoToolId) {
    if (tool === "shape") { applyShape(); return; }
    if (tool === "optics") { applyDraft(); return; }
    if (tool === "typography" && fontCandidate) return;
    const accepted = workingDocumentRef.current;
    const nextAppearance = { ...accepted.appearance, [preset]: { ...accepted.appearance[preset],
      ...Object.fromEntries(TOOL_SLICES[tool].map(key => [key, structuredClone(draftAppearance[preset][key])])) } };
    const next = { ...accepted, appearance: nextAppearance,
      background: tool === "environment" ? shownBackground : accepted.background };
    colorLab.end();
    if (acceptWorkingDocument(next, tool)) {
      setAppliedAppearance(next.appearance);
      if (tool === "environment") { setBackground(next.background); setBackgroundDraft(null); }
      clearTrialWarning();
    }
  }
  function clearAppliedMaterialBackground() {
    if (!workingDocumentRef.current.materials[preset].background) return;
    if (!trialsSettled(clearAppliedMaterialBackground)) return;
    const current = workingDocumentRef.current;
    const next = { ...current, materials: { ...current.materials,
      [preset]: { ...current.materials[preset], background: null } } };
    if (acceptWorkingDocument(next, "environment"))
      setWorkingStatus("Материал фона снят · прежний фон MONO сохранён.");
  }
  function cancelTool(tool: MonoToolId) {
    if (tool === "shape") { cancelShape(); return; }
    if (tool === "optics") { cancelDraft(); return; }
    if (tool === "typography") {
      fontRequestRef.current += 1; setFontCandidate(null); setFontLoading(false); setFontError("");
    }
    if (tool === "environment") setBackgroundDraft(null);
    setDraftAppearance(current => ({ ...current, [preset]: { ...current[preset],
      ...Object.fromEntries(TOOL_SLICES[tool].map(key => [key, structuredClone(appliedAppearance[preset][key])])) } }));
    clearTrialWarning();
  }
  function selectTool(tool: MonoToolId) {
    setActiveTool(tool);
    if (compactChrome) setMobileRail("fine");
  }
  function finishTransition(choice: "apply" | "cancel" | "back") {
    const next = pendingTransition;
    if (!next) return;
    if (choice === "back") { setPendingTransition(null); return; }
    if (choice === "apply") {
      if (fontCandidate || colorLab.pending) return;
      colorLab.end();
      const document = { ...workingDocumentRef.current, shapes: structuredClone(draftShapes), optics: structuredClone(draftOptics),
        appearance: structuredClone(draftAppearance), background: shownBackground };
      if (!acceptWorkingDocument(document, "all")) return;
      setAppliedShapes(document.shapes); setAppliedOptics(document.optics); setAppliedAppearance(document.appearance);
      setBackground(document.background); setBackgroundDraft(null);
    } else {
      setDraftShapes(appliedShapes); setDraftOptics(appliedOptics);
      setDraftAppearance(structuredClone(appliedAppearance)); setBackgroundDraft(null);
      fontRequestRef.current += 1; setFontCandidate(null); setFontLoading(false); setFontError("");
      colorLab.setPending(null);
    }
    setPendingTransition(null);
    allowTransitionRef.current = true;
    try { if (choice === "apply" || next.continueAfterCancel) next.run(); }
    finally { allowTransitionRef.current = false; }
    clearTrialWarning();
  }
  useEffect(() => {
    const dialog = trialDialogRef.current;
    if (!dialog) return;
    if (pendingTransition) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
      }
    } else if (dialog.open) {
      if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
      const previous = trialReturnFocusRef.current;
      requestAnimationFrame(() => (previous?.isConnected ? previous : document.querySelector<HTMLElement>(".mono-working-preset__selector"))?.focus());
    }
  }, [pendingTransition]);

  const activeRecord = workingLibrary ? activeSevenRecord(workingLibrary) : null;
  const selectedPublishedSlot = workingLibrary?.activeSlot ?? 1;
  const activeMaterials = workingDocumentRef.current.materials[preset];
  const materialSceneActive = Boolean(activeMaterials.background || activeMaterials.buttons?.bindings.length);
  const dirtyTools = (Object.keys(MONO_TOOL_LABELS) as MonoToolId[]).filter(toolDirty);

  return (
    <div className="mono-workbench" data-mono-workbench data-panels-visible={panelsVisible}
      data-compact-chrome={compactChrome} data-mobile-rail={mobileRail ?? "none"} data-mono-theme={theme} style={workbenchStyle}>
      <button type="button" className="mono-workbench__master" aria-expanded={panelsVisible}
        aria-controls="mono-quick-rail mono-fine-rail"
        aria-label={panelsVisible ? "Скрыть панели" : "Показать панели"} onClick={togglePanels}>
        <span className="mono-workbench__master-track" aria-hidden="true"><i /></span>
        <span>{panelsVisible ? "Скрыть панели" : "Показать панели"}</span>
      </button>

      <button ref={quickLauncherRef} type="button"
        className="mono-workbench__launcher mono-workbench__launcher--quick"
        aria-label="Открыть быстрые настройки" aria-expanded={mobileRail === "quick"}
        aria-controls="mono-quick-rail" hidden={!panelsVisible}
        onClick={() => toggleMobileRail("quick")}>
        <span aria-hidden="true">01</span><span>Инструменты</span>
      </button>
      <button ref={fineLauncherRef} type="button"
        className="mono-workbench__launcher mono-workbench__launcher--fine"
        aria-label="Открыть тонкие настройки" aria-expanded={mobileRail === "fine"}
        aria-controls="mono-fine-rail" hidden={!panelsVisible}
        onClick={() => toggleMobileRail("fine")}>
        <span>{MONO_TOOL_LABELS[activeTool]}</span><span aria-hidden="true">02</span>
      </button>

      {compactChrome && panelsVisible && mobileRail && (
        <button type="button" className="mono-workbench__scrim" aria-label="Закрыть боковую панель"
          onClick={closeMobileRail} />
      )}


      <aside id="mono-quick-rail" className="mono-rail mono-rail--quick" data-mono-rail="quick"
        aria-label="Быстрые настройки" aria-hidden={quickRailHidden} inert={quickRailHidden}
        role={compactChrome && mobileRail === "quick" ? "dialog" : undefined}
        aria-modal={compactChrome && mobileRail === "quick" ? true : undefined}>
        <div className="mono-rail__head"><div><span>WORKSPACE</span><strong>MONO</strong></div><a href="/">V1 ↗</a></div>
        <MonoPreviewSource />
        <a className="mono-rail__lab-entry" href="/design-lab">Design Lab · Фоны и кнопки ↗</a>
        <MonoWorkingPresetBar key={workingLibrary?.activeSlot ?? "baseline"}
          ready={workingReady}
          activeSlot={workingLibrary?.activeSlot ?? 1}
          choices={workingLibrary?.slots.map(record => ({ slot: record.slot, name: record.name })) ?? []}
          archive={workingLibrary?.archive.map((record, index) => ({ index, name: record.name,
            direction: PRESETS[record.document.palette.activeSlotId - 1].id })) ?? []}
          status={workingStatus}
          onExport={() => {
            colorLab.end();
            const name = workingLibraryRef.current ? activeSevenRecord(workingLibraryRef.current).name : "Пресет";
            return exportMonoWorkingPreset(name, workingDocumentRef.current);
          }}
          onExportArchive={index => {
            const record = workingLibraryRef.current?.archive[index];
            if (!record) throw new Error("Архивная запись недоступна.");
            return exportMonoWorkingPreset(record.name, record.document);
          }}
          onImport={importWorking}
          onRestore={restoreWorking}
          onOpenPaletteArchive={() => {
            selectTool("color");
            colorLab.setVariantsOpen(true);
            requestAnimationFrame(() => document.getElementById("mono-palette-local-variants")?.scrollIntoView?.({ block: "start" }));
          }}
          onSelect={selectWorking} onCopy={copyWorking} onRename={renameWorking}
          onRetry={() => workingLibraryRef.current ? persistWorking(workingLibraryRef.current.activeSlot) : false}
          portableShare={<div className="mono-workbench__share" data-share-pending={hasPendingTrials()}
            onClickCapture={event => {
              const action = event.target instanceof Element
                ? event.target.closest<HTMLButtonElement>("[data-mono-share-action]") : null;
              const kind = action?.dataset.monoShareAction;
              if (kind !== "open" && kind !== "copy") return;
              if (!trialsSettled(() => requestAnimationFrame(() =>
                document.querySelector<HTMLButtonElement>(`[data-mono-share-action="${kind}"]`)?.click()))) {
                event.preventDefault(); event.stopPropagation();
              }
            }}>
            <MonoShareButton sourceKey={(activeRecord?.id ?? "baseline") + ":" + (activeRecord?.revision ?? 0)}
              disabled={!workingReady || workingBlockedRef.current} createLink={async () => {
                colorLab.end();
                if (workingBlockedRef.current) throw new Error("Пресет изменён в другой вкладке. Перезагрузите MONO перед созданием ссылки.");
                if (workingSaveFailedRef.current) throw new Error("Не удалось сохранить рабочий пресет. Повторите сохранение перед созданием ссылки.");
                if (!flushWorking()) throw new Error("Не удалось сохранить рабочий пресет. Повторите сохранение.");
                return createMonoShareUrl(createMonoAppearanceFromDocument(workingDocumentRef.current), window.location.origin);
              }} />
          </div>} />
        <MonoPublishedPresetControls slot={selectedPublishedSlot}
          disabled={!workingReady || workingBlockedRef.current}
          getSnapshot={async () => {
            const selected = selectedPublishedSlot;
            const current = workingLibraryRef.current;
            if (!workingReadyRef.current || !current || current.activeSlot !== selected ||
                workingBlockedRef.current || workingSaveFailedRef.current) return null;
            if (!trialsSettled(() => {
              requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(
                `[data-mono-publish-action="publish"][data-mono-publish-slot="${selected}"]`)?.click());
            }, false)) return null;
            colorLab.end();
            if (!flushWorking()) return null;
            const accepted = workingLibraryRef.current;
            if (!accepted || accepted.activeSlot !== selected || workingSaveFailedRef.current || hasPendingTrials()) return null;
            return createMonoAppearanceFromDocument(structuredClone(accepted.slots[selected - 1].document));
          }} />
        {hasPendingTrials() && <p className="mono-workbench__pending" role="status">Есть неприменённые пробы</p>}

        <p className="mono-workbench__dock-label">Инструменты</p>
        <MonoToolDock selected={activeTool} onSelect={selectTool} dirtyTools={dirtyTools} />
        <div className="mono-workbench__widths" role="group" aria-label="Ширина предпросмотра">
          {VIEWPORTS.map(item => <button key={item.width} type="button" aria-label={"Экран " + item.width + " пикселей"}
            aria-pressed={viewport === item.width} onClick={() => setViewport(item.width)}>{item.width}</button>)}
        </div>
      </aside>
      <aside id="mono-fine-rail" className="mono-rail mono-rail--fine" data-mono-rail="fine"
        aria-label="Тонкие настройки" aria-hidden={fineRailHidden} inert={fineRailHidden}
        role={compactChrome && mobileRail === "fine" ? "dialog" : undefined}
        aria-modal={compactChrome && mobileRail === "fine" ? true : undefined}>
        <MonoInspectorShell tool={activeTool} dirty={toolDirty(activeTool)}
          busy={activeTool === "typography" && (fontLoading || Boolean(fontCandidate))}
          onClose={compactChrome ? () => setMobileRail("quick") : undefined}
          onApply={activeTool === "color" ? undefined : () => applyTool(activeTool)}
          onCancel={activeTool === "color" ? undefined : () => cancelTool(activeTool)}
          note={activeTool === "color" ? "Прямые правки сохраняются в рабочем пресете. Импорт палитры применяется отдельно."
            : activeTool === "typography" && fontCandidate ? fontError || "Загрузка шрифтов…" : undefined}>
          {activeTool === "balance" && <><MonoBalanceControls value={draftAppearance[preset].balance} onChange={value => updateAppearance("balance", value)} />
            <label className="mono-workbench__eye-toggle"><input type="checkbox" checked={draftAppearance[preset].eye.blinkEnabled}
              onChange={event => updateAppearance("eye", { blinkEnabled: event.currentTarget.checked })} />Моргание глаза</label></>}
          {activeTool === "navigation" && <MonoNavigationControls value={draftAppearance[preset].navigation}
            onChange={value => updateAppearance("navigation", value)} />}
          {activeTool === "assets" && <MonoAssetListControls value={draftAppearance[preset].assets} onChange={value => updateAppearance("assets", value)} />}
          {activeTool === "chart" && <MonoChartControls value={draftAppearance[preset].chart} layout={draftAppearance[preset].layout}
            onChange={value => updateAppearance("chart", value)} onLayoutChange={value => updateAppearance("layout", value)} />}
          {activeTool === "typography" && <><MonoTypographyTuner value={fontCandidate ?? draftAppearance[preset].typography} onChange={updateTypography} />
            {fontError && <p role="alert">{fontError}</p>}</>}
          {activeTool === "shape" && <div className="mono-workbench__shape">          <MonoShapeTuner values={draftShapes[preset]} dirty={shapeDirty} status={shapeStatus}
            separateActions={(activeMaterials.buttons?.version === 2 || activeMaterials.buttons?.version === 3)
              && activeMaterials.buttons.frameMode !== "group"}
            onChange={updateShape} onDefault={resetShape} onCancel={cancelShape} onApply={applyShape}
            onOpenMotionLab={process.env.NODE_ENV === "development" && workingReady ? openQuickActionMotionLab : undefined}
            buttonLabHref="/design-lab/buttons"
            motionLabStatus={quickActionPreview && !quickActionOverride
              ? "Здесь действует стандартный Material; отдельная проба относится к другому пресету."
              : quickActionMotionStatus} />
</div>}
          {activeTool === "optics" && <div className="mono-workbench__optics">          <MonoGlassTuner preset={preset} settings={draftOptics[preset]}
            onChange={updateDraft} onDefault={resetDraft} onCancel={cancelDraft} onApply={applyDraft} />
</div>}
          {activeTool === "logo" && <>          <div className="mono-logo-options" role="group" aria-label="Настройка логотипа" data-mono-control>
            <span>Логотип</span>
            <div className="mono-logo-options__variants">
              <button type="button" aria-label="Логотип без плашки" aria-pressed={logoPreview.variant === "bare"}
                onClick={() => updateLogoPreview({ ...logoPreview, variant: "bare" })}>1 · Без плашки</button>
              <button type="button" aria-label="Логотип с плашкой" aria-pressed={logoPreview.variant === "plaque"}
                onClick={() => updateLogoPreview({ ...logoPreview, variant: "plaque" })}>2 · Плашка</button>
            </div>
            <label className="mono-logo-options__custom">
              <input type="checkbox" checked={logoPreview.customColor}
                onChange={event => updateLogoPreview({ ...logoPreview, customColor: event.currentTarget.checked })} />
              <span className="mono-logo-options__swatch" aria-hidden="true"
                style={{ backgroundColor: logoPreview.customColor ? logoColors[theme].primary : theme === "dark" ? "#9a90ff" : "#4338ca" }} />
              <span>Свой цвет эмблемы</span>
            </label>
            {logoPreview.customColor && <div className="mono-logo-options__tone">
              <div><span>Тон знака</span><output>{logoPreview.hue}°</output></div>
              <input type="range" aria-label="Тон знака Novex" min="0" max="359" step="1" value={logoPreview.hue}
                onChange={event => updateLogoPreview({ ...logoPreview, hue: normalizeMonoLogoHue(Number(event.currentTarget.value)) })} />
            </div>}
            <p aria-live="polite">Примените настройку, чтобы сохранить логотип в этом пресете.</p>
          </div>
</>}
          {activeTool === "environment" && <>
            {activeMaterials.background && <div className="mono-workbench__material-return">
              <p>Это направление показывает материал из мастерской. Прежний фон MONO сохранён.</p>
              <button type="button" onClick={clearAppliedMaterialBackground}>Снять материал фона</button>
            </div>}
            <MonoBackgroundRecipeControls value={draftAppearance[preset].background} onChange={value => updateAppearance("background", value)} />
            <MonoLabSection title="Исходная среда и тема">          <div className="mono-environment" aria-label="Визуальная среда" data-mono-control>
            <div className="mono-environment__backgrounds" role="group" aria-label="Фон">
              {BACKGROUNDS.map((item) => (
                <button key={item.id} type="button" aria-pressed={shownBackground === item.id}
                  onClick={() => selectEnvironment(theme, item.id)}>
                  <span className={`mono-environment__swatch mono-environment__swatch--${item.id}`} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mono-environment__themes" role="group" aria-label="Тема">
              <button type="button" aria-label="Тёмная тема" aria-pressed={theme === "dark"}
                onClick={() => selectEnvironment("dark", shownBackground)}><span aria-hidden="true">◐</span></button>
              <button type="button" aria-label="Светлая тема" aria-pressed={theme === "light"}
                onClick={() => selectEnvironment("light", shownBackground)}><span aria-hidden="true">◑</span></button>
            </div>
          </div>

              <p className="mono-workbench__note">Тема общая с палитрой и меняется сразу. Фон сохраняется по «Применить».</p>
            </MonoLabSection>
          </>}
          {activeTool === "color" && <>
            <MonoColorLab lab={colorLab} />
            <MonoLabSection title="Точная настройка цвета"><MonoColorInspector lab={colorLab} /></MonoLabSection>
            {colorLab.variantsOpen && <section aria-label="Серверная библиотека палитр">
              <h3>Серверная библиотека палитр</h3>
              <p className="mono-workbench__note">Здесь сохраняются только цвета. Шрифты, форма, график и фон остаются в локальном рабочем пресете и полной ссылке.</p>
              <MonoPresetLibrary lab={colorLab} visible />
              <button type="button" className="mono-rail__archive-close" onClick={() => colorLab.setVariantsOpen(false)}>Закрыть архив палитр</button>
            </section>}
          </>}
        </MonoInspectorShell>
      </aside>
      <div className="mono-preview-frame" data-material-scrollport={materialSceneActive || undefined}
        inert={compactChrome && panelsVisible && mobileRail !== null}>
        <MonoProductScene material={activeMaterials} snapshot={snapshot} appearance={{ ...draftAppearance[preset],
          preset, palette: { enabled: Boolean(colorLab.shown.paletteEnabled), config: colorLab.shown.config },
          shape: draftShapes[preset], optics: draftOptics[preset], environment: { theme, background: shownBackground },
        }} viewport={viewport} ready={workingReady} paletteReady={colorLab.ready}
          active={hostActive}
          session={{ balanceHidden: sceneBalanceHidden, onBalanceHiddenChange: setSceneBalanceHidden,
            period: scenePeriod, onPeriodChange: setScenePeriod,
            section: sceneSection, onSectionChange: setSceneSection }}
          paletteTransitionEnabled={colorLab.workspace.compare === null} quickActionPreset={quickActionPreset} />
      </div>
      <dialog ref={trialDialogRef} className="mono-trial-guard" aria-label="Неприменённые пробы"
        onCancel={event => { event.preventDefault(); finishTransition("back"); }}>
        <h2>Есть неприменённые пробы</h2>
        <p>Сохранить изменения перед продолжением?</p>
        {colorLab.pending && <p>Импорт палитры нужно сначала принять в инструменте «Цвет» или отменить.</p>}
        {fontCandidate && <p>{fontError || "Дождитесь загрузки шрифтов или отмените пробу."}</p>}
        <div>
          <button type="button" onClick={() => finishTransition("back")}>Назад</button>
          <button type="button" onClick={() => finishTransition("cancel")}>
            {pendingTransition?.continueAfterCancel ? "Отменить пробы и продолжить" : "Отменить пробы"}
          </button>
          <button type="button" disabled={Boolean(fontCandidate || colorLab.pending)} onClick={() => finishTransition("apply")}>
            {pendingTransition?.continueAfterCancel ? "Применить пробы и продолжить" : "Применить пробы и опубликовать"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
