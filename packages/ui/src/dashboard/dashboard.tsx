"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ChartPeriod, WalletAsset, WalletSnapshot } from "@wallet/core";
import type { PlatformBridge } from "@wallet/platform";

import { BottomSheet } from "../primitives/bottom-sheet";
import { ThemeStudio } from "../theme/theme-studio";
import { AssetListCard } from "./asset-list-card";
import { BalanceHero } from "./balance-hero";
import { BottomNavigation, type DashboardSection } from "./bottom-navigation";
import { DemoActionSheet } from "./demo-action-sheet";
import { LiquidPromoCard } from "./liquid-promo-card";
import { PortfolioSummaryCard } from "./portfolio-summary-card";
import { ProfileHeader } from "./profile-header";
import { QuickActions, type DashboardAction } from "./quick-actions";
import { SectionPlaceholder } from "./section-placeholder";
import "./dashboard.css";

type DashboardOverlay =
  | { type: "action"; action: DashboardAction }
  | { type: "asset"; asset: WalletAsset }
  | { type: "search" }
  | { type: "notifications" }
  | { type: "theme" };

export function Dashboard(props: {
  snapshot: WalletSnapshot;
  platform: PlatformBridge;
  video: { active: boolean; reducedMotion: boolean; saveData: boolean };
}) {
  const { snapshot, platform, video } = props;
  const [period, setPeriod] = useState<ChartPeriod>("1D");
  const [balanceHidden, setBalanceHidden] = useState(snapshot.balance.hidden);
  const [overlay, setOverlay] = useState<DashboardOverlay | null>(null);
  const [sectionHistory, setSectionHistory] = useState<DashboardSection[]>(["home"]);
  const activeSection = sectionHistory[sectionHistory.length - 1] ?? "home";
  const unreadCount = useMemo(
    () => snapshot.notifications.filter((notification) => notification.unread).length,
    [snapshot.notifications],
  );
  const safeArea = platform.getSafeArea();
  const shellStyle = {
    "--dashboard-safe-top": `${safeArea.top}px`,
    "--dashboard-safe-right": `${safeArea.right}px`,
    "--dashboard-safe-bottom": `${safeArea.bottom}px`,
    "--dashboard-safe-left": `${safeArea.left}px`,
  } as CSSProperties;

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const goBack = useCallback(() => {
    if (overlay !== null) {
      setOverlay(null);
      return;
    }

    setSectionHistory((current) =>
      current.length > 1 ? current.slice(0, current.length - 1) : current,
    );
  }, [overlay]);

  useEffect(() => {
    const canGoBack = overlay !== null || sectionHistory.length > 1;
    return platform.setBackHandler(canGoBack ? goBack : null);
  }, [goBack, overlay, platform, sectionHistory.length]);

  function openAction(action: DashboardAction) {
    platform.haptic("selection");
    setOverlay({ type: "action", action });
  }

  function selectSection(section: DashboardSection) {
    if (section === activeSection) {
      return;
    }

    platform.haptic("selection");
    setSectionHistory((current) => [...current, section]);
  }

  return (
    <div
      className="wallet-dashboard"
      data-platform={platform.kind}
      style={shellStyle}
    >
      <ProfileHeader
        profile={snapshot.profile}
        unreadCount={unreadCount}
        onSearch={() => setOverlay({ type: "search" })}
        onNotifications={() => setOverlay({ type: "notifications" })}
        onTheme={() => setOverlay({ type: "theme" })}
      />

      <main className="wallet-dashboard__content">
        {activeSection === "home" ? (
          <>
            <BalanceHero
              balance={{ ...snapshot.balance, hidden: balanceHidden }}
              chart={snapshot.chart}
              period={period}
              onPeriodChange={setPeriod}
              video={video}
              onToggleHidden={() => {
                platform.haptic("selection");
                setBalanceHidden((hidden) => !hidden);
              }}
            />
            <QuickActions onAction={openAction} />
            <LiquidPromoCard onOpen={() => openAction("swap")} />
            <AssetListCard
              assets={snapshot.assets}
              onSelect={(asset) => setOverlay({ type: "asset", asset })}
            />
            <PortfolioSummaryCard balance={snapshot.balance} assets={snapshot.assets} />
          </>
        ) : (
          <SectionPlaceholder section={activeSection} />
        )}
      </main>

      <div className="wallet-dashboard__navigation">
        <BottomNavigation activeSection={activeSection} onSectionChange={selectSection} />
      </div>

      <DemoActionSheet
        action={overlay?.type === "action" ? overlay.action : null}
        onClose={closeOverlay}
      />
      <ThemeStudio open={overlay?.type === "theme"} onClose={closeOverlay} />
      <InformationSheet overlay={overlay} snapshot={snapshot} onClose={closeOverlay} />
    </div>
  );
}

function InformationSheet(props: {
  overlay: DashboardOverlay | null;
  snapshot: WalletSnapshot;
  onClose(): void;
}) {
  const { overlay, snapshot, onClose } = props;

  if (overlay?.type === "search") {
    return (
      <BottomSheet open title="Поиск" onClose={onClose}>
        <label className="wallet-dashboard__search">
          <span>Найдите актив или раздел</span>
          <input type="search" aria-label="Поиск по кошельку" placeholder="Bitcoin, портфель…" />
        </label>
        <p className="wallet-dashboard__hint">Поиск работает локально в демонстрационном интерфейсе.</p>
      </BottomSheet>
    );
  }

  if (overlay?.type === "notifications") {
    return (
      <BottomSheet open title="Уведомления" onClose={onClose}>
        <ul className="wallet-dashboard__notifications">
          {snapshot.notifications.map((notification) => (
            <li key={notification.id} data-unread={notification.unread ? "true" : "false"}>
              {notification.title}
            </li>
          ))}
        </ul>
      </BottomSheet>
    );
  }

  if (overlay?.type === "asset") {
    return (
      <BottomSheet open title={overlay.asset.name} onClose={onClose}>
        <div className="wallet-dashboard__asset-details">
          <p className="wallet-dashboard__asset-amount">
            {formatAmount(overlay.asset.amount)} {overlay.asset.symbol}
          </p>
          <p>{formatUsd(overlay.asset.value)} · демонстрационные данные</p>
          <p>Изменение за сутки: {formatPercent(overlay.asset.change24h)}</p>
        </div>
      </BottomSheet>
    );
  }

  return null;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 8 }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD" }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value) + "%";
}
