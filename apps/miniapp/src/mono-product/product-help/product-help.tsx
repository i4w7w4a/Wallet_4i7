"use client";

import { useId, type JSX } from "react";
import { monoActionIconPath } from "@wallet/ui";
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
    explanation: "Выберите счёт, актив и сеть. Доступный маршрут откроет демо-реквизиты или пополнение между своими счетами. Демо-реквизиты не предназначены для реальных средств.",
  },
  {
    id: "send", title: "Отправить", summary: "Свой счёт или внешний адрес", cta: "Открыть отправку",
    explanation: "«На свой счёт» — перевод между своими доступными счетами. Для внешнего адреса выберите актив и сеть, укажите адрес и сумму. Комиссия и итог проверяются перед отдельным подтверждением.",
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
    <p className={styles.overview}>Общий баланс — оценка всех активов в валюте отображения, а не доступная сумма для отправки. Закрепления и «Только общий баланс» меняют вид главной, но не итог и не счёт отправки.</p>
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
              <svg className={styles.topicIcon} data-topic={topic.id} width="24" height="24" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true" focusable="false">
                <path d={monoActionIconPath(`quick.${topic.id}`)} />
              </svg>
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
    <p className={styles.pending}>«В процессе» открывает квитанцию одной операции или список в истории, если их несколько. Если вход был из счёта, «К счёту» возвращает к его сведениям.</p>
    <p className={styles.note}>Открытие сценария не запускает операцию.</p>
  </div>;
}
