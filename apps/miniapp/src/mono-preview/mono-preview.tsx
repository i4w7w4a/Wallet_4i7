"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { WalletSnapshot } from "@wallet/core";
import { CHANNEL_NAME, parseApplyRequest, parseApplyRequestEnvelope, type ApplyAck, type ApplyLaunch } from "../design-lab/control-feedback-handoff";
import type { ControlFeedbackPreset } from "../design-lab/control-feedback-model";
import {
  MONO_GLASS_DEFAULTS,
  normalizeMonoGlassSettings,
  type MonoGlassSettings,
} from "@wallet/ui";

import { MonoGlassTuner } from "./mono-glass-tuner";
import { loadMonoLogoPreview, normalizeMonoLogoHue,
  MONO_LOGO_PREVIEW_KEY, resolveMonoLogoColors, saveMonoLogoPreview, type MonoLogoPreview } from "./mono-logo-preview";
import { MonoColorLab, MonoColorInspector, useMonoColorLab } from "./mono-color-lab";
import { createMonoPaletteWorkspace, enableMonoPalette, switchMonoPaletteTheme } from "./mono-palette-workspace";
import { MonoPresetLibrary } from "./mono-preset-library";
import { MonoShapeTuner } from "./mono-shape-tuner";
import { MONO_QUICK_ACTION_DEFAULT } from "./mono-quick-action-feedback";
import { MonoWorkingPresetBar } from "./mono-working-preset-bar";
import { saveMonoPalettePrepaint } from "./mono-palette-prepaint";
import { MONO_PALETTE_PRESETS_KEY, MONO_PALETTE_WORKSPACE_KEY, loadMonoPaletteLibrary,
  loadMonoPaletteActive, readMonoPaletteWorkspace, saveMonoPaletteWorkspace } from "./mono-palette-storage";
import {
  createLegacyPaletteWorkingRecords,
  createMonoWorkingDocument,
  createRecoveredMonoWorkingLibrary,
  exportMonoWorkingPreset,
  loadMonoWorkingLibrary,
  MonoWorkingStoreError,
  saveMonoWorkingLibrary,
  type MonoWorkingDocument,
  type MonoWorkingLibrary,
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
import { MonoScene } from "./mono-scene";

import "./mono-workbench.css";
import "./mono-shape-tuner.css";
import "./mono-working-preset-bar.css";

type MonoPreset = "ledger" | "frost" | "mercury";
type MonoSettingsMap = Record<MonoPreset, MonoGlassSettings>;
type MonoTheme = "dark" | "light";
type MonoBackground = "iris" | "tide" | "strata";
type MonoViewport = 320 | 390 | 430 | 480;
type MonoRail = "quick" | "fine";
type MonoSection = "variants" | "viewport" | "shape" | "environment" | "optics";

function workingSaveError(error: unknown): string {
  return error instanceof MonoWorkingStoreError && error.kind === "conflict"
    ? "Изменён в другой вкладке · текущий черновик можно экспортировать"
    : "Не удалось сохранить · Повторить";
}

const OPTICAL_STORAGE_KEY = "wallet4i7.mono.optical-preview.v1";
const ENVIRONMENT_STORAGE_KEY = "wallet4i7.mono.environment-preview.v1";
const LOGO_PREVIEW_CHANGE_EVENT = "mono-logo-preview-change";

function subscribeLogoPreview(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === MONO_LOGO_PREVIEW_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOGO_PREVIEW_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOGO_PREVIEW_CHANGE_EVENT, onChange);
  };
}

function getLogoPreviewSnapshot(): string | null {
  try { return window.localStorage.getItem(MONO_LOGO_PREVIEW_KEY); }
  catch { return null; }
}

const getServerLogoPreviewSnapshot = () => null;

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

function MonoRailSection({
  id,
  title,
  index,
  expanded,
  onToggle,
  children,
}: {
  id: MonoSection;
  title: string;
  index: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `mono-${id}-panel`;
  return (
    <section className="mono-rail-section" data-mono-section={id}>
      <h2>
        <button type="button" aria-expanded={expanded} aria-controls={panelId}
          aria-label={`${expanded ? "Свернуть" : "Развернуть"} ${title}`} onClick={onToggle}>
          <span className="mono-rail-section__index">{index}</span>
          <span>{title}</span>
          <span className="mono-rail-section__state" aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      </h2>
      <div id={panelId} className="mono-rail-section__body" hidden={!expanded}>{children}</div>
    </section>
  );
}

export function MonoPreview({ snapshot }: { snapshot: WalletSnapshot }) {
  const quickActionLaunchRef = useRef<ApplyLaunch | null>(null);
  const quickActionKnownSessionsRef = useRef<string[]>([]);
  const workingLibraryRef = useRef<MonoWorkingLibrary | null>(null);
  const workingDocumentRef = useRef<MonoWorkingDocument>(createMonoWorkingDocument());
  const savedGenerationRef = useRef(0);
  const workingReadyRef = useRef(false);
  const [workingReady, setWorkingReady] = useState(false);
  const workingBlockedRef = useRef(false);
  const workingBlockReasonRef = useRef("");
  const workingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [workingLibrary, setWorkingLibrary] = useState<MonoWorkingLibrary | null>(null);
  const [workingStatus, setWorkingStatus] = useState("Загрузка рабочего пресета…");

  const persistWorking = useCallback((id: string) => {
    const pending = workingLibraryRef.current;
    if (!pending || pending.activeId !== id) return false;
    const next = { ...pending, generation: savedGenerationRef.current + 1 };
    try {
      saveMonoWorkingLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      setWorkingLibrary(next);
      setWorkingStatus("Сохранено в этом браузере");
      try {
        const document = next.records.find(record => record.id === id)!.document;
        saveMonoPaletteWorkspace(localStorage, document.palette);
        saveMonoPalettePrepaint(localStorage, document.palette);
        const mode = document.palette.slots[document.palette.activeSlotId - 1].present.mode;
        localStorage.setItem(ENVIRONMENT_STORAGE_KEY,
          JSON.stringify({ version: 1, theme: mode, background: document.background }));
      } catch { /* Legacy paint cache is not the working preset. */ }
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  }, []);

  const scheduleWorkingSave = useCallback((id: string) => {
    if (workingTimerRef.current !== null) clearTimeout(workingTimerRef.current);
    setWorkingStatus("Сохраняется…");
    workingTimerRef.current = setTimeout(() => {
      workingTimerRef.current = null;
      persistWorking(id);
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
      const records = current.records.map(record => record.id === current.activeId
        ? { ...record, revision: record.revision + 1, document } : record);
      const next = { ...current, records };
      workingLibraryRef.current = next;
      setWorkingLibrary(next);
      scheduleWorkingSave(next.activeId);
    } else {
      const id = crypto.randomUUID();
      const next: MonoWorkingLibrary = { version: 1, skinId: "mono-ledger-v1", generation: 0, activeId: id,
        records: [{ id, name: "Мой пресет", revision: 1, document }] };
      workingLibraryRef.current = next;
      setWorkingLibrary(next);
      scheduleWorkingSave(id);
    }
  }, [scheduleWorkingSave]);

  const colorLab = useMonoColorLab({ onWorkspaceChange });
  const loadManagedWorkspace = colorLab.loadManagedWorkspace;
  const flushWorking = () => {
    if (workingTimerRef.current === null) return true;
    clearTimeout(workingTimerRef.current);
    workingTimerRef.current = null;
    const id = workingLibraryRef.current?.activeId;
    return id ? persistWorking(id) : true;
  };

  const trialsSettled = () => {
    if (JSON.stringify(draftShapes) !== JSON.stringify(appliedShapes)) {
      setWorkingStatus("Сначала примените или отмените пробу формы.");
      return false;
    }
    if (JSON.stringify(draftOptics) !== JSON.stringify(appliedOptics)) {
      setWorkingStatus("Сначала примените или отмените пробу оптики.");
      return false;
    }
    return true;
  };

  const clearTrialWarning = () => setWorkingStatus(current => current.startsWith("Сначала примените")
    ? workingTimerRef.current !== null ? "Сохраняется…"
      : workingLibraryRef.current ? "Сохранено в этом браузере" : "Исходный образец · первое изменение создаст копию"
    : current);

  const selectWorking = (id: string) => {
    if (workingBlockedRef.current) return false;
    const current = workingLibraryRef.current;
    if (!current || current.activeId === id) return Boolean(current);
    if (!trialsSettled()) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const latest = workingLibraryRef.current!;
    const selected = latest.records.find(record => record.id === id);
    if (!selected) return false;
    const next: MonoWorkingLibrary = { ...latest, activeId: id, generation: savedGenerationRef.current + 1 };
    try {
      saveMonoWorkingLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      workingDocumentRef.current = selected.document;
      setWorkingLibrary(next);
      setAppliedOptics(selected.document.optics);
      setDraftOptics(selected.document.optics);
      setAppliedShapes(selected.document.shapes);
      setDraftShapes(selected.document.shapes);
      setBackground(selected.document.background);
      colorLab.loadManagedWorkspace(selected.document.palette);
      const mode = selected.document.palette.slots[selected.document.palette.activeSlotId - 1].present.mode;
      applyDocumentEnvironment(mode, selected.document.background);
      try {
        saveMonoPalettePrepaint(localStorage, selected.document.palette);
        localStorage.setItem(ENVIRONMENT_STORAGE_KEY,
          JSON.stringify({ version: 1, theme: mode, background: selected.document.background }));
      } catch { /* Derived first-paint cache is secondary. */ }
      setWorkingStatus("Сохранено в этом браузере");
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const copyWorking = (name: string) => {
    if (!workingReadyRef.current || workingBlockedRef.current) return false;
    if (!name || !trialsSettled()) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const current = workingLibraryRef.current;
    const id = crypto.randomUUID();
    const document = structuredClone(workingDocumentRef.current);
    const record = { id, name: name.slice(0, 80), revision: 1, document };
    const next: MonoWorkingLibrary = { version: 1, skinId: "mono-ledger-v1",
      generation: savedGenerationRef.current + 1, activeId: id,
      records: [...(current?.records ?? []), record] };
    try {
      saveMonoWorkingLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      workingDocumentRef.current = document;
      setWorkingLibrary(next);
      colorLab.loadManagedWorkspace(document.palette);
      setWorkingStatus("Сохранено в этом браузере");
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const renameWorking = (name: string) => {
    if (workingBlockedRef.current) return false;
    if (!name) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const current = workingLibraryRef.current;
    if (!current) return false;
    const records = current.records.map(record => record.id === current.activeId
      ? { ...record, name: name.slice(0, 80), revision: record.revision + 1 } : record);
    const next = { ...current, generation: savedGenerationRef.current + 1, records };
    try {
      saveMonoWorkingLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      setWorkingLibrary(next);
      setWorkingStatus("Сохранено в этом браузере");
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const createWorking = (name: string) => {
    if (!workingReadyRef.current || workingBlockedRef.current) return false;
    if (!name) return false;
    if (!trialsSettled()) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const current = workingLibraryRef.current;
    const id = crypto.randomUUID();
    const document = createMonoWorkingDocument();
    const next: MonoWorkingLibrary = { version: 1, skinId: "mono-ledger-v1",
      generation: savedGenerationRef.current + 1, activeId: id,
      records: [...(current?.records ?? []), { id, name: name.slice(0, 80), revision: 1, document }] };
    try {
      saveMonoWorkingLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      workingDocumentRef.current = document;
      setWorkingLibrary(next);
      setAppliedOptics(document.optics);
      setDraftOptics(document.optics);
      setAppliedShapes(document.shapes);
      setDraftShapes(document.shapes);
      setBackground(document.background);
      colorLab.loadManagedWorkspace(document.palette);
      applyDocumentEnvironment("dark", document.background);
      try {
        saveMonoPalettePrepaint(localStorage, document.palette);
        localStorage.setItem(ENVIRONMENT_STORAGE_KEY,
          JSON.stringify({ version: 1, theme: "dark", background: document.background }));
      }
      catch { /* Derived first-paint cache is secondary. */ }
      setWorkingStatus("Сохранено в этом браузере");
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const importWorking = (imported: MonoWorkingImport) => {
    if (!workingReadyRef.current || workingBlockedRef.current || !trialsSettled()) return false;
    colorLab.end();
    if (!flushWorking()) return false;
    const current = workingLibraryRef.current;
    const id = crypto.randomUUID();
    const document = structuredClone(imported.document);
    const name = imported.kind === "palette-only" ? "Импорт палитры" : `${imported.name} · импорт`;
    const next: MonoWorkingLibrary = { version: 1, skinId: "mono-ledger-v1",
      generation: savedGenerationRef.current + 1, activeId: id,
      records: [...(current?.records ?? []), { id, name: name.slice(0, 80), revision: 1, document }] };
    try {
      saveMonoWorkingLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      workingDocumentRef.current = document;
      setWorkingLibrary(next);
      setAppliedOptics(document.optics);
      setDraftOptics(document.optics);
      setAppliedShapes(document.shapes);
      setDraftShapes(document.shapes);
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
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };

  const acceptWorkingDocument = (document: MonoWorkingDocument) => {
    if (!workingReadyRef.current) return false;
    if (workingBlockedRef.current) {
      setWorkingStatus(workingBlockReasonRef.current);
      return false;
    }
    if (!flushWorking()) return false;
    const current = workingLibraryRef.current;
    const id = current?.activeId ?? crypto.randomUUID();
    const records = current ? current.records.map(record => record.id === id
      ? { ...record, revision: record.revision + 1, document } : record)
      : [{ id, name: "Мой пресет", revision: 1, document }];
    const next: MonoWorkingLibrary = { version: 1, skinId: "mono-ledger-v1",
      generation: savedGenerationRef.current + 1, activeId: id, records };
    try {
      saveMonoWorkingLibrary(localStorage, next, savedGenerationRef.current);
      savedGenerationRef.current = next.generation;
      workingLibraryRef.current = next;
      workingDocumentRef.current = document;
      setWorkingLibrary(next);
      setWorkingStatus("Сохранено в этом браузере");
      return true;
    } catch (error) {
      setWorkingStatus(workingSaveError(error));
      return false;
    }
  };
  const preset = PRESETS[colorLab.workspace.activeSlotId - 1].id;
  const [shapeStatus, setShapeStatus] = useState("");
  const setPreset = (next: MonoPreset) => {
    setShapeStatus("");
    colorLab.switchSlot((PRESETS.findIndex(item => item.id === next) + 1) as 1 | 2 | 3);
  };
  const [fineTab, setFineTab] = useState<"optics" | "color">("optics");
  const [quickActionMotionStatus, setQuickActionMotionStatus] = useState("Стандартный отклик: Материал · 2,7 px / 270 мс.");
  const [quickActionPreview, setQuickActionPreview] = useState<{
    preset: ControlFeedbackPreset;
    workingPresetId: string | null;
  } | null>(null);
  const quickActionOverride = quickActionPreview?.workingPresetId === (workingLibrary?.activeId ?? null)
    ? quickActionPreview?.preset ?? null : null;
  const quickActionPreset = quickActionOverride ?? MONO_QUICK_ACTION_DEFAULT;
  const theme = colorLab.shown.mode;
  const [background, setBackground] = useState<MonoBackground>("iris");
  const [viewport, setViewport] = useState<MonoViewport>(480);
  const logoPreviewRaw = useSyncExternalStore(subscribeLogoPreview, getLogoPreviewSnapshot, getServerLogoPreviewSnapshot);
  const savedLogoPreview = useMemo(() => loadMonoLogoPreview({ getItem: () => logoPreviewRaw }), [logoPreviewRaw]);
  const [logoOverride, setLogoOverride] = useState<MonoLogoPreview | null>(null);
  const logoPreview = logoOverride ?? savedLogoPreview;
  const [logoSaveStatus, setLogoSaveStatus] = useState("");
  const logoColors = useMemo(() => resolveMonoLogoColors(logoPreview.hue), [logoPreview.hue]);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [compactChrome, setCompactChrome] = useState(false);
  const [mobileRail, setMobileRail] = useState<MonoRail | null>(null);
  const [sections, setSections] = useState<Record<MonoSection, boolean>>({
    variants: true,
    viewport: true,
    shape: true,
    environment: true,
    optics: true,
  });
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
              request.workingPresetId !== (workingLibraryRef.current?.activeId ?? null)
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
        let library = loadMonoWorkingLibrary(localStorage);
        const activeId = library?.activeId;
        const saved = library?.records.find(record => record.id === activeId)?.document;
        let document = saved ?? { ...createMonoWorkingDocument(),
          optics: loadOpticalCandidate(), shapes: loadMonoShapeCandidateFrom(() => localStorage),
          background: loadEnvironmentCandidate().background };
        if (!library) {
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
              throw new Error("Старое рабочее место повреждено.");
            const environment = loadEnvironmentCandidate();
            document = { ...document, palette: palette ?? (environment.theme === "light"
              ? switchMonoPaletteTheme(document.palette, "light") : document.palette) };
          }
          const hasLegacyPresets = localStorage.getItem(MONO_PALETTE_PRESETS_KEY) !== null ||
            localStorage.getItem("wallet4i7.mono.palette-presets.v1") !== null;
          let legacyRecords: ReturnType<typeof createLegacyPaletteWorkingRecords> = [];
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
            legacyRecords = createLegacyPaletteWorkingRecords(entries);
          }
          if (legacyStateExists || legacyRecords.length) {
            library = legacyStateExists ? createRecoveredMonoWorkingLibrary(document) : {
              version: 1, skinId: "mono-ledger-v1", generation: 1,
              activeId: legacyRecords[0].id, records: [],
            };
            library = { ...library, records: [...library.records, ...legacyRecords] };
            saveMonoWorkingLibrary(localStorage, library, 0);
            document = library.records.find(record => record.id === library!.activeId)!.document;
          }
        }
        if (!alive) return;
        workingLibraryRef.current = library;
        workingDocumentRef.current = document;
        savedGenerationRef.current = library?.generation ?? 0;
        setWorkingLibrary(library);
        setAppliedOptics(document.optics);
        setDraftOptics(document.optics);
        setAppliedShapes(document.shapes);
        setDraftShapes(document.shapes);
        setBackground(document.background);
        loadManagedWorkspace(document.palette);
        setWorkingStatus(library ? "Сохранено в этом браузере" : "Исходный образец · первое изменение создаст копию");
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
  }, [loadManagedWorkspace]);

  useLayoutEffect(() => {
    const saved = loadEnvironmentCandidate();
    applyDocumentEnvironment(saved.theme, saved.background);
    const frame = requestAnimationFrame(() => {
      setBackground(saved.background);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (colorLab.ready) applyDocumentEnvironment(theme, background);
  }, [colorLab.ready, theme, background]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1199px)");
    const sync = () => setCompactChrome(query.matches);
    query.addEventListener("change", sync);
    sync();
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileRail) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const launcher = mobileRail === "quick" ? quickLauncherRef.current : fineLauncherRef.current;
      setMobileRail(null);
      requestAnimationFrame(() => launcher?.focus());
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileRail]);

  useEffect(() => {
    if (!compactChrome || !panelsVisible || !mobileRail) return;
    const panel = document.getElementById(mobileRail === "quick" ? "mono-quick-rail" : "mono-fine-rail");
    if (!panel) return;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((node) => node.getClientRects().length > 0 && !node.closest("[hidden], [inert]"));
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
  }, [compactChrome, mobileRail, panelsVisible]);

  function selectEnvironment(nextTheme: MonoTheme, nextBackground: MonoBackground) {
    applyDocumentEnvironment(nextTheme, nextBackground);
    if (theme !== nextTheme) colorLab.switchTheme(nextTheme);
    setBackground(nextBackground);
    if (workingReadyRef.current && workingDocumentRef.current.background !== nextBackground) {
      const document = { ...workingDocumentRef.current, background: nextBackground };
      workingDocumentRef.current = document;
      if (workingBlockedRef.current) {
        setWorkingStatus(workingBlockReasonRef.current);
        return;
      }
      const current = workingLibraryRef.current;
      if (current) {
        const records = current.records.map(record => record.id === current.activeId
          ? { ...record, revision: record.revision + 1, document } : record);
        const next = { ...current, records };
        workingLibraryRef.current = next;
        setWorkingLibrary(next);
        scheduleWorkingSave(next.activeId);
      } else {
        const id = crypto.randomUUID();
        const next: MonoWorkingLibrary = { version: 1, skinId: "mono-ledger-v1", generation: 0, activeId: id,
          records: [{ id, name: "Мой пресет", revision: 1, document }] };
        workingLibraryRef.current = next;
        setWorkingLibrary(next);
        scheduleWorkingSave(id);
      }
    }
    if (workingReadyRef.current && !workingBlockedRef.current) flushWorking();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) return;

      const next = PRESETS.find((item) => item.key === event.key);
      if (next) setPreset(next.id);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    if (acceptWorkingDocument({ ...workingDocumentRef.current, optics: next })) setAppliedOptics(next);
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
    if (acceptWorkingDocument({ ...workingDocumentRef.current, shapes: candidate })) {
      setAppliedShapes(candidate);
      setDraftShapes((current) => ({ ...current, [preset]: { ...candidate[preset] } }));
      setShapeStatus("Форма применена.");
    } else {
      setShapeStatus("Не удалось сохранить форму. Черновик остался в предпросмотре.");
    }
  }

  function toggleSection(section: MonoSection) {
    setSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function updateLogoPreview(next: MonoLogoPreview) {
    try {
      if (saveMonoLogoPreview(window.localStorage, next)) {
        window.dispatchEvent(new Event(LOGO_PREVIEW_CHANGE_EVENT));
        setLogoOverride(null);
        setLogoSaveStatus("Сохранено в этом браузере");
      } else {
        setLogoOverride(next);
        setLogoSaveStatus("Проба видна, но сохранить её не удалось");
      }
    } catch {
      setLogoOverride(next);
      setLogoSaveStatus("Проба видна, но сохранить её не удалось");
    }
  }

  function toggleQuickSections() {
    setSections((current) => {
      const expand = !(current.variants && current.viewport && current.shape);
      return { ...current, variants: expand, viewport: expand, shape: expand };
    });
  }

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
      workingPresetId: workingLibraryRef.current?.activeId ?? null,
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

  return (
    <div className="mono-workbench" data-mono-workbench data-panels-visible={panelsVisible}
      data-compact-chrome={compactChrome}
      data-mobile-rail={mobileRail ?? "none"} data-mono-theme={theme} style={workbenchStyle}>
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
        <span aria-hidden="true">01</span><span>Быстро</span>
      </button>
      <button ref={fineLauncherRef} type="button"
        className="mono-workbench__launcher mono-workbench__launcher--fine"
        aria-label="Открыть тонкие настройки" aria-expanded={mobileRail === "fine"}
        aria-controls="mono-fine-rail" hidden={!panelsVisible}
        onClick={() => toggleMobileRail("fine")}>
        <span>Материал</span><span aria-hidden="true">02</span>
      </button>

      {compactChrome && panelsVisible && mobileRail && (
        <button type="button" className="mono-workbench__scrim" aria-label="Закрыть боковую панель"
          onClick={closeMobileRail} />
      )}

      <aside id="mono-quick-rail" className="mono-rail mono-rail--quick" data-mono-rail="quick"
        aria-label="Быстрые настройки" aria-hidden={quickRailHidden} inert={quickRailHidden}
        role={compactChrome && mobileRail === "quick" ? "dialog" : undefined}
        aria-modal={compactChrome && mobileRail === "quick" ? true : undefined}>
        <div className="mono-rail__head">
          <div><span>V2 / 02</span><strong>MONO LAB</strong></div>
          <a href="/">V1 <span aria-hidden="true">↗</span></a>
        </div>
        <MonoWorkingPresetBar
          ready={workingReady}
          activeName={workingLibrary?.records.find(record => record.id === workingLibrary.activeId)?.name ?? "Исходный образец"}
          activeId={workingLibrary?.activeId ?? null}
          choices={workingLibrary?.records.map(record => ({ id: record.id, name: record.name,
            legacyPalette: record.source?.kind === "legacy-palette" })) ?? []}
          status={workingStatus}
          onExport={() => {
            colorLab.end();
            const name = workingLibraryRef.current?.records.find(record => record.id === workingLibraryRef.current?.activeId)?.name
              ?? "Исходный образец";
            return exportMonoWorkingPreset(name, workingDocumentRef.current);
          }}
          onImport={importWorking}
          onOpenArchive={() => {
            colorLab.setVariantsOpen(true);
            requestAnimationFrame(() => document.getElementById("mono-palette-local-variants")?.scrollIntoView?.({ block: "start" }));
          }}
          onSelect={selectWorking} onCreate={createWorking} onCopy={copyWorking} onRename={renameWorking}
          onRetry={() => workingLibraryRef.current ? persistWorking(workingLibraryRef.current.activeId) : false} />
        <div className="mono-rail__bulk">
          <button type="button" aria-controls="mono-variants-panel mono-viewport-panel mono-shape-panel"
            onClick={toggleQuickSections}>
            {sections.variants && sections.viewport && sections.shape ? "Свернуть всё" : "Развернуть всё"}
          </button>
        </div>
        <MonoRailSection id="variants" index="01" title="Варианты" expanded={sections.variants}
          onToggle={() => toggleSection("variants")}>
          <div className="mono-labbar__variants" role="group" aria-label="Варианты дизайна" data-mono-control>
            {PRESETS.map((item) => (
              <button key={item.id} type="button" aria-label={`${item.key} · ${item.label}`}
                aria-pressed={preset === item.id} onClick={() => setPreset(item.id)}>
                <span className="mono-labbar__key">{item.key}</span><span>{item.label}</span>
              </button>
            ))}
          </div>
        </MonoRailSection>
        <MonoRailSection id="viewport" index="02" title="Экран" expanded={sections.viewport}
          onToggle={() => toggleSection("viewport")}>
          <div className="mono-viewport-options" role="group" aria-label="Ширина предпросмотра" data-mono-control>
            {VIEWPORTS.map((item) => (
              <button key={item.width} type="button" aria-label={`Экран ${item.width} пикселей`}
                aria-pressed={viewport === item.width} onClick={() => setViewport(item.width)}>
                <strong>{item.width}</strong><span>{item.label}</span><small>{item.note}</small>
              </button>
            ))}
          </div>
          <div className="mono-logo-options" role="group" aria-label="Настройка логотипа" data-mono-control>
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
            <p aria-live="polite">{logoSaveStatus || "Локальная проба · отдельно от рабочего пресета"}</p>
          </div>
        </MonoRailSection>
        <MonoRailSection id="shape" index="03" title="Форма" expanded={sections.shape}
          onToggle={() => toggleSection("shape")}>
          <MonoShapeTuner values={draftShapes[preset]} dirty={shapeDirty} status={shapeStatus}
            onChange={updateShape} onDefault={resetShape} onCancel={cancelShape} onApply={applyShape}
            onOpenMotionLab={process.env.NODE_ENV === "development" && workingReady ? openQuickActionMotionLab : undefined}
            motionLabStatus={quickActionPreview && !quickActionOverride
              ? "Здесь действует стандартный Material; отдельная проба относится к другому пресету."
              : quickActionMotionStatus} />
        </MonoRailSection>
        <MonoColorLab lab={colorLab} />
        {colorLab.variantsOpen && <>
          <MonoPresetLibrary lab={colorLab} visible />
          <button type="button" className="mono-rail__archive-close" onClick={() => colorLab.setVariantsOpen(false)}>
            Закрыть архив палитр
          </button>
        </>}
        <p className="mono-rail__hint"><span>1 / 2 / 3</span> переключают характер без касания телефона.</p>
      </aside>

      <aside id="mono-fine-rail" className="mono-rail mono-rail--fine" data-mono-rail="fine"
        aria-label="Тонкие настройки" aria-hidden={fineRailHidden} inert={fineRailHidden}
        role={compactChrome && mobileRail === "fine" ? "dialog" : undefined}
        aria-modal={compactChrome && mobileRail === "fine" ? true : undefined}>
        <div className="mono-rail__head">
          <div><span>MATERIAL / LIVE</span><strong>CONTROL</strong></div>
          <span className="mono-rail__status"><i /> ONLINE</span>
        </div>
        <div className="mono-color-tabs" role="tablist" aria-label="Инспектор материала">
          {(["optics", "color"] as const).map((tab, index) => <button type="button" key={tab} id={`mono-tab-${tab}`} role="tab"
            aria-selected={fineTab === tab} aria-controls={`mono-inspector-${tab}`} tabIndex={fineTab === tab ? 0 : -1}
            onClick={() => setFineTab(tab)} onKeyDown={event => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                event.preventDefault(); const next = event.key === "Home" ? "optics" : event.key === "End" ? "color" : index === 0 ? "color" : "optics";
                setFineTab(next); document.getElementById(`mono-tab-${next}`)?.focus();
              }
            }}>{tab === "optics" ? "Оптика" : "Цвет · детали"}</button>)}
        </div>
        <div id="mono-inspector-optics" role="tabpanel" aria-labelledby="mono-tab-optics" hidden={fineTab !== "optics"}>
        <MonoRailSection id="environment" index="01" title="Среда" expanded={sections.environment}
          onToggle={() => toggleSection("environment")}>
          <div className="mono-environment" aria-label="Визуальная среда" data-mono-control>
            <div className="mono-environment__backgrounds" role="group" aria-label="Фон">
              {BACKGROUNDS.map((item) => (
                <button key={item.id} type="button" aria-pressed={background === item.id}
                  onClick={() => selectEnvironment(theme, item.id)}>
                  <span className={`mono-environment__swatch mono-environment__swatch--${item.id}`} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mono-environment__themes" role="group" aria-label="Тема">
              <button type="button" aria-label="Тёмная тема" aria-pressed={theme === "dark"}
                onClick={() => selectEnvironment("dark", background)}><span aria-hidden="true">◐</span></button>
              <button type="button" aria-label="Светлая тема" aria-pressed={theme === "light"}
                onClick={() => selectEnvironment("light", background)}><span aria-hidden="true">◑</span></button>
            </div>
          </div>
        </MonoRailSection>
        <MonoRailSection id="optics" index="02" title="Оптика" expanded={sections.optics}
          onToggle={() => toggleSection("optics")}>
          <MonoGlassTuner preset={preset} settings={draftOptics[preset]}
            onChange={updateDraft} onDefault={resetDraft} onCancel={cancelDraft} onApply={applyDraft} />
        </MonoRailSection>
        </div>
        <div id="mono-inspector-color" role="tabpanel" aria-labelledby="mono-tab-color" hidden={fineTab !== "color"}>
          <MonoColorInspector lab={colorLab} />
        </div>
      </aside>

      <div className="mono-preview-frame" inert={compactChrome && panelsVisible && mobileRail !== null}>
        <MonoScene snapshot={snapshot} appearance={{
          preset, palette: { enabled: Boolean(colorLab.shown.paletteEnabled), config: colorLab.shown.config },
          shape: draftShapes[preset], optics: draftOptics[preset],
          environment: { theme, background }, logo: logoPreview,
        }} viewport={viewport} paletteReady={colorLab.ready}
          paletteTransitionEnabled={colorLab.workspace.compare === null} quickActionPreset={quickActionPreset} />
      </div>
    </div>
  );
}
