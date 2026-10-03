"use client";

import { formatProductActivityFee, getProductActivityLabels, type ProductActivity } from "./demo-activity";
import { normalizeOperationReceipt } from "./operation-receipt";
import { formatQuantity } from "./product-format";
import { normalizeDecimal } from "./send/send-validation";
import styles from "./operation-receipt-view.module.css";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});
const countFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const plurals = new Intl.PluralRules("ru");

export type OperationReceiptViewProps = { activity: ProductActivity; balanceHidden: boolean; showStatusHeading?: boolean };

export function OperationReceiptView({ activity, balanceHidden, showStatusHeading = true }: OperationReceiptViewProps) {
  const receipt = normalizeOperationReceipt(activity.receipt);
  const simulation = activity.mode === "simulation";
  const internal = activity.internalTransfer;
  const { statusLabel } = getProductActivityLabels(activity);
  const failure = simulation && activity.status === "failed" ? failureExplanation(activity.failureReason) : null;
  const debitDiffers = receipt && activity.direction === "outgoing" &&
    normalizeDecimal(receipt.assetDebit) !== normalizeDecimal(activity.quantity);
  const occurredAt = new Date(activity.occurredAt);
  const validTime = !Number.isNaN(occurredAt.getTime());
  const fee = receipt ? receipt.networkFee.status === "known"
    ? amountLabel(receipt.networkFee.amount, receipt.networkFee.symbol, balanceHidden) : "Комиссия уточняется"
    : balanceHidden && activity.feeLabel?.trim() ? "••••" : formatProductActivityFee(activity.feeLabel);

  return <section className={styles.receipt} aria-label="Квитанция операции" data-embedded={!showStatusHeading}>
    <div className={styles.summary}>
      {showStatusHeading && <p className={styles.status}>
        <span aria-hidden="true">{activity.status === "completed" ? "✓" : activity.status === "failed" ? "×" : "·"}</span>
        <strong>{statusLabel}</strong>
      </p>}
      {failure && <p className={styles.reason}>{failure}</p>}
      <p className={styles.explanation}>{simulation
        ? "Демонстрация: средства и заряд батарейки не списаны."
        : "Пример состояния операции. Данные сети не подключены."}</p>
    </div>

    <dl className={styles.values}>
      <div><dt>Количество</dt><dd className={styles.money}>{amountLabel(activity.quantity, activity.assetSymbol, balanceHidden)}</dd></div>
      {debitDiffers && <div><dt>Списание по расчёту</dt><dd className={styles.money}>
        {amountLabel(receipt.assetDebit, activity.assetSymbol, balanceHidden)}
      </dd></div>}
      <div><dt>{internal ? "Комиссия примера" : receipt ? "Расчёт комиссии" : "Комиссия"}</dt><dd className={styles.money}>{fee}</dd></div>
      {receipt && !internal && <div><dt>Оплата по расчёту</dt><dd>
        {receipt.feeFunding.kind === "battery" ? <>
          <span>Батарейка · {receipt.feeFunding.networkLabel}</span>
          <small className={styles.fundingNote}>{balanceHidden ? "Расчёт: •••• зарядов" : `${chargeLabel(receipt.feeFunding.charges)} по расчёту`}</small>
        </> : receipt.feeFunding.kind === "balance" ? "Баланс счёта" : "Неизвестно"}
      </dd></div>}
      {activity.status === "pending" && <div><dt>Оценка ожидания</dt><dd>{waitLabel(receipt?.estimatedCompletionSeconds)}</dd></div>}
    </dl>

    <dl className={styles.context}>
      {internal ? <>
        <div><dt>Откуда</dt><dd>{internal.sourceAccountLabel}</dd></div>
        <div><dt>Куда</dt><dd>{internal.destinationAccountLabel}</dd></div>
      </> : <div><dt>Счёт</dt><dd>{activity.accountLabel?.trim() || "Счёт не указан"}</dd></div>}
      <div><dt>Сеть</dt><dd>{activity.networkLabel?.trim() || "Сеть не указана"}</dd></div>
      <div><dt>Время</dt><dd>{validTime ? <time dateTime={activity.occurredAt}>{dateFormat.format(occurredAt)} · UTC</time> : "Время не указано"}</dd></div>
    </dl>
  </section>;
}

function amountLabel(value: string, symbol: string, hidden: boolean): string {
  if (hidden) return "••••";
  return typeof value === "string" && normalizeDecimal(value) !== null
    ? `${formatQuantity(value.trim())} ${symbol}` : "Нет данных";
}

function failureExplanation(reason: ProductActivity["failureReason"]): string | null {
  switch (reason) {
    case "rejected": return "Симуляция отклонена.";
    case "expired": return "Срок действия расчёта истёк.";
    case "unavailable": return "Сервис симуляции недоступен.";
    default: return null;
  }
}

function waitLabel(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "Время уточняется";
  if (seconds < 60) return "Меньше минуты";
  if (seconds < 3600) return `Около ${countFormat.format(Math.ceil(seconds / 60))} мин`;
  if (seconds < 86400) return `Около ${countFormat.format(Math.ceil(seconds / 3600))} ч`;
  return `Около ${countFormat.format(Math.ceil(seconds / 86400))} дн`;
}

function chargeLabel(charges: number): string {
  const form = plurals.select(charges);
  return `${countFormat.format(charges)} ${form === "one" ? "заряд" : form === "few" ? "заряда" : "зарядов"}`;
}
