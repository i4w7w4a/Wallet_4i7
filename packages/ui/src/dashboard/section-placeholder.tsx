"use client";

import { useId } from "react";

import { type DashboardSection } from "./bottom-navigation";
import "./dashboard-controls.css";

const SECTION_CONTENT = {
  home: {
    title: "Главная",
    description: "Главный экран кошелька отображается здесь.",
  },
  portfolio: {
    title: "Портфель",
    description: "Состав и распределение демонстрационного портфеля появятся здесь.",
  },
  explore: {
    title: "Обзор",
    description: "Демонстрационные сервисы и новые возможности появятся здесь.",
  },
  settings: {
    title: "Настройки",
    description: "Параметры приложения и темы будут доступны здесь.",
  },
} as const satisfies Record<DashboardSection, { title: string; description: string }>;

export function SectionPlaceholder(props: { section: DashboardSection }) {
  const content = SECTION_CONTENT[props.section];
  const titleId = useId();

  return (
    <section
      className="wallet-controls__section-placeholder"
      aria-labelledby={titleId}
      data-dashboard-surface="content"
    >
      <span className="wallet-controls__section-kicker">Раздел</span>
      <h2 id={titleId}>{content.title}</h2>
      <p>{content.description}</p>
    </section>
  );
}
