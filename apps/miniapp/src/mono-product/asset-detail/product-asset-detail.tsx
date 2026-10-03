"use client";

import { useId } from "react";
import type { ProductActionRoute } from "@wallet/core";
import styles from "./product-asset-detail.module.css";

export type ProductAssetDetailBattery = {
  networkLabel: string;
  chargePercent: number | null;
  remainingTransfers?: number | "unknown";
};

export type ProductAssetDetailOperation = {
  status: "preparing" | "pending" | "completed" | "failed";
  estimatedRemainingSeconds: number | null;
};

export type ProductAssetDetailProps = {
  route: ProductActionRoute;
  battery: ProductAssetDetailBattery | null;
  operation?: ProductAssetDetailOperation | null;
  onBack: () => void;
};

const percentFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const operationLabels: Record<ProductAssetDetailOperation["status"], string> = {
  preparing: "Подготовка перевода",
  pending: "Перевод в обработке",
  completed: "Демо-перевод завершён",
  failed: "Демо-перевод не выполнен",
};

export function ProductAssetDetail({ route, battery, operation, onBack }: ProductAssetDetailProps) {
  const titleId = useId();
  // Metadata belongs to this network only. Counts never stand in for percentage.
  const scoped = battery?.networkLabel.trim() === route.networkLabel.trim() ? battery : null;
  const chargeValue = scoped?.chargePercent;
  const charge = validNumber(chargeValue, 100) ? chargeValue : null;
  const remaining = scoped?.remainingTransfers;
  const estimate = operation?.status === "pending" && validNumber(operation.estimatedRemainingSeconds)
    ? operation.estimatedRemainingSeconds : null;
  const waiting = operation?.status === "preparing" || operation?.status === "pending";

  return <section className={styles.detail} aria-labelledby={titleId}>
    <button type="button" className={styles.back} onClick={onBack}><span aria-hidden="true">←</span>Назад к операции</button>
    <header className={styles.heading}>
      <h3 id={titleId}>{route.name}</h3>
      <span className={styles.symbol}>{route.symbol}</span>
    </header>
    <p className={styles.example}>Пример · данные не подключены</p>
    <dl className={styles.context}>
      <div><dt>Сеть</dt><dd>{route.networkLabel}</dd></div>
      <div><dt>Счёт</dt><dd>{route.accountLabel}</dd></div>
    </dl>
    <section className={styles.battery} aria-label="Батарейка сети">
      <h4>Батарейка</h4>
      <dl className={styles.metrics}>
        <div><dt>Заряд</dt><dd className={styles.chargeValue} data-known={charge !== null}>{charge === null ? "Нет данных" : `${percentFormat.format(charge)}%`}</dd></div>
        {battery?.remainingTransfers !== undefined && <div><dt>Осталось переводов</dt>
          <dd>{typeof remaining === "number" && Number.isSafeInteger(remaining) && remaining >= 0 ? remaining : "Нет данных"}</dd>
        </div>}
      </dl>
      {charge !== null && <div className={styles.charge} role="meter" aria-label="Заряд батарейки"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={charge} aria-valuetext={`${percentFormat.format(charge)}%`}>
        <span style={{ width: `${charge}%` }} />
      </div>}
      <details className={styles.explanation}>
        <summary>Как работает</summary>
        <p>Подходящие счета одной сети используют общий заряд.</p>
        <p>Батарейка покрывает сетевую комиссию, когда это подтверждает расчёт перевода. Сам процент заряда не гарантирует перевод без комиссии.</p>
      </details>
    </section>
    <div className={styles.operation} role="status" aria-atomic="true">
      {operation ? <>
        <strong>{operationLabels[operation.status]}</strong>
        {waiting && <p>{estimate === null ? "Время уточняется" : formatEstimate(estimate)}</p>}
        {estimate !== null && <small>Оценка этой симуляции. Срок реального перевода неизвестен.</small>}
      </> : <p>Ожидание появится при отправке</p>}
    </div>
  </section>;
}

function validNumber(value: number | null | undefined, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
}

function formatEstimate(seconds: number): string {
  if (seconds < 60) return "Примерно меньше минуты до завершения";
  const minutes = Math.ceil(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts = [days ? `${days} д` : "", hours ? `${hours} ч` : "", rest ? `${rest} мин` : ""].filter(Boolean);
  return `Примерно ${parts.join(" ")} до завершения`;
}
