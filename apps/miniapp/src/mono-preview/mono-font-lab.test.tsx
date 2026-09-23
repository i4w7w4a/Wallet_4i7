import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonoFontLab } from "./mono-font-lab";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Font Lab switching", () => {
  it("keeps the last ready family during loading/failure and ignores a stale completed request", async () => {
    let releaseOnest: () => void = () => {};
    const onest = new Promise<void>(resolve => { releaseOnest = resolve; });
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async (font: string) => {
      if (font.includes("Onest")) await onest;
      if (font.includes("Manrope")) throw new Error("offline");
      return [{} as FontFace];
    } } });
    render(<MonoFontLab snapshot={await new MockWalletRepository().getSnapshot()} />);
    await screen.findByText("Набор готов");
    const scene = screen.getByRole("region", { name: "Живой образец кошелька" });
    const select = screen.getByRole("combobox", { name: "Шрифтовой набор" });
    fireEvent.change(select, { target: { value: "onest" } });
    expect(scene.style.getPropertyValue("--mono-font-ui")).toContain("Mono Plex Sans");
    fireEvent.change(select, { target: { value: "manrope" } });
    await screen.findByText("Шрифт не загрузился. Оставлен предыдущий набор.");
    await act(async () => { releaseOnest(); await onest; });
    expect(scene.style.getPropertyValue("--mono-font-ui")).toContain("Mono Plex Sans");
    expect(localStorage.length).toBe(0);
  });

  it("undoes a complete slider gesture and keeps controls outside the specimen", async () => {
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [{} as FontFace] } });
    render(<MonoFontLab snapshot={await new MockWalletRepository().getSnapshot()} />);
    const slider = screen.getByRole("slider", { name: "Макс. размер баланса" });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "56" } });
    fireEvent.change(slider, { target: { value: "60" } });
    fireEvent.pointerUp(slider);
    await waitFor(() => expect(screen.getByRole("region", { name: "Живой образец кошелька" }).style.getPropertyValue("--mono-type-balance-size")).toBe("60px"));
    fireEvent.click(screen.getByRole("button", { name: "Отменить изменение" }));
    expect(slider).toHaveValue("52");
    expect(screen.getByRole("button", { name: "Отменить изменение" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Живой образец кошелька" }).querySelector('input[type="range"]')).toBeNull();
  });
});
