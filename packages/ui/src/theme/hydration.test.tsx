import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

import type { PreferenceStorage } from "@wallet/core";

import { GlassSurface } from "../primitives/glass-surface";
import { ThemeProvider } from "./theme-provider";

afterEach(() => {
  vi.restoreAllMocks();
});

it("гидратирует первый кадр без несовпадения media-флагов и backdrop support", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const storage: PreferenceStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  const content = (
    <ThemeProvider storage={storage}>
      <GlassSurface>Стекло</GlassSurface>
    </ThemeProvider>
  );

  stubCapabilities(false);
  const serverHtml = renderToString(content);
  const container = document.createElement("div");
  container.innerHTML = serverHtml;
  document.body.append(container);

  stubCapabilities(true);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  let root: ReturnType<typeof hydrateRoot> | undefined;

  await act(async () => {
    root = hydrateRoot(container, content);
  });

  const hydrationErrors = consoleError.mock.calls;
  await act(async () => root?.unmount());
  container.remove();

  expect(hydrationErrors).toEqual([]);
});

function stubCapabilities(enabled: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: enabled,
      media: query,
      onchange: null,
      addEventListener() {
        return undefined;
      },
      removeEventListener() {
        return undefined;
      },
      addListener() {
        return undefined;
      },
      removeListener() {
        return undefined;
      },
      dispatchEvent() {
        return false;
      },
    }) as MediaQueryList;

  Object.defineProperty(window, "CSS", {
    configurable: true,
    writable: true,
    value: { supports: () => enabled },
  });
}
