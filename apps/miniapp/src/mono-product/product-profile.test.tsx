import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { WalletProfile } from "@wallet/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductProfileDetails, ProductProfileResource } from "./profile";
import { ProductProfile } from "./product-profile";

afterEach(cleanup);

const profile: WalletProfile = { name: "Тестовый профиль", shortAddress: "demo…7", avatarUrl: null };
const empty: ProductProfileDetails = {
  email: null, phone: null, languageLabel: "Русский", valuationCurrencyLabel: "USD",
  verification: "unknown", twoFactor: "unknown", addressAllowlist: "unknown", support: null, documents: [],
};
const ready = (data: Partial<ProductProfileDetails> = {}): ProductProfileResource => ({ status: "ready", data: { ...empty, ...data } });
const base = { profile, balanceHidden: false, onBalanceHiddenChange: () => undefined };
const section = (name: string) => screen.getByRole("region", { name });
function open(name: string) { fireEvent.click(screen.getByRole("button", { name })); }

describe("ProductProfile", () => {
  it("requests controlled theme and shared privacy changes even while server data is loading", () => {
    const privacy = vi.fn(), theme = vi.fn();
    const { rerender } = render(<ProductProfile profile={profile} balanceHidden={false} onBalanceHiddenChange={privacy}
      theme="dark" onThemeChange={theme} resource={{ status: "loading" }} />);
    const light = screen.getByRole("button", { name: "Светлая" });
    light.focus();
    fireEvent.click(light);
    expect(theme).toHaveBeenCalledExactlyOnceWith("light");
    expect(screen.getByRole("button", { name: "Тёмная" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Скрыть суммы" }));
    expect(privacy).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole("button", { name: "Скрыть суммы" })).toHaveAttribute("aria-pressed", "false");
    rerender(<ProductProfile profile={profile} balanceHidden onBalanceHiddenChange={privacy}
      theme="light" onThemeChange={theme} resource={{ status: "loading" }} />);
    expect(light).toHaveAttribute("aria-pressed", "true");
    expect(light).toHaveFocus();
    expect(screen.getByRole("button", { name: "Показать суммы" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /анимаци/i })).not.toBeInTheDocument();
  });

  it("defaults to empty demo data, opens only one disclosure and preserves section focus on prop updates", () => {
    const { rerender } = render(<ProductProfile {...base} />);
    expect(screen.getByText("Идентификатор демо-профиля")).toBeInTheDocument();
    expect(screen.getByText("demo…7")).toBeInTheDocument();
    const personal = screen.getByRole("button", { name: "Личные данные" });
    personal.focus();
    fireEvent.click(personal);
    expect(personal).toHaveFocus();
    expect(within(section("Личные данные")).getAllByText("Не указано")).toHaveLength(2);
    const settings = screen.getByRole("button", { name: "Настройки" });
    settings.focus();
    fireEvent.click(settings);
    expect(personal).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(personal.getAttribute("aria-controls")!)).toHaveAttribute("hidden");
    expect(within(section("Настройки")).getByText("Русский")).toBeInTheDocument();
    expect(within(section("Настройки")).getByText("USD")).toBeInTheDocument();
    expect(within(section("Настройки")).queryByRole("combobox")).not.toBeInTheDocument();
    rerender(<ProductProfile {...base} balanceHidden theme="light" />);
    expect(settings).toHaveFocus();
    expect(settings).toHaveAttribute("aria-expanded", "true");
    open("Безопасность");
    expect(within(section("Безопасность")).getAllByText("Данные не подключены")).toHaveLength(3);
    open("Помощь и документы");
    expect(section("Помощь и документы")).toHaveTextContent(/реальные средства/i);
    expect(within(section("Помощь и документы")).queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    { verification: "pending" as const, twoFactor: "disabled" as const, addressAllowlist: "disabled" as const,
      verificationLabel: "На проверке", twoFactorLabel: "Выключена", addressesLabel: "Выключен" },
    { verification: "verified" as const, twoFactor: "enabled" as const, addressAllowlist: "enabled" as const,
      verificationLabel: "Подтверждена", twoFactorLabel: "Включена", addressesLabel: "Включён" },
  ])("shows actual $verification/$twoFactor protection states without converting them to unknown", data => {
    render(<ProductProfile {...base} resource={ready(data)} />);
    open("Безопасность");
    const security = within(section("Безопасность"));
    expect(security.getByText(data.verificationLabel)).toBeInTheDocument();
    expect(security.getByText(data.twoFactorLabel)).toBeInTheDocument();
    expect(security.getByText(data.addressesLabel)).toBeInTheDocument();
    expect(security.queryByText("Данные не подключены")).not.toBeInTheDocument();
  });

  it("opens only supplied workflows and does not pretend contacts or protection changed", () => {
    const contacts = vi.fn(), verification = vi.fn(), twoFactor = vi.fn(), password = vi.fn(), addresses = vi.fn();
    render(<ProductProfile {...base} resource={ready({ email: "test@example.test", phone: "+7 000 000-00-00" })}
      actions={{ "edit-contacts": contacts, "manage-verification": verification, "manage-2fa": twoFactor,
        "manage-password": password, "manage-addresses": addresses }} />);
    open("Личные данные");
    expect(section("Личные данные")).toHaveTextContent("test@example.test");
    expect(section("Личные данные")).toHaveTextContent("+7 000 000-00-00");
    fireEvent.click(screen.getByRole("button", { name: "Изменить контакты" }));
    expect(contacts).toHaveBeenCalledOnce();
    expect(within(section("Личные данные")).queryByRole("textbox")).not.toBeInTheDocument();
    open("Безопасность");
    fireEvent.click(screen.getByRole("button", { name: "Открыть проверку личности" }));
    fireEvent.click(screen.getByRole("button", { name: "Настроить двухфакторную защиту" }));
    fireEvent.click(screen.getByRole("button", { name: "Изменить пароль" }));
    fireEvent.click(screen.getByRole("button", { name: "Управлять разрешёнными адресами" }));
    for (const callback of [verification, twoFactor, password, addresses]) expect(callback).toHaveBeenCalledOnce();
    expect(within(section("Безопасность")).getAllByText("Данные не подключены")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
    expect(document.querySelector("input[type='password']")).toBeNull();
  });

  it("renders only validated provided support/doc links as text with safe new-tab attributes", () => {
    const data = ready({ support: { label: "Связаться с поддержкой", href: "https://support.example.test/help" },
      documents: [
        { id: "terms", title: "Правила сервиса", href: "https://docs.example.test/terms" },
        { id: "script", title: "Unsafe", href: "javascript:alert(1)" },
        { id: "credentials", title: "Credentials", href: "https://user:secret@example.test/policy" },
      ] });
    const { container, rerender } = render(<ProductProfile {...base} resource={data} />);
    open("Помощь и документы");
    const links = within(section("Помощь и документы")).getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(["https://support.example.test/help", "https://docs.example.test/terms"]);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(container.innerHTML).not.toMatch(/javascript:|user:secret/);
    rerender(<ProductProfile {...base} resource={ready({ support: { label: "Unsafe", href: "data:text/html,secret" } })} />);
    expect(within(section("Помощь и документы")).queryByRole("link")).not.toBeInTheDocument();
    expect(section("Помощь и документы")).toHaveTextContent("Контакт поддержки пока не указан.");
  });

  it("removes stale server data on loading/error and only offers an actionable retry", () => {
    const retry = vi.fn(), privacy = vi.fn(), theme = vi.fn();
    const local = { ...base, onBalanceHiddenChange: privacy, theme: "dark" as const, onThemeChange: theme };
    const { container, rerender } = render(<ProductProfile {...local}
      resource={ready({ email: "test@example.test", verification: "verified", twoFactor: "enabled" })} onRetry={retry} />);
    open("Личные данные");
    expect(container).toHaveTextContent("test@example.test");
    rerender(<ProductProfile {...local} resource={{ status: "loading" }} onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем данные профиля");
    expect(container).not.toHaveTextContent("test@example.test");
    open("Безопасность");
    expect(container).not.toHaveTextContent("Подтверждена");
    expect(container).not.toHaveTextContent("Включена");
    rerender(<ProductProfile {...local} resource={{ status: "error", retryable: true }} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить данные профиля");
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(retry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Скрыть суммы" }));
    fireEvent.click(screen.getByRole("button", { name: "Светлая" }));
    expect(privacy).toHaveBeenCalledWith(true);
    expect(theme).toHaveBeenCalledWith("light");
    rerender(<ProductProfile {...local} resource={{ status: "error", retryable: false }} onRetry={retry} />);
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
    rerender(<ProductProfile {...local} resource={{ status: "error", retryable: true }} />);
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
  });

  it("shows read-only theme and short unsupported-action notes without fake controls", () => {
    render(<ProductProfile {...base} theme="dark" />);
    expect(screen.getByText("Тёмная")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Тёмная" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Светлая" })).not.toBeInTheDocument();
    open("Личные данные");
    expect(section("Личные данные")).toHaveTextContent("Изменение контактов здесь пока недоступно.");
    expect(screen.queryByRole("button", { name: "Изменить контакты" })).not.toBeInTheDocument();
    open("Безопасность");
    expect(section("Безопасность")).toHaveTextContent("Управление защитой здесь пока недоступно.");
    expect(screen.queryByRole("button", { name: "Изменить пароль" })).not.toBeInTheDocument();
  });
});
