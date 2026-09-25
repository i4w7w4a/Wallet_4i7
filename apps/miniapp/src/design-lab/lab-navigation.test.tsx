import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LabNavigation } from "./lab-navigation";

afterEach(cleanup);

test("navigation shows only explicitly enabled destinations and marks the current page", () => {
  render(<LabNavigation active="buttons" enabled={["home", "atmosphere", "buttons", "motion"]} />);
  const nav = screen.getByRole("navigation", { name: "Мастерские" });
  expect(within(nav).getAllByRole("link").map(link => [link.textContent?.trim(), link.getAttribute("href")])).toEqual([
    ["Лаборатория", "/design-lab"],
    ["Фоны", "/design-lab/atmosphere"],
    ["Кнопки", "/design-lab/buttons"],
    ["Отклик", "/design-lab/motion"],
  ]);
  expect(within(nav).getByRole("link", { name: "Кнопки" })).toHaveAttribute("aria-current", "page");
  expect(within(nav).queryByRole("link", { name: "Шрифты" })).not.toBeInTheDocument();
  expect(within(nav).queryByRole("link", { name: "Сцена" })).not.toBeInTheDocument();
});

test("an omitted allowlist exposes only the safe home link", () => {
  render(<LabNavigation active="home" />);
  const nav = screen.getByRole("navigation", { name: "Мастерские" });
  expect(within(nav).getAllByRole("link")).toHaveLength(1);
  expect(within(nav).getByRole("link", { name: "Лаборатория" })).toHaveAttribute("aria-current", "page");
});

test("allowed dev destinations stay ordinary focusable links", () => {
  render(<LabNavigation active="scene" enabled={["scene", "type"]} />);
  const nav = screen.getByRole("navigation", { name: "Мастерские" });
  const scene = within(nav).getByRole("link", { name: "Сцена" });
  scene.focus();
  expect(scene).toHaveFocus();
  expect(scene).toHaveAttribute("href", "/design-lab/scene");
  expect(scene).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("link", { name: "Шрифты" })).toHaveAttribute("href", "/design-lab/type");
});
