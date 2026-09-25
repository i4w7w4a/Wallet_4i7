import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LabHome } from "./lab-home";

afterEach(cleanup);

test("hub shows only connected workshops with one useful line each", () => {
  render(<LabHome enabled={["home", "atmosphere", "buttons", "motion"]} />);
  const main = screen.getByRole("main");
  expect(within(main).getByRole("heading", { name: "Лаборатория" })).toBeInTheDocument();
  const cardsRegion = within(main).getByRole("region", { name: "Доступные мастерские" });
  const cards = within(cardsRegion).getAllByRole("link", { name: /^(Фоны|Кнопки|Отклик)/ });
  expect(cards.map(card => card.getAttribute("href"))).toEqual([
    "/design-lab/atmosphere", "/design-lab/buttons", "/design-lab/motion",
  ]);
  expect(within(cardsRegion).queryByRole("link", { name: /Шрифты|Сцена/ })).not.toBeInTheDocument();
  expect(main).not.toHaveTextContent(/скоро/i);
  expect(main.querySelector("canvas, iframe, video")).toBeNull();
});

test("hub renders dev cards only when they are explicitly allowed", () => {
  render(<LabHome enabled={["home", "type", "scene"]} />);
  const cards = screen.getByRole("region", { name: "Доступные мастерские" });
  expect(within(cards).getByRole("link", { name: /^Шрифты/ })).toHaveAttribute("href", "/design-lab/type");
  expect(within(cards).getByRole("link", { name: /^Сцена/ })).toHaveAttribute("href", "/design-lab/scene");
  expect(within(cards).queryByRole("link", { name: /^Кнопки/ })).not.toBeInTheDocument();
});
