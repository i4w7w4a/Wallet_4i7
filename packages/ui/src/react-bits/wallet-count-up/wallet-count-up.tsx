/*
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
Upstream: src/ts-default/TextAnimations/CountUp/CountUp.tsx
*/

"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring } from "motion/react";

type WalletCountUpProps = {
  value: number;
  locale: string;
  currency: string;
  reducedMotion: boolean;
  duration?: number;
  className?: string;
};

export function WalletCountUp(props: WalletCountUpProps) {
  if (props.reducedMotion) {
    return <StaticAmount {...props} />;
  }

  return <AnimatedAmount {...props} />;
}

function StaticAmount(props: WalletCountUpProps) {
  return <span className={props.className}>{formatAmount(props.value, props.locale, props.currency)}</span>;
}

function AnimatedAmount(props: WalletCountUpProps) {
  const { value, locale, currency, duration = 1.2, className } = props;
  const nodeRef = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    visualDuration: duration,
    bounce: 0,
  });

  useEffect(() => {
    if (nodeRef.current) {
      nodeRef.current.textContent = formatAmount(0, locale, currency);
    }
  }, [locale, currency]);

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest: number) => {
      if (nodeRef.current) {
        nodeRef.current.textContent = formatAmount(latest, locale, currency);
      }
    });

    return () => unsubscribe();
  }, [springValue, locale, currency]);

  return <span ref={nodeRef} className={className} />;
}

function formatAmount(value: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
