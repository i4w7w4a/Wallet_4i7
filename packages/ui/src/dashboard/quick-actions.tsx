"use client";

import { ActionButton } from "../primitives/action-button";
import "./dashboard-controls.css";

export type DashboardAction = "send" | "receive" | "swap" | "buy";

const ACTIONS = [
  { id: "send", label: "Отправить", icon: "↗" },
  { id: "receive", label: "Получить", icon: "↙" },
  { id: "swap", label: "Обменять", icon: "⇄" },
  { id: "buy", label: "Купить", icon: "+" },
] as const satisfies ReadonlyArray<{
  id: DashboardAction;
  label: string;
  icon: string;
}>;

export function QuickActions(props: {
  onAction(action: DashboardAction): void;
}) {
  const { onAction } = props;

  return (
    <section className="wallet-controls__quick-actions" aria-label="Быстрые действия">
      <div className="wallet-controls__action-grid" role="group" aria-label="Быстрые действия">
        {ACTIONS.map((action) => (
          <ActionButton
            key={action.id}
            className="wallet-controls__action"
            aria-label={action.label}
            onClick={() => onAction(action.id)}
          >
            <span className="wallet-controls__action-icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="wallet-controls__action-label">{action.label}</span>
          </ActionButton>
        ))}
      </div>
    </section>
  );
}
