"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { useTheme } from "../theme/theme-provider";
import { useMediaFlag } from "../theme/use-media-flag";
import { GlassSurface } from "./glass-surface";
import "./primitives.css";

export function BottomSheet(props: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  const { open, title, onClose, children } = props;
  const { theme } = useTheme();
  const prefersReduced = useMediaFlag("(prefers-reduced-motion: reduce)");
  const fade = prefersReduced || theme.motionIntensity <= 0;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const motionMode = fade ? "fade" : "spatial";
  const yOffset = `${Math.round(100 * Math.max(theme.motionIntensity, 0.4))}%`;

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = getFocusable(dialogRef.current)[0] ?? dialogRef.current;
    first?.focus();

    return () => {
      previousFocus.current?.focus();
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const nodes = getFocusable(dialogRef.current);
    if (nodes.length === 0) {
      return;
    }

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="bottom-sheet">
          <div className="bottom-sheet__backdrop" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-motion={motionMode}
            className="bottom-sheet__dialog"
            onKeyDown={onKeyDown}
            initial={fade ? { opacity: 0 } : { y: yOffset }}
            animate={fade ? { opacity: 1 } : { y: 0 }}
            exit={fade ? { opacity: 0 } : { y: yOffset }}
            transition={
              fade
                ? { duration: 0.16 }
                : {
                    type: "spring",
                    stiffness: 380 * (0.4 + theme.motionIntensity * 0.6),
                    damping: 32,
                  }
            }
          >
            <GlassSurface variant="regular" className="bottom-sheet__chrome">
              <h2 id={titleId}>{title}</h2>
              <button type="button" className="bottom-sheet__close" onClick={onClose}>
                Закрыть
              </button>
            </GlassSurface>
            <div className="bottom-sheet__body">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  return [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}
