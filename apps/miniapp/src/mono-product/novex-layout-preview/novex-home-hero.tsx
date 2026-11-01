import type { ReactNode } from "react";

import styles from "./novex-layout-preview.module.css";

export function NovexHomeHero({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={[styles.homeHero, className].filter(Boolean).join(" ")}>
      {children ?? <div className={styles.homeHeroArt} aria-hidden="true">
        <span className={styles.homeHeroPlane} />
        <span className={styles.homeHeroOrbit} />
      </div>}
    </div>
  );
}
