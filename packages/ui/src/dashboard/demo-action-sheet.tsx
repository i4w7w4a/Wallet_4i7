"use client";

import { useState, type FormEvent } from "react";

import { ActionButton } from "../primitives/action-button";
import { BottomSheet } from "../primitives/bottom-sheet";
import { type DashboardAction } from "./quick-actions";
import "./dashboard-controls.css";

const DEMO_RESULT = "Демо: данные не отправлены";

const ACTION_CONTENT = {
  send: {
    title: "Отправить",
    description: "Заполните демонстрационные поля перевода.",
  },
  receive: {
    title: "Получить",
    description: "QR-код ниже не содержит адреса или транзакции.",
  },
  swap: {
    title: "Обменять",
    description: "Выберите демонстрационную пару обмена.",
  },
  buy: {
    title: "Купить",
    description: "Настройте демонстрационную покупку актива.",
  },
} as const satisfies Record<DashboardAction, { title: string; description: string }>;

const DEMO_QR_PATTERN = [
  "11111110101",
  "10000010010",
  "10111010111",
  "10111010001",
  "10111010101",
  "10000010010",
  "11111110101",
  "00000000110",
  "10101111101",
  "01101000110",
  "11011110101",
].join("");

export function DemoActionSheet(props: {
  action: DashboardAction | null;
  onClose(): void;
}) {
  const { action, onClose } = props;
  const [submittedAction, setSubmittedAction] = useState<DashboardAction | null>(null);
  const content = ACTION_CONTENT[action ?? "send"];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedAction(action);
  }

  function close() {
    setSubmittedAction(null);
    onClose();
  }

  return (
    <BottomSheet open={action !== null} title={content.title} onClose={close}>
      {action ? (
        <form
          className="wallet-controls__demo-form"
          aria-label={`Демонстрационная форма: ${content.title}`}
          onSubmit={onSubmit}
        >
          <p className="wallet-controls__demo-description">{content.description}</p>
          <ActionFields action={action} />
          <ActionButton type="submit" className="wallet-controls__demo-confirm">
            Подтвердить демо
          </ActionButton>
          {submittedAction === action ? (
            <p className="wallet-controls__demo-status" role="status">
              {DEMO_RESULT}
            </p>
          ) : null}
        </form>
      ) : null}
    </BottomSheet>
  );
}

function ActionFields(props: { action: DashboardAction }) {
  switch (props.action) {
    case "send":
      return (
        <div className="wallet-controls__field-grid">
          <label className="wallet-controls__field">
            <span>Получатель (демо)</span>
            <input name="demo-recipient" placeholder="Демонстрационный получатель" autoComplete="off" />
          </label>
          <label className="wallet-controls__field">
            <span>Сумма (демо)</span>
            <input name="demo-send-amount" type="number" min="0" inputMode="decimal" placeholder="0" />
          </label>
        </div>
      );
    case "receive":
      return (
        <div className="wallet-controls__qr-block">
          <div
            className="wallet-controls__demo-qr"
            role="img"
            aria-label="Демонстрационный QR-код"
            data-demo-only="true"
          >
            {Array.from(DEMO_QR_PATTERN, (cell, index) => (
              <span key={index} data-filled={cell === "1" ? "true" : "false"} aria-hidden="true" />
            ))}
          </div>
          <p>Только визуальный макет — без платёжных данных.</p>
        </div>
      );
    case "swap":
      return (
        <div className="wallet-controls__field-grid">
          <label className="wallet-controls__field">
            <span>Отдать (демо)</span>
            <select name="demo-swap-from" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="BTC">BTC</option>
            </select>
          </label>
          <label className="wallet-controls__field">
            <span>Получить (демо)</span>
            <select name="demo-swap-to" defaultValue="ETH">
              <option value="ETH">ETH</option>
              <option value="USDT">USDT</option>
            </select>
          </label>
        </div>
      );
    case "buy":
      return (
        <div className="wallet-controls__field-grid">
          <label className="wallet-controls__field">
            <span>Актив (демо)</span>
            <select name="demo-buy-asset" defaultValue="BTC">
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>
          </label>
          <label className="wallet-controls__field">
            <span>Сумма покупки (демо)</span>
            <input name="demo-buy-amount" type="number" min="0" inputMode="decimal" placeholder="0" />
          </label>
        </div>
      );
  }
}
