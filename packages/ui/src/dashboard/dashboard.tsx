"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ChartPeriod, WalletAsset, WalletSnapshot } from "@wallet/core";
import type { PlatformBridge } from "@wallet/platform";

import {
  WalletVisualLayer,
  type VisualRuntimeCapabilities,
} from "../appearance/wallet-visual-layer";
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
  runtime: VisualRuntimeCapabilities;
}) {
  const { snapshot, platform, runtime } = props;
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
      <WalletVisualLayer runtime={runtime} />
      <div className="wallet-dashboard__foreground">
        <ProfileHeader
          profile={snapshot.profile}
          unreadCount={unreadCount}
          onSearch={() => setOverlay({ type: "search" })}
          onNotifications={() => setOverlay({ type: "notifications" })}
          onTheme={() => setOverlay({ type: "theme" })}
          reducedMotion={runtime.reducedMotion}
        />

        <main className="wallet-dashboard__content">
          {activeSection === "home" ? (
            <DashboardHome
              snapshot={snapshot}
              period={period}
              balanceHidden={balanceHidden}
              runtime={runtime}
              onPeriodChange={setPeriod}
              onToggleHidden={() => {
                platform.haptic("selection");
                setBalanceHidden((hidden) => !hidden);
              }}
              onAction={openAction}
              onSelectAsset={(asset) => setOverlay({ type: "asset", asset })}
            />
          ) : (
            <SectionPlaceholder section={activeSection} />
          )}
        </main>

        <div className="wallet-dashboard__navigation">
          <BottomNavigation
            activeSection={activeSection}
            reducedMotion={runtime.reducedMotion}
            onSectionChange={selectSection}
          />
        </div>
      </div>

      <DemoActionSheet
        key={overlay?.type === "action" ? overlay.action : "closed"}
        action={overlay?.type === "action" ? overlay.action : null}
        onClose={closeOverlay}
      />
      {overlay?.type === "theme" ? (
        <div className="wallet-dashboard__theme-overlay" data-theme-overlay>
          <button
            type="button"
            className="wallet-dashboard__theme-backdrop"
            aria-label="Закрыть студию темы"
            onClick={closeOverlay}
          />
          <ThemeStudio open onClose={closeOverlay} />
        </div>
      ) : null}
      <InformationSheet
        overlay={overlay}
        snapshot={snapshot}
        onClose={closeOverlay}
        onSelectAsset={(asset) => setOverlay({ type: "asset", asset })}
      />
    </div>
  );
}

type DashboardHomeProps = {
  snapshot: WalletSnapshot;
  period: ChartPeriod;
  balanceHidden: boolean;
  runtime: VisualRuntimeCapabilities;
  onPeriodChange(period: ChartPeriod): void;
  onToggleHidden(): void;
  onAction(action: DashboardAction): void;
  onSelectAsset(asset: WalletAsset): void;
};

function DashboardHome(props: DashboardHomeProps) {
  return (
    <>
      <BalanceHero
        balance={{ ...props.snapshot.balance, hidden: props.balanceHidden }}
        chart={props.snapshot.chart}
        period={props.period}
        reducedMotion={props.runtime.reducedMotion}
        onPeriodChange={props.onPeriodChange}
        onToggleHidden={props.onToggleHidden}
      />
      <QuickActions
        reducedMotion={props.runtime.reducedMotion}
        onAction={props.onAction}
      />
      <LiquidPromoCard
        finePointer={!props.runtime.coarsePointer}
        reducedMotion={props.runtime.reducedMotion}
        onOpen={() => props.onAction("swap")}
      />
      <AssetListCard
        assets={props.snapshot.assets}
        finePointer={!props.runtime.coarsePointer}
        onSelect={props.onSelectAsset}
      />
      <PortfolioSummaryCard
        balance={props.snapshot.balance}
        assets={props.snapshot.assets}
        finePointer={!props.runtime.coarsePointer}
      />
    </>
  );
}

function InformationSheet(props: {
  overlay: DashboardOverlay | null;
  snapshot: WalletSnapshot;
  onClose(): void;
  onSelectAsset(asset: WalletAsset): void;
}) {
  const { overlay, snapshot, onClose, onSelectAsset } = props;

  if (overlay?.type === "search") {
    return <SearchSheet assets={snapshot.assets} onClose={onClose} onSelect={onSelectAsset} />;
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

function SearchSheet(props: {
  assets: WalletAsset[];
  onClose(): void;
  onSelect(asset: WalletAsset): void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("ru-RU");
  const results = normalized
    ? props.assets.filter((asset) =>
        `${asset.name} ${asset.symbol}`.toLocaleLowerCase("ru-RU").includes(normalized),
      )
    : [];

  return (
    <BottomSheet open title="Поиск" onClose={props.onClose}>
      <label className="wallet-dashboard__search">
        <span>Найдите актив</span>
        <input
          type="search"
          aria-label="Поиск по кошельку"
          placeholder="Bitcoin, ETH…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {normalized ? (
        results.length > 0 ? (
          <ul className="wallet-dashboard__search-results" aria-label="Результаты поиска">
            {results.map((asset) => (
              <li key={asset.symbol}>
                <button type="button" onClick={() => props.onSelect(asset)}>
                  <span>{asset.name}</span>
                  <span>{asset.symbol}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wallet-dashboard__hint" role="status">Ничего не найдено</p>
        )
      ) : (
        <p className="wallet-dashboard__hint">Результаты появятся по мере ввода.</p>
      )}
    </BottomSheet>
  );
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
