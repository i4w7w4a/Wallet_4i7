/**
 * Adapted for Wallet_4i7 from React Bits at commit
 * 3a1c7f2f9f94ed833934ab5c2635760b9e644583.
 * Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
 */

"use client";

import { useEffect, useRef } from "react";

import type { VisualEffectsConfig } from "@wallet/core";

import {
  createWebThreadsEngine,
  type WebThreadsColors,
  type WebThreadsEngine,
  type WebThreadsEngineInput,
  type WebThreadsUnavailableReason,
} from "./web-threads-engine";
import "./web-threads.css";

export type { WebThreadsColors } from "./web-threads-engine";

export type WebThreadsProps = {
  effects: VisualEffectsConfig;
  colors: WebThreadsColors;
  active: boolean;
  coarsePointer: boolean;
  onUnavailable(reason: WebThreadsUnavailableReason): void;
  engineFactory?: typeof createWebThreadsEngine;
};

export function WebThreads({
  effects,
  colors,
  active,
  coarsePointer,
  onUnavailable,
  engineFactory = createWebThreadsEngine,
}: WebThreadsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WebThreadsEngine | null>(null);
  const inputRef = useRef<WebThreadsEngineInput>(
    makeInput(effects, colors, coarsePointer, onUnavailable),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = engineFactory(canvas, inputRef.current);
    engineRef.current = engine;

    return () => {
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [engineFactory]);

  useEffect(() => {
    const input = makeInput(effects, colors, coarsePointer, onUnavailable);
    inputRef.current = input;
    engineRef.current?.update(input);
  }, [effects, colors, coarsePointer, onUnavailable]);

  useEffect(() => {
    engineRef.current?.setRunning(active);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="wallet-web-threads"
      data-testid="web-threads-canvas"
      data-web-threads
      aria-hidden="true"
    />
  );
}

function makeInput(
  effects: VisualEffectsConfig,
  colors: WebThreadsColors,
  coarsePointer: boolean,
  onUnavailable: WebThreadsProps["onUnavailable"],
): WebThreadsEngineInput {
  return {
    effects,
    colors,
    viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth,
    mouseInteraction: effects.pointerInteraction && !coarsePointer,
    onUnavailable,
  };
}
