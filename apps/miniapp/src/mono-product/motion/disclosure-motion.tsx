"use client";

import { useLayoutEffect, useRef, useState, type AriaRole, type ReactNode, type SyntheticEvent } from "react";
import styles from "./disclosure-motion.module.css";

type DisclosureMotionProps = {
  open: boolean;
  id: string;
  launcherId: string;
  role?: AriaRole;
  labelledBy?: string;
  children: ReactNode;
};

export function DisclosureMotion({ open, id, launcherId, role, labelledBy, children }: DisclosureMotionProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const initialOpen = useRef(open);
  const initialized = useRef(false);
  const generation = useRef(0);
  const presenceRef = useRef(open);
  const [present, setPresent] = useState(open);
  const mounted = open || present;

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const doc = element.ownerDocument, view = doc.defaultView;
    const gate = element.closest<HTMLElement>("[data-mono-motion]");
    const reduced = view?.matchMedia?.("(prefers-reduced-motion: reduce)");
    const initial = !initialized.current;
    initialized.current = true;
    const setPresence = (value: boolean) => { presenceRef.current = value; setPresent(value); };

    const sync = () => {
      const revision = ++generation.current;
      const animated = !initial && gate?.dataset.monoMotion === "ready" &&
        doc.visibilityState !== "hidden" && reduced?.matches === false && typeof element.getAnimations === "function";
      if (!open && element.contains(doc.activeElement)) doc.getElementById(launcherId)?.focus({ preventScroll: true });
      // Focus leaves before either accessibility exclusion is applied, including controlled closes.
      if (open) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", "true");
      element.toggleAttribute("inert", !open);
      element.style.transition = animated ? "" : "none";
      // Establish the previous grid size after removing hidden; CSS reverses from its
      // current interpolated size on subsequent toggles, without a timer or height cap.
      void view?.getComputedStyle(element).gridTemplateRows;
      element.style.gridTemplateRows = open ? "1fr" : "0fr";
      if (open) { setPresence(true); return; }
      if (!animated || !presenceRef.current) { setPresence(false); return; }
      void view?.getComputedStyle(element).gridTemplateRows;
      const transitions = element.getAnimations();
      if (transitions.length === 0) { setPresence(false); return; }
      // Cancellation also settles a close; a newer open/close invalidates this completion.
      void Promise.allSettled(transitions.map(transition => transition.finished)).then(() => {
        if (generation.current === revision) setPresence(false);
      });
    };

    sync();
    const observer = gate && view ? new view.MutationObserver(sync) : null;
    if (gate) observer?.observe(gate, { attributes: true, attributeFilter: ["data-mono-motion"] });
    reduced?.addEventListener("change", sync);
    doc.addEventListener("visibilitychange", sync);
    return () => {
      ++generation.current;
      observer?.disconnect();
      reduced?.removeEventListener("change", sync);
      doc.removeEventListener("visibilitychange", sync);
    };
  }, [open, launcherId]);

  const blockClosed = (event: SyntheticEvent) => { event.preventDefault(); event.stopPropagation(); };
  return <div ref={elementRef} id={id} role={role} aria-labelledby={labelledBy}
    className={styles.disclosure} data-mono-disclosure-open={open} aria-hidden={!initialOpen.current || undefined} hidden={!mounted}
    style={{ gridTemplateRows: initialOpen.current ? "1fr" : "0fr" }}
    onClickCapture={open ? undefined : blockClosed} onKeyDownCapture={open ? undefined : blockClosed}>
    <div className={styles.clip}>{mounted && children}</div>
  </div>;
}
