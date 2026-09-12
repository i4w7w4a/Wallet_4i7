import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import Page from "../app/page";

it("показывает название Wallet_4i7", () => {
  render(<Page />);

  expect(screen.getByRole("heading", { name: "Wallet_4i7" })).toBeVisible();
});
