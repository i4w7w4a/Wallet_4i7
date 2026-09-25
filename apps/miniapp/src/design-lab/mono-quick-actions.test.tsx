import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MonoPreview } from "../mono-preview/mono-preview";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("lets a user try each quick action's feedback while keeping operations unavailable", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);

  const names = ["Отправить", "Получить", "Обмен", "Купить"];
  for (const name of names) {
    const control = await screen.findByRole("button", { name: new RegExp(`^${name}.*операция недоступна`) });
    expect(control).toBeEnabled();
    fireEvent.click(control);
    expect(screen.getByRole("status", { name: "Статус быстрых действий" }))
      .toHaveTextContent(`${name} — операция недоступна в демо.`);
  }
});

it("starts all four quick actions with the approved material response", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<MonoPreview snapshot={snapshot} />);

  for (const name of ["Отправить", "Получить", "Обмен", "Купить"]) {
    const control = await screen.findByRole("button", { name: new RegExp(`^${name}.*операция недоступна`) });
    expect(control).toHaveAttribute("data-control-effect", "material");
    expect(control).toHaveStyle({ "--press-depth": "2.7px", "--settle-ms": "270ms" });
  }
});
