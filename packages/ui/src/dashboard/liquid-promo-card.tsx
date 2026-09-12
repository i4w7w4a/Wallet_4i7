"use client";

import { GradientText } from "../react-bits/gradient-text/gradient-text";
import { SpotlightSurface } from "../react-bits/spotlight-surface/spotlight-surface";
import "./dashboard-visuals.css";

export function LiquidPromoCard(props: {
  active: boolean;
  finePointer: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  onOpen(): void;
}) {
  return (
    <SpotlightSurface
      as="section"
      className="wallet-material-surface liquid-promo"
      finePointer={props.finePointer}
      spotlightColor="color-mix(in srgb, var(--color-accent) 22%, transparent)"
      aria-label="Обмен"
    >
      <div>
        <p className="liquid-promo__eyebrow">Новый маршрут</p>
        <h2>
          <GradientText
            active={props.active}
            reducedMotion={props.reducedMotion}
            saveData={props.saveData}
          >
            Swap smarter
          </GradientText>
        </h2>
        <p>Демонстрационный курс. Операция не будет отправлена.</p>
        <button type="button" className="liquid-promo__action" onClick={props.onOpen}>
          Обменять
        </button>
      </div>
      <svg className="liquid-promo__art" viewBox="0 0 160 120" aria-hidden="true">
        <defs>
          <linearGradient id="promo-ribbon" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent, #5b8cff)" />
            <stop offset="55%" stopColor="var(--color-glass-tint, #7c6cff)" />
            <stop offset="100%" stopColor="#d7f3ff" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path
          d="M12 86c18-28 32-46 54-52 22-6 28 14 46 8 16-6 28-22 36-34"
          fill="none"
          stroke="url(#promo-ribbon)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M8 98c22-18 40-22 58-14 18 8 27 22 48 16 14-4 28-20 38-32"
          fill="none"
          stroke="url(#promo-ribbon)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </SpotlightSurface>
  );
}
