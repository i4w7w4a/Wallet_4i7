import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "../mono-preview/mono-scene";
import { MonoProductScene } from "../mono-preview/mono-product-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import { useMonoProductController, type MonoProductController } from "./product-controller";
import { buyQuote, buyRoute } from "./commerce/test-fixtures";
import { commerceOperationId } from "./commerce/validation";

const animateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
const animationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations");
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.classList.contains("mono-actions__item")) return new DOMRect(40, 200, 72, 64);
    return new DOMRect();
  });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (animateDescriptor) Object.defineProperty(HTMLElement.prototype, "animate", animateDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  if (animationsDescriptor) Object.defineProperty(Element.prototype, "getAnimations", animationsDescriptor);
  else Reflect.deleteProperty(Element.prototype, "getAnimations");
});

async function home(adapter: MonoProductAdapter = MONO_PRODUCT_DEMO_ADAPTER) {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  let controller!: MonoProductController;
  function Host({ source }: { source: MonoProductAdapter }) {
    controller = useMonoProductController(source, { initialHidden: false });
    const [section, setSection] = useState<MonoSection>("profile");
    return <MonoScene snapshot={snapshot} appearance={envelope.appearance} product={controller}
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: controller.view.balanceHidden, onBalanceHiddenChange: controller.commands.setBalanceHidden }} />;
  }
  const view = render(<Host source={adapter} />);
  return { ...view, current: () => controller, replace: (source: MonoProductAdapter) => view.rerender(<Host source={source} />) };
}

function openTopic(topic: string) {
  fireEvent.click(screen.getByRole("button", { name: "Помощь и документы" }));
  fireEvent.click(screen.getByRole("button", { name: topic }));
  return screen.getByRole("region", { name: topic });
}

function motionBoundary() {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const motions: { element: HTMLElement; animation: Animation; finish(): void }[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: function (this: HTMLElement) {
    let state: AnimationPlayState = "running", resolve!: () => void, reject!: (reason: unknown) => void;
    const finished = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    void finished.catch(() => {});
    const animation = { finished, get playState() { return state; },
      effect: { getTiming: () => ({ iterations: 1 }) }, onfinish: null, oncancel: null,
      cancel() { if (state === "running") reject(new DOMException("Cancelled", "AbortError")); state = "idle"; },
    } as unknown as Animation;
    motions.push({ element: this, animation, finish() {
      if (state !== "running") return;
      state = "finished"; resolve();
      animation.onfinish?.call(animation, new Event("finish") as AnimationPlaybackEvent);
    } });
    return animation;
  } });
  Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: function (this: Element) {
    return motions.filter(motion => motion.element === this && motion.animation.playState === "running")
      .map(motion => motion.animation);
  } });
  return { async finish() { await act(async () => { motions.forEach(motion => motion.finish()); }); } };
}

it.each([
  { topic: "Получить", cta: "Открыть получение", action: "receive", dialog: "Получить" },
  { topic: "Отправить", cta: "Открыть отправку", action: "send", dialog: "Отправить" },
  { topic: "Купить", cta: "Открыть покупку", action: "buy", dialog: "Купить" },
  { topic: "Обменять", cta: "Открыть обмен", action: "swap", dialog: "Обмен" },
] as const)("opens $action once from Help after overview mounts, preserving its current account and privacy", async topic => {
  const view = await home();
  act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-custody" }));
  act(() => view.current().commands.setBalanceHidden(true));
  const panel = openTopic(topic.topic);
  expect(view.current().view.sheet).toBeNull();
  fireEvent.click(within(panel).getByRole("button", { name: topic.cta }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
  expect(await screen.findByRole("dialog", { name: topic.dialog })).toBeInTheDocument();
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(view.current().view.balanceHidden).toBe(true);
  expect(view.current().view.sheet).toMatchObject({ kind: "intent", action: topic.action });
  expect(view.current().view.intent?.routes.every(route => route.accountId === "demo-custody")).toBe(true);
  expect(view.current().view.activities.filter(activity => activity.mode === "simulation")).toEqual([]);
});

it("shows a current no-route reason without an action CTA and does not change context by reading Help", async () => {
  const view = await home();
  act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  const send = openTopic("Отправить");
  expect(within(send).queryByRole("button", { name: "Открыть отправку" })).toBeNull();
  expect(send).toHaveTextContent(/маршрут.*нет|нет.*маршрут|отправка недоступна/i);
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
  expect(view.current().view.sheet).toBeNull();
});

it("keeps a read-only externally controlled host without a navigation handler honest", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material}
    session={{ section: "profile", period: "1D", onPeriodChange() {}, balanceHidden: false, onBalanceHiddenChange() {} }} />);
  const panel = openTopic("Получить");
  expect(within(panel).queryByRole("button", { name: "Открыть получение" })).toBeNull();
  expect(panel).toHaveTextContent(/переход.*недоступен/i);
  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
});

it("waits for the existing finite view animation and retries on its completion without another navigation render", async () => {
  const motion = motionBoundary();
  const view = await home();
  const panel = openTopic("Отправить");
  fireEvent.click(within(panel).getByRole("button", { name: "Открыть отправку" }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
  expect(view.current().view.sheet).toBeNull();
  await motion.finish();
  expect(await screen.findByRole("dialog", { name: "Отправить" })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Отправить" })).toHaveFocus());
});

it.each(["navigation", "logo", "context", "adapter"])("cancels a queued opening after a later %s change", async change => {
  const motion = motionBoundary();
  const view = await home();
  fireEvent.click(within(openTopic("Отправить")).getByRole("button", { name: "Открыть отправку" }));
  expect(view.current().view.sheet).toBeNull();
  if (change === "navigation") fireEvent.click(screen.getByRole("button", { name: "История" }));
  else if (change === "logo") fireEvent.click(screen.getByRole("button", { name: "На главную" }));
  else if (change === "context") act(() => view.current().commands.selectContext({ kind: "account", accountId: "demo-depositary" }));
  else view.replace({ kind: "demo", snapshot: MULTI_ACCOUNT_DEMO });
  await motion.finish();
  expect(view.current().view.sheet).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  if (change === "navigation") expect(screen.getByRole("heading", { name: "История операций" })).toBeInTheDocument();
  if (change === "logo") expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
  if (change === "context") expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it("does not overwrite an accepted commerce flow or its raw draft when queued Help completion arrives", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  const motion = motionBoundary();
  const view = await home();
  fireEvent.click(within(openTopic("Отправить")).getByRole("button", { name: "Открыть отправку" }));
  act(() => view.current().commands.openIntent("buy"));
  act(() => view.current().commands.saveBuyDraft(buyRoute, { route: buyRoute, methodId: "demo-payment-usd", fiatAmount: "23," }));
  const quote = buyQuote();
  quote.portId = view.current().view.flowPorts.buy.id;
  const idempotencyKey = "help-pending";
  act(() => view.current().commands.setCommerceSubmitState(buyRoute, { busy: true,
    attempt: { kind: "buy", quote, idempotencyKey, operationId: commerceOperationId(quote, idempotencyKey) } }));
  const sheet = view.current().view.sheet;
  act(() => view.current().commands.setBalanceHidden(true));
  await motion.finish();
  expect(view.current().view.commerceBusy).toBe(true);
  expect(view.current().view.sheet).toBe(sheet);
  expect(Object.values(view.current().view.buyDrafts)[0]?.fiatAmount).toBe("23,");
  expect(view.current().view.balanceHidden).toBe(true);
  expect(view.current().view.activities.filter(activity => activity.mode === "simulation")).toEqual([]);
});

it("cancels Help after external navigation leaves committed overview even if a later overview arrives", async () => {
  const motion = motionBoundary();
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  let controller!: MonoProductController;
  function Host({ section }: { section: MonoSection }) {
    controller = useMonoProductController(MONO_PRODUCT_DEMO_ADAPTER, { initialHidden: false });
    return <MonoScene snapshot={snapshot} appearance={envelope.appearance} product={controller}
      session={{ section, onSectionChange: next => view.rerender(<Host section={next} />),
        period: "1D", onPeriodChange() {}, balanceHidden: false, onBalanceHiddenChange() {} }} />;
  }
  const view = render(<Host section="profile" />);
  fireEvent.click(within(openTopic("Отправить")).getByRole("button", { name: "Открыть отправку" }));
  expect(view.container.querySelector("[data-mono-preview]")).toHaveAttribute("data-mono-section", "overview");
  expect(controller.view.sheet).toBeNull();
  view.rerender(<Host section="profile" />);
  await motion.finish();
  view.rerender(<Host section="overview" />);
  await motion.finish();
  expect(controller.view.sheet).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
