import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { disclosureTestAnimations } from "../motion/disclosure-test-animations";
import { ProductHelp, type ProductHelpAction, type ProductHelpActions,
  type ProductHelpProps, type ProductHelpTopicId } from "./index";

afterEach(cleanup);

const topics = [
  { id: "receive", title: "Получить", cta: "Открыть получение" },
  { id: "send", title: "Отправить", cta: "Открыть отправку" },
  { id: "buy", title: "Купить", cta: "Открыть покупку" },
  { id: "swap", title: "Обменять", cta: "Открыть обмен" },
] as const;

function ControlledHelp({ actions }: Pick<ProductHelpProps, "actions">) {
  const [openTopic, setOpenTopic] = useState<ProductHelpTopicId | null>(null);
  return <ProductHelp openTopic={openTopic} onOpenTopicChange={setOpenTopic} actions={actions} />;
}

function OpeningHost({ openings, payloads }: { openings: ProductHelpTopicId[]; payloads: unknown[][] }) {
  const [openTopic, setOpenTopic] = useState<ProductHelpTopicId | null>(null);
  const [openedFlow, setOpenedFlow] = useState<ProductHelpTopicId | null>(null);
  const open = (topic: ProductHelpTopicId) => (...args: unknown[]) => {
    openings.push(topic);
    payloads.push(args);
    setOpenedFlow(topic);
  };
  const actions: ProductHelpActions = {
    receive: { allowed: true, onOpen: open("receive") },
    send: { allowed: true, onOpen: open("send") },
    buy: { allowed: true, onOpen: open("buy") },
    swap: { allowed: true, onOpen: open("swap") },
  };
  return <>
    <ProductHelp openTopic={openTopic} onOpenTopicChange={setOpenTopic} actions={actions} />
    <output aria-label="Открытый сценарий">{openedFlow ?? "Нет"}</output>
  </>;
}

describe("ProductHelp controlled actions", () => {
  // Catches a topic wired to another callback, eager opening, or event/payload forwarding.
  it.each(topics)("opens only $id through its supplied callback after explicit CTA activation", topic => {
    const openings: ProductHelpTopicId[] = [], payloads: unknown[][] = [];
    render(<OpeningHost openings={openings} payloads={payloads} />);
    expect(openings).toEqual([]);
    expect(screen.getByLabelText("Открытый сценарий")).toHaveTextContent("Нет");

    const trigger = screen.getByRole("button", { name: topic.title });
    trigger.focus();
    // Native keyboard activation produces a click without pointer details.
    fireEvent.click(trigger, { detail: 0 });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(openings).toEqual([]);
    const panel = screen.getByRole("region", { name: topic.title });
    const cta = within(panel).getByRole("button", { name: topic.cta });
    expect(cta).toHaveAttribute("type", "button");
    expect(cta.tabIndex).toBe(0);
    cta.focus();
    expect(cta).toHaveFocus();
    fireEvent.click(cta, { detail: 0 });

    expect(screen.getByLabelText("Открытый сценарий")).toHaveTextContent(topic.id);
    expect(openings).toEqual([topic.id]);
    expect(payloads).toEqual([[]]);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  // Catches treating presence/truthiness of an action or callback as permission.
  it.each([
    { case: "explicitly unavailable", action: { allowed: false, reason: "Сначала завершите текущий сценарий." },
      reason: "Сначала завершите текущий сценарий." },
    { case: "missing entry", action: undefined, reason: "Открытие этой операции сейчас недоступно." },
    { case: "missing callback", action: { allowed: true }, reason: "Открытие этой операции сейчас недоступно." },
    { case: "empty unavailable reason", action: { allowed: false, reason: "  " },
      reason: "Открытие этой операции сейчас недоступно." },
  ])("keeps $case read-only with an explanation", ({ action, reason }) => {
    const actions: ProductHelpActions = {
      send: action as ProductHelpAction | undefined,
      receive: { allowed: true, onOpen: () => { throw new Error("Receive must not open from Send help"); } },
    };
    render(<ControlledHelp actions={actions} />);
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    const panel = screen.getByRole("region", { name: "Отправить" });
    expect(within(panel).getByText(reason)).toBeInTheDocument();
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("link")).not.toBeInTheDocument();
  });

  // Catches local open state overriding controlled props or broken button/region relationships.
  it("requests topic changes and waits for host props to expose a single labelled disclosure", () => {
    const requested: (ProductHelpTopicId | null)[] = [];
    const onOpenTopicChange = (topic: ProductHelpTopicId | null) => { requested.push(topic); };
    const { rerender } = render(<ProductHelp openTopic={null} onOpenTopicChange={onOpenTopicChange} />);
    const receive = screen.getByRole("button", { name: "Получить" });
    receive.focus();
    fireEvent.click(receive, { detail: 0 });
    expect(requested).toEqual(["receive"]);
    expect(receive).toHaveAttribute("type", "button");
    expect(receive.tabIndex).toBe(0);
    expect(receive).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();

    rerender(<ProductHelp openTopic="receive" onOpenTopicChange={onOpenTopicChange} />);
    const panel = screen.getByRole("region", { name: "Получить" });
    expect(receive).toHaveFocus();
    expect(receive.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", receive.id);
    expect(receive).toHaveAccessibleDescription("Счёт, актив и сеть");
    fireEvent.click(receive, { detail: 0 });
    expect(requested).toEqual(["receive", null]);
    expect(receive).toHaveAttribute("aria-expanded", "true");

    rerender(<ProductHelp openTopic="buy" onOpenTopicChange={onOpenTopicChange} />);
    expect(receive).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Купить" })).toBeInTheDocument();
  });

  // Catches a stale enabled CTA after host eligibility changes, and captured old callbacks.
  it("updates an open topic immediately when eligibility or its supplied callback changes", () => {
    const openings: string[] = [];
    const fixed = { openTopic: "send" as const, onOpenTopicChange: () => undefined };
    const { rerender } = render(<ProductHelp {...fixed}
      actions={{ send: { allowed: true, onOpen: () => { openings.push("old"); } } }} />);
    const oldCta = screen.getByRole("button", { name: "Открыть отправку" });
    rerender(<ProductHelp {...fixed} actions={{ send: { allowed: false, reason: "Направление пока недоступно." } }} />);
    expect(oldCta).not.toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Отправить" });
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
    expect(within(panel).getByText("Направление пока недоступно.")).toBeInTheDocument();
    rerender(<ProductHelp {...fixed}
      actions={{ send: { allowed: true, onOpen: () => { openings.push("current"); } } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть отправку" }));
    expect(openings).toEqual(["current"]);
    rerender(<ProductHelp {...fixed} />);
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
  });

  // Catches an unavailable action with a stray runtime callback becoming clickable or rendering HTML.
  it("renders a supplied unavailable reason as text and ignores a stray callback", () => {
    const openings: string[] = [];
    const reason = "<strong>Сначала завершите текущий сценарий.</strong>";
    const action = { allowed: false, reason, onOpen: () => { openings.push("unexpected"); } } as unknown as ProductHelpAction;
    render(<ControlledHelp actions={{ send: action }} />);
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    const panel = screen.getByRole("region", { name: "Отправить" });
    const note = within(panel).getByText(reason);
    expect(note.querySelector("strong")).toBeNull();
    expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
    expect(openings).toEqual([]);
  });

  // Catches a duplicate page heading or hidden demo boundary when every topic is closed.
  it("keeps the demo boundary visible and supplies topic headings beneath the profile group", () => {
    render(<ProductHelp openTopic={null} onOpenTopicChange={() => undefined} />);
    expect(screen.getByText(/это демо.*не перемещают реальные средства/i)).toBeInTheDocument();
    expect(screen.getByText("Открытие сценария не запускает операцию.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    for (const topic of topics) {
      const heading = screen.getByRole("heading", { level: 3, name: topic.title });
      expect(within(heading).getByRole("button", { name: topic.title })).toHaveAttribute("aria-expanded", "false");
    }
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("ProductHelp disclosure lifecycle", () => {
  let animations: ReturnType<typeof disclosureTestAnimations>;
  beforeEach(() => { animations = disclosureTestAnimations(); });
  afterEach(() => animations.restore());

  // Catches incorrect launcher IDs or outgoing CTAs that stay active during a controlled close.
  it("returns focus and excludes outgoing actions during the existing disclosure close", async () => {
    const openings: string[] = [];
    const actions: ProductHelpActions = { send: { allowed: true, onOpen: () => { openings.push("send"); } } };
    const view = (openTopic: ProductHelpTopicId | null) => <div data-mono-motion="ready">
      <ProductHelp openTopic={openTopic} onOpenTopicChange={() => undefined} actions={actions} />
    </div>;
    const { rerender } = render(view("send"));
    const trigger = screen.getByRole("button", { name: "Отправить" });
    const panel = screen.getByRole("region", { name: "Отправить" });
    const cta = within(panel).getByRole("button", { name: "Открыть отправку" });
    cta.focus();
    rerender(view(null));
    expect(trigger).toHaveFocus();
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).toContainElement(cta);
    expect(screen.queryByRole("button", { name: "Открыть отправку" })).not.toBeInTheDocument();
    fireEvent.click(cta);
    expect(openings).toEqual([]);
    await animations.finish(panel);
    expect(panel).toHaveAttribute("hidden");
    expect(cta).not.toBeInTheDocument();
  });

  // Catches animation or retained outgoing content when the host/system requires static presentation.
  it.each(["static", "reduced"] as const)("settles %s disclosures immediately", async mode => {
    const view = (openTopic: ProductHelpTopicId | null) => <div data-mono-motion={mode === "static" ? "static" : "ready"}>
      <ProductHelp openTopic={openTopic} onOpenTopicChange={() => undefined}
        actions={{ buy: { allowed: true, onOpen: () => undefined } }} />
    </div>;
    const { rerender } = render(view("buy"));
    const trigger = screen.getByRole("button", { name: "Купить" });
    const panel = screen.getByRole("region", { name: "Купить" });
    screen.getByRole("button", { name: "Открыть покупку" }).focus();
    if (mode === "reduced") await animations.reduceMotion();
    rerender(view(null));
    expect(trigger).toHaveFocus();
    expect(panel).toHaveAttribute("hidden");
    expect(panel).toHaveAttribute("inert");
    expect(panel.querySelector("button")).toBeNull();
    expect(animations.requests).toHaveLength(0);
  });
});
