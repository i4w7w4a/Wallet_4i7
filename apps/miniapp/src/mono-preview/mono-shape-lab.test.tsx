import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MonoPreview } from "./mono-preview";

const SHAPE_STORAGE_KEY = "wallet4i7.mono.shape-preview.v1";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MONO shape lab", () => {
  it("live-edits only the selected control group without writing before Apply", async () => {
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;
    const quickActions = screen.getByRole("radio", { name: "Быстрые действия" });
    const bottomNavigation = screen.getByRole("radio", { name: "Нижнее меню" });
    const radius = screen.getByRole("slider", { name: "Радиус формы" });

    expect(quickActions).toBeChecked();
    expect(quickActions.closest("label")).toHaveTextContent("✓");
    expect(bottomNavigation.closest("label")).not.toHaveTextContent("✓");
    expect(radius).toHaveValue("12");

    fireEvent.change(radius, { target: { value: "24" } });
    expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("24px");
    expect(preview.style.getPropertyValue("--mono-nav-radius")).toBe("0px");
    expect(localStorage.getItem(SHAPE_STORAGE_KEY)).toBeNull();

    fireEvent.click(bottomNavigation);
    expect(bottomNavigation).toBeChecked();
    expect(bottomNavigation.closest("label")).toHaveTextContent("✓");
    expect(quickActions.closest("label")).not.toHaveTextContent("✓");
    expect(radius).toHaveValue("0");
    fireEvent.change(radius, { target: { value: "18" } });

    expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("24px");
    expect(preview.style.getPropertyValue("--mono-nav-radius")).toBe("18px");
    expect(localStorage.getItem(SHAPE_STORAGE_KEY)).toBeNull();

    await waitFor(() => expect(screen.getByRole("button", { name: "Применить форму" })).toBeEnabled());
  });

  it("resets both groups of the active direction without applying them", async () => {
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;
    const lab = within(screen.getByRole("group", { name: "Настройка формы" }));
    const radius = lab.getByRole("slider", { name: "Радиус формы" });

    fireEvent.change(radius, { target: { value: "24" } });
    fireEvent.click(lab.getByRole("radio", { name: "Нижнее меню" }));
    fireEvent.change(radius, { target: { value: "18" } });
    fireEvent.click(lab.getByRole("button", { name: "По умолчанию" }));

    expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("12px");
    expect(preview.style.getPropertyValue("--mono-nav-radius")).toBe("0px");
    expect(localStorage.getItem(SHAPE_STORAGE_KEY)).toBeNull();
  });

  it("restores only an explicitly applied candidate after remount", async () => {
    const snapshot = await new MockWalletRepository().getSnapshot();
    const first = render(<MonoPreview snapshot={snapshot} />);
    let lab = within(screen.getByRole("group", { name: "Настройка формы" }));
    let radius = lab.getByRole("slider", { name: "Радиус формы" });

    fireEvent.change(radius, { target: { value: "22" } });
    expect(localStorage.getItem(SHAPE_STORAGE_KEY)).toBeNull();
    first.unmount();

    const second = render(<MonoPreview snapshot={snapshot} />);
    let preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;
    expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("12px");

    lab = within(screen.getByRole("group", { name: "Настройка формы" }));
    radius = lab.getByRole("slider", { name: "Радиус формы" });
    fireEvent.change(radius, { target: { value: "20" } });
    fireEvent.click(lab.getByRole("radio", { name: "Нижнее меню" }));
    fireEvent.change(radius, { target: { value: "16" } });
    fireEvent.click(lab.getByRole("button", { name: "Применить форму" }));

    expect(localStorage.getItem(SHAPE_STORAGE_KEY)).not.toBeNull();
    second.unmount();
    render(<MonoPreview snapshot={snapshot} />);
    preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;

    await waitFor(() => {
      expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("20px");
      expect(preview.style.getPropertyValue("--mono-nav-radius")).toBe("16px");
    });
  });

  it("normalizes an applied candidate to the MONO manual radius bounds", async () => {
    localStorage.setItem(SHAPE_STORAGE_KEY, JSON.stringify({
      version: 1,
      skinId: "mono-ledger-v1",
      presets: {
        ledger: { "quick-actions": 999, "bottom-navigation": -8 },
        frost: { "quick-actions": 19, "bottom-navigation": 0 },
        mercury: { "quick-actions": 14, "bottom-navigation": 0 },
      },
    }));
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;
    const radius = screen.getByRole("slider", { name: "Радиус формы" });
    expect(radius).toHaveAttribute("min", "0");
    expect(radius).toHaveAttribute("max", "24");
    expect(radius).toHaveAttribute("step", "1");
    await waitFor(() => {
      expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("24px");
      expect(preview.style.getPropertyValue("--mono-nav-radius")).toBe("0px");
    });
  });

  it("keeps the last valid draft while exact input is incomplete or out of bounds", async () => {
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const preview = document.querySelector<HTMLElement>("[data-mono-preview]")!;
    const exact = screen.getByRole("spinbutton", { name: "Радиус: точное значение" });

    fireEvent.change(exact, { target: { value: "" } });
    expect(exact).toHaveValue(null);
    expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("12px");

    fireEvent.change(exact, { target: { value: "25" } });
    expect(exact).toHaveValue(25);
    expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("12px");

    fireEvent.change(exact, { target: { value: "20" } });
    expect(preview.style.getPropertyValue("--mono-actions-radius")).toBe("20px");
    fireEvent.blur(exact);
    expect(exact).toHaveValue(20);
  });

  it("applies only the active direction and leaves other direction drafts unapplied", async () => {
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const lab = within(screen.getByRole("group", { name: "Настройка формы" }));
    const radius = lab.getByRole("slider", { name: "Радиус формы" });
    const apply = lab.getByRole("button", { name: "Применить форму" });

    fireEvent.change(radius, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "2 · Frost" }));
    expect(radius).toHaveValue("19");
    expect(apply).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(radius, { target: { value: "21" } });
    fireEvent.click(apply);

    const stored = JSON.parse(localStorage.getItem(SHAPE_STORAGE_KEY)!) as {
      presets: Record<string, Record<string, number>>;
    };
    expect(stored.presets.ledger?.["quick-actions"]).toBe(12);
    expect(stored.presets.frost?.["quick-actions"]).toBe(21);

    fireEvent.click(screen.getByRole("button", { name: "1 · Ledger" }));
    expect(radius).toHaveValue("20");
  });

  it("keeps the live draft dirty when candidate storage is unavailable", async () => {
    const nativeSetItem = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === SHAPE_STORAGE_KEY) throw new Error("storage blocked");
      return nativeSetItem.call(this, key, value);
    });
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const lab = within(screen.getByRole("group", { name: "Настройка формы" }));
    const radius = lab.getByRole("slider", { name: "Радиус формы" });
    const apply = lab.getByRole("button", { name: "Применить форму" });
    fireEvent.change(radius, { target: { value: "20" } });
    fireEvent.click(apply);

    expect(document.querySelector<HTMLElement>("[data-mono-preview]")!.style
      .getPropertyValue("--mono-actions-radius")).toBe("20px");
    expect(apply).toBeEnabled();
    expect(apply).toHaveAttribute("aria-disabled", "false");
    expect(lab.getByRole("status", { name: "Состояние формы" })).toHaveTextContent("Не удалось сохранить форму");
    expect(localStorage.getItem(SHAPE_STORAGE_KEY)).toBeNull();
    write.mockRestore();
  });

  it("announces Apply without removing the focused action from the tab order", async () => {
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const lab = within(screen.getByRole("group", { name: "Настройка формы" }));
    fireEvent.change(lab.getByRole("slider", { name: "Радиус формы" }), { target: { value: "20" } });
    const apply = lab.getByRole("button", { name: "Применить форму" });
    apply.focus();
    fireEvent.click(apply);

    expect(apply).toHaveFocus();
    expect(apply).toBeEnabled();
    expect(apply).toHaveAttribute("aria-disabled", "true");
    expect(lab.getByRole("status", { name: "Состояние формы" })).toHaveTextContent("Форма применена");
  });

  it("associates the range and exact value with independent labels", async () => {
    render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);

    const range = screen.getByRole("slider", { name: "Радиус формы" });
    const exact = screen.getByRole("spinbutton", { name: "Радиус: точное значение" });

    expect(range.closest("label")).toBeNull();
    expect(exact.closest("label")).not.toBeNull();
    expect(exact.closest("label")).not.toBe(range.closest("label"));
  });
});
