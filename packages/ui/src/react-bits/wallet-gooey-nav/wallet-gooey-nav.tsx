/*
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
Upstream: src/ts-default/Components/GooeyNav/GooeyNav.tsx
*/

"use client";

import { type ReactNode, useEffect, useRef } from "react";

import "./wallet-gooey-nav.css";

type GooeyNavItem<T extends string> = { id: T; label: string; icon: ReactNode };

type WalletGooeyNavProps<T extends string> = {
  items: readonly GooeyNavItem<T>[];
  activeId: T;
  onChange(id: T): void;
  reducedMotion: boolean;
};

export function WalletGooeyNav<T extends string>(props: WalletGooeyNavProps<T>) {
  const { items, activeId, onChange, reducedMotion } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef(new Set<number>());
  const rafsRef = useRef(new Set<number>());

  function trackTimeout(fn: () => void, delay: number) {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, delay);
    timersRef.current.add(id);
  }

  function updateIndicator() {
    const container = containerRef.current;
    const filter = filterRef.current;
    const activeButton = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !filter || !activeButton) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const pos = activeButton.getBoundingClientRect();
    filter.style.left = `${pos.x - containerRect.x}px`;
    filter.style.top = `${pos.y - containerRect.y}px`;
    filter.style.width = `${pos.width}px`;
    filter.style.height = `${pos.height}px`;
  }

  function makeParticles(element: HTMLElement) {
    if (reducedMotion) {
      return;
    }

    for (let index = 0; index < 8; index += 1) {
      trackTimeout(() => {
        const particle = document.createElement("span");
        particle.className = "wallet-gooey-nav__particle";
        particle.setAttribute("aria-hidden", "true");
        particle.style.setProperty("--start-x", `${(Math.random() - 0.5) * 36}px`);
        particle.style.setProperty("--start-y", `${(Math.random() - 0.5) * 24}px`);
        element.appendChild(particle);
        const raf = requestAnimationFrame(() => {
          rafsRef.current.delete(raf);
          particle.classList.add("is-active");
        });
        rafsRef.current.add(raf);
        trackTimeout(() => {
          particle.remove();
        }, 420);
      }, 20 * index);
    }
  }

  useEffect(() => {
    updateIndicator();
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => updateIndicator());
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeId]);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current.clear();
      rafsRef.current.forEach((id) => cancelAnimationFrame(id));
      rafsRef.current.clear();
    },
    [],
  );

  return (
    <div className="wallet-gooey-nav" ref={containerRef}>
      <nav aria-label="Основная навигация">
        <ul ref={navRef}>
          {items.map((item) => {
            const active = item.id === activeId;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (item.id === activeId) {
                      return;
                    }
                    onChange(item.id);
                    if (filterRef.current) {
                      filterRef.current.replaceChildren();
                      makeParticles(filterRef.current);
                    }
                  }}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <span className="wallet-gooey-nav__effect" ref={filterRef} aria-hidden="true" />
    </div>
  );
}
