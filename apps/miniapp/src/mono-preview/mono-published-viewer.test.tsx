import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, expect, it, vi } from "vitest";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoPublishedViewer } from "./mono-published-viewer";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("renders the published product scene with wallet sections and no editor or storage access", async () => {
  vi.stubGlobal("matchMedia", (media: string) => ({ matches: media.includes("reduced-motion"), media,
    addEventListener() {}, removeEventListener() {} }));
  const wallet = await new MockWalletRepository().getSnapshot();
  const published = createMonoAppearanceEnvelope("frost");
  published.appearance.environment = { theme: "light", background: "strata" };
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const { container } = render(<MonoPublishedViewer wallet={wallet} published={published} />);
  expect(container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-theme", "light");
  expect(container.querySelector("[data-mono-rail], [data-mono-workbench]")).toBeNull();
  expect(screen.queryByText(/редактор|публикац|пароль/i)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Скрыть баланс" }));
  expect(screen.getByRole("button", { name: "Показать баланс" })).toBeVisible();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
