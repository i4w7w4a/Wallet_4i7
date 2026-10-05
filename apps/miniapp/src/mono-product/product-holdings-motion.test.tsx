import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SINGLE_ACCOUNT_DEMO } from "@wallet/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MONO_ASSET_LIST_DEFAULT } from "../mono-preview/mono-scene-lab-contract";
import { useMonoProductController } from "./product-controller";
import { ProductHoldings } from "./product-holdings";
import { disclosureTestAnimations } from "./motion/disclosure-test-animations";

let animations: ReturnType<typeof disclosureTestAnimations>;
beforeEach(() => { animations = disclosureTestAnimations(); });
afterEach(() => { cleanup(); animations.restore(); });

function Holdings({ onAction, onOpenAsset }: { onAction?: (id: string, action: "send" | "receive") => void; onOpenAsset?: (id: string) => void }) {
  const product = useMonoProductController({ kind: "demo", snapshot: SINGLE_ACCOUNT_DEMO }, { initialHidden: false });
  return <div data-mono-motion="ready">
    <button onClick={() => product.commands.setBalanceHidden(!product.view.balanceHidden)}>Privacy</button>
    <ProductHoldings {...product} appearance={MONO_ASSET_LIST_DEFAULT} overview
      onPlacementAction={onAction} onOpenAsset={onOpenAsset} />
  </div>;
}

function controlledBy(button: HTMLElement) {
  return document.getElementById(button.getAttribute("aria-controls")!)!;
}

describe("ProductHoldings disclosure motion", () => {
  it("retains only inert outgoing lists, refreshes privacy and preserves exact actions and asset routing", async () => {
    const action = vi.fn(), asset = vi.fn();
    const { container } = render(<Holdings onAction={action} onOpenAsset={asset} />);
    const funds = screen.getByRole("button", { name: /Мои средства/ });
    funds.focus();
    fireEvent.click(funds);
    expect(funds).toHaveFocus();
    const list = controlledBy(funds);
    const primary = screen.getByRole("button", { name: "Открыть актив USD Coin (USDC)" });
    fireEvent.click(primary);
    expect(asset).toHaveBeenCalledExactlyOnceWith("usdc");
    expect(screen.getByRole("button", { name: "Показать размещения USDC" })).toHaveAttribute("aria-expanded", "false");
    const expand = screen.getByRole("button", { name: "Показать размещения USDC" });
    fireEvent.click(expand);
    const placements = controlledBy(expand);
    const send = screen.getByRole("button", { name: "Отправить USDC · Основной · Ethereum" });
    fireEvent.click(send);
    expect(action).toHaveBeenCalledExactlyOnceWith("demo-single-usdc", "send");
    send.focus();
    fireEvent.click(expand);
    expect(expand).toHaveFocus();
    expect(placements).toHaveAttribute("inert");
    expect(placements).toHaveAttribute("aria-hidden", "true");
    expect(placements).toContainElement(send);
    expect(screen.queryByRole("button", { name: /Отправить USDC/ })).not.toBeInTheDocument();
    fireEvent.click(send);
    expect(action).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(placements).toHaveTextContent("Значения скрыты");
    expect(container.innerHTML).not.toMatch(/1250|1[\s\u00a0\u202f]250/);
    await animations.finish(placements);
    expect(placements).toHaveAttribute("hidden");
    expect(placements.querySelector("ul")).toBeNull();
    primary.focus();
    fireEvent.click(funds);
    expect(funds).toHaveFocus();
    expect(list).toHaveAttribute("inert");
    expect(list).toContainElement(primary);
    fireEvent.click(primary);
    expect(asset).toHaveBeenCalledOnce();
    expect(container.querySelector("ul > :not(li)")).toBeNull();
    await animations.finish(list);
    expect(list).toHaveAttribute("hidden");
    expect(list.querySelector("ul")).toBeNull();
  });

  it("reopens nested lists without a late close completion removing them", async () => {
    render(<Holdings onOpenAsset={() => undefined} />);
    const funds = screen.getByRole("button", { name: /Мои средства/ });
    fireEvent.click(funds);
    const list = controlledBy(funds);
    const expand = screen.getByRole("button", { name: "Показать размещения USDC" });
    fireEvent.click(expand);
    const placements = controlledBy(expand);
    fireEvent.click(expand);
    fireEvent.click(expand);
    await animations.finish(placements, 0);
    expect(placements).not.toHaveAttribute("inert");
    expect(screen.getByRole("list", { name: "Размещения USDC" })).toBeInTheDocument();
    fireEvent.click(funds);
    fireEvent.click(funds);
    await animations.finish(list, 0);
    expect(list).not.toHaveAttribute("inert");
    expect(controlledBy(expand)).toBe(placements);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(funds);
    await animations.cancel(list);
    expect(list).toHaveAttribute("hidden");
  });

  it("settles outgoing funds immediately when the scene becomes static or the document becomes hidden", async () => {
    const { container } = render(<Holdings onOpenAsset={() => undefined} />);
    const funds = screen.getByRole("button", { name: /Мои средства/ });
    fireEvent.click(funds);
    const list = controlledBy(funds);
    fireEvent.click(funds);
    await act(async () => { container.firstElementChild!.setAttribute("data-mono-motion", "static"); });
    expect(list).toHaveAttribute("hidden");
    expect(list.querySelector("ul")).toBeNull();
    await act(async () => { container.firstElementChild!.setAttribute("data-mono-motion", "ready"); });
    fireEvent.click(funds);
    fireEvent.click(funds);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(list).toHaveAttribute("hidden");
    expect(list.querySelector("ul")).toBeNull();
  });
});
