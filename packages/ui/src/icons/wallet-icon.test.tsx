import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WalletIcon, type WalletIconName } from "./wallet-icon";

const NAMES: WalletIconName[] = [
  "send",
  "receive",
  "swap",
  "buy",
  "search",
  "notifications",
  "appearance",
  "home",
  "portfolio",
  "explore",
  "settings",
  "eye",
];

afterEach(() => {
  cleanup();
});

describe("WalletIcon", () => {
  it.each(NAMES)("рисует резкую SVG-иконку %s без текста и scale", (name) => {
    const { container } = render(<WalletIcon name={name} />);
    const svg = container.querySelectorAll("svg");

    expect(svg).toHaveLength(1);
    expect(svg[0]).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg[0]).toHaveAttribute("aria-hidden", "true");
    expect(svg[0]).toHaveAttribute("focusable", "false");
    expect(svg[0]).toHaveAttribute("stroke-width", "1.7");
    expect(svg[0]).toHaveAttribute("stroke-linecap", "round");
    expect(svg[0]).toHaveAttribute("stroke-linejoin", "round");
    expect(svg[0]).toHaveAttribute("stroke", "currentColor");
    expect(svg[0]).toHaveAttribute("fill", "none");
    expect(svg[0]?.textContent?.trim()).toBe("");
    expect(svg[0]?.getAttribute("style") ?? "").not.toMatch(/scale\(/);
    expect(svg[0]?.getAttribute("transform") ?? "").not.toMatch(/scale/i);
  });

  it("поддерживает размеры 20, 24 и 28 px", () => {
    const { rerender, container } = render(<WalletIcon name="home" size={20} />);
    expect(container.querySelector("svg")).toHaveClass("wallet-icon--20");

    rerender(<WalletIcon name="home" size={24} />);
    expect(container.querySelector("svg")).toHaveClass("wallet-icon--24");

    rerender(<WalletIcon name="home" size={28} />);
    expect(container.querySelector("svg")).toHaveClass("wallet-icon--28");
  });
});
