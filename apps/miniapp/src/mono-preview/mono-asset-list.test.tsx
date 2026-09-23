import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MonoAssetList } from "./mono-asset-list";
import { MONO_ASSET_LIST_DEFAULT } from "./mono-scene-lab-contract";

afterEach(cleanup);
const assets = [{ name: "Bitcoin", symbol: "BTC", amount: 0.12, value: 8040.25, change24h: 2.8, sparkline: [1, 2] }];
const props = { assets, format: { locale: "ru-RU", currency: "USD" }, hidden: false,
  appearance: MONO_ASSET_LIST_DEFAULT };

it("does not invent operations on passive assets", () => {
  render(<MonoAssetList {...props} />);
  expect(screen.getByRole("list")).toBeInTheDocument();
  expect(screen.getByText("Bitcoin")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("hides quantities, valuations and changes in both list designs", () => {
  const { container, rerender } = render(<MonoAssetList {...props} hidden />);
  for (const variant of ["ledger", "tiles"] as const) {
    rerender(<MonoAssetList {...props} hidden appearance={{ ...props.appearance, variant }} />);
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/8040|040|0,12|2,8|25/);
    expect(screen.getByText("Значения скрыты")).toBeInTheDocument();
  }
});

it("uses the supplied command only when the parent provides an actual asset action", () => {
  const onAssetSelect = vi.fn();
  render(<MonoAssetList {...props} onAssetSelect={onAssetSelect} />);
  fireEvent.click(screen.getByRole("button", { name: /Bitcoin/ }));
  expect(onAssetSelect).toHaveBeenCalledExactlyOnceWith(assets[0]);
});
