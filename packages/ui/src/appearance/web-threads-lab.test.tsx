import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type PreferenceStorage } from "@wallet/core";

import {
  VISUAL_EFFECTS_STORAGE_KEY,
  VisualEffectsProvider,
  useVisualEffects,
} from "./visual-effects-provider";
import { WebThreadsLab } from "./web-threads-lab";

const LABELS = [
  "Скорость",
  "Количество нитей",
  "Частота",
  "Разброс",
  "Сужение",
  "Положение",
  "Режим веера",
  "Свечение",
  "Затухание",
  "Толщина",
  "Яркость",
  "Прозрачность нитей",
  "Зеркальность",
  "Мерцание",
  "Зерно",
  "Интенсивность зерна",
  "Реакция на указатель",
  "Сила указателя",
] as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(16);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

describe("WebThreadsLab", () => {
  it("показывает полный доступный набор shader controls", () => {
    renderLab(createMemoryStorage());

    for (const label of LABELS) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
  });

  it("немедленно меняет threadCount и сохраняет нормализованное значение", () => {
    const storage = createMemoryStorage();
    renderLab(storage);

    fireEvent.change(screen.getByLabelText("Количество нитей"), {
      target: { value: "9" },
    });

    expect(screen.getByRole("status", { name: "Текущее количество нитей" })).toHaveTextContent(
      "9",
    );
    expect(JSON.parse(storage.values.get(VISUAL_EFFECTS_STORAGE_KEY) ?? "{}")).toMatchObject({
      version: 1,
      threadCount: 9,
    });
  });
});

function renderLab(storage: ReturnType<typeof createMemoryStorage>) {
  return render(
    <VisualEffectsProvider storage={storage}>
      <WebThreadsLab />
      <EffectsProbe />
    </VisualEffectsProvider>,
  );
}

function EffectsProbe() {
  const { effects } = useVisualEffects();
  return (
    <output aria-label="Текущее количество нитей" role="status">
      {effects.threadCount}
    </output>
  );
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  const storage: PreferenceStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  return Object.assign(storage, { values });
}
