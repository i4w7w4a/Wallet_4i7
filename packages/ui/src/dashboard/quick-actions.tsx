"use client";

import { WalletIcon, type WalletIconName } from "../icons/wallet-icon";
import { ClickSpark } from "../react-bits/click-spark/click-spark";
import { GlassAction } from "../react-bits/glass-action/glass-action";
import "./dashboard-controls.css";

export type DashboardAction = "send" | "receive" | "swap" | "buy";

const ACTIONS = [
  { id: "send", label: "Отправить", icon: "send" },
  { id: "receive", label: "Получить", icon: "receive" },
  { id: "swap", label: "Обменять", icon: "swap" },
  { id: "buy", label: "Купить", icon: "buy" },
] as const satisfies ReadonlyArray<{
  id: DashboardAction;
  label: string;
  icon: WalletIconName;
}>;

export function QuickActions(props: {
  reducedMotion: boolean;
  onAction(action: DashboardAction): void;
}) {
  const { reducedMotion, onAction } = props;

  return (
    <section className="wallet-controls__quick-actions" aria-label="Быстрые действия">
      <div className="wallet-controls__action-grid" role="group" aria-label="Быстрые действия">
        {ACTIONS.map((action) => (
          <ClickSpark
            key={action.id}
            color="var(--color-accent)"
            reducedMotion={reducedMotion}
            count={8}
            duration={460}
          >
            <GlassAction
              className="wallet-controls__action"
              label={action.label}
              icon={<WalletIcon name={action.icon} size={28} />}
              onAction={() => onAction(action.id)}
            />
          </ClickSpark>
        ))}
      </div>
    </section>
  );
}
