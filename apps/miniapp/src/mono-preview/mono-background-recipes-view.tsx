"use client";

import { useEffect, useId, useMemo, useRef, type CSSProperties, type RefObject } from "react";
import { monoBackgroundTiming, normalizeMonoBackgroundRecipe, type MonoBackgroundRecipeConfig } from "./mono-background-recipes";
import { mountMonoBackgroundMotion } from "./mono-background-recipes-runtime";
import "./mono-atmosphere.css";
import "./mono-environment.css";
import styles from "./mono-background-recipes.module.css";

export type MonoBackgroundRecipesProps = {
  config: MonoBackgroundRecipeConfig;
  surfaceRef: RefObject<HTMLElement | null>;
  theme: "dark" | "light";
  active?: boolean;
  hostActive?: boolean;
  effectsDisabled?: boolean;
};

/** Original vector/CSS compositions, inspired by light mechanics, not shader ports.
 * Provenance and visual losses: docs/skins/mono-atmosphere-lab.md.
 * Mount exactly one of these OR the legacy atmosphere. The content stays DOM.
 */
export function MonoBackgroundRecipes({ config: input, surfaceRef, theme, active = true,
  hostActive = true, effectsDisabled = false }: MonoBackgroundRecipesProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const config = useMemo(() => normalizeMonoBackgroundRecipe(input), [input]);
  const timing = monoBackgroundTiming(config);
  useEffect(() => {
    if (!ref.current || !surfaceRef.current) return;
    return mountMonoBackgroundMotion(ref.current, surfaceRef.current, config, { active, hostActive, effectsDisabled });
  }, [config, surfaceRef, active, hostActive, effectsDisabled]);
  const style = {
    "--recipe-intensity": config.recipe === "baseline" ? 1 : config.intensity,
    "--recipe-duration": `${timing.durationMs}ms`,
    "--recipe-easing": timing.easing,
  } as CSSProperties;

  return <div ref={ref} className={styles.layer} style={style} aria-hidden="true"
    data-mono-background-recipe={config.recipe} data-recipe-theme={theme} data-motion="static"
    data-effects-disabled={effectsDisabled} data-pointer-active="false">
    {config.recipe === "baseline" ? <div className={`mono-atmosphere ${styles.baseline}`}>
      <span className="mono-atmosphere__focus" />
      <span className="mono-atmosphere__ribbon" />
      <span className="mono-atmosphere__grid" />
      <span className="mono-atmosphere__iridescence" />
    </div> : config.recipe === "obsidian" ? <div className={styles.material}>
      <svg className={styles.folds} viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2=".35">
            <stop stopColor="var(--recipe-shadow)" offset="0" />
            <stop stopColor="var(--recipe-body)" offset=".53" />
            <stop stopColor="var(--recipe-edge)" offset=".79" />
            <stop stopColor="var(--recipe-shadow)" offset="1" />
          </linearGradient>
          <linearGradient id={`${id}-back`} x1="0" y1="0" x2=".8" y2="1">
            <stop stopColor="var(--recipe-shadow)" />
            <stop stopColor="var(--recipe-body)" offset=".49" />
            <stop stopColor="var(--recipe-edge)" offset=".6" />
            <stop stopColor="var(--recipe-shadow)" offset="1" />
          </linearGradient>
        </defs>
        <path d="M600-170C-55 40 32 157 367 258C677 352 545 464 159 542C-156 606-88 789 616 1052L740 1010V-170Z" fill={`url(#${id}-fold)`} />
        <path d="M596-137C-16 63 74 171 386 271C635 351 520 447 150 533" fill="none" stroke="var(--recipe-thread)" strokeWidth="1" />
        <path d="M-182 216C70 310 316 387 142 520C-58 672 116 787 563 804L589 981C-130 819-142 647 25 516C206 374-79 335-182 308Z" fill={`url(#${id}-back)`} opacity=".8" />
      </svg>
      <svg className={styles.counterfold} viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice" focusable="false">
        <path d="M530-20C212 130 230 181 428 254C734 367 402 476 133 544C-74 596 11 766 502 886" fill="none" stroke="var(--recipe-thread)" strokeWidth=".8" />
        <path d="M567-17C268 140 238 189 449 270C719 374 453 477 177 548C-33 602 16 736 518 880" fill="none" stroke="var(--recipe-thread)" strokeWidth=".5" opacity=".45" />
      </svg>
    </div> : <div className={styles.material}>
      <svg className={styles.aperture} viewBox="0 0 480 900" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id={`${id}-beam`} x1=".8" y1="0" x2=".2" y2="1">
            <stop stopColor="var(--recipe-edge)" stopOpacity=".85" />
            <stop stopColor="var(--recipe-body)" stopOpacity=".66" offset=".46" />
            <stop stopColor="var(--recipe-shadow)" stopOpacity="0" offset="1" />
          </linearGradient>
          <linearGradient id={`${id}-plane`} x1="0" y1="0" x2="1" y2=".5">
            <stop stopColor="var(--recipe-shadow)" />
            <stop stopColor="var(--recipe-body)" stopOpacity=".15" offset=".85" />
            <stop stopColor="var(--recipe-edge)" stopOpacity=".65" offset="1" />
          </linearGradient>
        </defs>
        <path d="M325-90H383L200 920H-310Z" fill={`url(#${id}-beam)`} />
        <path d="M410-80H436L522 850H331Z" fill={`url(#${id}-beam)`} opacity=".5" />
        <path d="M-90-100H329L97 687L-90 834Z" fill={`url(#${id}-plane)`} />
        <path d="M329-100L97 687L-90 834" fill="none" stroke="var(--recipe-thread)" strokeWidth="1.2" />
      </svg>
      <div className={styles.shutter} />
      <div className={styles.ruling} />
    </div>}
    {config.recipe !== "baseline" && <div className={styles.veil} />}
  </div>;
}
