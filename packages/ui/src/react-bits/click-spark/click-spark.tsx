/*
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
Upstream: src/ts-default/Animations/ClickSpark/ClickSpark.tsx
*/

"use client";

import { type MouseEvent, type PropsWithChildren, useCallback, useEffect, useRef } from "react";

import "./click-spark.css";

type ClickSparkProps = PropsWithChildren<{
  color: string;
  reducedMotion: boolean;
  count?: number;
  duration?: number;
}>;

type Spark = {
  x: number;
  y: number;
  angle: number;
  startTime: number;
};

export function ClickSpark(props: ClickSparkProps) {
  const { children, color, reducedMotion, count = 8, duration = 400 } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const rafRef = useRef<number | null>(null);
  const drawRef = useRef<(timestamp: number) => void>(() => undefined);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    drawRef.current = (timestamp: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        stopLoop();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) {
          return false;
        }

        const progress = elapsed / duration;
        const eased = progress * (2 - progress);
        const distance = eased * 16;
        const length = 10 * (1 - eased);
        ctx.strokeStyle = resolveCanvasColor(canvas, color);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(spark.x + distance * Math.cos(spark.angle), spark.y + distance * Math.sin(spark.angle));
        ctx.lineTo(
          spark.x + (distance + length) * Math.cos(spark.angle),
          spark.y + (distance + length) * Math.sin(spark.angle),
        );
        ctx.stroke();
        return true;
      });

      if (sparksRef.current.length === 0) {
        stopLoop();
        return;
      }

      rafRef.current = requestAnimationFrame((next) => drawRef.current(next));
    };
  }, [color, duration, stopLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || reducedMotion) {
      return;
    }

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resize();
    if (typeof ResizeObserver === "undefined") {
      return stopLoop;
    }

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => {
      observer.disconnect();
      stopLoop();
    };
  }, [reducedMotion, stopLoop]);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (reducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = performance.now();
    sparksRef.current = Array.from({ length: count }, (_, index) => ({
      x,
      y,
      angle: (2 * Math.PI * index) / count,
      startTime: now,
    }));

    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame((timestamp) => drawRef.current(timestamp));
    }
  }

  return (
    <div className="wallet-click-spark" onClick={onClick}>
      {reducedMotion ? null : <canvas ref={canvasRef} className="wallet-click-spark__canvas" aria-hidden="true" />}
      {children}
    </div>
  );
}

function resolveCanvasColor(host: HTMLElement, color: string): string {
  const trimmed = color.trim();
  const variable = trimmed.match(/^var\(\s*(--[A-Za-z0-9-]+)(?:\s*,\s*((?:[^)(]+|\([^)]*\))+))?\s*\)$/);
  if (!variable) {
    return trimmed;
  }

  let node: HTMLElement | null = host;
  while (node) {
    const inline = node.style.getPropertyValue(variable[1]).trim();
    if (inline) {
      return inline;
    }
    const computed = getComputedStyle(node).getPropertyValue(variable[1]).trim();
    if (computed) {
      return computed;
    }
    node = node.parentElement;
  }

  return variable[2]?.trim() || "#5b8cff";
}
