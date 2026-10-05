import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, MULTI_ACCOUNT_DEMO, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene, type MonoSection } from "../mono-preview/mono-scene";
import { createMonoAppearanceEnvelope } from "../mono-preview/mono-preset-envelope";
import { MONO_PRODUCT_DEMO_ADAPTER, type MonoProductAdapter } from "./demo-adapter";
import { useMonoProductController, type MonoProductController } from "./product-controller";
import { disclosureTestAnimations } from "./motion/disclosure-test-animations";

let animations: ReturnType<typeof disclosureTestAnimations>;
beforeEach(() => {
  animations = disclosureTestAnimations();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(40, 20, 390, 900);
    if (this.hasAttribute("data-mono-product-context-trigger")) return new DOMRect(64, 88, 130, 44);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(358, 28, 44, 44);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); animations.restore(); });

// Same real scene/controller fixture as product-interaction-polish. A new snapshot
// stays inside the adapter session so stale source identities reach the UI guards.
async function home(options: { adapter?: MonoProductAdapter; hidden?: boolean } = {}) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const appearance = createMonoAppearanceEnvelope("ledger").appearance;
  const adapter = { ...(options.adapter ?? MONO_PRODUCT_DEMO_ADAPTER) };
  let controller!: MonoProductController;
  let refresh!: () => void;
  function Host() {
    const [, setRevision] = useState(0);
    refresh = () => setRevision(value => value + 1);
    controller = useMonoProductController(adapter, { initialHidden: options.hidden ?? false });
    const [section, setSection] = useState<MonoSection>("overview");
    return <MonoScene snapshot={wallet} appearance={appearance} product={controller} effectsDisabled
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: controller.view.balanceHidden, onBalanceHiddenChange: controller.commands.setBalanceHidden }} />;
  }
  const view = render(<Host />);
  return { ...view, current: () => controller, replaceSnapshot(snapshot: ProductSnapshot) {
    act(() => { adapter.snapshot = snapshot; refresh(); });
  } };
}

function accountWorkspace() {
  return screen.getByRole("region", { name: "Основной" });
}

function holdingDisclosure(root: HTMLElement = accountWorkspace()) {
  const target = root.querySelector<HTMLButtonElement>('[data-product-holding-id="demo-usdc-eth"]');
  expect(target).not.toBeNull();
  return target!;
}

function holdingAction(action: "send" | "receive", root: HTMLElement = accountWorkspace()) {
  const target = root.querySelector<HTMLButtonElement>(`[data-product-holding-action-id="demo-usdc-eth"][data-product-holding-action="${action}"]`);
  expect(target).not.toBeNull();
  expect(target).not.toBeDisabled();
  expect(target!.closest("[hidden], [inert]")).toBeNull();
  return target!;
}

function holdingDetails() {
  const target = accountWorkspace().querySelector<HTMLButtonElement>('[data-product-holding-detail-id="demo-usdc-eth"]');
  expect(target).not.toBeNull();
  return target!;
}

function inspectMain() {
  fireEvent.click(screen.getByRole("button", { name: "Быстрые настройки" }));
  fireEvent.click(screen.getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Основной" }));
}

function closePreparation() {
  fireEvent.click(within(screen.getByRole("dialog", { name: "Отправить" })).getByRole("button", { name: "Закрыть" }));
}

const ethereumSend = {
  action: "send", accountId: "demo-custody", assetId: "usdc", networkId: "ethereum",
} as const;

it.each(["close", "Back"])("returns direct Ethereum Send %s to the same visible placement action without committing disclosure", async exit => {
  const view = await home({ hidden: true });
  inspectMain();
  expect(view.current().view.context).toEqual({ kind: "all" });
  fireEvent.click(holdingDisclosure());
  expect(view.current().view.context).toEqual({ kind: "all" });
  expect(view.current().view.assetWorkspace).toBeNull();
  expect(holdingDisclosure()).toHaveAttribute("aria-expanded", "true");
  const workspace = accountWorkspace();
  expect(workspace.textContent).not.toMatch(/500|400|8\s?040|3\s?900|12\s?840/);
  for (const target of workspace.querySelectorAll("[aria-label], [title], [aria-valuetext]")) {
    expect([target.getAttribute("aria-label"), target.getAttribute("title"), target.getAttribute("aria-valuetext")].join(" "))
      .not.toMatch(/500|400|8\s?040|3\s?900|12\s?840/);
  }
  fireEvent.click(holdingAction("send"));
  expect(view.current().view.sheet).toMatchObject({ kind: "intent", action: "send", route: ethereumSend,
    returnToAccountId: "demo-custody" });
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  const flow = await screen.findByRole("region", { name: "Демонстрационная отправка" });
  expect(flow).toHaveAttribute("data-send-stage", "recipient");
  expect(within(flow).getByRole("button", { name: "О валюте USDC в сети Ethereum" })).toBeInTheDocument();
  expect(flow.closest('[data-product-flow-surface="send"]')).not.toBeNull();
  const back = within(flow).getByRole("button", { name: /Назад.*Основной|Назад.*размещени/i });
  if (exit === "close") closePreparation();
  else fireEvent.click(back);
  await waitFor(() => expect(holdingAction("send")).toHaveFocus());
  expect(holdingDisclosure()).toHaveAttribute("aria-expanded", "true");
  expect(view.current().view.sheet).toBeNull();
  expect(view.current().view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
});

it("keeps the expanded holding through Details and child Send, then returns to its Details button", async () => {
  const view = await home();
  inspectMain();
  fireEvent.click(holdingDisclosure());
  fireEvent.click(holdingDetails());
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(view.current().view.assetWorkspace).toEqual({ assetId: "usdc", holdingId: "demo-usdc-eth" });
  const details = screen.getByRole("region", { name: "USD Coin" });
  fireEvent.click(within(details).getByRole("button", { name: "Отправить USDC · Основной · Ethereum" }));
  expect(view.current().view.sheet).toMatchObject({ kind: "intent", route: ethereumSend, placementId: "demo-usdc-eth" });
  await screen.findByLabelText("Получатель");
  closePreparation();
  await waitFor(() => expect(within(screen.getByRole("region", { name: "USD Coin" }))
    .getByRole("button", { name: "Отправить USDC · Основной · Ethereum" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: /Назад.*Основной|Назад.*размещени/i }));
  await waitFor(() => expect(holdingDetails()).toHaveFocus());
  expect(holdingDisclosure()).toHaveAttribute("aria-expanded", "true");
  expect(view.current().view.assetWorkspace).toBeNull();
  expect(view.current().view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
});

it("opens the exact internal Ethereum receive route in an empty Vault and returns to its visible account launcher", async () => {
  const view = await home();
  fireEvent.click(screen.getByRole("button", { name: "Быстрые настройки" }));
  fireEvent.click(screen.getByRole("button", { name: "Мои счета" }));
  fireEvent.click(screen.getByRole("button", { name: "Открыть счёт: Хранилище" }));
  const vault = screen.getByRole("region", { name: "Хранилище" });
  expect(within(vault).getByText("Размещений пока нет.")).toBeInTheDocument();
  fireEvent.click(within(vault).getByRole("button", { name: "Получить на счёт" }));
  if (!view.current().view.sheet) {
    const route = vault.querySelector<HTMLButtonElement>('[data-product-account-route-key="receive:demo-depositary:usdc:ethereum:internal-transfer"]');
    expect(route).not.toBeNull();
    expect(route!.closest("[hidden], [inert]")).toBeNull();
    fireEvent.click(route!);
  }
  expect(view.current().view.sheet).toMatchObject({ kind: "intent", action: "receive", route: {
    accountId: "demo-depositary", assetId: "usdc", networkId: "ethereum", receiveMode: "internal-transfer",
  }, returnToAccountId: "demo-depositary" });
  const heading = await screen.findByRole("heading", { name: "Внутреннее пополнение" });
  expect(heading).toBeInTheDocument();
  const receive = screen.getByRole("dialog", { name: "Получить" });
  const direction = await within(receive).findByRole("group", { name: "Направление пополнения" });
  expect(direction).toHaveTextContent(/Откуда\s*Основной/);
  expect(direction).toHaveTextContent(/Куда\s*Хранилище/);
  expect(within(receive).getByLabelText("Сумма пополнения")).toBeInTheDocument();
  fireEvent.click(within(receive).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Хранилище" }))
    .getByRole("button", { name: "Получить на счёт" })).toHaveFocus());
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-depositary" });
});

it.each(["holding", "route"])("returns to a visible safe account target when the source %s disappears", async missing => {
  const snapshot: ProductSnapshot = structuredClone(MULTI_ACCOUNT_DEMO);
  const view = await home({ adapter: { kind: "demo", snapshot } });
  inspectMain();
  fireEvent.click(holdingDisclosure());
  fireEvent.click(holdingAction("send"));
  await screen.findByLabelText("Получатель");
  const next: ProductSnapshot = structuredClone(snapshot);
  if (missing === "holding") next.holdings = next.holdings.filter(holding => holding.id !== "demo-usdc-eth");
  else next.accounts = next.accounts.map(account => account.id === "demo-custody" ? { ...account,
    capabilities: account.capabilities.filter(capability => !(capability.action === "send" &&
      capability.assetId === "usdc" && capability.networkId === "ethereum")) } : account);
  view.replaceSnapshot(next);
  if (missing === "holding") closePreparation();
  else {
    expect(screen.queryByRole("region", { name: "Демонстрационная отправка" })).toBeNull();
    expect(view.current().view.sheet).toMatchObject({ kind: "intent", route: null });
    fireEvent.keyDown(document, { key: "Escape" });
  }
  await waitFor(() => expect(missing === "holding" ? screen.getByRole("heading", { name: "Основной" })
    : holdingDisclosure()).toHaveFocus());
  expect(document.activeElement?.closest("[hidden], [inert]")).toBeNull();
  expect(view.current().view.sheet).toBeNull();
  expect(view.current().view.accountsWorkspace).toEqual({ accountId: "demo-custody" });
});

it("retains the exact send draft but reopens at recipient and requires validation and a new quote", async () => {
  const view = await home();
  inspectMain();
  fireEvent.click(holdingDisclosure());
  fireEvent.click(holdingAction("send"));
  fireEvent.change(await screen.findByLabelText("Получатель"), { target: { value: "demo:kept" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  fireEvent.change(await screen.findByLabelText("Сумма, USDC"), { target: { value: "23,5" } });
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  fireEvent.click(await screen.findByRole("button", { name: "Проверить перевод" }));
  expect(screen.getByRole("heading", { name: "Проверьте перевод" })).toBeInTheDocument();
  const send = screen.getByRole("region", { name: "Демонстрационная отправка" });
  fireEvent.click(within(send).getByRole("button", { name: "О валюте USDC в сети Ethereum" }));
  expect(send.closest("[data-product-flow-content]")).toHaveAttribute("hidden");
  expect(send.closest("[data-product-flow-content]")).toHaveAttribute("inert");
  expect(view.container.querySelector('[data-product-flow-surface="send"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Назад к операции" }));
  expect(screen.getByRole("region", { name: "Демонстрационная отправка" })).toBe(send);
  expect(send).toHaveAttribute("data-send-stage", "review");
  expect(send.closest('[data-product-flow-surface="send"]')).not.toBeNull();
  expect(screen.getByRole("heading", { name: "Проверьте перевод" })).toBeInTheDocument();
  closePreparation();
  await waitFor(() => expect(holdingAction("send")).toHaveFocus());
  expect(view.current().view.sendDrafts['["demo-custody","usdc","ethereum"]']).toEqual({ route: {
    accountId: "demo-custody", assetId: "usdc", networkId: "ethereum",
  }, recipient: { address: "demo:kept" }, amount: "23,5" });
  fireEvent.click(holdingAction("send"));
  const recipient = await screen.findByLabelText("Получатель");
  expect(recipient).toHaveValue("demo:kept");
  expect(screen.getByRole("region", { name: "Демонстрационная отправка" })).toHaveAttribute("data-send-stage", "recipient");
  expect(screen.queryByRole("button", { name: "Подтвердить симуляцию" })).toBeNull();
  fireEvent.change(recipient, { target: { value: "invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/получател/i);
  expect(screen.queryByLabelText("Сумма, USDC")).toBeNull();
  fireEvent.change(recipient, { target: { value: "demo:kept" } });
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(await screen.findByLabelText("Сумма, USDC")).toHaveValue("23,5");
  expect(screen.queryByRole("button", { name: "Проверить перевод" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Рассчитать комиссию" }));
  expect(await screen.findByRole("button", { name: "Проверить перевод" })).toBeInTheDocument();
});
