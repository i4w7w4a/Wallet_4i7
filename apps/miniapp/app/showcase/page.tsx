import type { Metadata } from "next";
import Image from "next/image";

import styles from "./showcase.module.css";

export const metadata: Metadata = {
  title: "Семь состояний Novex · Витрина",
  description: "Семь прямых ссылок на опубликованные дизайн-прототипы Novex Wallet.",
};

const presets = [
  { id: 1, name: "Графит" },
  { id: 2, name: "Живая среда" },
  { id: 3, name: "Светлый" },
  { id: 4, name: "Терминал" },
  { id: 5, name: "Минимал" },
  { id: 6, name: "Мягкое стекло" },
  { id: 7, name: "Фирменный" },
] as const;

export default function ShowcasePage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.topline}>
            <span className={styles.brand}>NOVEX</span>
            <span className={styles.section}>ВИТРИНА / 01—07</span>
          </div>
          <div className={styles.intro}>
            <div>
              <p className={styles.eyebrow}>КОЛЛЕКЦИЯ ДИЗАЙНА</p>
              <h1>Семь состояний Novex</h1>
            </div>
            <p className={styles.description}>
              Выберите направление и откройте его напрямую. Здесь только навигация: каждый пресет живёт на своей странице.
            </p>
          </div>
          <p className={styles.notice}>Интерактивный дизайн-прототип · демонстрационные данные</p>
        </header>

        <div className={styles.grid} aria-label="Пресеты Novex">
          {presets.map(({ id, name }) => (
            <a className={styles.card} href={`/p/${id}`} key={id}>
              {id <= 5 ? (
                <div className={`${styles.swatch} ${styles.capture}`} aria-hidden="true">
                  <Image
                    src={`/showcase/slot-${id}-mobile.jpg`}
                    alt=""
                    fill
                    unoptimized
                    loading="eager"
                    sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 25vw"
                  />
                </div>
              ) : (
                <div className={styles.swatch} aria-hidden="true">
                  <span className={styles.swatchLabel}>УСЛОВНЫЙ ЦВЕТОВОЙ МАРКЕР</span>
                  <span className={styles.swatchLine} />
                  <span className={styles.swatchLine} />
                  <span className={styles.swatchLine} />
                </div>
              )}
              <div className={styles.cardFooter}>
                <span className={styles.cardText}>
                  <span className={styles.name}>{id} {name}</span>
                  <span className={styles.kind}>{id <= 5 ? "Снимок кандидата" : "Цветовой маркер"}</span>
                </span>
                <span className={styles.arrow} aria-hidden="true">↗</span>
              </div>
            </a>
          ))}
        </div>

        <footer className={styles.footer}>
          Карточки 1–5 показывают локальных кандидатов; 6–7 — условные цветовые маркеры.
          Откройте пресет, чтобы увидеть опубликованную версию.
        </footer>
      </div>
    </main>
  );
}
