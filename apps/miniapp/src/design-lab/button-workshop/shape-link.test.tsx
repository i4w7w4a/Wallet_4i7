import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { MonoShapeTuner } from "../../mono-preview/mono-shape-tuner";

const props = {
  values: { "quick-actions": 12, "bottom-navigation": 0 },
  dirty: false,
  status: "",
  onChange: () => {}, onDefault: () => {}, onCancel: () => {}, onApply: () => {},
} as const;

test("Shape Lab opens the separate button materials workshop when the dev link is supplied", () => {
  render(<MonoShapeTuner {...props} buttonLabHref="/design-lab/buttons" />);
  expect(screen.getByRole("link", { name: /мастерскую кнопок/i })).toHaveAttribute("href", "/design-lab/buttons");
});
