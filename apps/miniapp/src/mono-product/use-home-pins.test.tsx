import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HOME_PINS_STORAGE_KEY, LEGACY_HOME_PINS_STORAGE_KEY } from "./home-pins";
import { useHomePins } from "./use-home-pins";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it("renders snapshot defaults on the server then migrates only valid v1 choices without touching presets", () => {
  localStorage.setItem(LEGACY_HOME_PINS_STORAGE_KEY, '{"version":1,"groups":["private","depositary","depositary","custodial"]}');
  localStorage.setItem("wallet4i7.mono.appearance.v1", "kept-preset");
  function ServerProbe() { return <span>{useHomePins(MULTI_ACCOUNT_DEMO).pinnedKinds.join(",")}</span>; }
  expect(renderToString(<ServerProbe />)).toContain("custodial,depositary");
  const { result } = renderHook(() => useHomePins(MULTI_ACCOUNT_DEMO));
  expect(result.current.pinnedKinds).toEqual(["depositary", "custodial"]);
  expect(result.current.totalOnly).toBe(false);
  expect(JSON.parse(localStorage.getItem(HOME_PINS_STORAGE_KEY)!)).toEqual({ version: 2, groups: ["depositary", "custodial"], totalOnly: false });
  expect(localStorage.getItem("wallet4i7.mono.appearance.v1")).toBe("kept-preset");
  expect(JSON.parse(localStorage.getItem(LEGACY_HOME_PINS_STORAGE_KEY)!)).toEqual({ version: 1, groups: ["private", "depositary", "depositary", "custodial"] });
});

it("remembers pins across total-only, reload and restore; selecting a wallet exits total-only", () => {
  const { result, unmount } = renderHook(() => useHomePins(MULTI_ACCOUNT_DEMO));
  act(() => result.current.togglePin("depositary"));
  act(() => result.current.setTotalOnly(true));
  expect(result.current.pinnedKinds).toEqual(["custodial"]);
  expect(JSON.parse(localStorage.getItem(HOME_PINS_STORAGE_KEY)!)).toEqual({ version: 2, groups: ["custodial"], totalOnly: true });
  unmount();
  const restored = renderHook(() => useHomePins(MULTI_ACCOUNT_DEMO));
  expect(restored.result.current.totalOnly).toBe(true);
  expect(restored.result.current.pinnedKinds).toEqual(["custodial"]);
  act(() => restored.result.current.setTotalOnly(false));
  expect(restored.result.current.pinnedKinds).toEqual(["custodial"]);
  act(() => restored.result.current.setTotalOnly(true));
  act(() => restored.result.current.togglePin("depositary"));
  expect(restored.result.current.totalOnly).toBe(false);
  expect(restored.result.current.pinnedKinds).toEqual(["custodial", "depositary"]);
});

it("rejects private even if supplied as active and preserves explicit empty selections", () => {
  const { result } = renderHook(() => useHomePins({ ...MULTI_ACCOUNT_DEMO,
    accounts: MULTI_ACCOUNT_DEMO.accounts.map(account => account.kind === "private" ? { ...account, status: "active" } : account) }));
  let accepted: boolean | undefined;
  act(() => { accepted = result.current.togglePin("private"); });
  expect(accepted).toBe(false);
  expect(result.current.pinnedKinds).toEqual(["custodial", "depositary"]);
  act(() => { result.current.togglePin("custodial"); result.current.togglePin("depositary"); });
  expect(result.current.pinnedKinds).toEqual([]);
  expect(JSON.parse(localStorage.getItem(HOME_PINS_STORAGE_KEY)!)).toEqual({ version: 2, groups: [], totalOnly: false });
});

it("works without storage and discards unavailable snapshot choices without resurrecting them", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
  const { result, rerender } = renderHook(({ snapshot }: { snapshot: Readonly<ProductSnapshot> }) => useHomePins(snapshot),
    { initialProps: { snapshot: MULTI_ACCOUNT_DEMO as Readonly<ProductSnapshot> } });
  act(() => result.current.togglePin("depositary"));
  act(() => result.current.setTotalOnly(true));
  expect(result.current.pinnedKinds).toEqual(["custodial"]);
  rerender({ snapshot: { ...MULTI_ACCOUNT_DEMO, accounts: MULTI_ACCOUNT_DEMO.accounts.map(account =>
    account.kind === "custodial" ? { ...account, status: "unavailable" } : account) } });
  expect(result.current.pinnedKinds).toEqual([]);
  rerender({ snapshot: MULTI_ACCOUNT_DEMO });
  expect(result.current.pinnedKinds).toEqual([]);
  expect(result.current.totalOnly).toBe(true);
  act(() => result.current.togglePin("depositary"));
  expect(result.current.pinnedKinds).toEqual(["depositary"]);
  expect(result.current.totalOnly).toBe(false);
});

it("does not read or write viewer storage when persistence is disabled", () => {
  const read = vi.spyOn(Storage.prototype, "getItem"), write = vi.spyOn(Storage.prototype, "setItem");
  const { result } = renderHook(() => useHomePins(MULTI_ACCOUNT_DEMO, false));
  act(() => result.current.setTotalOnly(true));
  act(() => result.current.togglePin("depositary"));
  expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
});

it("discards unavailable restored choices before their account can reappear", () => {
  localStorage.setItem(HOME_PINS_STORAGE_KEY, '{"version":2,"groups":["custodial"],"totalOnly":true}');
  const unavailable: ProductSnapshot = { ...MULTI_ACCOUNT_DEMO, accounts: MULTI_ACCOUNT_DEMO.accounts.filter(account => account.kind !== "custodial") };
  const { result, rerender } = renderHook(({ snapshot }: { snapshot: Readonly<ProductSnapshot> }) => useHomePins(snapshot),
    { initialProps: { snapshot: unavailable as Readonly<ProductSnapshot> } });
  expect(result.current.pinnedKinds).toEqual([]);
  rerender({ snapshot: MULTI_ACCOUNT_DEMO });
  expect(result.current.pinnedKinds).toEqual([]);
  expect(result.current.totalOnly).toBe(true);
});
