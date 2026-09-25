import "@testing-library/jest-dom/vitest";
import { expect, test } from "vitest";
import { focusButtonActions } from "./scene-focus";

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 390, width: 390,
    x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

test("focus moves only the scene viewport until the real action row is visible", () => {
  const viewport = document.createElement("section");
  const row = document.createElement("div");
  row.className = "mono-actions";
  viewport.append(row);
  viewport.scrollTop = 0;
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 420 });
  Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1100 });
  viewport.getBoundingClientRect = () => rect(100, 420);
  row.getBoundingClientRect = () => rect(680, 120);
  const pageScroll = window.scrollY;

  expect(focusButtonActions(viewport)).toBe(true);
  expect(viewport.scrollTop).toBe(430);
  expect(window.scrollY).toBe(pageScroll);
});

test("focus leaves scroll alone when the action row has not mounted", () => {
  const viewport = document.createElement("section");
  viewport.scrollTop = 38;
  expect(focusButtonActions(viewport)).toBe(false);
  expect(viewport.scrollTop).toBe(38);
});
