"use client";

import { WalletIcon, type WalletIconName } from "../icons/wallet-icon";
import { WalletGooeyNav } from "../react-bits/wallet-gooey-nav/wallet-gooey-nav";
import "./dashboard-controls.css";

export type DashboardSection = "home" | "portfolio" | "explore" | "settings";

const SECTIONS = [
  { id: "home", label: "Главная", icon: "home" },
  { id: "portfolio", label: "Портфель", icon: "portfolio" },
  { id: "explore", label: "Обзор", icon: "explore" },
  { id: "settings", label: "Настройки", icon: "settings" },
] as const satisfies ReadonlyArray<{
  id: DashboardSection;
  label: string;
  icon: WalletIconName;
}>;

export function BottomNavigation(props: {
  activeSection: DashboardSection;
  reducedMotion: boolean;
  onSectionChange(section: DashboardSection): void;
}) {
  const { activeSection, reducedMotion, onSectionChange } = props;
  const items = SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    icon: <WalletIcon name={section.icon} size={24} />,
  }));

  return (
    <div className="wallet-controls__bottom-navigation">
      <WalletGooeyNav
        items={items}
        activeId={activeSection}
        onChange={onSectionChange}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
