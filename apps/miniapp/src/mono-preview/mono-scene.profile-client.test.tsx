import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockWalletRepository } from "@wallet/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MonoScene } from "./mono-scene";
import { MonoProductScene } from "./mono-product-scene";
import { MONO_GOLD_ENVELOPE } from "./mono-gold-appearance";
import { createDemoProfileResource } from "../mono-product/profile";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduced-motion"), media: query,
    addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mono-preview")) return new DOMRect(0, 0, 390, 900);
    if (this.classList.contains("mono-nav")) return new DOMRect(0, 700, 390, 68);
    if (this.hasAttribute("data-profile-quick-menu-trigger")) return new DOMRect(300, 710, 68, 48);
    return new DOMRect();
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function renderProfileHost(product = true, avatarUrl: string | null = " /host-profile.webp ") {
  const source = await new MockWalletRepository().getSnapshot();
  const snapshot = { ...source, profile: { ...source.profile, name: "Исходное имя", avatarUrl } };
  const resource = createDemoProfileResource();
  const props = { snapshot, profileResource: resource, appearance: MONO_GOLD_ENVELOPE.appearance,
    presentation: "gold" as const, effectsDisabled: true };
  const view = render(<div data-material-scrollport>{product
    ? <MonoProductScene {...props} material={{ background: null, buttons: null }} themePreference="fixed" />
    : <MonoScene {...props} />}</div>);
  await waitFor(() => expect(view.container.querySelector("[data-mono-preview]")).toBeInTheDocument());
  return { ...view, snapshot, resource, scene: view.container.querySelector<HTMLElement>("[data-mono-preview]")!,
    scrollport: view.container.querySelector<HTMLElement>("[data-material-scrollport]")! };
}

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

function saveContacts() {
  click("Личные данные"); click("Изменить контакты");
  for (const [label, value] of [
    ["Имя", "Марина Проверочная"], ["Эл. почта", "saved@example.test"],
    ["Телефон", "+1234567890"], ["Telegram", "@saved_profile"],
    ["Дополнительная эл. почта", "extra@example.test"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  click("Сохранить");
  expect(screen.getByRole("button", { name: "Изменить контакты" })).toHaveFocus();
}

function expectSavedProfile(scene: HTMLElement) {
  expect(scene.querySelector("[data-profile-identity]")).toHaveTextContent("Марина Проверочная");
  expect(screen.getByRole("button", { name: "Закрыть профиль" })).toHaveTextContent("М");
  expect(scene.querySelector("header img")).toHaveAttribute("src", "/host-profile.webp");
  expect(scene.querySelector("[data-profile-identity] img")).toHaveAttribute("src", "/host-profile.webp");
  click("Личные данные");
  const personal = screen.getByRole("region", { name: "Личные данные" });
  for (const value of ["saved@example.test", "+1234567890", "@saved_profile", "extra@example.test"])
    expect(personal).toHaveTextContent(value);
}

// Catches a conditional/local-only session, resolved edits fed back as source, or divergent header identity.
it("keeps saved Profile identity through Gold Overview and exact Accounts/Asset avatar returns", async () => {
  const view = await renderProfileHost();
  const openAccounts = () => {
    click("Меню");
    fireEvent.click(within(screen.getByRole("dialog", { name: "Меню" })).getByRole("button", { name: "Мои счета" }));
  };
  const choose = (label: string) => {
    openAccounts(); click(`Открыть счёт: ${label}`); click("Выбрать счёт в кошельке"); click("Обзор");
  };
  const selected = (label: string) => {
    openAccounts(); click(`Открыть счёт: ${label}`);
    expect(within(screen.getByRole("region", { name: label })).getByText("Выбран в кошельке")).toBeVisible();
    click("Назад к счетам"); click("Назад в кошелёк");
  };
  choose("Хранилище");
  click("Открыть профиль"); saveContacts();
  click("Обзор");
  expect(screen.queryByRole("heading", { name: "Профиль" })).toBeNull();
  selected("Хранилище");
  click("Открыть профиль"); expectSavedProfile(view.scene);
  click("Изменить контакты");
  expect(screen.getByLabelText("Имя")).toHaveValue("Марина Проверочная");
  expect(screen.getByLabelText("Telegram")).toHaveValue("@saved_profile");
  click("Отмена"); click("Закрыть профиль");
  expect(screen.getByRole("button", { name: "Открыть профиль" })).toHaveFocus();
  selected("Хранилище");

  openAccounts(); click("Открыть счёт: Основной");
  const account = screen.getByRole("region", { name: "Основной" });
  const holding = account.querySelector<HTMLButtonElement>('[data-product-holding-id="demo-usdc-eth"]')!;
  fireEvent.click(holding); view.scrollport.scrollTop = 129;
  click("Открыть профиль"); expectSavedProfile(view.scene);
  expect(screen.queryByRole("region", { name: "Основной" })).toBeNull();
  click("Закрыть профиль");
  expect(screen.getByRole("region", { name: "Основной" })).toBe(account);
  expect(holding).toHaveAttribute("aria-expanded", "true");
  expect(view.scrollport.scrollTop).toBe(129);
  expect(screen.getByRole("button", { name: "Открыть профиль" })).toHaveFocus();
  click("Назад к счетам"); click("Назад в кошелёк"); selected("Хранилище");

  choose("Основной"); click("Активы");
  fireEvent.click(view.scene.querySelector('[data-mono-product-asset-trigger="usdc"]')!);
  const asset = view.scene.querySelector('[data-mono-product-asset-workspace="usdc"]');
  const placement = screen.getByRole("radio", { name: "Выбрать размещение: Основной · Ethereum" });
  fireEvent.click(placement); view.scrollport.scrollTop = 84;
  click("Открыть профиль"); expectSavedProfile(view.scene);
  click("Закрыть профиль");
  expect(view.scene.querySelector('[data-mono-product-asset-workspace="usdc"]')).toBe(asset);
  expect(placement).toBeChecked(); expect(view.scrollport.scrollTop).toBe(84);
  expect(screen.getByRole("button", { name: "Открыть профиль" })).toHaveFocus();
  expect(view.scene).toHaveAttribute("data-mono-section", "assets");
  click("Назад к активам"); click("Обзор"); selected("Основной");
  expect(view.snapshot.profile.name).toBe("Исходное имя");
  expect(view.snapshot.profile.avatarUrl).toBe(" /host-profile.webp ");
  expect(view.resource).toEqual(createDemoProfileResource());
});

// Catches leaving the non-product Profile branch on its own unmounting session.
it("keeps the non-product host's saved contacts and supplied portrait across Overview", async () => {
  const view = await renderProfileHost(false);
  click("Открыть профиль"); saveContacts(); click("Обзор");
  click("Открыть профиль"); expectSavedProfile(view.scene);
});

// Catches applying the fictional portrait beyond the existing two-demo-port eligibility guard.
it.each([true, false])("shares the eligible portrait in header and Profile for product=%s", async product => {
  const view = await renderProfileHost(product, null);
  click("Открыть профиль");
  const header = view.scene.querySelector("header img");
  const profile = view.scene.querySelector("[data-profile-identity] img");
  if (product) {
    expect(header).toHaveAttribute("src", "/media/mono/profile/demo-portrait-v1.webp");
    expect(profile).toHaveAttribute("src", "/media/mono/profile/demo-portrait-v1.webp");
  } else {
    expect(header).toBeNull(); expect(profile).toBeNull();
  }
});
