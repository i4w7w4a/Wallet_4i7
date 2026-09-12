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

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
