"use client";

import { motion } from "motion/react";
import { useEffect, useState, type CSSProperties, type PointerEvent } from "react";

import { magneticOffset, type ControlEffectId, type ControlFeedbackConfig } from "./control-feedback-model";
import styles from "./control-feedback-button.module.css";

type ButtonStyle = CSSProperties & {
  "--press-depth": string;
  "--settle-ms": string;
};

type Props = {
  effectId: ControlEffectId;
  config: ControlFeedbackConfig;
  onActivate: () => void;
  disabled?: boolean;
};

export function ControlFeedbackButton({ effectId, config, onActivate, disabled = false }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (effectId !== "magnetic") return;
    const resetWhenHidden = () => {
      if (document.visibilityState === "hidden") setOffset({ x: 0, y: 0 });
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resetWhenReduced = () => {
      if (reduced.matches) setOffset({ x: 0, y: 0 });
    };
    document.addEventListener("visibilitychange", resetWhenHidden);
    reduced.addEventListener("change", resetWhenReduced);
    return () => {
      document.removeEventListener("visibilitychange", resetWhenHidden);
      reduced.removeEventListener("change", resetWhenReduced);
    };
  }, [effectId]);

  const reset = () => setOffset({ x: 0, y: 0 });
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (effectId !== "magnetic" || disabled || event.pointerType !== "mouse" ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setOffset(magneticOffset({ x: event.clientX, y: event.clientY }, rect, config.magneticTravel));
  };

  const style: ButtonStyle = {
    "--press-depth": `${config.pressDepth}px`,
    "--settle-ms": `${config.settleMs}ms`,
  };

  return (
    <button
      type="button"
      data-control-feedback
      data-effect={effectId}
      className={styles.button}
      style={style}
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onBlur={reset}
      onClick={onActivate}
      disabled={disabled}
    >
      <span className={styles.face}>
        <motion.span
          className={styles.content}
          animate={effectId === "magnetic" ? offset : { x: 0, y: 0 }}
          transition={{ type: "spring", duration: config.settleMs / 1000, bounce: 0 }}
        >
          Проверить отклик
        </motion.span>
      </span>
    </button>
  );
}
