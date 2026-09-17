"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { WalletSnapshot } from "@wallet/core";
import {
  MONO_GLASS_DEFAULTS,
  MonoOpticalGlass,
  normalizeMonoGlassSettings,
  type MonoGlassSettings,
} from "@wallet/ui";

import { MonoGlassTuner } from "./mono-glass-tuner";
import { MonoColorLab, MonoColorInspector, useMonoColorLab } from "./mono-color-lab";
import { stepTideMotion, type TideMotionState } from "./mono-tide-motion";

import "./mono-fonts.css";
import "./mono-preview.css";
import "./mono-atmosphere.css";
import "./mono-motion.css";
import "./mono-interactions.css";
import "./mono-environment.css";
import "./mono-theme.css";
import "./mono-workbench.css";

type MonoPreset = "ledger" | "frost" | "mercury";
type MonoSettingsMap = Record<MonoPreset, MonoGlassSettings>;
type MonoTheme = "dark" | "light";
type MonoBackground = "iris" | "tide" | "strata";
type MonoViewport = 320 | 390 | 430 | 480;
type MonoRail = "quick" | "fine";
type MonoSection = "variants" | "viewport" | "environment" | "optics";

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
  const colorLab = useMonoColorLab();
  const preset = PRESETS[colorLab.workspace.activeSlotId - 1].id;
  const setPreset = (next: MonoPreset) => colorLab.switchSlot((PRESETS.findIndex(item => item.id === next) + 1) as 1 | 2 | 3);
  const [fineTab, setFineTab] = useState<"optics" | "color">("optics");
  const [balanceHidden, setBalanceHidden] = useState(snapshot.balance.hidden);
  const theme = colorLab.shown.mode;
  const [background, setBackground] = useState<MonoBackground>("iris");
  const [viewport, setViewport] = useState<MonoViewport>(480);
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [compactChrome, setCompactChrome] = useState(false);
  const [mobileRail, setMobileRail] = useState<MonoRail | null>(null);
  const [sections, setSections] = useState<Record<MonoSection, boolean>>({
    variants: true,
    viewport: true,
    environment: true,
    optics: true,
  });
  const [appliedOptics, setAppliedOptics] = useState<MonoSettingsMap>(makeDefaultOptics);
  const [draftOptics, setDraftOptics] = useState<MonoSettingsMap>(makeDefaultOptics);
  const pageRef = useRef<HTMLElement>(null);
  const paletteCrossfadeRef = useRef<HTMLDivElement>(null);
  const previousPaletteBackgroundRef = useRef<string | null>(null);
  const paletteAnimationRef = useRef<Animation | null>(null);
  const quickLauncherRef = useRef<HTMLButtonElement>(null);
  const fineLauncherRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = loadOpticalCandidate();
      setAppliedOptics(saved);
      setDraftOptics(saved);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

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
    if (!previous || previous === next || !colorLab.ready || !colorLab.shown.paletteEnabled ||
        colorLab.workspace.compare !== null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
  }, [colorLab.style, colorLab.ready, colorLab.shown.paletteEnabled, colorLab.workspace.compare, theme, background, preset]);

  useEffect(() => () => paletteAnimationRef.current?.cancel(), []);

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

  useEffect(() => {
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
  }, [stopAtmosphere]);

  function selectEnvironment(nextTheme: MonoTheme, nextBackground: MonoBackground) {
    applyDocumentEnvironment(nextTheme, nextBackground);
    colorLab.switchTheme(nextTheme);
    setBackground(nextBackground);
    try {
      localStorage.setItem(ENVIRONMENT_STORAGE_KEY,
        JSON.stringify({ version: 1, theme: nextTheme, background: nextBackground }));
    } catch {
      // Preview selection still works when browser storage is unavailable.
    }
  }

  useEffect(() => {
    if (background !== "tide") {
      rippleRootRef.current?.replaceChildren();
      tideMotionRef.current = null;
    }
    if (background !== "strata") {
      document.querySelectorAll<HTMLElement>(".mono-page .mono-atmosphere__node")
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
    const nodes = document.querySelectorAll<HTMLElement>(".mono-page .mono-atmosphere__node");
    nodes.forEach((node, index) => {
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

  function applyDraft() {
    const next = { ...appliedOptics, [preset]: { ...draftOptics[preset] } };
    setAppliedOptics(next);
    try {
      localStorage.setItem(OPTICAL_STORAGE_KEY, JSON.stringify({ version: 1, presets: next }));
    } catch {
      // The live material still works when browser storage is unavailable.
    }
  }

  function toggleSection(section: MonoSection) {
    setSections((current) => ({ ...current, [section]: !current[section] }));
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

  const workbenchStyle = { "--mono-preview-width": `${viewport}px` } as CSSProperties;
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
          <div><span>W / 02</span><strong>MONO LAB</strong></div>
          <a href="/">V1 <span aria-hidden="true">↗</span></a>
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
        </MonoRailSection>
        <MonoColorLab lab={colorLab} />
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
            onChange={updateDraft} onDefault={resetDraft} onApply={applyDraft} />
        </MonoRailSection>
        </div>
        <div id="mono-inspector-color" role="tabpanel" aria-labelledby="mono-tab-color" hidden={fineTab !== "color"}>
          <MonoColorInspector lab={colorLab} />
        </div>
      </aside>

      <div className="mono-preview-frame" inert={compactChrome && panelsVisible && mobileRail !== null}>
        <main ref={pageRef} className="mono-page" data-mono-preview data-mono-preset={preset}
          data-palette-enabled={Boolean(colorLab.shown.paletteEnabled)} data-palette-ready={colorLab.ready} style={colorLab.style}
          data-mono-theme={theme} data-mono-background={background} data-mono-viewport={viewport}
          data-pointer-active="false" onPointerMove={moveAtmosphere} onPointerLeave={restAtmosphere}>
          <div ref={paletteCrossfadeRef} className="mono-palette-crossfade" data-mono-palette-crossfade aria-hidden="true" />
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
          </div>

      <div className="mono-scene">
        <header className="mono-app-header">
          <div className="mono-app-header__mark" aria-hidden="true"><span>W</span><i /></div>
          <div className="mono-app-header__person">
            <span>WALLET_4I7</span>
            <strong>{snapshot.profile.name}</strong>
          </div>
          <div className="mono-app-header__signal" aria-label="Визуальный прототип, демо-данные">
            <span className="mono-app-header__signal-dot" />
            DEMO
          </div>
        </header>

        <section className="mono-hero" aria-labelledby="mono-balance-title">
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
        </section>

        <section className="mono-actions" aria-label="Действия — визуальный прототип">
          {ACTIONS.map((action) => (
            <div className="mono-actions__item" key={action.label}>
              <span className="mono-actions__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d={action.path} /></svg>
              </span>
              <span>{action.label}</span>
            </div>
          ))}
        </section>

        <div className="mono-promo-frame">
          <MonoOpticalGlass preset={preset} settings={draftOptics[preset]} active className="mono-promo">
            <div className="mono-promo__content">
              <span className="mono-promo__overline">WALLET_4I7 / PRIVATE</span>
              <strong>Контроль<br />без шума.</strong>
              <span className="mono-promo__foot">МАТЕРИАЛ / 001 <span aria-hidden="true">↗</span></span>
            </div>
            <div className="mono-promo__seal" aria-hidden="true"><span>4i7</span></div>
          </MonoOpticalGlass>
        </div>

        <section className="mono-assets" aria-labelledby="mono-assets-title">
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
        </section>
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
      </div>
    </div>
  );
}
