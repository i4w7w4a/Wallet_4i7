"use client";

import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import styles from "./avatar-control.module.css";

export type AvatarControlProps =
  Omit<ComponentPropsWithoutRef<"button">, "children" | "aria-label"> & {
    "aria-label": string;
    avatarSrc?: string | null;
    fallback?: string;
    motionEnabled?: boolean;
  };

function Portrait({ src, fallback }: { src?: string; fallback: string }) {
  const [status, setStatus] = useState<"pending" | "ready" | "failed">("pending");
  return <span className={styles.portrait} aria-hidden="true">
    <span className={styles.fallback} hidden={status === "ready"}>
      {fallback || <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.3" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>}
    </span>
    {src && status !== "failed" &&
      // The local 160px asset is already optimized; native load/error keeps its fallback independent of an image service.
      // eslint-disable-next-line @next/next/no-img-element
      <img className={styles.image} src={src} width="40" height="40" alt="" aria-hidden="true"
        draggable={false} decoding="async" hidden={status !== "ready"}
        onLoad={() => setStatus("ready")} onError={() => setStatus("failed")} />}
  </span>;
}

/** Presentation only. Profile navigation, guards and focus return stay with the host. */
export const AvatarControl = forwardRef<HTMLButtonElement, AvatarControlProps>(
  function AvatarControl({ avatarSrc, fallback = "", motionEnabled = true, className,
    type = "button", ...buttonProps }, ref) {
    const src = avatarSrc?.trim() || undefined;
    const initial = Array.from(fallback.trim())[0]?.toLocaleUpperCase("ru-RU") ?? "";
    return <button {...buttonProps} ref={ref} type={type}
      className={[styles.control, className].filter(Boolean).join(" ")}
      data-avatar-motion={motionEnabled ? "full" : "static"}>
      <Portrait key={src ?? ""} src={src} fallback={initial} />
      <span className={styles.rim} aria-hidden="true" />
      <span className={styles.glint} aria-hidden="true" />
    </button>;
  },
);
