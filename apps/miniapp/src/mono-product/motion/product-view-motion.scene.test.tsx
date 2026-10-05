import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "../../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../../mono-preview/mono-preset-envelope";

type Entry = { target: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; animation: Animation };
let entries: Entry[];

beforeEach(() => {
  entries = [];
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("IntersectionObserver", undefined);
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (
    this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions,
  ) {
    const animation = { cancel: vi.fn(), onfinish: null, oncancel: null } as unknown as Animation;
    if (this.parentElement?.classList.contains("mono-scene") &&
        !this.matches(".mono-app-header, .mono-product-context")) entries.push({ target: this, frames, options, animation });
    return animation;
  } });
});

afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

it("enters only semantic product views while preserving immediate asset commands, focus, and scroll rebase", async () => {
  const wallet = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const session = { balanceHidden: false, onBalanceHiddenChange: vi.fn(), period: "1D" as const,
    onPeriodChange: vi.fn(), onThemeChange: vi.fn() };
  const scene = (hidden = false, theme: "light" | "dark" = "dark") => <div data-material-scrollport>
    <MonoProductScene snapshot={wallet} appearance={{ ...envelope.appearance,
      environment: { ...envelope.appearance.environment, theme } }} material={envelope.material}
      session={{ ...session, balanceHidden: hidden }} />
  </div>;
  const { container, rerender } = render(scene());
  const header = container.querySelector(".mono-app-header");
  const context = container.querySelector(".mono-product-context");
  const nav = screen.getByRole("navigation", { name: "Разделы кошелька" });
  const scrollport = container.querySelector<HTMLElement>("[data-material-scrollport]")!;
  const rebased: number[] = [];
  scrollport.addEventListener("material-viewport-motion-rebase", () => rebased.push(scrollport.scrollTop));
  expect(entries).toHaveLength(0);

  scrollport.scrollTop = 120;
  fireEvent.click(within(nav).getByRole("button", { name: "Активы" }));
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeVisible();
  expect(entries).toHaveLength(1);
  expect(entries[0].options).toMatchObject({ duration: 280, easing: "cubic-bezier(.2,0,0,1)" });
  expect(entries[0].frames[0]).toMatchObject({ transform: "translate3d(6px, 0, 0)" });
  expect(Number(entries[0].frames[0].opacity)).toBeGreaterThan(0);
  expect(rebased).toEqual([0]);

  fireEvent.click(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" }));
  expect(screen.getByRole("heading", { name: "USD Coin" })).toHaveFocus();
  expect(entries).toHaveLength(2);
  expect(entries[0].animation.cancel).toHaveBeenCalled();
  expect(entries[1].options.duration).toBe(300);
  expect(entries[1].frames[0].transform).toBe("translate3d(12px, 0, 0)");
  expect(rebased).toEqual([0, 0]);
  expect(container.querySelectorAll("[data-mono-product-asset-workspace]")).toHaveLength(1);
  expect(container.querySelector(".mono-hero, .mono-actions, .mono-product-funds")).toBeNull();

  fireEvent.click(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" }));
  rerender(scene(false, "light"));
  rerender(scene(true, "light"));
  expect(screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" })).toBeChecked();
  expect(entries).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
  expect(screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" })).toHaveFocus();
  expect(entries).toHaveLength(3);
  expect(entries[1].animation.cancel).toHaveBeenCalled();
  expect(entries[2].frames[0].transform).toBe("translate3d(-12px, 0, 0)");
  expect(container.querySelector(".mono-app-header")).toBe(header);
  expect(container.querySelector(".mono-product-context")).toBe(context);
  expect(screen.getByRole("navigation", { name: "Разделы кошелька" })).toBe(nav);
  expect(container.querySelectorAll("canvas").length).toBeLessThanOrEqual(1);
});
