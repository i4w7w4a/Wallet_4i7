import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClickSpark } from "./click-spark/click-spark";
import { GlassAction } from "./glass-action/glass-action";
import { GradientText } from "./gradient-text/gradient-text";
import { SpotlightSurface } from "./spotlight-surface/spotlight-surface";
import { WalletCountUp } from "./wallet-count-up/wallet-count-up";
import { WalletGooeyNav } from "./wallet-gooey-nav/wallet-gooey-nav";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("WalletCountUp", () => {
  it("при reduced motion сразу показывает русскую сумму", () => {
    render(<WalletCountUp value={12437.82} locale="ru-RU" currency="USD" reducedMotion />);

    expect(screen.getByText(/12.*437/)).toHaveTextContent(/12[\s\u00a0]437,82/);
  });
});

describe("SpotlightSurface", () => {
  it("не двигает spotlight без fine pointer", () => {
    render(<SpotlightSurface finePointer={false}>Активы</SpotlightSurface>);

    fireEvent.pointerMove(screen.getByText("Активы"), { clientX: 20, clientY: 10 });

    expect(screen.getByText("Активы").closest("[data-spotlight]")).toHaveAttribute("data-spotlight", "disabled");
  });

  it("обновляет координаты только на fine pointer", () => {
    render(<SpotlightSurface finePointer>Промо</SpotlightSurface>);

    const surface = screen.getByText("Промо").closest("[data-spotlight]");
    expect(surface).toHaveAttribute("data-spotlight", "enabled");

    fireEvent.pointerMove(surface as HTMLElement, { clientX: 24, clientY: 16 });
    expect((surface as HTMLElement).style.getPropertyValue("--spotlight-x")).not.toBe("");
  });
});

describe("GradientText", () => {
  it("в reduced motion отдаёт читаемый текст без animation frame", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(
      <GradientText reducedMotion colors={["#5B8CFF", "#7C6CFF"]}>
        Swap smarter
      </GradientText>,
    );

    expect(screen.getByText("Swap smarter")).toHaveClass("wallet-gradient-text--static");
    expect(raf).not.toHaveBeenCalled();
  });

  it("анимированный вариант использует CSS, а не постоянный JS RAF", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(
      <GradientText reducedMotion={false} colors={["#5B8CFF", "#7C6CFF"]}>
        Swap smarter
      </GradientText>,
    );

    const node = screen.getByText("Swap smarter");
    expect(node).toHaveClass("wallet-gradient-text--animated");
    expect(node).not.toHaveClass("wallet-gradient-text--static");
    expect(raf).not.toHaveBeenCalled();
  });

  it("останавливает shimmer при saveData, inactive и hidden", () => {
    const { rerender } = render(
      <GradientText reducedMotion={false} saveData>
        Swap smarter
      </GradientText>,
    );
    expect(screen.getByText("Swap smarter")).toHaveClass("wallet-gradient-text--static");

    rerender(
      <GradientText reducedMotion={false} active={false}>
        Swap smarter
      </GradientText>,
    );
    expect(screen.getByText("Swap smarter")).toHaveClass("wallet-gradient-text--static");

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    rerender(
      <GradientText reducedMotion={false} active>
        Swap smarter
      </GradientText>,
    );
    expect(screen.getByText("Swap smarter")).toHaveAttribute("data-paused", "true");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });
});

describe("GlassAction", () => {
  it("вызывает callback по click и остаётся кнопкой 44 px", () => {
    const onAction = vi.fn();

    render(<GlassAction label="Отправить" icon={<span />} onAction={onAction} />);

    const button = screen.getByRole("button", { name: "Отправить" });
    expect(button).toHaveClass("glass-action");
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector(".glass-action__core")).toBeInTheDocument();
    expect(button.querySelector(".glass-action__lens")).toBeInTheDocument();
    expect(button.querySelector(".glass-action__rim")).toBeInTheDocument();
    expect(button.querySelector(".glass-action__icon")).toBeInTheDocument();

    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: "Enter" });
    expect(onAction).toHaveBeenCalledTimes(2);

    const back = button.querySelector(".glass-action__back") as HTMLElement;
    const icon = button.querySelector(".glass-action__icon") as HTMLElement;
    expect(getComputedStyle(back).getPropertyValue("--glass-action-transition")).toMatch(/transform/);
    expect(getComputedStyle(icon).getPropertyValue("--glyph-filter").trim() || "none").toBe("none");
    expect(getComputedStyle(icon).getPropertyValue("--glyph-color").trim()).toMatch(/#e8f4ff|#e7f3ff/i);
  });
});

describe("ClickSpark", () => {
  it("не держит постоянный RAF до активации и отменяет его при unmount", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 17);
    const caf = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = render(
      <ClickSpark color="#ffffff" reducedMotion={false}>
        <button type="button">Искра</button>
      </ClickSpark>,
    );

    expect(raf).not.toHaveBeenCalled();
    expect(document.querySelectorAll("canvas")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Искра" }));
    expect(raf).toHaveBeenCalled();

    unmount();
    expect(caf).toHaveBeenCalled();
  });

  it("при reduced motion не анимирует canvas", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(
      <ClickSpark color="#ffffff" reducedMotion>
        <button type="button">Тихо</button>
      </ClickSpark>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Тихо" }));
    expect(raf).not.toHaveBeenCalled();
  });

  it("разрешает CSS-переменную в конкретный цвет для Canvas2D", () => {
    const strokes: string[] = [];
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return 21;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          clearRect() {
            return undefined;
          },
          beginPath() {
            return undefined;
          },
          moveTo() {
            return undefined;
          },
          lineTo() {
            return undefined;
          },
          stroke() {
            return undefined;
          },
          set strokeStyle(value: string) {
            strokes.push(value);
          },
          lineWidth: 0,
        }) as unknown as CanvasRenderingContext2D,
    );

    render(
      <div style={{ ["--color-accent" as string]: "#5b8cff" }}>
        <ClickSpark color="var(--color-accent)" reducedMotion={false}>
          <button type="button">Цвет</button>
        </ClickSpark>
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Цвет" }));
    frames[0]?.(16);

    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes[0]?.toLowerCase()).not.toBe("#000000");
    expect(strokes[0]?.toLowerCase()).not.toBe("var(--color-accent)");
    expect(strokes[0]).toMatch(/#5b8cff|rgb\(\s*91,\s*140,\s*255\s*\)/i);
  });
});

describe("WalletGooeyNav", () => {
  it("вызывает callback один раз и синхронизирует внешний active id", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const items = [
      { id: "home", label: "Главная", icon: <span /> },
      { id: "settings", label: "Настройки", icon: <span /> },
    ] as const;

    const { rerender, unmount } = render(
      <WalletGooeyNav items={items} activeId="home" onChange={onChange} reducedMotion={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("settings");
    expect(document.querySelector("a[href]")).not.toBeInTheDocument();

    rerender(<WalletGooeyNav items={items} activeId="settings" onChange={onChange} reducedMotion={false} />);
    expect(screen.getByRole("button", { name: "Настройки" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "Главная" }));
    vi.advanceTimersByTime(40);
    const particle = document.querySelector(".wallet-gooey-nav__particle");
    expect(particle).toBeTruthy();
    expect(particle).toHaveClass("is-active");
    expect(particle).toHaveAttribute("data-peak-opacity", "0.9");

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
