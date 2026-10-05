import "@testing-library/jest-dom/vitest";
import { StrictMode, createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MonoOpticalGlass, createMonoOpticalHost, createMonoOpticalOverlay, normalizeMonoGlassSettings } from "@wallet/ui";
import { ProductGlassProvider, ProductGlassSurface } from "./product-glass-surface";

afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps Promo and panel leases independent and never presents a panel without its own rendered frame", () => {
  const host = createMonoOpticalHost();
  const promo = document.createElement("div"), panel = document.createElement("div");
  document.body.append(promo, panel);
  const settings = normalizeMonoGlassSettings("ledger");
  const promoLease = host.binding.register(promo, settings);
  let panelPresented = false;
  // Regression: the old singleton throws here and kills the entire material host.
  const panelLease = host.binding.register(panel, settings, {
    source: "background", onPresented: (presented: boolean) => { panelPresented = presented; },
  });
  expect(host.getRegions().map(region => region.element)).toEqual([promo, panel]);
  const panelRegion = host.getRegions().find(region => region.element === panel)!;
  host.markPresented(true);
  expect(host.binding.getSnapshot()).toBe(true);
  expect(panelPresented).toBe(false);
  // A backend success without a rendered region (e.g. no live background) is not optics.
  createMonoOpticalOverlay(host).markPresented(true);
  expect(panelPresented).toBe(false);
  host.markPresented(true);
  host.markRegionPresented(panelRegion, true);
  expect(panelPresented).toBe(true);
  panelLease.update(normalizeMonoGlassSettings("ledger", { ior: -0.6 }));
  expect(panelRegion.settings.ior).toBe(-0.6);
  expect(host.getRegion()?.settings.ior).toBe(1.34);
  panelLease.dispose(); panelLease.dispose();
  expect(panelPresented).toBe(false);
  expect(host.binding.getSnapshot()).toBe(true);
  expect(host.getRegions().map(region => region.element)).toEqual([promo]);
  // A stale lease cannot remove a newer registration of the same DOM node.
  const replacement = host.binding.register(promo, settings);
  promoLease.dispose();
  expect(host.getRegions().map(region => region.element)).toEqual([promo]);
  replacement.dispose();
  expect(host.getRegions()).toEqual([]);
  expect(host.binding.getSnapshot()).toBe(false);
});

it("composes accessible DOM over independent lenses, falls back without a source and releases every panel lease", () => {
  let reducedMotion = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query === "(prefers-reduced-motion: reduce)" && reducedMotion; },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  const acquire = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const host = createMonoOpticalHost();
  const dialogRef = createRef<HTMLDivElement>();
  const close = vi.fn();
  function Scene({ ior = 1.34, opaque = false }: { ior?: number; opaque?: boolean }) {
    return <StrictMode>
      <MonoOpticalGlass sharedHost={host.binding} preset="ledger" />
      <ProductGlassProvider sharedHost={host.binding} preset="ledger" settings={{ ior }} opaque={opaque}>
        <ProductGlassSurface ref={dialogRef} role="dialog" aria-label="Батарейка" tabIndex={-1} className="original-panel">
          <button onClick={close}>Закрыть</button>
        </ProductGlassSurface>
        <ProductGlassSurface role="dialog" aria-label="Перевод"><input aria-label="Сумма" defaultValue="12" /></ProductGlassSurface>
      </ProductGlassProvider>
    </StrictMode>;
  }
  const view = render(<Scene />);
  const panel = screen.getByRole("dialog", { name: "Батарейка" });
  const sheet = screen.getByRole("dialog", { name: "Перевод" });
  expect(dialogRef.current).toBe(panel);
  expect(panel).toHaveClass("original-panel", "mono-product-glass");
  expect(panel).toHaveAttribute("data-product-glass", "fallback");
  expect(sheet).toHaveAttribute("data-product-glass", "fallback");
  expect(host.getRegions()).toHaveLength(3);
  const firstPanelLease = host.getRegions().find(region => region.element === panel)!;
  act(() => host.markRegionPresented(firstPanelLease, true));
  expect(panel).toHaveAttribute("data-product-glass", "shared-webgl");
  expect(sheet).toHaveAttribute("data-product-glass", "fallback");
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(close).toHaveBeenCalledOnce();
  view.rerender(<Scene ior={0} />);
  expect(host.getRegions().find(region => region.element === panel)).toBe(firstPanelLease);
  expect(firstPanelLease.settings.ior).toBe(0);
  act(() => { reducedMotion = true; [...listeners].forEach(listener => listener()); });
  expect(panel).toHaveAttribute("data-product-glass", "fallback");
  expect(host.getRegions().map(region => region.source)).toEqual(["relief"]);
  expect(screen.getByRole("textbox", { name: "Сумма" })).toHaveValue("12");
  act(() => { reducedMotion = false; [...listeners].forEach(listener => listener()); });
  expect(host.getRegions()).toHaveLength(3);
  view.rerender(<Scene opaque />);
  expect(panel).toHaveAttribute("data-product-glass", "opaque");
  expect(host.getRegions().map(region => region.source)).toEqual(["relief"]);
  expect(acquire).not.toHaveBeenCalled();
  expect(view.container.querySelector("canvas")).toBeNull();
  view.unmount();
  expect(host.getRegions()).toEqual([]);
  expect(listeners.size).toBe(0);
});
