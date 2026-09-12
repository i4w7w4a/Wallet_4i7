"use client";

import { motion } from "motion/react";
import { useContext, type ButtonHTMLAttributes } from "react";

import { useTheme } from "../theme/theme-provider";
import { useMediaFlag } from "../theme/use-media-flag";
import { GlassNestingContext } from "./glass-surface";
import "./primitives.css";

type ActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  variant?: "regular" | "clear";
};

export function ActionButton(props: ActionButtonProps) {
  const { variant = "regular", className, children, type = "button", onClick, ...rest } = props;
  const nested = useContext(GlassNestingContext);
  const { theme } = useTheme();
  const prefersReduced = useMediaFlag("(prefers-reduced-motion: reduce)");
  const fade = prefersReduced || theme.motionIntensity <= 0;
  const pressScale = 1 - 0.05 * theme.motionIntensity;

  return (
    <GlassNestingContext.Provider value={true}>
      <motion.button
        type={type}
        className={["glass-surface", "action-button", className].filter(Boolean).join(" ")}
        data-glass-variant={nested ? undefined : variant}
        data-glass-nested={nested ? "true" : undefined}
        data-interactive="true"
        data-motion={fade ? "fade" : "spatial"}
        whileTap={fade ? undefined : { scale: pressScale }}
        transition={{
          type: "spring",
          stiffness: 420 * (0.45 + theme.motionIntensity * 0.55),
          damping: 28,
        }}
        onClick={onClick}
        {...rest}
      >
        {children}
      </motion.button>
    </GlassNestingContext.Provider>
  );
}
