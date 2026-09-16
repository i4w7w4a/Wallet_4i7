import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChartPeriod, WalletAsset, WalletBalance, WalletProfile } from "@wallet/core";

import { AssetListCard } from "./asset-list-card";
import { BalanceHero } from "./balance-hero";
import { LiquidPromoCard } from "./liquid-promo-card";
import { PortfolioSummaryCard } from "./portfolio-summary-card";
import { ProfileHeader } from "./profile-header";

const PROFILE: WalletProfile = {
  name: "Демо пользователь",
  shortAddress: "0x4i7…A91F",
  avatarUrl: null,
};

const BALANCE: WalletBalance = {
  amount: 12840.75,
  currency: "USD",
  change24h: 2.34,
  hidden: false,
};

const CHART: Record<ChartPeriod, number[]> = {
  "1D": [12540, 12610, 12588, 12735, 12840.75],
  "1W": [11980, 12150, 12070, 12390, 12520, 12695, 12840.75],
  "1M": [11240, 11680, 11420, 12010, 12360, 12190, 12620, 12840.75],
  "1Y": [8360, 9120, 8840, 10110, 10980, 11740, 12420, 12840.75],
  ALL: [4200, 5180, 4760, 6390, 7210, 8980, 10420, 11780, 12840.75],
};

const ASSETS: WalletAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    amount: 0.12,
    value: 8040.25,
    change24h: 2.8,
    sparkline: [64, 67, 65, 70, 72, 74],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    amount: 1.1,
    value: 3900.5,
    change24h: 1.7,
    sparkline: [42, 45, 44, 48, 47, 51],
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    amount: 900,
    value: 900,
    change24h: 0,
    sparkline: [30, 30, 30, 30, 30, 30],
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.matchMedia = () => createMediaQueryList(false);
});

describe("ProfileHeader", () => {
  it("показывает профиль и вызывает поиск, уведомления и студию темы", () => {
    const onSearch = vi.fn();
    const onNotifications = vi.fn();
    const onTheme = vi.fn();

    render(
      <ProfileHeader
        profile={PROFILE}
        unreadCount={1}
        onSearch={onSearch}
        onNotifications={onNotifications}
        onTheme={onTheme}
        reducedMotion={false}
      />,
    );

    expect(screen.getByText("Демо пользователь")).toBeVisible();
    expect(screen.getByText("0x4i7…A91F")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Поиск" }));
    fireEvent.click(screen.getByRole("button", { name: /Уведомления/ }));
    fireEvent.click(screen.getByRole("button", { name: "Студия темы" }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onNotifications).toHaveBeenCalledTimes(1);
    expect(onTheme).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".profile-header__actions svg")).toHaveLength(3);
    for (const icon of document.querySelectorAll(".profile-header__actions svg")) {
      expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });
});

describe("BalanceHero", () => {
  it("показывает открытый баланс, безопасную тёмную зону и пять периодов без video", () => {
    const { container } = render(
      <BalanceHero
        balance={BALANCE}
        chart={CHART}
        period="1D"
        onPeriodChange={() => undefined}
        reducedMotion
      />,
    );

    expect(container.textContent).toMatch(/12[\s\u00a0,]?840/);
    expect(container.querySelector("[data-balance-safe-zone]")).toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();

    for (const name of ["1Д", "1Н", "1М", "1Г", "Всё"]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }

    const chart = screen.getByRole("img", { name: /график баланса/i });
    expect(chart.tagName.toLowerCase()).toBe("svg");
    expect(chart).toHaveAttribute("viewBox", "0 0 320 120");
    expect(chart.querySelector("path")).toHaveAttribute("d");
  });

  it("скрывает цифры баланса в hide-state", () => {
    const { container } = render(
      <BalanceHero
        balance={{ ...BALANCE, hidden: true }}
        chart={CHART}
        period="1D"
        onPeriodChange={() => undefined}
        reducedMotion={false}
      />,
    );

    expect(container.textContent).not.toMatch(/12840/);
    expect(container.textContent).not.toMatch(/12[\s\u00a0,]?840/);
    expect(container.textContent).not.toMatch(/2[.,]34/);
  });

  it("меняет path графика при смене периода", () => {
    function Harness() {
      const [period, setPeriod] = useState<ChartPeriod>("1D");

      return (
        <BalanceHero
          balance={BALANCE}
          chart={CHART}
          period={period}
          onPeriodChange={setPeriod}
          reducedMotion={false}
        />
      );
    }

    render(<Harness />);

    const initial = screen.getByRole("img", { name: /график баланса/i }).querySelector("path");
    const before = initial?.getAttribute("d");

    fireEvent.click(screen.getByRole("button", { name: "1Н" }));

    const after = screen.getByRole("img", { name: /график баланса/i }).querySelector("path");
    expect(after?.getAttribute("d")).not.toBe(before);
    expect(screen.getByRole("button", { name: "1Н" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("LiquidPromoCard", () => {
  it("открывает промо по кнопке и скрывает декоративный SVG", () => {
    const onOpen = vi.fn();

    render(
      <LiquidPromoCard
        active
        finePointer
        reducedMotion={false}
        saveData={false}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Обменять/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);

    const card = screen.getByRole("region", { name: /обмен/i });
    expect(card).toHaveAttribute("data-spotlight", "enabled");
    expect(card.querySelector("[data-glass-variant]")).not.toBeInTheDocument();
    expect(card).not.toHaveClass("glass-surface");
  });

  it("останавливает GradientText при inactive runtime и saveData", () => {
    const { rerender } = render(
      <LiquidPromoCard
        active={false}
        finePointer
        reducedMotion={false}
        saveData={false}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText("Swap smarter")).toHaveClass("wallet-gradient-text--static");

    rerender(
      <LiquidPromoCard
        active
        finePointer
        reducedMotion={false}
        saveData
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText("Swap smarter")).toHaveClass("wallet-gradient-text--static");
  });
});

describe("AssetListCard", () => {
  it("показывает активы кнопками и сообщает выбранный актив", () => {
    const onSelect = vi.fn();

    render(<AssetListCard assets={ASSETS} finePointer onSelect={onSelect} />);

    const bitcoin = screen.getByRole("button", { name: /Bitcoin/ });
    const ethereum = screen.getByRole("button", { name: /Ethereum/ });
    const usdc = screen.getByRole("button", { name: /USD Coin/ });

    expect(bitcoin).toBeVisible();
    expect(ethereum).toBeVisible();
    expect(usdc).toBeVisible();

    fireEvent.click(bitcoin);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ symbol: "BTC", name: "Bitcoin" });

    const sparkline = within(bitcoin).getAllByRole("presentation", { hidden: true })[0];
    expect(sparkline).toHaveAttribute("aria-hidden", "true");
    expect(sparkline).toHaveAttribute("viewBox");

    const card = screen.getByRole("region", { name: /активы/i });
    expect(card).toHaveAttribute("data-spotlight", "enabled");
    expect(card.querySelector("[data-glass-variant]")).not.toBeInTheDocument();
    expect(card).not.toHaveClass("glass-surface");
  });
});

describe("PortfolioSummaryCard", () => {
  it("показывает распределение портфеля без стеклянной поверхности", () => {
    render(<PortfolioSummaryCard balance={BALANCE} assets={ASSETS} finePointer />);

    const card = screen.getByRole("region", { name: /портфел/i });
    expect(screen.getByText("Bitcoin")).toBeVisible();
    expect(screen.getByText("Ethereum")).toBeVisible();
    expect(screen.getByText("USD Coin")).toBeVisible();
    expect(card.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(card).toHaveAttribute("data-spotlight", "enabled");
    expect(card.querySelector("[data-glass-variant]")).not.toBeInTheDocument();
    expect(card).not.toHaveClass("glass-surface");
  });
});

describe("mobile art direction", () => {
  it("фиксирует ограниченную hero-сцену, mobile breakpoints и безопасный focus layer", () => {
    const css = readFileSync("src/dashboard/dashboard-visuals.css", "utf8")
      + readFileSync("src/dashboard/dashboard.css", "utf8");

    expect(css).toContain("min-height: 340px");
    expect(css).toContain("clamp(2.65rem, min(12vw, 57.6px), 4.6rem)");
    expect(css).toContain("max-width: 359px");
    expect(css).toContain("min-width: 430px");
    expect(css).toContain("position: fixed");
    expect(css).toMatch(/focus-visible[\s\S]*z-index/);
  });
});

function createMediaQueryList(matches: boolean): MediaQueryList {
  return {
    matches,
    media: "",
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}
