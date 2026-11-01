import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesignLab } from "./design-lab";
import { STORAGE_KEY } from "./control-feedback-model";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// A synthetic replacement or disconnected controller cannot complete the real route.
it("previews the real A wallet through custody, receive and back in the old lab", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const { container } = render(<DesignLab walletSnapshot={snapshot} />);
  const wallet = screen.getByRole("region", { name: "Примерка кошелька" });
  const card = wallet.querySelector<HTMLButtonElement>("[data-r1-wallet-kind='custodial']")!;
  expect(card.querySelector("img")?.getAttribute("src")).toContain("/wallet-art/series-a/custodial-");
  fireEvent.click(card);
  const workspace = wallet.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]")!;
  expect(workspace).toBeVisible();
  fireEvent.click(within(workspace).getByRole("button", { name: "Получить" }));
  fireEvent.click(within(workspace).getByRole("button", { name: "Подготовить получение USDC · Кастодиальный · Ethereum · Внешнее получение" }));
  const dialog = await screen.findByRole("dialog", { name: "Получить" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
  fireEvent.click(within(workspace).getByRole("button", { name: /^Назад/ }));
  await waitFor(() => expect(container.querySelector("[data-r1-wallet-kind='custodial']")).toBeVisible());
});

// The applied preview must actually use the saved draft and reset, not merely acknowledge a click.
it("applies saved controls to the real preview and restores defaults", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  render(<DesignLab walletSnapshot={snapshot} />);
  const wallet = screen.getByRole("region", { name: "Примерка кошелька" });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Мягкость возврата" }), { target: { value: "240" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить пробу" }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).config.settleMs).toBe(240);
  fireEvent.click(screen.getByRole("button", { name: "Применить к примерке кошелька" }));
  expect(wallet).toHaveStyle({ "--motion-linked-card": "240ms" });
  fireEvent.click(screen.getByRole("button", { name: "Сбросить настройки" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить к примерке кошелька" }));
  expect(wallet).toHaveStyle({ "--motion-linked-card": "190ms" });
});
