import { act } from "@testing-library/react";
import { vi } from "vitest";

// JSDOM has no layout/CSS transition engine. Only the completion boundary is supplied;
// mounted content, focus, aria, inert and controller behavior remain real.
export function disclosureTestAnimations() {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");
  const requests: { element: Element; finish(): void; cancel(): void }[] = [];
  const reduced = new EventTarget() as EventTarget & { matches: boolean };
  reduced.matches = false;
  vi.stubGlobal("matchMedia", () => reduced);
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: function (this: Element) {
    let finish!: () => void, cancel!: () => void;
    const finished = new Promise<void>((resolve, reject) => {
      finish = resolve;
      cancel = () => reject(new DOMException("Cancelled", "AbortError"));
    });
    requests.push({ element: this, finish, cancel });
    return [{ finished } as unknown as Animation];
  } });
  return {
    requests,
    async finish(element: Element, occurrence = -1) {
      const candidates = requests.filter(request => request.element === element);
      const request = candidates.at(occurrence);
      if (!request) throw new Error("No disclosure transition was observed");
      await act(async () => { request.finish(); });
    },
    async cancel(element: Element) {
      const request = requests.filter(candidate => candidate.element === element).at(-1);
      if (!request) throw new Error("No disclosure transition was observed");
      await act(async () => { request.cancel(); });
    },
    async reduceMotion() {
      await act(async () => { reduced.matches = true; reduced.dispatchEvent(new Event("change")); });
    },
    restore() {
      if (original) Object.defineProperty(Element.prototype, "getAnimations", original);
      else Reflect.deleteProperty(Element.prototype, "getAnimations");
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    },
  };
}
