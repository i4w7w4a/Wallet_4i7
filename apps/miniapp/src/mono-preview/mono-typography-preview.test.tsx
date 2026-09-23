import { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createMonoTypographyDefaults, type MonoTypographyConfigV1 } from "./mono-typography";
import { useMonoTypographyPreview } from "./mono-typography-preview";

const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
const pending: { resolve(): void }[] = [];
const faces = [{} as FontFace];

function fontRequest() {
  let resolve!: (faces: FontFace[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<FontFace[]>((yes, no) => { resolve = yes; reject = no; });
  const request = { promise, resolve: () => resolve(faces), reject: () => reject(new Error("offline")) };
  pending.push(request);
  return request;
}

function installFontLoader(load: (font: string) => Promise<FontFace[]>) {
  Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
}

function preview(candidate: MonoTypographyConfigV1 | null) {
  return renderHook(({ candidate }) => useMonoTypographyPreview(candidate), {
    initialProps: { candidate }, wrapper: StrictMode,
  });
}

afterEach(async () => {
  cleanup();
  await act(async () => { pending.splice(0).forEach(request => request.resolve()); });
  if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
  else Reflect.deleteProperty(document, "fonts");
});

describe("typography preview readiness", () => {
  it("exposes no initial non-null payload until every required face is ready", async () => {
    const request = fontRequest();
    installFontLoader(() => request.promise);
    const config = createMonoTypographyDefaults("mercury");
    const { result } = preview(config);

    expect(result.current).toEqual({ active: null, status: "loading" });
    await act(async () => request.resolve());
    await waitFor(() => expect(result.current).toEqual({ active: config, status: "ready" }));
  });

  it("keeps legacy after the initial font request fails", async () => {
    installFontLoader(async () => { throw new Error("offline"); });
    const { result } = preview(createMonoTypographyDefaults("mercury"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.active).toBeNull();
  });

  it("preserves a ready A while B is pending and after B fails", async () => {
    const request = fontRequest();
    installFontLoader(font => font.includes("Onest") ? request.promise : Promise.resolve(faces));
    const first = createMonoTypographyDefaults();
    const { result, rerender } = preview(first);
    await waitFor(() => expect(result.current.status).toBe("ready"));

    rerender({ candidate: createMonoTypographyDefaults("mercury") });
    expect(result.current).toEqual({ active: first, status: "loading" });
    await act(async () => request.reject());
    await waitFor(() => expect(result.current).toEqual({ active: first, status: "error" }));
  });

  it.each(["resolve", "reject"] as const)("does not resurrect A after ready A → legacy → B (%s)", async outcome => {
    const request = fontRequest();
    installFontLoader(font => font.includes("Onest") ? request.promise : Promise.resolve(faces));
    const { result, rerender } = preview(createMonoTypographyDefaults());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    rerender({ candidate: null });
    expect(result.current).toEqual({ active: null, status: "legacy" });
    const next = createMonoTypographyDefaults("mercury");
    rerender({ candidate: next });
    expect(result.current).toEqual({ active: null, status: "loading" });
    await act(async () => request[outcome]());
    await waitFor(() => expect(result.current).toEqual(outcome === "resolve"
      ? { active: next, status: "ready" } : { active: null, status: "error" }));
  });

  it("ignores a request completed after returning to legacy", async () => {
    const request = fontRequest();
    installFontLoader(() => request.promise);
    const { result, rerender } = preview(createMonoTypographyDefaults("mercury"));

    rerender({ candidate: null });
    await act(async () => request.resolve());
    expect(result.current).toEqual({ active: null, status: "legacy" });
  });
});
