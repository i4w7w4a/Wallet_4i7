import "@testing-library/jest-dom/vitest";
import { Blob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CompressionStream, DecompressionStream } from "node:stream/web";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, resolveActionRoutes, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoProductScene } from "./mono-product-scene";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoScene, type MonoSection } from "./mono-scene";
import { MonoPreview } from "./mono-preview";
import { MonoPublishedViewer } from "./mono-published-viewer";
import { parsePublishedRecord } from "./mono-published-contract";
import { createMonoShareUrl } from "./mono-share-codec";
import { MonoViewerPage } from "./mono-viewer-page";
import manifest from "../../../../checkpoints/mono-published/2026-10-17/manifest.json";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../mono-product/demo-adapter";
import { sendDraftKey, useMonoProductController, type MonoProductController } from "../mono-product/product-controller";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps the existing Assets overview when the host does not opt in", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const view = render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material}
    viewport={390} homeComposition="compact" historyPresentation="compact" effectsDisabled />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Активы" }));
  expect(view.container.querySelector("[data-r1-wallet-selection]")).toBeNull();
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Назад в обзор" })).toBeVisible();
});

it("enables R1 in the actual /mono workbench host", async () => {
  localStorage.clear(); history.replaceState(null, "", "/mono");
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "unconfigured" }, { status: 503 })));
  const view = render(<MonoPreview snapshot={await new MockWalletRepository().getSnapshot()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Пресет 1: Пресет 1" })).toBeEnabled());
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Активы" }));
  expect(view.container.querySelector("[data-r1-wallet-selection]")).toBeVisible();
  localStorage.clear();
});

it.each(["published", "portable"] as const)("keeps the existing Assets view in the %s host", async hostKind => {
  localStorage.clear(); history.replaceState(null, "", "/mono/view");
  vi.stubGlobal("Blob", Blob); vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("CompressionStream", CompressionStream); vi.stubGlobal("DecompressionStream", DecompressionStream);
  const record = manifest.slots[1];
  const source = readFileSync(resolve(process.cwd(), "../../checkpoints/mono-published/2026-10-17", record.snapshotFile), "utf8");
  const archived = parsePublishedRecord({ slot: record.slot, revision: record.revision,
    updatedAt: record.updatedAt, snapshot: JSON.parse(source) }, 2);
  if (hostKind === "portable") history.replaceState(null, "", await createMonoShareUrl(archived.snapshot, location.origin));
  const wallet = await new MockWalletRepository().getSnapshot();
  const view = render(hostKind === "published"
    ? <MonoPublishedViewer wallet={wallet} published={archived.snapshot} /> : <MonoViewerPage snapshot={wallet} />);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Активы" }));
  expect(view.container.querySelector("[data-r1-wallet-selection]")).toBeNull();
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Назад в обзор" })).toBeVisible();
  localStorage.clear();
});

it("opens Assets on the three product choices and a separate overview", async () => {
  const snapshot = await new MockWalletRepository().getSnapshot();
  const envelope = createMonoAppearanceEnvelope("ledger");
  const view = render(<MonoProductScene snapshot={snapshot} appearance={envelope.appearance} material={envelope.material}
    viewport={390} homeComposition="compact" historyPresentation="compact" assetsPresentation="wallet-selection" effectsDisabled />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Активы" }));
  const selection = view.container.querySelector<HTMLElement>("[data-r1-wallet-selection]");
  expect(selection).toBeInTheDocument();
  expect(selection!.querySelectorAll("button[data-r1-wallet-kind]")).toHaveLength(3);
  expect(selection!.querySelector("button[data-r1-overview]")).toBeEnabled();
  expect(selection!.querySelector("button[data-r1-wallet-kind='private']")).toBeDisabled();
  expect(selection!.querySelector("button[data-r1-wallet-kind='private']")).toHaveTextContent("Пока недоступно");
  expect(selection!.querySelector("button[data-r1-wallet-kind='custodial']")).toHaveAccessibleName(/Кастодиальный/);
  expect(selection!.querySelector("button[data-r1-wallet-kind='depositary']")).toHaveAccessibleName(/Депозитарный/);
  expect(selection!.querySelector("button[data-r1-wallet-kind='private']")).toHaveAccessibleName(/Приватный/);
  fireEvent.click(selection!.querySelector<HTMLButtonElement>("button[data-r1-wallet-kind='private']")!);
  expect(selection).toBeVisible();
  expect(view.container.querySelector("[data-mono-product-accounts-workspace]")).toBeNull();
});

async function host(snapshot: Readonly<ProductSnapshot> = MONO_PRODUCT_DEMO_ADAPTER.snapshot) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const appearance = createMonoAppearanceEnvelope("ledger").appearance;
  const adapter = { ...MONO_PRODUCT_DEMO_ADAPTER, snapshot };
  let controller!: MonoProductController;
  function Host({ blocked = false }: { blocked?: boolean }) {
    const [section, setSection] = useState<MonoSection>("overview");
    controller = useMonoProductController(adapter, { initialHidden: false });
    const product = blocked ? { ...controller, commands: { ...controller.commands, requestContextChange: () => false } } : controller;
    return <div data-material-scrollport><MonoScene snapshot={wallet} appearance={appearance} product={product}
      homeComposition="compact" historyPresentation="compact" assetsPresentation="wallet-selection" effectsDisabled session={{ section, onSectionChange: setSection,
        period: "1D", onPeriodChange() {}, balanceHidden: controller.view.balanceHidden,
        onBalanceHiddenChange: controller.commands.setBalanceHidden }} /></div>;
  }
  const view = render(<Host />);
  return { ...view, current: () => controller, block: () => view.rerender(<Host blocked />),
    unblock: () => view.rerender(<Host />) };
}

function assets() {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Активы" }));
}
function walletCard(kind: "custodial" | "depositary" | "private") {
  const card = document.querySelector<HTMLButtonElement>(`button[data-r1-wallet-kind="${kind}"]`);
  expect(card).toBeVisible();
  return card!;
}
function overviewButton() {
  const button = document.querySelector<HTMLButtonElement>("button[data-r1-overview]");
  expect(button).toBeVisible();
  return button!;
}
function workspace() {
  const element = document.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]");
  expect(element).toBeVisible();
  return element!;
}
function backIn(element: HTMLElement) {
  fireEvent.click(within(element).getByRole("button", { name: /^Назад/ }));
}

it("opens the exact default custody account directly and returns focus to its card", async () => {
  const view = await host();
  assets();
  fireEvent.click(walletCard("custodial"));
  expect(view.current().view.accountsWorkspace?.accountId).toBe("demo-custody");
  expect(workspace()).toHaveAttribute("data-mono-product-accounts-workspace", "demo-custody");
  expect(within(workspace()).getByRole("heading", { name: /Кастодиальный/ })).toBeVisible();
  backIn(workspace());
  expect(view.current().view.accountsWorkspace).toBeNull();
  await waitFor(() => expect(walletCard("custodial")).toHaveFocus());
});

it("opens the separate all-assets overview and returns to its originating control", async () => {
  const view = await host();
  assets();
  fireEvent.click(overviewButton());
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeVisible();
  expect(view.current().view.accountsWorkspace).toBeNull();
  expect(screen.getByRole("button", { name: /Открыть актив.*BTC/i })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Назад/ }));
  await waitFor(() => expect(overviewButton()).toHaveFocus());
  expect(walletCard("custodial")).toBeVisible();
  fireEvent.click(overviewButton());
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(overviewButton()).toHaveFocus());
  fireEvent.click(overviewButton());
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name: "Обзор" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Общий баланс" })).toHaveFocus());
  assets();
  expect(overviewButton()).toBeVisible();
});

it("requires an explicit account choice when two accounts share a kind", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const first = source.accounts.find(account => account.id === "demo-custody")!;
  const custom: ProductSnapshot = { ...source, accounts: [...source.accounts,
    { ...first, id: "second-custody", label: "Второй кастодиальный" }] };
  const view = await host(custom);
  assets();
  fireEvent.click(walletCard("custodial"));
  expect(view.current().view.accountsWorkspace?.accountId).toBeNull();
  expect(workspace()).toHaveAttribute("data-mono-product-accounts-workspace", "list");
  expect(within(workspace()).getByRole("button", { name: "Открыть счёт: Кастодиальный" })).toBeVisible();
  fireEvent.click(within(workspace()).getByRole("button", { name: "Открыть счёт: Второй кастодиальный" }));
  expect(view.current().view.accountsWorkspace?.accountId).toBe("second-custody");
  expect(workspace()).toHaveAttribute("data-mono-product-accounts-workspace", "second-custody");
  backIn(workspace());
  expect(view.current().view.accountsWorkspace?.accountId).toBeNull();
  await waitFor(() => expect(within(workspace()).getByRole("button", { name: "Открыть счёт: Второй кастодиальный" })).toHaveFocus());
  backIn(workspace());
  await waitFor(() => expect(walletCard("custodial")).toHaveFocus());
});

it("returns from profile inspection to the same Assets overview", async () => {
  await host();
  assets();
  fireEvent.click(overviewButton());
  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть профиль" }));
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Открыть профиль" })).toHaveFocus();
});

it("shows the account explicitly selected in the wallet, while the separate overview remains aggregate", async () => {
  const view = await host();
  assets();
  fireEvent.click(walletCard("custodial"));
  fireEvent.click(within(workspace()).getByText("Управление счётом"));
  fireEvent.click(within(workspace()).getByRole("button", { name: /Выбрать счёт в кошельке/ }));
  expect(view.current().view.context).toEqual({ kind: "account", accountId: "demo-custody" });
  expect(screen.getByRole("heading", { name: "Активы счёта" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Выбрать счёт: Кастодиальный" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Назад к кошелькам" }));
  fireEvent.click(overviewButton());
  expect(screen.getByRole("heading", { name: "Все активы" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Выбрать счёт: Общий обзор" })).toBeVisible();
});

it("does not open an account when the only matching ID is duplicated", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const first = source.accounts.find(account => account.id === "demo-custody")!;
  const view = await host({ ...source, accounts: [...source.accounts, { ...first }] });
  assets();
  expect(walletCard("custodial")).toBeDisabled();
  fireEvent.click(walletCard("custodial"));
  expect(view.current().view.accountsWorkspace).toBeNull();
  expect(walletCard("depositary")).toBeEnabled();
});

it("honours a rejected context guard and keeps the exact send draft", async () => {
  const view = await host();
  const route = resolveActionRoutes(MONO_PRODUCT_DEMO_ADAPTER.snapshot, { kind: "account", accountId: "demo-custody" }, "send")
    .routes.find(candidate => candidate.assetId === "usdc" && candidate.networkId === "ethereum")!;
  const draft = { route: { accountId: "demo-custody", assetId: "usdc", networkId: "ethereum" },
    recipient: { address: "demo:kept" }, amount: "001," };
  act(() => view.current().commands.saveSendDraft(route, draft));
  assets();
  const previousContext = view.current().view.context;
  view.block();
  fireEvent.click(overviewButton());
  expect(overviewButton()).toBeVisible();
  fireEvent.click(walletCard("custodial"));
  expect(view.current().view.accountsWorkspace).toBeNull();
  expect(view.current().view.context).toEqual(previousContext);
  expect(view.current().view.sendDrafts[sendDraftKey(route)]).toEqual(draft);
  expect(walletCard("custodial")).toBeVisible();
  view.unblock();
  fireEvent.click(walletCard("custodial"));
  expect(view.current().view.accountsWorkspace?.accountId).toBe("demo-custody");
  expect(view.current().view.sendDrafts[sendDraftKey(route)]).toEqual(draft);
});

it("opens scoped USDC Ethereum Receive and returns to custody, then to the card", async () => {
  const view = await host();
  assets();
  fireEvent.click(walletCard("custodial"));
  fireEvent.click(within(workspace()).getByRole("button", { name: "Получить" }));
  fireEvent.click(within(workspace()).getByRole("button", {
    name: "Подготовить получение USDC · Кастодиальный · Ethereum · Внешнее получение",
  }));
  expect(view.current().view.sheet).toMatchObject({ kind: "intent", action: "receive", route: {
    accountId: "demo-custody", assetId: "usdc", networkId: "ethereum", receiveMode: "external-address",
  } });
  const dialog = await screen.findByRole("dialog", { name: "Получить" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
  await waitFor(() => expect(within(workspace()).getByRole("button", { name: "Получить" })).toHaveFocus());
  expect(view.current().view.accountsWorkspace?.accountId).toBe("demo-custody");
  backIn(workspace());
  await waitFor(() => expect(walletCard("custodial")).toHaveFocus());
});
