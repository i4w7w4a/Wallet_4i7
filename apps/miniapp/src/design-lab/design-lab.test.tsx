import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesignLab } from "./design-lab";
import { STORAGE_KEY } from "./control-feedback-model";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("hover: hover"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CONTROL-FEEDBACK-01 lab", () => {
  it("keeps one semantic button while switching effect and comparing baseline", () => {
    render(<DesignLab />);
    fireEvent.click(screen.getByRole("button", { name: "Материал" }));
    expect(screen.getByRole("button", { name: "Материал" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll("[data-control-feedback]")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Проверить отклик" }));
    expect(screen.getByText("Срабатываний: 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Сравнить с базой" }));
    expect(document.querySelector("[data-control-feedback]")).toHaveAttribute("data-effect", "baseline");
    expect(document.querySelectorAll("[data-control-feedback]")).toHaveLength(1);
    expect(localStorage.length).toBe(0);
  });

  it("saves only a Lab preset and validates import before applying it", async () => {
    const first = render(<DesignLab />);
    fireEvent.click(screen.getByRole("button", { name: "Магнит" }));
    fireEvent.click(screen.getByRole("button", { name: "Контекст" }));
    fireEvent.click(screen.getByRole("button", { name: "430" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Ход магнитного слоя" }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
    expect(localStorage.length).toBe(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ effectId: "magnetic", view: "context", previewWidth: 430, config: { magneticTravel: 6 } });

    first.unmount();
    render(<DesignLab />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Магнит" })).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "Экспорт JSON" }));
    const exported = (screen.getByRole("textbox", { name: "Экспортированная проба" }) as HTMLTextAreaElement).value;
    expect(JSON.parse(exported).config.magneticTravel).toBe(6);

    fireEvent.change(screen.getByRole("textbox", { name: "Импорт JSON" }), { target: { value: JSON.stringify({ ...JSON.parse(exported), extra: "transfer" }) } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
    expect(screen.getByRole("button", { name: "Применить импорт" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Магнит" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByRole("textbox", { name: "Импорт JSON" }), { target: { value: exported.replace('"effectId": "magnetic"', '"effectId": "material"') } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
    expect(screen.getByRole("region", { name: "Предпросмотр импорта" })).toHaveTextContent("430 px");
    expect(screen.getByRole("region", { name: "Предпросмотр импорта" })).toHaveTextContent("6 px");
    expect(screen.getByRole("button", { name: "Применить импорт" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Применить импорт" }));
    expect(screen.getByRole("button", { name: "Материал" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.length).toBe(1);
  });
});
