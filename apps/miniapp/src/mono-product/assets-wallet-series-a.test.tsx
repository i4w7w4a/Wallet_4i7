import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AssetsWalletSelection } from "./assets-wallet-selection";

afterEach(cleanup);

const selection = () => <AssetsWalletSelection canOpen={{ custodial: true, depositary: true }}
  onOpenWallet={vi.fn()} onOpenOverview={vi.fn()} />;

// Omitting the fallback or revealing a pending image would leave the first frame empty.
it("keeps real decorative SVG visible until each series A image loads", () => {
  const { container } = render(selection());
  const cards = container.querySelectorAll("[data-r1-wallet-kind]");
  expect(cards).toHaveLength(3);
  for (const [index, kind] of ["custodial", "depositary", "private"].entries()) {
    const card = cards[index];
    const image = card.querySelector("img")!;
    const fallback = card.querySelector("svg[viewBox='18 10 205 182']")!;
    expect(image).toHaveAttribute("src", `/wallet-art/series-a/${kind}-300.png`);
    expect(image.getAttribute("srcset")).toContain(`/wallet-art/series-a/${kind}-450.png 3x`);
    expect(image).toHaveAttribute("alt", "");
    expect(image).not.toBeVisible();
    expect(fallback).toBeVisible();
    fireEvent.load(image);
    expect(image).toBeVisible();
    expect(fallback).not.toBeVisible();
  }
  expect(container.querySelectorAll("[src*='-B-'], [srcset*='-B-']")).toHaveLength(0);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Приватный/ })).toBeDisabled();
  expect(within(cards[0] as HTMLElement).getByText("Кастодиальный")).toBeInTheDocument();
});

// A failed resource must restore the same real SVG, including after a previous successful load.
it("restores the SVG if a series A image errors", () => {
  const { container } = render(selection());
  const card = container.querySelector("[data-r1-wallet-kind='custodial']")!;
  const image = card.querySelector("img")!;
  const fallback = card.querySelector("svg[viewBox='18 10 205 182']")!;
  fireEvent.load(image);
  fireEvent.error(image);
  expect(image).not.toBeVisible();
  expect(fallback).toBeVisible();
});

// SSR must carry the actual SVG rather than relying on hydration to create it.
it("renders the SVG fallback in the first server frame", () => {
  const html = renderToString(selection());
  const document = new DOMParser().parseFromString(html, "text/html");
  const card = document.querySelector("[data-r1-wallet-kind='custodial']")!;
  expect(card.querySelector("svg[viewBox='18 10 205 182']")?.closest("[hidden]")).toBeNull();
  expect(card.querySelector("img")?.hasAttribute("hidden")).toBe(true);
});
