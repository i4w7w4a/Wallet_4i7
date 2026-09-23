"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { ControlFeedbackButton } from "./control-feedback-button";
import { CHANNEL_NAME, createApplyRequest, matchesApplyAck, type ApplyLaunch, type ApplyOutcome } from "./control-feedback-handoff";
import {
  createPresetJson,
  DEFAULT_CONFIG,
  parsePresetJson,
  PREVIEW_WIDTHS,
  STORAGE_KEY,
  type ControlEffectId,
  type ControlFeedbackConfig,
  type ControlFeedbackPreset,
  type LabView,
  type PreviewWidth,
} from "./control-feedback-model";
import styles from "./design-lab.module.css";

const INITIAL_PRESET: ControlFeedbackPreset = {
  schemaVersion: 1,
  sceneId: "control-feedback-01",
  implementationVersion: 1,
  effectId: "material",
  view: "isolated",
  previewWidth: 390,
  status: "draft",
  config: DEFAULT_CONFIG,
};

const EFFECTS: Array<{ id: ControlEffectId; label: string; description: string }> = [
  { id: "baseline", label: "База", description: "Нейтральная поверхность. Контроль по скорости и ясности." },
  { id: "material", label: "Материал", description: "Глубина поверхности отвечает на нажатие и спокойно возвращается." },
  { id: "magnetic", label: "Магнит", description: "Только надпись следует за точным указателем; область нажатия неподвижна." },
];

const SOURCE: Record<ControlEffectId, string> = {
  baseline: "Внутренний контроль · без внешнего эффекта",
  material: "Референс: Cult UI Neumorph Button · собственная компактная адаптация",
  magnetic: "Референс: Motion Primitives Magnetic · ограничен внутренний слой",
};

type PreviewStyle = CSSProperties & { "--preview-width": string };

type NumericControlProps = {
  label: string;
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled: boolean;
  onChange: (value: number) => void;
};

function NumericControl({ label, id, value, min, max, step, unit, disabled, onChange }: NumericControlProps) {
  const change = (raw: string) => {
    const next = Number(raw);
    if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
  };
  return (
    <div className={styles.control}>
      <label htmlFor={`${id}-number`}>{label}</label>
      <div className={styles.controlInputs}>
        <input
          aria-label={`${label} — ползунок`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => change(event.currentTarget.value)}
        />
        <input
          id={`${id}-number`}
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => change(event.currentTarget.value)}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
}

function subscribeToSaved(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readSaved() {
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function emptyServerSnapshot() { return null; }

export function DesignLab({ launch = null }: { launch?: ApplyLaunch | null }) {
  const storedRaw = useSyncExternalStore(subscribeToSaved, readSaved, emptyServerSnapshot);
  const storedPreset = useMemo(() => {
    try { return storedRaw ? parsePresetJson(storedRaw) : null; } catch { return null; }
  }, [storedRaw]);
  const [draft, setDraft] = useState<ControlFeedbackPreset | null>(null);
  const preset = draft ?? storedPreset ?? INITIAL_PRESET;
  const [comparing, setComparing] = useState(false);
  const [activationCount, setActivationCount] = useState(0);
  const [status, setStatus] = useState("");
  const [exported, setExported] = useState("");
  const [importText, setImportText] = useState("");
  const [pendingImport, setPendingImport] = useState<ControlFeedbackPreset | null>(null);
  const [applyPending, setApplyPending] = useState(false);
  const applyResourceRef = useRef<{ channel: BroadcastChannel; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => () => {
    const resource = applyResourceRef.current;
    if (resource) {
      clearTimeout(resource.timer);
      resource.channel.close();
      applyResourceRef.current = null;
    }
  }, []);
  const statusMessage = status || (storedRaw
    ? (storedPreset ? "Сохранённая проба восстановлена." : "Сохранённая проба повреждена; открыт исходный черновик.")
    : "Локальная проба ещё не сохранена.");

  const update = (next: ControlFeedbackPreset) => {
    setDraft(next);
    setStatus("Черновик изменён. Сохранение — отдельная команда.");
  };
  const setEffect = (effectId: ControlEffectId) => {
    setComparing(false);
    update({ ...preset, effectId });
  };
  const setView = (view: LabView) => update({ ...preset, view });
  const setWidth = (previewWidth: PreviewWidth) => update({ ...preset, previewWidth });
  const setControl = (name: keyof ControlFeedbackConfig, value: number) => {
    update({ ...preset, config: { ...preset.config, [name]: value } });
  };
  const save = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, createPresetJson(preset));
      setStatus("Проба сохранена только в локальном Motion Lab.");
    } catch {
      setStatus("Не удалось сохранить пробу. Экспорт JSON остаётся доступен.");
    }
  };
  const exportJson = () => {
    setExported(createPresetJson(preset));
    setStatus("JSON готов: выделите текст и скопируйте его.");
  };
  const validateImport = () => {
    try {
      const next = parsePresetJson(importText);
      setPendingImport(next);
      setStatus(`Импорт проверен: ${EFFECTS.find((effect) => effect.id === next.effectId)?.label}, ${next.previewWidth} px. Примените его отдельно.`);
    } catch {
      setPendingImport(null);
      setStatus("Импорт отклонён: структура, версия или значения недопустимы.");
    }
  };
  const applyImport = () => {
    if (!pendingImport) return;
    setDraft(pendingImport);
    setComparing(false);
    setPendingImport(null);
    setStatus("Проверенный импорт применён к черновику. Для записи нажмите «Сохранить пробу».");
  };
  const applyToMono = () => {
    if (!launch || applyPending) return;
    if (typeof BroadcastChannel === "undefined") {
      setStatus("Передача между вкладками недоступна. Используйте экспорт JSON.");
      return;
    }
    let request: ReturnType<typeof createApplyRequest>;
    try { request = createApplyRequest(launch, crypto.randomUUID(), preset); }
    catch {
      setStatus("Проба не прошла проверку перед применением.");
      return;
    }
    let channel: BroadcastChannel;
    try { channel = new BroadcastChannel(CHANNEL_NAME); }
    catch {
      setStatus("Не удалось открыть связь с MONO. Используйте экспорт JSON.");
      return;
    }
    const finish = () => {
      const resource = applyResourceRef.current;
      if (resource?.channel !== channel) return false;
      clearTimeout(resource.timer);
      channel.close();
      applyResourceRef.current = null;
      setApplyPending(false);
      return true;
    };
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!matchesApplyAck(request, event.data) || !finish()) return;
      const outcome = (event.data as { outcome: ApplyOutcome }).outcome;
      const messages: Record<ApplyOutcome, string> = {
        applied: "MONO подтвердил применение в локальной примерке. Рабочий пресет не сохранён.",
        "stale-session": "Сеанс MONO устарел. Откройте лабораторию снова из настроек.",
        "target-mismatch": "MONO отклонил цель. Откройте лабораторию из нужной кнопки.",
        "preset-changed": "Активный рабочий пресет изменился. Откройте лабораторию снова.",
        "invalid-preset": "MONO отклонил параметры пробы.",
      };
      setStatus(messages[outcome]);
    };
    const timer = setTimeout(() => {
      if (finish()) setStatus("MONO не ответил. Проверьте исходную вкладку и попробуйте снова.");
    }, 2400);
    applyResourceRef.current = { channel, timer };
    setApplyPending(true);
    setStatus("Ожидаем подтверждения от MONO…");
    channel.postMessage(request);
  };
  const activeEffect = comparing ? "baseline" : preset.effectId;
  const previewStyle: PreviewStyle = { "--preview-width": `${preset.previewWidth}px` };

  return (
    <main className={styles.lab}>
      <header className={styles.header}>
        <div className={styles.brand}>NOVEX <small>DESIGN RESEARCH</small></div>
        <div className={styles.headerCode}>MOTION LAB / 001</div>
      </header>

      <div className={styles.intro}>
        <p className={styles.eyebrow}>CONTROL-FEEDBACK-01 / ЛОКАЛЬНЫЙ ПИЛОТ</p>
        <h1>Один объект.<br /><em>Три ощущения.</em></h1>
        <p>Наведите указатель, нажмите, затем сравните с нейтральной базой. Геометрия кнопки и её действие одинаковы.</p>
      </div>

      <div className={styles.layout}>
        <aside className={styles.panel} aria-label="Настройки Motion Lab">
          <div className={styles.panelHeading}><span>01 / Характер</span><span>LIVE DRAFT</span></div>
          <div className={styles.choiceGroup} role="group" aria-label="Вариант отклика">
            {EFFECTS.map((effect) => (
              <button
                key={effect.id}
                type="button"
                aria-pressed={preset.effectId === effect.id}
                aria-label={effect.label}
                aria-describedby={`effect-${effect.id}-description`}
                className={styles.choice}
                onClick={() => setEffect(effect.id)}
              >
                <strong>{effect.label}</strong><span id={`effect-${effect.id}-description`}>{effect.description}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.compare}
            aria-pressed={comparing}
            disabled={preset.effectId === "baseline"}
            onClick={() => setComparing((value) => !value)}
          >
            {comparing ? "Вернуться к варианту" : "Сравнить с базой"}
          </button>

          <div className={styles.divider} />
          <div className={styles.panelHeading}><span>02 / Точная мера</span><span>3 CONTROL</span></div>
          <NumericControl label="Глубина нажатия" id="press-depth" value={preset.config.pressDepth} min={0} max={3} step={0.1} unit="px" disabled={preset.effectId !== "material"} onChange={(value) => setControl("pressDepth", value)} />
          <NumericControl label="Ход магнитного слоя" id="magnetic-travel" value={preset.config.magneticTravel} min={0} max={8} step={0.5} unit="px" disabled={preset.effectId !== "magnetic"} onChange={(value) => setControl("magneticTravel", value)} />
          <NumericControl label="Мягкость возврата" id="settle" value={preset.config.settleMs} min={100} max={320} step={10} unit="ms" disabled={preset.effectId === "baseline"} onChange={(value) => setControl("settleMs", value)} />
          <button type="button" className={styles.textButton} onClick={() => update({ ...preset, config: { ...DEFAULT_CONFIG } })}>Сбросить настройки</button>
        </aside>

        <section className={styles.stagePanel} aria-label="Сцена Motion Lab">
          <div className={styles.stageToolbar}>
            <div className={styles.modeGroup} role="group" aria-label="Режим просмотра">
              <button type="button" aria-pressed={preset.view === "isolated"} onClick={() => setView("isolated")}>Изолированно</button>
              <button type="button" aria-pressed={preset.view === "context"} onClick={() => setView("context")}>Контекст</button>
            </div>
            <div className={styles.widthGroup} role="group" aria-label="Ширина сцены">
              {PREVIEW_WIDTHS.map((width) => <button key={width} type="button" aria-pressed={preset.previewWidth === width} onClick={() => setWidth(width)}>{width}</button>)}
            </div>
          </div>

          <div className={styles.stage}>
            <div className={styles.preview} data-preview-width={preset.previewWidth} style={previewStyle}>
              {preset.view === "isolated" ? (
                <div className={styles.isolated}>
                  <span className={styles.sceneIndex}>N / 01</span>
                  <span className={styles.crosshair} aria-hidden="true" />
                  <ControlFeedbackButton key={activeEffect} effectId={activeEffect} config={preset.config} onActivate={() => setActivationCount((count) => count + 1)} />
                  <span className={styles.sceneCaption}>ОБЛАСТЬ ОТКЛИКА · 168 × 48</span>
                </div>
              ) : (
                <div className={styles.context}>
                  <div className={styles.contextTop}><strong>NOVEX</strong><span>ДЕМО-СРЕДА</span><span>01 / 03</span></div>
                  <div className={styles.contextBody}>
                    <small>ПРОБА ИНТЕРФЕЙСА</small>
                    <h2>Точное действие.<br />Спокойный ответ.</h2>
                    <div className={styles.fixtureLines} aria-hidden="true"><i /><i /><i /></div>
                    <div className={styles.contextAction}>
                      <ControlFeedbackButton key={activeEffect} effectId={activeEffect} config={preset.config} onActivate={() => setActivationCount((count) => count + 1)} />
                      <p>Только тестовый индикатор.<br />Без финансового действия.</p>
                    </div>
                  </div>
                  <div className={styles.contextFoot}>NOVEX / CONTROL STUDY <span>LOCAL ONLY</span></div>
                </div>
              )}
            </div>
          </div>
          <div className={styles.stageFoot}>
            <span>{SOURCE[activeEffect]}</span>
            <output aria-live="polite">Срабатываний: {activationCount}</output>
          </div>
        </section>
      </div>

      <section className={styles.persistence} aria-label="Проба и перенос JSON">
        <div className={styles.persistenceHead}>
          <div><span>03 / Сохранение</span><h2>Зафиксировать пробу</h2></div>
          <p>Локальная запись не меняет вид кошелька. Импорт сначала проверяется, затем применяется к черновику.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={save}>Сохранить пробу</button>
          <button type="button" onClick={exportJson}>Экспорт JSON</button>
        </div>
        {launch && (
          <div className={styles.applyPanel}>
            <p>Эта вкладка открыта из MONO. Apply меняет только живую локальную примерку; сохранение пробы остаётся отдельным действием.</p>
            <button type="button" disabled={applyPending} onClick={applyToMono}>Применить к локальной примерке MONO</button>
          </div>
        )}
        <p className={styles.status} role="status">{statusMessage}</p>
        <div className={styles.jsonGrid}>
          <label>Экспортированная проба<textarea aria-label="Экспортированная проба" value={exported} readOnly placeholder="Нажмите «Экспорт JSON»" /></label>
          <label>Импорт JSON<textarea aria-label="Импорт JSON" value={importText} maxLength={8192} onChange={(event) => { setImportText(event.currentTarget.value); setPendingImport(null); }} placeholder="Вставьте JSON пробы" /></label>
        </div>
        {pendingImport && (
          <section className={styles.importPreview} aria-label="Предпросмотр импорта">
            <strong>Проверенный кандидат · {EFFECTS.find((effect) => effect.id === pendingImport.effectId)?.label}</strong>
            <span>{pendingImport.view === "isolated" ? "Изолированный вид" : "Контекстный вид"} · {pendingImport.previewWidth} px</span>
            <span>Глубина {pendingImport.config.pressDepth} px · магнитный ход {pendingImport.config.magneticTravel} px · возврат {pendingImport.config.settleMs} ms</span>
          </section>
        )}
        <div className={styles.actions}>
          <button type="button" onClick={validateImport}>Проверить импорт</button>
          <button type="button" disabled={!pendingImport} onClick={applyImport}>Применить импорт</button>
        </div>
      </section>
    </main>
  );
}
