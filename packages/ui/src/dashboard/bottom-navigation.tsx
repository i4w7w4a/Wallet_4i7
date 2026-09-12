"use client";

import { GlassSurface } from "../primitives/glass-surface";
import "./dashboard-controls.css";

export type DashboardSection = "home" | "portfolio" | "explore" | "settings";

const SECTIONS = [
  { id: "home", label: "Главная", icon: "⌂" },
  { id: "portfolio", label: "Портфель", icon: "◫" },
  { id: "explore", label: "Обзор", icon: "◇" },
  { id: "settings", label: "Настройки", icon: "⚙" },
] as const satisfies ReadonlyArray<{
  id: DashboardSection;
  label: string;
  icon: string;
}>;

export function BottomNavigation(props: {
  activeSection: DashboardSection;
  onSectionChange(section: DashboardSection): void;
}) {
  const { activeSection, onSectionChange } = props;

  return (
    <nav className="wallet-controls__bottom-navigation" aria-label="Основная навигация">
      <GlassSurface variant="regular" className="wallet-controls__bottom-navigation-surface">
        <ul className="wallet-controls__navigation-list">
          {SECTIONS.map((section) => {
            const active = section.id === activeSection;

            return (
              <li key={section.id}>
                <button
                  type="button"
                  className="wallet-controls__navigation-item"
                  aria-label={section.label}
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "true" : "false"}
                  onClick={() => onSectionChange(section.id)}
                >
                  <span className="wallet-controls__navigation-icon" aria-hidden="true">
                    {section.icon}
                  </span>
                  <span>{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </GlassSurface>
    </nav>
  );
}
