/*
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
Upstream: src/ts-default/TextAnimations/GradientText/GradientText.tsx
*/

"use client";

import { type ReactNode, useRef } from "react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";

import "./gradient-text.css";

type GradientTextProps = {
  children: ReactNode;
  className?: string;
  colors?: string[];
  reducedMotion: boolean;
  animationSpeed?: number;
};

export function GradientText(props: GradientTextProps) {
  const {
    children,
    className,
    colors = ["var(--color-accent, #5b8cff)", "var(--color-glass-tint, #7c6cff)", "#d7f3ff"],
    reducedMotion,
    animationSpeed = 8,
  } = props;

  if (reducedMotion) {
    return <span className={["wallet-gradient-text", "wallet-gradient-text--static", className].filter(Boolean).join(" ")}>{children}</span>;
  }

  return (
    <AnimatedGradientText className={className} colors={colors} animationSpeed={animationSpeed}>
      {children}
    </AnimatedGradientText>
  );
}

function AnimatedGradientText(props: {
  children: ReactNode;
  className?: string;
  colors: string[];
  animationSpeed: number;
}) {
  const { children, className, colors, animationSpeed } = props;
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const duration = animationSpeed * 1000;
  const gradientColors = [...colors, colors[0]].join(", ");
  const backgroundPosition = useTransform(progress, (value) => `${value}% 50%`);

  useAnimationFrame((time) => {
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    const delta = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += delta;
    const cycle = elapsedRef.current % (duration * 2);
    progress.set(cycle < duration ? (cycle / duration) * 100 : 100 - ((cycle - duration) / duration) * 100);
  });

  return (
    <motion.span
      className={["wallet-gradient-text", className].filter(Boolean).join(" ")}
      style={{
        backgroundImage: `linear-gradient(to right, ${gradientColors})`,
        backgroundSize: "300% 100%",
        backgroundPosition,
      }}
    >
      {children}
    </motion.span>
  );
}
