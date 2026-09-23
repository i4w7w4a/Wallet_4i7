import "@testing-library/jest-dom/vitest";
import { Blob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { CompressionStream, DecompressionStream } from "node:stream/web";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoViewer } from "./mono-viewer";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { createMonoShareUrl } from "./mono-share-codec";

beforeEach(() => {
  vi.stubGlobal("Blob", Blob);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("CompressionStream", CompressionStream);
  vi.stubGlobal("DecompressionStream", DecompressionStream);
  history.replaceState(null, "", "/mono/view");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("decodes only the URL and leaves existing editor storage untouched", async () => {
  const appearance = createMonoAppearanceEnvelope("frost");
  appearance.appearance.environment.theme = "light";
  const url = await createMonoShareUrl(appearance, location.origin);
  localStorage.setItem("wallet4i7.mono.working-presets.v2", "existing-editor-draft");
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  history.replaceState(null, "", url);
  render(<MonoViewer renderScene={value => <main aria-label="Готовый кошелёк" data-theme={value.environment.theme} />} />);
  await waitFor(() => expect(screen.getByRole("main", { name: "Готовый кошелёк" })).toHaveAttribute("data-theme", "light"));
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

it("shows a usable error without rendering a default wallet for a damaged link", async () => {
  history.replaceState(null, "", "/mono/view#mono=m1.broken");
  render(<MonoViewer renderScene={() => <main aria-label="Готовый кошелёк" />} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/повреждена/);
  expect(screen.queryByRole("main", { name: "Готовый кошелёк" })).toBeNull();
});

it("explains an absent snapshot instead of reading the local editor preset", () => {
  render(<MonoViewer renderScene={() => <main aria-label="Готовый кошелёк" />} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/нет сохранённого оформления/);
  expect(screen.queryByRole("main", { name: "Готовый кошелёк" })).toBeNull();
});
