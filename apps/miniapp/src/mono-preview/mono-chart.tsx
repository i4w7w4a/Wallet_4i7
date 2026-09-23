"use client";

import type { ChartPeriod } from "@wallet/core";
import { useId } from "react";
import { formatMonoMoney, type MonoMoneyFormat } from "./mono-balance-format";
import { createMonoChartGeometry } from "./mono-chart-geometry";
import type { MonoChartAppearance } from "./mono-scene-lab-contract";
import "./mono-chart.css";

export type MonoChartProps = {
  values: readonly number[];
  format: MonoMoneyFormat;
  hidden: boolean;
  period: ChartPeriod;
  onPeriodChange?: (period: ChartPeriod) => void;
  appearance: Readonly<MonoChartAppearance>;
};

const PERIODS: readonly { id: ChartPeriod; label: string; accessible: string }[] = [
  { id: "1D", label: "1Д", accessible: "За день" }, { id: "1W", label: "1Н", accessible: "За неделю" },
  { id: "1M", label: "1М", accessible: "За месяц" }, { id: "1Y", label: "1Г", accessible: "За год" },
  { id: "ALL", label: "Всё", accessible: "За всё время" },
];

export function MonoChart({ values, format, hidden, period, onPeriodChange, appearance }: MonoChartProps) {
  const id = useId();
  if (!appearance.visible) return null;
  const geometry = hidden ? null : createMonoChartGeometry(values);
  const periodName = PERIODS.find((item) => item.id === period)!.accessible.toLocaleLowerCase("ru");
  const last = geometry?.points[geometry.points.length - 1];
  const description = geometry ? values.map((value) => formatMonoMoney(value, format).accessibleLabel).join("; ") : "";
  return <section className="mono-chart-view" aria-label="График баланса" data-chart-variant={appearance.variant}>
    <div className="mono-chart-view__heading"><span>Динамика баланса</span><span>{PERIODS.find((item) => item.id === period)!.accessible}</span></div>
    <div className="mono-chart-view__plot">
      {hidden ? <p className="mono-chart-view__empty">График скрыт</p> : !geometry ?
        <p className="mono-chart-view__empty">Нет данных за этот период</p> :
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
          <title id={`${id}-title`}>{`Динамика баланса ${periodName}`}</title>
          <desc id={`${id}-description`}>{`Значения по порядку: ${description}`}</desc>
          <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".17" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
          <path className="mono-chart-view__grid" d="M4 25H296M4 75H296" />
          {appearance.variant === "area" && geometry.points.length > 1 && <path d={geometry.area} fill={`url(#${id}-fill)`} />}
          <path className="mono-chart-view__line" d={appearance.variant === "step" ? geometry.step : geometry.line} />
          {last && <circle className="mono-chart-view__terminal" cx={last.x} cy={last.y} r="2.5" />}
        </svg>}
    </div>
    <div className="mono-chart-view__caption"><span>Начало периода</span><span>Сейчас</span></div>
    {onPeriodChange ? <div className="mono-chart-view__periods" role="group" aria-label="Период графика">
      {PERIODS.map((item) => <button type="button" key={item.id} aria-label={item.accessible}
        aria-pressed={period === item.id} onClick={() => onPeriodChange(item.id)}>{item.label}</button>)}
    </div> : null}
  </section>;
}
