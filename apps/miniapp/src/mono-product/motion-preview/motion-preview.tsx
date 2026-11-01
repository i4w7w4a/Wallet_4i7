"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { DisclosureMotion } from "../motion/disclosure-motion";
import { useLinkedCardMotion } from "../motion/linked-card-motion";
import motion from "../motion/motion-patterns.module.css";
import styles from "./motion-preview.module.css";

type Mode = "normal" | "reduced" | "effects-off";
const cards = [{ id: "aurora", title: "Север" }, { id: "orbit", title: "Орбита" }];

export function MotionPreview() {
  const [mode, setMode] = useState<Mode>("normal");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [privateView, setPrivateView] = useState(false);
  const [open, setOpen] = useState(false);
  const surfaceRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousId = useRef<string | null>(null);
  useLinkedCardMotion({ surfaceRef, contentRef, detailId, enabled: mode === "normal" });

  useLayoutEffect(() => {
    const old = previousId.current;
    previousId.current = detailId;
    if (detailId) document.getElementById("motion-detail-heading")?.focus({ preventScroll: true });
    else if (old) document.getElementById(`motion-card-${old}`)?.focus({ preventScroll: true });
  }, [detailId]);
  useLayoutEffect(() => {
    if (open) document.getElementById("motion-surface-close")?.focus({ preventScroll: true });
  }, [open]);

  return <main ref={surfaceRef} className={`${styles.page} ${motion.scope}`}
    data-mono-motion={mode === "normal" ? "ready" : "static"}
    onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); } }}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.kicker}>NOVEX / MOTION R1</p>
        <h1>Движение как связь</h1>
        <p>Локальная примерка на условных данных. Состояние меняется сразу; движение лишь помогает его увидеть.</p>
      </header>

      <section className={styles.controls} aria-label="Режим примерки">
        <div><span className={styles.label}>Режим движения</span>
          <div className={styles.switches}>
            {(["normal", "reduced", "effects-off"] as const).map((value) =>
              <button key={value} type="button" className={`${styles.control} ${motion.feedback}`}
                aria-pressed={mode === value} onClick={() => setMode(value)}>
                {value === "normal" ? "Обычный" : value === "reduced" ? "Reduced" : "Effects off"}
              </button>)}
          </div>
        </div>
        <button type="button" className={`${styles.control} ${motion.feedback}`}
          aria-pressed={privateView} onClick={() => setPrivateView(value => !value)}>
          {privateView ? "Показать данные" : "Скрыть данные"}
        </button>
      </section>

      <div className={styles.grid}>
        <section className={styles.stage} aria-label="Карточка и детали">
          <div className={styles.stageHeader}><span>01 / ПЕРЕХОД</span><span>Карточка → детали → возврат</span></div>
          <div ref={contentRef} className={styles.view} aria-live="polite">
            {detailId === null ? <div className={styles.cardList}>
              <h2>Пространства</h2><p className={styles.muted}>Выберите карточку, чтобы открыть её содержимое.</p>
              {cards.map(card => <button id={`motion-card-${card.id}`} key={card.id} type="button"
                className={`${styles.card} ${motion.feedback}`} onClick={() => setDetailId(card.id)}>
                <span className={styles.orb} aria-hidden="true" /><span><strong>{card.title}</strong><small>Условная карточка</small></span><span aria-hidden="true">↗</span>
              </button>)}
            </div> : <div className={styles.detail}>
              <button type="button" className={`${styles.back} ${motion.feedback}`} onClick={() => setDetailId(null)}>← Назад</button>
              <span className={styles.orb} aria-hidden="true" />
              <h2 id="motion-detail-heading" tabIndex={-1}>{cards.find(card => card.id === detailId)?.title}</h2>
              <p className={styles.muted}>Условные детали выбранной карточки</p>
              <p className={styles.value}>{privateView ? "••••" : "Данные доступны"}</p>
              <button type="button" className={`${styles.control} ${motion.feedback}`}
                onClick={() => setDetailId(detailId === "aurora" ? "orbit" : "aurora")}>Другая карточка</button>
            </div>}
          </div>
        </section>
        <section className={styles.stage} aria-label="Поверхность">
          <div className={styles.stageHeader}><span>02 / ПОВЕРХНОСТЬ</span><span>Открыть → Escape → фокус</span></div>
          <div className={styles.panelContent}>
            <h2>Дополнительное действие</h2>
            <p className={styles.muted}>Открытая область остаётся частью страницы и не блокирует её.</p>
            <button id="motion-surface-launcher" type="button" className={`${styles.primary} ${motion.feedback}`}
              aria-expanded={open} aria-controls="motion-surface" onClick={() => setOpen(value => !value)}>
              {open ? "Закрыть область" : "Открыть область"}
            </button>
            <DisclosureMotion open={open} id="motion-surface" launcherId="motion-surface-launcher" role="region" labelledBy="motion-surface-title">
              <div className={styles.reveal}>
                <h3 id="motion-surface-title">Открытая область</h3>
                <p className={styles.muted}>Закройте кнопкой или клавишей Escape. Фокус вернётся к открывшей кнопке.</p>
                <button id="motion-surface-close" type="button" className={`${styles.control} ${motion.feedback}`}
                  onClick={() => setOpen(false)}>Закрыть</button>
              </div>
            </DisclosureMotion>
          </div>
        </section>
      </div>
      <p className={styles.footnote}>Движение отключается системным reduced motion. Переключатели действуют только в этой вкладке.</p>
    </div>
  </main>;
}
