import "@testing-library/jest-dom/vitest";
import { useMemo, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository, type ProductSnapshot } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MONO_PRODUCT_DEMO_ADAPTER } from "../mono-product/demo-adapter";
import { AssetsWalletSelection } from "../mono-product/assets-wallet-selection";
import { selectAccountGroups } from "../mono-product/home-pins";
import { useMonoProductController, type MonoProductController } from "../mono-product/product-controller";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { MonoScene, type MonoSection } from "./mono-scene";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function host(initial: Readonly<ProductSnapshot> = MONO_PRODUCT_DEMO_ADAPTER.snapshot) {
  const wallet = await new MockWalletRepository().getSnapshot();
  const appearance = createMonoAppearanceEnvelope("ledger").appearance;
  let controller!: MonoProductController;
  function Host({ source, hostActive = true }: { source: Readonly<ProductSnapshot>; hostActive?: boolean }) {
    const [section, setSection] = useState<MonoSection>("overview");
    const adapter = useMemo(() => ({ ...MONO_PRODUCT_DEMO_ADAPTER, snapshot: source }), [source]);
    controller = useMonoProductController(adapter, { initialHidden: false });
    return <div data-material-scrollport><MonoScene snapshot={wallet} appearance={appearance} product={controller}
      homeComposition="compact" historyPresentation="compact" assetsPresentation="wallet-selection" effectsDisabled active={hostActive}
      session={{ section, onSectionChange: setSection, period: "1D", onPeriodChange() {},
        balanceHidden: controller.view.balanceHidden, onBalanceHiddenChange: controller.commands.setBalanceHidden }} /></div>;
  }
  const view = render(<Host source={initial} />);
  let currentSource = initial;
  return { ...view, current: () => controller, update: (source: Readonly<ProductSnapshot>) => {
    currentSource = source; view.rerender(<Host source={source} />);
  }, setActive: (hostActive: boolean) => view.rerender(<Host source={currentSource} hostActive={hostActive} />) };
}

function navigate(name: "Обзор" | "Активы") {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Разделы кошелька" })).getByRole("button", { name }));
}
function card(kind: "custodial" | "depositary" | "private") {
  const result = document.querySelector<HTMLButtonElement>(`[data-r1-wallet-kind="${kind}"]`);
  expect(result).toBeVisible();
  return result!;
}
function accountWorkspace() {
  const result = document.querySelector<HTMLElement>("[data-mono-product-accounts-workspace]");
  expect(result).toBeVisible();
  return result!;
}
function back() { fireEvent.click(within(accountWorkspace()).getByRole("button", { name: /^Назад/ })); }

it("begins Assets with the three cards, with only a visually hidden heading and no aggregate entry", async () => {
  const view = await host();
  navigate("Активы");
  const selection = view.container.querySelector<HTMLElement>("[data-r1-wallet-selection]")!;
  expect(selection).toBeVisible();
  expect(screen.queryByText("Портфель · Демо")).not.toBeInTheDocument();
  expect(within(selection).queryByRole("button", { name: "Общий обзор" })).not.toBeInTheDocument();
  const title = within(selection).getByRole("heading", { name: "Активы" });
  expect(title.className).toMatch(/visuallyHidden/);
  expect([...selection.querySelectorAll("[data-r1-wallet-kind]")].map(node => node.getAttribute("data-r1-wallet-kind")))
    .toEqual(["custodial", "depositary", "private"]);
  expect(card("private")).toBeDisabled();
  expect(card("private")).toHaveTextContent("Пока недоступно");
  expect(card("private")).not.toHaveTextContent(/Оценка в USD|\$/);
});

it("uses the scoped per-account values on each card and in the corresponding details", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  await host(source);
  navigate("Активы");
  for (const [kind, id, expected] of [["custodial", "demo-custody", "12 840,75 $"],
    ["depositary", "demo-depositary", "0,00 $"]] as const) {
    expect(card(kind)).toHaveTextContent("Оценка в USD");
    expect(card(kind)).toHaveTextContent(expected);
    fireEvent.click(card(kind));
    expect(accountWorkspace()).toHaveAttribute("data-mono-product-accounts-workspace", id);
    expect(accountWorkspace()).toHaveTextContent(expected);
    back();
    await waitFor(() => expect(card(kind)).toHaveFocus());
  }
});

it("sums distinct accounts once for a type while retaining the explicit account list", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const first = source.accounts.find(account => account.id === "demo-custody")!;
  const placement = source.holdings.find(holding => holding.accountId === first.id)!;
  const second = { ...first, id: "other-custody", label: "Второй кастодиальный" };
  const custom: ProductSnapshot = { ...source, accounts: [...source.accounts, second],
    holdings: [...source.holdings, { ...placement, id: "other-placement", accountId: second.id, fiatMinor: 12345 }] };
  const expected = "12 964,20 $";
  const view = await host(custom);
  navigate("Активы");
  expect(card("custodial")).toHaveTextContent(expected);
  fireEvent.click(card("custodial"));
  expect(view.current().view.accountsWorkspace?.accountId).toBeNull();
  expect(within(accountWorkspace()).getByRole("button", { name: "Открыть счёт: Второй кастодиальный" })).toBeVisible();
});

it("does not present a numeric group estimate for duplicate account or holding identities", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const duplicateAccount = source.accounts.find(account => account.id === "demo-custody")!;
  const view = await host({ ...source, accounts: [...source.accounts, { ...duplicateAccount }] });
  navigate("Активы");
  expect(card("custodial")).toBeDisabled();
  expect(card("custodial")).toHaveTextContent("Пока недоступно");
  const duplicateHolding = source.holdings.find(holding => holding.accountId === "demo-custody")!;
  view.update({ ...source, holdings: [...source.holdings, { ...duplicateHolding }] });
  expect(card("custodial")).toBeEnabled();
  expect(card("custodial")).toHaveTextContent("Нет данных");
});

it("keeps invalid or unavailable group values unknown instead of coercing them to zero", () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const holding = source.holdings[0]!;
  expect(selectAccountGroups({ ...source, holdings: [{ ...holding, fiatMinor: Number.NaN }] })
    .find(group => group.kind === "custodial")?.estimateMinor).toBeNull();
  expect(selectAccountGroups({ ...source, accounts: source.accounts.map(account => account.kind === "custodial"
    ? { ...account, status: "unavailable" as const } : account) })
    .find(group => group.kind === "custodial")?.estimateMinor).toBeNull();
});

it("shows unknown instead of a partial or ambiguous amount for an available group", () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const first = source.accounts.find(account => account.id === "demo-custody")!;
  const holding = source.holdings.find(item => item.accountId === first.id)!;
  const other = { ...first, id: "unavailable-custody", status: "unavailable" as const };
  const scenarios: ProductSnapshot[] = [
    { ...source, accounts: [...source.accounts, other] },
    { ...source, holdings: source.holdings.map(item => item.id === holding.id ? { ...item, fiatMinor: NaN } : item) },
    { ...source, holdings: [...source.holdings, { ...holding, accountId: "demo-depositary" }] },
  ];
  const component = (snapshot: ProductSnapshot) => <AssetsWalletSelection snapshot={snapshot} balanceHidden={false}
    canOpen={{ custodial: true, depositary: true }} onOpenWallet={() => {}} />;
  const view = render(component(scenarios[0]!));
  for (const snapshot of scenarios) {
    view.rerender(component(snapshot));
    expect(card("custodial")).toHaveTextContent("Нет данных");
    expect(card("custodial")).not.toHaveTextContent("0,00 $");
  }
});

it("updates the real scoped snapshot while preserving the balance privacy control", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const view = await host(source);
  navigate("Активы");
  const before = "12 840,75 $";
  expect(card("custodial")).toHaveTextContent(before);
  act(() => view.current().commands.setBalanceHidden(true));
  expect(card("custodial")).not.toHaveTextContent(before);
  expect(card("custodial")).toHaveTextContent(/•/);
  const changed = { ...source, holdings: source.holdings.map((holding, index) => index === 0
    ? { ...holding, fiatMinor: holding.fiatMinor + 10000 } : holding) };
  view.update(changed);
  const after = "12 940,75 $";
  expect(card("custodial")).not.toHaveTextContent(after);
  act(() => view.current().commands.setBalanceHidden(false));
  expect(card("custodial")).toHaveTextContent(after);
  expect(card("custodial")).not.toHaveTextContent(before);
});

it("opens depositary at the top and restores catalogue position and focus on Back", async () => {
  const view = await host();
  navigate("Активы");
  const scrollport = view.container.querySelector<HTMLElement>("[data-material-scrollport]")!;
  scrollport.scrollTop = 180;
  fireEvent.click(card("depositary"));
  expect(view.current().view.accountsWorkspace?.accountId).toBe("demo-depositary");
  expect(scrollport.scrollTop).toBe(0);
  expect(within(accountWorkspace()).getByRole("heading", { name: "Депозитарный" })).toBeVisible();
  back();
  await waitFor(() => expect(card("depositary")).toHaveFocus());
  expect(scrollport.scrollTop).toBe(180);
});

it("restores catalogue position if the source identity closes an inspected account", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const view = await host(source);
  navigate("Активы");
  const scrollport = view.container.querySelector<HTMLElement>("[data-material-scrollport]")!;
  scrollport.scrollTop = 160;
  fireEvent.click(card("depositary"));
  expect(scrollport.scrollTop).toBe(0);
  view.update({ ...source, accounts: [...source.accounts] });
  await waitFor(() => expect(view.current().view.accountsWorkspace).toBeNull());
  await waitFor(() => expect(card("depositary")).toHaveFocus());
  expect(scrollport.scrollTop).toBe(160);
});

it("defers Back focus and catalogue scroll restoration until the host is active", async () => {
  const view = await host();
  navigate("Активы");
  const scrollport = view.container.querySelector<HTMLElement>("[data-material-scrollport]")!;
  scrollport.scrollTop = 140;
  fireEvent.click(card("depositary"));
  expect(scrollport.scrollTop).toBe(0);
  act(() => { back(); view.setActive(false); });
  expect(scrollport.scrollTop).toBe(0);
  view.setActive(true);
  await waitFor(() => expect(card("depositary")).toHaveFocus());
  expect(scrollport.scrollTop).toBe(140);
});

it("defers the account entrance scroll reset until the host is active", async () => {
  const view = await host();
  navigate("Активы");
  const scrollport = view.container.querySelector<HTMLElement>("[data-material-scrollport]")!;
  scrollport.scrollTop = 150;
  act(() => { fireEvent.click(card("depositary")); view.setActive(false); });
  expect(scrollport.scrollTop).toBe(150);
  view.setActive(true);
  await waitFor(() => expect(within(accountWorkspace()).getByRole("heading", { name: "Депозитарный" })).toHaveFocus());
  expect(scrollport.scrollTop).toBe(0);
});

it("keeps Overview balance and actions while removing the empty decorative panel", async () => {
  const view = await host();
  expect(screen.getByRole("heading", { name: "Общий баланс" })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Действия" })).getAllByRole("button")).toHaveLength(4);
  expect(view.container.querySelector(".mono-compact-home-art")).not.toBeInTheDocument();
  navigate("Активы");
  navigate("Обзор");
  expect(screen.getByRole("heading", { name: "Общий баланс" })).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Действия" })).getAllByRole("button")).toHaveLength(4);
});

it("offers available Overview actions equally and disables a route that does not exist", async () => {
  const source = MONO_PRODUCT_DEMO_ADAPTER.snapshot;
  const view = await host(source);
  const actions = within(screen.getByRole("region", { name: "Действия" }));
  const labels = ["Отправить", "Получить", "Обмен", "Купить"];
  expect(actions.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(labels);
  for (const label of labels) {
    expect(actions.getByRole("button", { name: label })).toBeEnabled();
    expect(actions.getByRole("button", { name: label })).toHaveAttribute("data-product-primary", "true");
  }
  view.update({ ...source, accounts: source.accounts.map(account => ({ ...account,
    capabilities: account.capabilities.filter(capability => capability.action !== "swap") })) });
  expect(actions.getByRole("button", { name: "Обмен" })).toBeDisabled();
  expect(actions.getByRole("button", { name: "Купить" })).toBeEnabled();
  fireEvent.click(actions.getByRole("button", { name: "Обмен" }));
  expect(view.current().view.sheet).toBeNull();
});
