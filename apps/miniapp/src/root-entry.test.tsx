import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getRedirectStatusCodeFromError, getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import Page from "../app/page";
import { MonoPreview } from "./mono-preview/mono-preview";
import { LabHome } from "./design-lab/lab-home";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it("root entry issues a temporary redirect to MONO", async () => {
  const outcome = await Promise.resolve().then(() => Page()).then(
    () => null,
    (error: unknown) => error,
  );
  expect(isRedirectError(outcome)).toBe(true);
  if (!isRedirectError(outcome)) throw new Error("Root entry must redirect before rendering a wallet");
  expect(getURLFromRedirectError(outcome)).toBe("/mono");
  expect(getRedirectStatusCodeFromError(outcome)).toBe(307);
});

it("visible navigation in MONO offers Lab without a V1 or legacy destination", async () => {
  render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  expect(await screen.findByRole("link", { name: /Design Lab/ })).toHaveAttribute("href", "/design-lab");
  const links = screen.getAllByRole("link");
  expect(links.some(link => /\bV1\b/i.test(link.textContent ?? ""))).toBe(false);
  expect(links.some(link => ["/", "/legacy"].includes(link.getAttribute("href") ?? ""))).toBe(false);
});

it("visible navigation in Lab retains connected workshops without a V1 destination", () => {
  render(<LabHome enabled={["home", "atmosphere", "buttons", "motion", "type", "scene"]} />);
  const links = screen.getAllByRole("link");
  expect(links.some(link => link.getAttribute("href") === "/design-lab/buttons")).toBe(true);
  expect(links.some(link => /\bV1\b/i.test(link.textContent ?? ""))).toBe(false);
  expect(links.some(link => ["/", "/legacy"].includes(link.getAttribute("href") ?? ""))).toBe(false);
});
