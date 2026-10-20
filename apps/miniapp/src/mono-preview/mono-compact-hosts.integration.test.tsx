import "@testing-library/jest-dom/vitest";
import { Blob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CompressionStream, DecompressionStream } from "node:stream/web";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import manifest from "../../../../checkpoints/mono-published/2026-10-17/manifest.json";
import { HOME_PINS_STORAGE_KEY } from "../mono-product/home-pins";
import { monoPaletteStyle } from "./mono-palette-tokens";
import { canonicalMonoAppearance } from "./mono-preset-envelope";
import { parsePublishedRecord } from "./mono-published-contract";
import { MonoPublishedViewer } from "./mono-published-viewer";
import { createMonoShareUrl, readMonoShareFragment } from "./mono-share-codec";
import { MonoViewerPage } from "./mono-viewer-page";

const appearances = manifest.slots.map(record => {
  const source = readFileSync(resolve(process.cwd(), "../../checkpoints/mono-published/2026-10-17", record.snapshotFile), "utf8");
  return { source, ...parsePublishedRecord({ slot: record.slot, revision: record.revision,
    updatedAt: record.updatedAt, snapshot: JSON.parse(source) },
    record.slot as 1 | 2 | 3 | 4 | 5 | 6 | 7) };
});
// Hand-checked archive geometry/artwork, independent of the host's frame selection.
const variants = [
  { index: 0, theme: "dark", frame: "group", artwork: "original", radius: "12px", material: "false" },
  { index: 1, theme: "dark", frame: "group", artwork: "original", radius: "18px", material: "true" },
  { index: 2, theme: "light", frame: "group", artwork: "original", radius: "16px", material: null },
  { index: 3, theme: "dark", frame: "group", artwork: "original", radius: "4px", material: null },
  { index: 4, theme: "light", frame: "icons", artwork: "original", radius: "0px", material: null },
  { index: 5, theme: "dark", frame: "group", artwork: "volume-v1", radius: "22px", material: null },
  { index: 6, theme: "dark", frame: "separate", artwork: "contour-v1", radius: "14px", material: null },
];

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/mono/view");
  vi.stubGlobal("Blob", Blob);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("CompressionStream", CompressionStream);
  vi.stubGlobal("DecompressionStream", DecompressionStream);
  // No GPU exists in jsdom. The real host and material fallback remain mounted.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: media.includes("reduced-motion"), media,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 390, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(300, 710, 68, 48);
    if (this.hasAttribute("data-history-status-trigger")) return new DOMRect(280, 170, 44, 44);
    if (this.hasAttribute("data-history-status-filter")) return new DOMRect(180, 170, 144, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

function navigate(name: string) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name }));
}

for (const host of ["published", "portable"] as const) {
  // Removing either host flag must expose legacy content or ungrouped History.
  it.each(variants)(`${host} renders archive $index through compact Home/History with its own appearance`, async variant => {
    const archived = appearances[variant.index];
    const original = canonicalMonoAppearance(archived.snapshot);
    const wallet = await new MockWalletRepository().getSnapshot();
    if (host === "portable") {
      const url = await createMonoShareUrl(archived.snapshot, location.origin);
      const decoded = await readMonoShareFragment(new URL(url).hash);
      expect(canonicalMonoAppearance(decoded)).toBe(original);
      history.replaceState(null, "", url);
    }
    const view = render(host === "published"
      ? <MonoPublishedViewer wallet={wallet} published={archived.snapshot} />
      : <MonoViewerPage snapshot={wallet} />);
    await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
    const scene = view.container.querySelector<HTMLElement>("[data-mono-preview]")!;
    expect(screen.queryByRole("button", { name: "Мои средства" })).toBeVisible();
    expect(screen.getAllByRole("region", { name: "Общий баланс" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "В процессе · 1" })).toBeVisible();
    expect(scene).not.toHaveAttribute("data-mono-presentation");
    expect(scene).toHaveAttribute("data-mono-theme", variant.theme);
    expect(scene).toHaveAttribute("data-mono-preset", variant.index === 5 ? "frost" : "ledger");
    expect(scene.style.getPropertyValue("--mono-actions-radius")).toBe(variant.radius);
    if (archived.snapshot.appearance.palette.enabled) {
      // The boundary must forward this archive's semantic palette, rather than a host/default palette.
      const paint = monoPaletteStyle(archived.snapshot.appearance.palette.config.themes[variant.theme as "dark" | "light"]);
      for (const [token, value] of Object.entries(paint)) expect(scene.style.getPropertyValue(token)).toBe(String(value));
    }
    const actions = screen.getByRole("region", { name: "Действия" });
    expect(within(actions).getAllByRole("button")).toHaveLength(4);
    expect(actions).toHaveAttribute("data-frame-mode", variant.frame);
    expect([...actions.querySelectorAll("[data-artwork-pack]")].map(node => node.getAttribute("data-artwork-pack")))
      .toEqual(Array(4).fill(variant.artwork));
    const material = view.container.querySelector("[data-mono-product-material]");
    if (variant.material === null) expect(material).toBeNull();
    else expect(material).toHaveAttribute("data-mono-effect-background", variant.material);
    expect(actions.querySelectorAll("[data-material-target]")).toHaveLength(variant.index === 0 ? 4 : 0);
    expect(view.container.querySelector(".mono-promo-frame, .mono-product-funds__list, [data-mono-gold-account-deck]")).toBeNull();
    expect(screen.queryByRole("region", { name: "График баланса" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Последняя операция" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Закреплённые группы счетов" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Подробнее/ })).toBeNull();
    expect(view.container.querySelectorAll("canvas").length).toBeLessThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(within(screen.getByRole("dialog", { name: "Меню" })).queryByRole("button", { name: "На главной" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть меню" }));
    navigate("История");
    const activity = screen.getByRole("region", { name: "История операций" });
    expect(activity).toHaveAttribute("data-history-presentation", "compact");
    expect(within(activity).getByRole("heading", { name: "27 сентября 2026 г." })).toBeVisible();
    expect(within(activity).getByRole("heading", { name: "26 сентября 2026 г." })).toBeVisible();
    expect(activity.querySelector('[data-product-activity-id][data-status="pending"]')).toBeVisible();
    expect(activity.querySelector('[data-product-activity-id][data-status="failed"]')).toBeVisible();
    expect(canonicalMonoAppearance(archived.snapshot)).toBe(original);
    expect(readFileSync(resolve(process.cwd(), "../../checkpoints/mono-published/2026-10-17", manifest.slots[variant.index].snapshotFile), "utf8"))
      .toBe(archived.source);
  });

  it(`${host} preserves visitor preferences while Funds, privacy, History search/status/reset and receipts work`, async () => {
    const archived = appearances[1];
    const theme = '{ "version": 1, "theme": "light" }';
    const pins = '{ "version": 2, "groups": ["depositary"], "totalOnly": true }';
    localStorage.setItem("wallet4i7.mono.viewer-theme.v1", theme);
    localStorage.setItem(HOME_PINS_STORAGE_KEY, pins);
    if (host === "portable") history.replaceState(null, "", await createMonoShareUrl(archived.snapshot, location.origin));
    const wallet = await new MockWalletRepository().getSnapshot();
    const view = render(host === "published"
      ? <MonoPublishedViewer wallet={wallet} published={archived.snapshot} />
      : <MonoViewerPage snapshot={wallet} />);
    await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light"));
    expect(screen.queryByRole("button", { name: "Мои средства" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Мои средства" }));
    expect(screen.getByRole("button", { name: "Выбрать счёт: Все счета" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Открыть актив Bitcoin (BTC)" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад к активам" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад в обзор" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Мои средства" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
    navigate("История");
    const activity = screen.getByRole("region", { name: "История операций" });
    fireEvent.click(within(activity).getByRole("button", { name: "Поиск по операциям" }));
    fireEvent.change(within(activity).getByRole("searchbox"), { target: { value: "no-match-compact" } });
    expect(within(activity).getByText("Нет совпадений")).toBeVisible();
    fireEvent.click(within(activity).getByRole("button", { name: "Сбросить фильтры" }));
    fireEvent.click(within(activity).getByRole("button", { name: "Фильтр статуса" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Статус операций" })).getByRole("button", { name: "Ожидают" }));
    expect(activity.querySelectorAll("[data-product-activity-id]")).toHaveLength(1);
    expect(activity.querySelector('[data-product-activity-id][data-status="pending"]')).toBeVisible();
    fireEvent.click(within(activity).getByRole("button", { name: "Сбросить фильтр статуса" }));
    expect(activity.querySelectorAll("[data-product-activity-id]")).toHaveLength(4);
    const row = activity.querySelector<HTMLButtonElement>('[data-product-activity-id][data-status="pending"]')!;
    fireEvent.click(row);
    const receipt = screen.getByRole("region", { name: "Квитанция операции" });
    expect(receipt).toHaveTextContent("••••");
    act(() => { row.focus(); });
    fireEvent.click(row);
    expect(screen.queryByRole("region", { name: "Квитанция операции" })).toBeNull();
    await waitFor(() => expect(row).toHaveFocus());
    navigate("Обзор");
    expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
    expect(localStorage.getItem("wallet4i7.mono.viewer-theme.v1")).toBe(theme);
    // Ordinary viewers retain their existing controller's canonical preference write on mount.
    expect(JSON.parse(localStorage.getItem(HOME_PINS_STORAGE_KEY)!)).toEqual({
      version: 2, groups: ["depositary"], totalOnly: true,
    });
  });
}
