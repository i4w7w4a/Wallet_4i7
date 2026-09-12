"use client";

import type { ChartPeriod, WalletBalance } from "@wallet/core";

import { HeroVideo } from "../media/hero-video";
import "./dashboard-visuals.css";

const PERIODS: Array<{ id: ChartPeriod; label: string; description: string }> = [
  { id: "1D", label: "1Д", description: "1 день" },
  { id: "1W", label: "1Н", description: "1 неделю" },
  { id: "1M", label: "1М", description: "1 месяц" },
  { id: "1Y", label: "1Г", description: "1 год" },
  { id: "ALL", label: "Всё", description: "весь период" },
];

export function BalanceHero(props: {
  balance: WalletBalance;
  chart: Record<ChartPeriod, number[]>;
  period: ChartPeriod;
  onPeriodChange(period: ChartPeriod): void;
  video: { active: boolean; reducedMotion: boolean; saveData: boolean };
  onToggleHidden?(): void;
}) {
  const { balance, chart, period, onPeriodChange, video, onToggleHidden } = props;
  const selected = PERIODS.find((item) => item.id === period) ?? PERIODS[0];
  const series = chart[period] ?? [];
  const hidden = balance.hidden;
  const amountText = hidden ? "••••••" : formatUsd(balance.amount);
  const changeText = hidden ? "••••" : formatChange(balance.change24h);
  const chartLabel = hidden
    ? `График баланса за ${selected.description}. Сумма скрыта.`
    : `График баланса за ${selected.description}. Изменение за сутки ${formatChange(balance.change24h)}.`;

  return (
    <section className="balance-hero" aria-label="Баланс">
      <div className="balance-hero__media" aria-hidden="true">
        <HeroVideo
          className="balance-hero__video"
          active={video.active}
          reducedMotion={video.reducedMotion}
          saveData={video.saveData}
        />
        <div className="balance-hero__mask" data-balance-mask />
      </div>

      <div className="balance-hero__content">
        <div className="balance-hero__top">
          <div>
            <p className="balance-hero__greeting">Добрый день</p>
            <p className="balance-hero__amount">{amountText}</p>
            <p className="balance-hero__change" data-trend={hidden ? "hidden" : balance.change24h >= 0 ? "up" : "down"}>
              {hidden ? "Изменение скрыто" : `за сутки ${changeText}`}
            </p>
          </div>
          <button
            type="button"
            className="balance-hero__toggle"
            aria-pressed={hidden}
            aria-label={hidden ? "Показать баланс" : "Скрыть баланс"}
            onClick={onToggleHidden}
          >
            {hidden ? "Показать" : "Скрыть"}
          </button>
        </div>

        <svg className="balance-hero__chart" viewBox="0 0 320 120" role="img" aria-label={chartLabel}>
          <path d={toChartPath(series, 320, 120)} />
        </svg>

        <div className="balance-hero__periods" role="group" aria-label="Период графика">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="balance-hero__period"
              aria-pressed={item.id === period}
              onClick={() => onPeriodChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD" }).format(amount);
}

function formatChange(value: number): string {
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value);

  return `${formatted}%`;
}

function toChartPath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);

  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - 10 - ((value - min) / span) * (height - 20);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
