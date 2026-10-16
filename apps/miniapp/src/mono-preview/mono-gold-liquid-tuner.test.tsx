import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoGoldLiquidTuner } from "./mono-gold-liquid-tuner";
import { normalizeGoldLiquidSettings } from "./mono-gold-liquid-settings";

const writeText = vi.fn();
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
function LocalPreview() {
  const [settings, setSettings] = useState(() => normalizeGoldLiquidSettings({}));
  return <MonoGoldLiquidTuner settings={settings} onChange={setSettings} />;
}
const slider = (name: string) => screen.getByRole("slider", { name }) as HTMLInputElement;
const candidate = () => JSON.parse((screen.getByRole("textbox", { name: "Gold liquid JSON" }) as HTMLTextAreaElement).value).params;
const openGroup = (name: "Field" | "Flow") => fireEvent.click(screen.getByText(name, { selector: "summary" }));
beforeEach(() => {
  window.history.replaceState(null, "", "/gold?goldLiquidTuner=1");
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/gold");
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

it("requires explicit local opt-in and remains absent on the server", () => {
  window.history.replaceState(null, "", "/gold");
  const view = render(<LocalPreview />);
  expect(view.container).toBeEmptyDOMElement();
  expect(renderToString(<LocalPreview />)).toBe("");
});
it("previews numeric/field edits and Default, with Apply/copy JSON but no preset writes", async () => {
  const storageWrite = vi.spyOn(Storage.prototype, "setItem");
  render(<LocalPreview />);
  const json = () => JSON.parse((screen.getByRole("textbox", { name: "Gold liquid JSON" }) as HTMLTextAreaElement).value);
  await screen.findByRole("slider", { name: "IOR" });
  openGroup("Field");
  fireEvent.click(screen.getByRole("button", { name: "Mask" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Field" }));
  fireEvent.change(slider("Corner radius"), { target: { value: "0.12" } });
  fireEvent.change(slider("IOR"), { target: { value: "0" } });
  expect(json().params).toMatchObject({ ior: 0, cornerRadius: 0.12, fieldEnabled: false, fieldFadeMode: 0 });
  expect(writeText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(JSON.parse(writeText.mock.calls[0][0]).params.ior).toBe(0);
  expect(storageWrite).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Default" }));
  expect(json().params).toMatchObject({ ior: -0.65, cornerRadius: 0.025, fieldEnabled: true });
  fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  expect(storageWrite).not.toHaveBeenCalled();
});
it("disables inactive Field/edge controls with a reason and preserves their values on return", () => {
  render(<LocalPreview />); openGroup("Field");
  expect(slider("Corner radius")).toBeDisabled();
  expect(slider("Corner radius")).toHaveAccessibleDescription(/Field/);
  const edits = [["Field start", "0.32"], ["Field softness", "0.6"], ["Field curve", "2"], ["Field strength", "0.8"]] as const;
  for (const [name, value] of edits) {
    expect(slider(name)).toBeEnabled();
    fireEvent.change(slider(name), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Mask" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Field" }));
  for (const [name] of edits) {
    expect(slider(name)).toBeDisabled();
    expect(slider(name)).toHaveAccessibleDescription(/Field/);
  }
  expect(screen.getByRole("button", { name: "Mask" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Dissolve" })).toBeDisabled();
  fireEvent.change(slider("Field start"), { target: { value: "0.66" } });
  fireEvent.click(screen.getByRole("button", { name: "Dissolve" }));
  expect(slider("Corner radius")).toBeEnabled();
  fireEvent.change(slider("Corner radius"), { target: { value: "0.115" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Field" }));
  expect(slider("Corner radius")).toBeDisabled();
  fireEvent.change(slider("Corner radius"), { target: { value: "0.17" } });
  for (const [name, value] of edits) { expect(slider(name)).toBeEnabled(); expect(slider(name).value).toBe(value); }
  expect(screen.getByRole("button", { name: "Mask" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Mask" })).toHaveAttribute("aria-pressed", "true");
  expect(candidate()).toMatchObject({ fieldStart: 0.32, fieldSoftness: 0.6, fieldCurve: 2,
    fieldStrength: 0.8, fieldFadeMode: 0, cornerRadius: 0.115 });
  fireEvent.click(screen.getByRole("checkbox", { name: "Field" }));
  expect(slider("Corner radius")).toBeEnabled(); expect(slider("Corner radius").value).toBe("0.115");
});
it("disables flow dependents at zero strength and restores the edited speed and scale", () => {
  render(<LocalPreview />); openGroup("Flow");
  fireEvent.change(slider("Flow speed"), { target: { value: "0.27" } });
  fireEvent.change(slider("Flow scale"), { target: { value: "3.1" } });
  fireEvent.change(slider("Flow strength"), { target: { value: "0" } });
  for (const name of ["Flow speed", "Flow scale"]) {
    expect(slider(name)).toBeDisabled(); expect(slider(name)).toHaveAccessibleDescription(/Flow strength/);
    fireEvent.change(slider(name), { target: { value: "1" } });
  }
  expect(slider("Flow strength")).toBeEnabled();
  fireEvent.change(slider("Flow strength"), { target: { value: "0.45" } });
  expect(slider("Flow speed")).toBeEnabled(); expect(slider("Flow speed").value).toBe("0.27");
  expect(slider("Flow scale")).toBeEnabled(); expect(slider("Flow scale").value).toBe("3.1");
});
it("locks zero-IOR optical controls while retaining IOR and quality as recovery controls", () => {
  render(<LocalPreview />); openGroup("Field"); openGroup("Flow");
  fireEvent.change(slider("Edge darkening"), { target: { value: "0.4" } });
  fireEvent.change(slider("IOR"), { target: { value: "0" } });
  for (const name of ["Edge thickness", "Corner radius", "Dispersion", "Edge darkening", "Highlights",
    "Field start", "Field softness", "Field curve", "Field strength", "Flow speed", "Flow strength", "Flow scale"]) {
    expect(slider(name)).toBeDisabled(); expect(slider(name)).toHaveAccessibleDescription(/IOR/);
  }
  expect(screen.getByRole("checkbox", { name: "Field" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Mask" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Dissolve" })).toBeDisabled();
  expect(slider("IOR")).toBeEnabled(); expect(slider("Pixel ratio")).toBeEnabled();
  fireEvent.change(slider("Edge darkening"), { target: { value: "0.6" } });
  fireEvent.change(slider("Pixel ratio"), { target: { value: "1.5" } });
  fireEvent.change(slider("IOR"), { target: { value: "-0.83" } });
  expect(slider("Corner radius")).toBeDisabled();
  for (const name of ["Edge darkening", "Field strength", "Flow speed", "Flow scale"]) expect(slider(name)).toBeEnabled();
  expect(screen.getByRole("checkbox", { name: "Field" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Dissolve" })).toBeEnabled();
  expect(candidate()).toMatchObject({ ior: -0.83, edgeDarkening: 0.4, pixelRatio: 1.5, fieldEnabled: true });
});
it("explains the zero-field clean branch and keeps its strength/toggle recovery available", () => {
  render(<LocalPreview />); openGroup("Field"); openGroup("Flow");
  fireEvent.change(slider("Field strength"), { target: { value: "0" } });
  expect(slider("Highlights")).toBeDisabled();
  expect(slider("Highlights")).toHaveAccessibleDescription(/Field strength/);
  expect(slider("Field start")).toBeDisabled(); expect(slider("Flow strength")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Mask" })).toBeDisabled();
  expect(slider("Field strength")).toBeEnabled();
  expect(slider("IOR")).toBeEnabled(); expect(slider("Pixel ratio")).toBeEnabled();
  expect(screen.getByRole("checkbox", { name: "Field" })).toBeEnabled();
  fireEvent.change(slider("Field strength"), { target: { value: "0.9" } });
  expect(slider("Highlights")).toBeEnabled(); expect(slider("Field start")).toBeEnabled();
  expect(slider("Flow strength")).toBeEnabled(); expect(screen.getByRole("button", { name: "Mask" })).toBeEnabled();
});
it("keeps selectable JSON when clipboard permission is denied", async () => {
  writeText.mockRejectedValue(new Error("denied"));
  render(<LocalPreview />);
  fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/JSON/));
  expect((screen.getByRole("textbox", { name: "Gold liquid JSON" }) as HTMLTextAreaElement).readOnly).toBe(true);
});
