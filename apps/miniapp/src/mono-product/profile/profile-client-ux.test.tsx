import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { WalletProfile } from "@wallet/core";
import { ProductProfile, ProductProfileDocumentsContent } from "../product-profile";
import type { ProductProfileDetails, ProductProfileResource } from "./types";

afterEach(cleanup);

const profile: WalletProfile = { name: "Профиль проверки", shortAddress: "demo-fixture…7", avatarUrl: null };
const data: ProductProfileDetails = {
  email: null, phone: null, languageLabel: "Русский", valuationCurrencyLabel: "USD",
  verification: "unknown", twoFactor: "unknown", addressAllowlist: "unknown", support: null, documents: [],
};
const ready = (overrides: Partial<ProductProfileDetails> = {}): ProductProfileResource => ({ status: "ready", data: { ...data, ...overrides } });
const base = { profile, balanceHidden: false, onBalanceHiddenChange: () => undefined };
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function editContacts() { click("Личные данные"); click("Изменить контакты"); }

describe("profile contact editor", () => {
  // Catches a Save that drops a contact, claims verification, or does not restore its launcher.
  it("saves the five labelled values in memory and reports only a demo-session save", () => {
    render(<ProductProfile {...base} resource={ready()} />);
    editContacts();
    expect(screen.getByLabelText("Имя")).toHaveFocus();
    change("Имя", "  Имя для проверки  ");
    change("Эл. почта", "fixture@example.test");
    change("Телефон", "+0 (000) 000-00-00");
    change("Telegram", "@fixture_profile");
    change("Дополнительная эл. почта", "extra@example.test");
    click("Сохранить");
    expect(screen.queryByRole("textbox")).toBeNull();
    const personal = screen.getByRole("region", { name: "Личные данные" });
    for (const value of ["fixture@example.test", "+0 (000) 000-00-00", "@fixture_profile", "extra@example.test"]) {
      expect(personal).toHaveTextContent(value);
    }
    expect(screen.getByText("Имя для проверки")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/только в демонстрационной сессии/i);
    expect(screen.getByRole("status")).toHaveTextContent(/не подтвержд/i);
    expect(screen.getByRole("button", { name: "Изменить контакты" })).toHaveFocus();
    click("Изменить контакты");
    expect(screen.getByLabelText("Telegram")).toHaveValue("@fixture_profile");
  });

  // Catches dismissal accidentally saving a draft or returning focus to the wrong group.
  it.each(["Отмена", "Назад в профиль", "Escape"])("discards a draft through %s and returns to the edit button", action => {
    render(<ProductProfile {...base} resource={ready({ email: "original@example.test" })} />);
    editContacts(); change("Эл. почта", "unsaved@example.test");
    if (action === "Escape") fireEvent.keyDown(screen.getByLabelText("Эл. почта"), { key: "Escape" });
    else click(action);
    expect(screen.getByRole("region", { name: "Личные данные" })).toHaveTextContent("original@example.test");
    expect(screen.queryByText("unsaved@example.test")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Изменить контакты" })).toHaveFocus();
    click("Изменить контакты");
    expect(screen.getByLabelText("Эл. почта")).toHaveValue("original@example.test");
  });

  // Catches bypassing a field's shape/length validation or losing invalid input on submit.
  it.each([
    { label: "Имя", value: "x".repeat(81) },
    { label: "Эл. почта", value: "broken-email" },
    { label: "Эл. почта", value: `${"x".repeat(250)}@example.test` },
    { label: "Телефон", value: "letters123" },
    { label: "Телефон", value: "+1234567890123456" },
    { label: "Telegram", value: "https://t.me/fixture_profile" },
    { label: "Дополнительная эл. почта", value: "extra@" },
  ])("keeps invalid $label input in the form", ({ label, value }) => {
    render(<ProductProfile {...base} resource={ready()} />);
    editContacts(); change(label, value); click("Сохранить");
    const field = screen.getByLabelText(label);
    expect(field).toHaveValue(value);
    expect(field).toHaveAttribute("aria-invalid", "true");
    const error = document.getElementById(field.getAttribute("aria-describedby")!.split(" ").at(-1)!);
    expect(error).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeInTheDocument();
  });

  // Catches multiple errors without an accessible correction path.
  it("focuses the error summary and lets its links focus the invalid fields", () => {
    render(<ProductProfile {...base} resource={ready()} />);
    editContacts(); change("Эл. почта", "broken"); change("Телефон", "bad"); click("Сохранить");
    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    fireEvent.click(within(summary).getByRole("link", { name: /Телефон/ }));
    expect(screen.getByLabelText("Телефон")).toHaveFocus();
  });
});

describe("profile risk and security entries", () => {
  // Catches hiding the risk-test entry while production content is pending.
  it("opens an honest empty risk-test screen and restores the standalone launcher", () => {
    render(<ProductProfile {...base} />);
    const launcher = screen.getByRole("button", { name: "Тест о рисках" });
    fireEvent.click(launcher);
    expect(screen.getByRole("region", { name: "Тест о рисках" })).toHaveTextContent(/вопросы.*пока.*подгот/i);
    expect(screen.queryByRole("button", { name: "Начать тест" })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    click("Назад в профиль");
    expect(launcher).toHaveFocus();
  });

  // Catches locally claiming protection or collecting secrets instead of opening useful details.
  it.each([
    { action: "Открыть проверку личности", title: "Проверка личности" },
    { action: "Настроить двухфакторную защиту", title: "Двухфакторная защита" },
    { action: "Изменить пароль", title: "Пароль" },
    { action: "Управлять разрешёнными адресами", title: "Разрешённые адреса" },
  ])("opens $title details without changing its unknown protection state", ({ action, title }) => {
    render(<ProductProfile {...base} resource={ready()} />);
    click("Безопасность"); const launcher = screen.getByRole("button", { name: action });
    fireEvent.click(launcher);
    const detail = screen.getByRole("region", { name: title });
    expect(detail).toHaveTextContent(/не подключен/i);
    expect(within(detail).getByRole("button", { name: action })).toBeDisabled();
    expect(within(detail).queryByRole("textbox")).toBeNull();
    expect(detail.querySelector("input[type='password']")).toBeNull();
    fireEvent.keyDown(within(detail).getByRole("button", { name: "Назад в профиль" }), { key: "Escape" });
    expect(launcher).toHaveFocus();
    expect(within(screen.getByRole("region", { name: "Безопасность" })).getAllByText("Данные не подключены")).toHaveLength(3);
  });

  // Catches unknown details overriding supplied security facts.
  it("keeps supplied security states after viewing a local explanation", () => {
    render(<ProductProfile {...base} resource={ready({ verification: "verified", twoFactor: "enabled" })} />);
    click("Безопасность"); click("Открыть проверку личности");
    expect(screen.getByRole("region", { name: "Проверка личности" })).toHaveTextContent("Подтверждена");
    click("Закрыть");
    const security = screen.getByRole("region", { name: "Безопасность" });
    expect(security).toHaveTextContent("Подтверждена"); expect(security).toHaveTextContent("Включена");
  });
});

describe("profile documents and portrait", () => {
  // Catches empty legal rows, made-up terms, and a broken inner Back/focus path.
  it.each(["Условия использования", "Политика конфиденциальности"])("opens the pending %s material and returns to its document row", title => {
    render(<ProductProfileDocumentsContent resource={ready()} />);
    const row = screen.getByRole("button", { name: title }); fireEvent.click(row);
    const detail = screen.getByRole("region", { name: title });
    expect(detail).toHaveTextContent(/материал.*пока.*подгот/i);
    expect(within(detail).queryByRole("link")).toBeNull();
    expect(within(detail).queryByRole("checkbox")).toBeNull();
    click("Назад к документам"); expect(row).toHaveFocus();
  });

  // Catches local placeholders replacing valid original links or reviving an unsafe link.
  it("preserves supplied HTTPS materials and substitutes pending content for a rejected policy URL", () => {
    const { container } = render(<ProductProfileDocumentsContent resource={ready({ documents: [
      { id: "terms", title: "Условия из источника", href: "https://docs.example.test/terms?version=2#text" },
      { id: "privacy", title: "Unsafe policy", href: "javascript:alert(1)" },
    ] })} />);
    expect(screen.getByRole("link", { name: "Условия из источника" })).toHaveAttribute("href", "https://docs.example.test/terms?version=2#text");
    expect(screen.queryByText("Unsafe policy")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
    click("Политика конфиденциальности");
    fireEvent.keyDown(screen.getByRole("button", { name: "Назад к документам" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Политика конфиденциальности" })).toHaveFocus();
  });

  // Catches the header-controlled portrait being ignored or a failed image hiding the fallback.
  it("uses the supplied avatar and falls back to the current name if its image fails", () => {
    const { container } = render(<ProductProfile {...base} avatarSrc="/fixture-portrait.webp" />);
    const identity = container.querySelector("[data-profile-identity]")!;
    expect(identity).not.toBeNull();
    const portrait = identity.querySelector("img")!;
    expect(portrait).toHaveAttribute("src", "/fixture-portrait.webp");
    fireEvent.error(portrait);
    expect(identity).toHaveTextContent("П");
    expect(identity.querySelector("img")).toBeNull();
    expect(identity).toHaveTextContent("demo-fixture…7");
    expect(screen.getByText("Не используется для получения средств.")).toBeInTheDocument();
  });
});
