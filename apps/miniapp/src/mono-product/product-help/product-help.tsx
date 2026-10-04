"use client";

import { useId, type JSX } from "react";
import { DisclosureMotion } from "../motion/disclosure-motion";
import styles from "./product-help.module.css";

export type ProductHelpTopicId = "receive" | "send" | "buy" | "swap";

export type ProductHelpAction =
  | { allowed: true; onOpen: () => void; reason?: never }
  | { allowed: false; reason: string; onOpen?: never };

export type ProductHelpActions = Partial<Record<ProductHelpTopicId, ProductHelpAction>>;

export type ProductHelpProps = {
  openTopic: ProductHelpTopicId | null;
  onOpenTopicChange: (topic: ProductHelpTopicId | null) => void;
  actions?: ProductHelpActions;
};

const topics = [
  {
    id: "receive", title: "Получить", summary: "Счёт, актив и сеть", cta: "Открыть получение",
    explanation: "Выберите счёт, актив и сеть. Дальше откроются демо-реквизиты или пополнение между счетами — в зависимости от выбранного маршрута. Демо-реквизиты не предназначены для реальных средств.",
  },
  {
    id: "send", title: "Отправить", summary: "Получатель, сумма и проверка", cta: "Открыть отправку",
    explanation: "Выберите счёт, актив и сеть, затем укажите получателя и сумму. Доступный маршрут ещё не означает готовый расчёт: комиссия проверяется перед отдельным подтверждением. Покрытие батарейки зависит от счёта и сети и проверяется для конкретного перевода.",
  },
  {
    id: "buy", title: "Купить", summary: "Способ демо-оплаты и расчёт", cta: "Открыть покупку",
    explanation: "Выберите доступное направление, способ демо-оплаты и сумму. Курс, комиссия и итог показываются после расчёта, перед отдельным подтверждением.",
  },
  {
    id: "swap", title: "Обменять", summary: "Что отдаёте и что получаете", cta: "Открыть обмен",
    explanation: "Выберите, что обменять и что получить, затем укажите сумму. Итог и комиссия показываются после расчёта; выбор направления сам по себе не выполняет обмен.",
  },
] as const;
const unavailable = "Открытие этой операции сейчас недоступно.";

export function ProductHelp({ openTopic, onOpenTopicChange, actions }: ProductHelpProps): JSX.Element {
  const prefix = useId();

  return <div className={styles.help}>
    <p className={styles.lead}>Это демо: операции не перемещают реальные средства.</p>
    <div className={styles.topics}>
      {topics.map(topic => {
        const expanded = openTopic === topic.id;
        const panelId = `${prefix}-${topic.id}`;
        const triggerId = `${panelId}-trigger`;
        const summaryId = `${panelId}-summary`;
        const action = actions?.[topic.id];
        // Eligibility permits opening a scenario only; the host owns guards, anchors and navigation.
        const onOpen = action?.allowed === true && typeof action.onOpen === "function" ? action.onOpen : null;
        const reason = action?.allowed === false && typeof action.reason === "string" && action.reason.trim()
          ? action.reason : unavailable;

        return <div key={topic.id} className={styles.topic}>
          <h3 className={styles.heading} aria-labelledby={triggerId}>
            <button type="button" id={triggerId} className={styles.trigger} aria-label={topic.title}
              aria-describedby={summaryId} aria-expanded={expanded} aria-controls={panelId}
              onClick={() => onOpenTopicChange(expanded ? null : topic.id)}>
              <span className={styles.copy}>
                <span className={styles.title}>{topic.title}</span>
                <span className={styles.summary} id={summaryId}>{topic.summary}</span>
              </span>
              <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
                <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </h3>
          <DisclosureMotion open={expanded} id={panelId} launcherId={triggerId} role="region" labelledBy={triggerId}>
            <div className={styles.content}>
              <p className={styles.explanation}>{topic.explanation}</p>
              {onOpen ? <button type="button" className={styles.action} onClick={() => onOpen()}>
                <span>{topic.cta}</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
                  <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button> : <p className={styles.reason}>{reason}</p>}
            </div>
          </DisclosureMotion>
        </div>;
      })}
    </div>
    <p className={styles.note}>Открытие сценария не запускает операцию.</p>
  </div>;
}
