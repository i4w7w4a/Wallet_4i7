"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import type { ButtonTargetId } from "@wallet/ui";
import { getActionArtworkAsset, type ArtworkMotion } from "./catalog";
import type { MonoActionArtworkV1 } from "./model";
import styles from "./mono-action-artwork.module.css";

type Props = {
  actionId: ButtonTargetId;
  config: MonoActionArtworkV1;
  active: boolean;
  trigger: number;
};

type Connection = EventTarget & { readonly saveData?: boolean };

function beamPath(motion: ArtworkMotion, size: number, opacity: number): Keyframe[] {
  const at = (x: number, y: number, extra = "") => `translate3d(${x}px, ${y}px, 0)${extra}`;
  const [from, to] = motion === "send"
    ? [at(-size * 0.6, size * 0.36, " rotate(30deg)"), at(size * 1.04, -size * 0.36, " rotate(30deg)")]
    : motion === "receive"
      ? [at(0, -size * 0.62), at(0, size * 0.84)]
      : motion === "swap"
        ? [at(-size * 0.62, 0), at(size * 1.04, 0)]
        : [at(size * 0.82, -size * 0.42, " scale(0.75)"), at(size * 0.22, size * 0.2, " scale(1)")];
  return [
    { transform: from, opacity: 0, offset: 0 },
    { transform: from, opacity, offset: 0.12 },
    { transform: to, opacity: opacity * 0.65, offset: 0.86 },
    { transform: to, opacity: 0, offset: 1 },
  ];
}

export function MonoActionArtwork({ actionId, config, active, trigger }: Props) {
  const asset = getActionArtworkAsset(config.packId, actionId);
  const root = useRef<HTMLSpanElement>(null);
  const beam = useRef<HTMLSpanElement>(null);
  const afterglow = useRef<HTMLSpanElement>(null);
  const animations = useRef<Animation[]>([]);
  const eligible = useRef(false);
  const lastTrigger = useRef(trigger);

  const cancel = useCallback(() => {
    for (const animation of animations.current) animation.cancel();
    animations.current = [];
  }, []);

  useEffect(() => {
    if (!active || !asset || !config.energy.enabled || config.energy.intensity <= 0) {
      eligible.current = false;
      cancel();
      return;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    let intersecting = true;
    const update = () => {
      eligible.current = document.visibilityState !== "hidden" && !reduced?.matches &&
        !connection?.saveData && intersecting;
      if (!eligible.current) cancel();
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      intersecting = entries.some(entry => entry.isIntersecting);
      update();
    }, { threshold: 0.01 });
    if (root.current) observer?.observe(root.current);
    document.addEventListener("visibilitychange", update);
    reduced?.addEventListener?.("change", update);
    connection?.addEventListener?.("change", update);
    update();
    return () => {
      eligible.current = false;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduced?.removeEventListener?.("change", update);
      connection?.removeEventListener?.("change", update);
      cancel();
    };
  }, [active, asset, config.energy.enabled, config.energy.intensity,
    config.energy.durationMs, config.energy.width, cancel]);

  useEffect(() => {
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    if (!eligible.current || !asset || !beam.current?.animate || !afterglow.current?.animate) return;
    cancel();
    const duration = config.energy.durationMs;
    const intensity = config.energy.intensity;
    const sweep = beam.current.animate(beamPath(asset.motion, asset.cssSize, intensity * 0.55), {
      duration: duration * 0.76, iterations: 1, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "none",
    });
    const decay = afterglow.current.animate([
      { opacity: 0, offset: 0 },
      { opacity: intensity * 0.24, offset: 0.22 },
      { opacity: 0, offset: 1 },
    ], { delay: duration * 0.44, duration: duration * 0.56, iterations: 1,
      easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "none" });
    animations.current = [sweep, decay];
  }, [trigger, active, asset, config.energy.enabled, config.energy.intensity,
    config.energy.durationMs, config.energy.width, cancel]);

  if (!asset) return null;
  const style = {
    "--art-size": `${asset.cssSize}px`,
    "--art-url": `url("${asset.src}")`,
    "--energy-width": `${config.energy.width * 100}%`,
  } as CSSProperties;
  return <span ref={root} className={styles.artwork} data-artwork-id={asset.id}
    data-motion={asset.motion} style={style} aria-hidden="true">
    <img className={styles.image} src={asset.src} width={1254} height={1254}
      alt="" aria-hidden="true" draggable={false} decoding="async" />
    <span className={styles.light} aria-hidden="true">
      <span ref={beam} className={styles.beam} />
      <span ref={afterglow} className={styles.afterglow} />
    </span>
  </span>;
}
