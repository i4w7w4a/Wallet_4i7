import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { WalletProfile } from "@wallet/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductProfileDetails, ProductProfileResource } from "./profile";
import type { ProductHelpActions, ProductHelpTopicId } from "./product-help";
import { ProductProfile, ProductProfileHelpContent } from "./product-profile";
import { disclosureTestAnimations } from "./motion/disclosure-test-animations";

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

it.each([
  { name: "ready", resource: ready() },
  { name: "unavailable", resource: { status: "error", retryable: false } as ProductProfileResource },
])("balance dynamics Profile Settings shares the Gold host control with $name profile data", ({ resource }) => {
  function Host() {
    const [enabled, onChange] = useState(false);
    const appearanceControl = { balanceDynamics: { enabled, onChange } };
    return <ProductProfile {...base} {...appearanceControl} resource={resource}
      openSectionRequest={{ section: "settings", revision: 1 }} />;
  }
  render(<Host />);
  const toggle = within(screen.getByRole("dialog", { name: "Настройки" }))
    .getByRole("switch", { name: "Динамика баланса" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("button", { name: "Назад в профиль" }));
  expect(screen.queryByRole("switch", { name: "Динамика баланса" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Профиль" })).toHaveFocus();
});

describe("ProductProfile", () => {

  it("wallet cohesion Profile keeps personal, security and risk entries without wallet preference duplicates", () => {
    render(<ProductProfile {...base} resource={ready()} />);
    for (const label of ["Личные данные", "Безопасность", "Тест о рисках"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Настройки|Помощь и документы/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Скрыть суммы|Показать суммы/ })).toBeNull();
    open("Безопасность");
    expect(within(section("Безопасность")).getAllByText("Данные не подключены")).toHaveLength(3);
  });

  it("wallet cohesion legacy Help requests enter the compact shared detail and Back consumes the revision", () => {
    const request = { section: "help", revision: 7 } as const;
    const { rerender } = render(<ProductProfile {...base} resource={ready()} openSectionRequest={request} />);
    const detail = screen.getByRole("dialog", { name: "Помощь" });
    expect(within(detail).getByRole("button", { name: "Получить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Назад в профиль" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Назад в профиль" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Профиль" })).toHaveFocus();
    rerender(<ProductProfile {...base} resource={ready()} openSectionRequest={request} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  // Catches artwork becoming a separate control, toggling the wrong group or invoking a profile command.
  it.each([
    { group: "personal", label: "Личные данные" },
    { group: "security", label: "Безопасность" },
  ])("uses decorative $group artwork as part of its single disclosure button", ({ label }) => {
    const commands: string[] = [];
    render(<ProductProfile {...base} resource={ready()} theme="dark"
      onBalanceHiddenChange={() => { commands.push("privacy"); }}
      onThemeChange={() => { commands.push("theme"); }}
      actions={{
        "edit-contacts": () => { commands.push("contacts"); },
        "manage-verification": () => { commands.push("verification"); },
        "manage-2fa": () => { commands.push("two-factor"); },
        "manage-password": () => { commands.push("password"); },
        "manage-addresses": () => { commands.push("addresses"); },
      }} />);
    const trigger = screen.getByRole("button", { name: label });
    const icon = trigger.querySelector("svg[data-profile-section-icon]");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(trigger.querySelectorAll("svg")).toHaveLength(2);
    expect(trigger.querySelectorAll("[tabindex], button, a, input, select, textarea, [role='button']")).toHaveLength(0);
    expect(within(trigger.closest("h2")!).getAllByRole("button", { hidden: true })).toEqual([trigger]);
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
    const description = document.getElementById(trigger.getAttribute("aria-describedby")!);
    expect(description).toBeInTheDocument();
    expect(panel).toHaveAttribute("hidden");

    trigger.focus();
    fireEvent.click(icon!);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(section(label)).toBe(panel);
    expect(screen.getAllByRole("region", { name: /^(Личные данные|Настройки|Безопасность|Помощь и документы)$/ })).toEqual([panel]);
    expect(screen.getAllByRole("button", { expanded: true })).toEqual([trigger]);
    if (label === "Безопасность") {
      expect(within(section(label)).getAllByText("Данные не подключены")).toHaveLength(3);
    }

    fireEvent.click(icon!.querySelector("path, circle, rect")!);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("hidden");
    expect(screen.queryByRole("region", { name: label })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Скрыть суммы" })).toBeNull();
    expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
    expect(commands).toEqual([]);
  });

  it("keeps loading Profile personal/security without invoking removed preference commands", () => {
    const privacy = vi.fn(), theme = vi.fn();
    render(<ProductProfile {...base} onBalanceHiddenChange={privacy} onThemeChange={theme} resource={{ status: "loading" }} />);
    expect(screen.queryByRole("button", { name: /Скрыть суммы|Показать суммы|Настройки/ })).toBeNull();
    open("Безопасность");
    expect(section("Безопасность")).toHaveTextContent("Загружаем данные");
    expect(privacy).not.toHaveBeenCalled(); expect(theme).not.toHaveBeenCalled();
  });
  it("defaults to unknown personal/security data and preserves one disclosure and focus on prop updates", () => {
    const { rerender } = render(<ProductProfile {...base} />);
    const personal = screen.getByRole("button", { name: "Личные данные" });
    personal.focus(); fireEvent.click(personal);
    expect(within(section("Личные данные")).getAllByText("Не указано")).toHaveLength(4);
    const security = screen.getByRole("button", { name: "Безопасность" });
    security.focus(); fireEvent.click(security);
    expect(personal).toHaveAttribute("aria-expanded", "false");
    expect(within(section("Безопасность")).getAllByText("Данные не подключены")).toHaveLength(3);
    rerender(<ProductProfile {...base} balanceHidden theme="light" />);
    expect(security).toHaveFocus(); expect(security).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("region", { name: /^(Личные данные|Безопасность)$/ })).toHaveLength(1);
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
    const { container, rerender } = render(<ProductProfileHelpContent resource={data} />);
    const links = screen.getAllByRole("link");
    expect(links.map(link => link.getAttribute("href"))).toEqual(["https://support.example.test/help", "https://docs.example.test/terms"]);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(container.innerHTML).not.toMatch(/javascript:|user:secret/);
    rerender(<ProductProfileHelpContent resource={ready({ support: { label: "Unsafe", href: "data:text/html,secret" } })} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Контакт поддержки пока не указан.")).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Скрыть суммы" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Тема оформления" })).toBeNull();
    expect(privacy).not.toHaveBeenCalled();
    expect(theme).not.toHaveBeenCalled();
    rerender(<ProductProfile {...local} resource={{ status: "error", retryable: false }} onRetry={retry} />);
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
    rerender(<ProductProfile {...local} resource={{ status: "error", retryable: true }} />);
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
  });

  it("omits the theme placeholder while local contacts and security details remain available", () => {
    render(<ProductProfile {...base} theme="dark" />);
    expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Тёмная" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Светлая" })).not.toBeInTheDocument();
    open("Личные данные");
    open("Изменить контакты");
    expect(screen.getByRole("textbox", { name: "Имя" })).toBeInTheDocument();
    open("Отмена");
    open("Безопасность");
    open("Изменить пароль");
    expect(section("Пароль")).toHaveTextContent("Управление не подключено");
    expect(screen.getByRole("button", { name: "Изменить пароль" })).toBeDisabled();
    expect(document.querySelector("input[type='password']")).toBeNull();
  });

  it("menu support documents target focuses the exact service block in the existing Help disclosure", () => {
    render(<ProductProfile {...base} resource={ready({ documents: [
      { id: "service", title: "Материал сервиса", href: "https://docs.example.test/service" },
    ] })} openSectionRequest={{ section: "help", target: "documents", revision: 1 }} />);
    const documents = screen.getByRole("region", { name: "Документы сервиса" });
    expect(screen.getByRole("button", { name: "Назад в профиль" })).toHaveFocus();
    expect(within(documents).getByRole("link", { name: "Материал сервиса" })).toHaveAttribute("href", "https://docs.example.test/service");
    expect(within(documents).queryByRole("button", { name: "Получить" })).toBeNull();
  });

  it.each([
    { resource: { status: "loading" } as ProductProfileResource, statusText: "Загружаем данные" },
    { resource: { status: "error", retryable: false } as ProductProfileResource, statusText: "Данные профиля пока недоступны" },
  ])("menu support service documents never report an empty list before resource $resource.status is ready", ({ resource, statusText }) => {
    render(<ProductProfile {...base} resource={resource} openSectionRequest={{ section: "help", target: "documents", revision: 1 }} />);
    const documents = screen.getByRole("region", { name: "Документы сервиса" });
    expect(documents).toHaveTextContent(statusText);
    expect(documents).not.toHaveTextContent("Документы сервиса пока не подключены");
    expect(screen.getByRole("button", { name: "Назад в профиль" })).toHaveFocus();
  });
});

describe("ProductProfile help handoff", () => {
  // Catches a default help UI that offers actions without host eligibility/callbacks.
  it("hosts four read-only topics in the existing help group when helpActions is omitted", () => {
    render(<ProductProfileHelpContent resource={ready()} />);
    const help = within(document.body);
    expect(help.getAllByRole("heading", { level: 3, name: /^(Получить|Отправить|Купить|Обменять)$/ })).toHaveLength(4);
    expect(help.getAllByText(/это демо.*не перемещают реальные средства/i)).toHaveLength(1);
    open("Отправить");
    const send = within(help.getByRole("region", { name: "Отправить" }));
    expect(send.getByText("Открытие этой операции сейчас недоступно.")).toBeInTheDocument();
    expect(send.queryByRole("button")).not.toBeInTheDocument();
    expect(help.getByText("Контакт поддержки пока не указан.")).toBeInTheDocument();
    expect(help.getByText("Документы сервиса пока не подключены")).toBeInTheDocument();
    expect(help.queryByRole("link")).not.toBeInTheDocument();
  });

  // Catches helpActions being ignored/remapped or disclosure toggles opening an operation.
  it("passes only supplied opening callbacks through the existing profile help group", () => {
    const openings: ProductHelpTopicId[] = [], payloads: unknown[][] = [];
    const record = (topic: ProductHelpTopicId) => (...args: unknown[]) => { openings.push(topic); payloads.push(args); };
    const helpActions: ProductHelpActions = {
      receive: { allowed: true, onOpen: record("receive") },
      send: { allowed: true, onOpen: record("send") },
      buy: { allowed: true, onOpen: record("buy") },
      swap: { allowed: true, onOpen: record("swap") },
    };
    render(<ProductProfileHelpContent resource={ready()} helpActions={helpActions} />);
    expect(screen.getByRole("button", { name: "Получить" })).toHaveAttribute("aria-expanded", "false");
    expect(openings).toEqual([]);
    const topics = [
      { id: "receive", title: "Получить", cta: "Открыть получение" },
      { id: "send", title: "Отправить", cta: "Открыть отправку" },
      { id: "buy", title: "Купить", cta: "Открыть покупку" },
      { id: "swap", title: "Обменять", cta: "Открыть обмен" },
    ] as const;
    for (const [index, topic] of topics.entries()) {
      open(topic.title);
      expect(openings).toHaveLength(index);
      const help = within(document.body);
      expect(help.getAllByRole("region", { name: /^(Получить|Отправить|Купить|Обменять)$/ })).toHaveLength(1);
      fireEvent.click(help.getByRole("button", { name: topic.cta }), { detail: 0 });
      expect(openings.at(-1)).toBe(topic.id);
    }
    expect(openings).toEqual(["receive", "send", "buy", "swap"]);
    expect(payloads).toEqual([[], [], [], []]);
  });

  // Catches inner state being reset by profile updates/remounts or request focus being stolen on the same revision.
  it("shared Help preserves its selected topic while new action guards remove an unavailable CTA", () => {
    const openings: string[] = [];
    const resource = ready();
    const { rerender } = render(<ProductProfileHelpContent resource={resource}
      helpActions={{ send: { allowed: true, onOpen: () => { openings.push("send"); } } }} />);
    const send = screen.getByRole("button", { name: "Отправить" });
    send.focus(); fireEvent.click(send);
    expect(send).toHaveAttribute("aria-expanded", "true");
    rerender(<ProductProfileHelpContent resource={{ status: "loading" }}
      helpActions={{ send: { allowed: false, reason: "Завершите текущий сценарий." } }} />);
    expect(send).toHaveFocus(); expect(section("Отправить")).toHaveTextContent("Завершите текущий сценарий.");
    expect(screen.queryByRole("button", { name: "Открыть отправку" })).toBeNull();
    expect(openings).toEqual([]);
  });});

describe("ProductProfile disclosure motion", () => {
  let animations: ReturnType<typeof disclosureTestAnimations>;
  beforeEach(() => { animations = disclosureTestAnimations(); });
  afterEach(() => animations.restore());
  const motionProfile = (resource = ready({ email: "fresh@example.test" }), mode = "ready") =>
    <div data-mono-motion={mode}><ProductProfile {...base} resource={resource} actions={{ "edit-contacts": () => undefined }} /></div>;

  // Catches nested help CTAs remaining active or losing the correct outer launcher on profile-group close.
  it("legacy compact Help close returns focus to Profile and removes its nested action immediately", () => {
    const openings: string[] = [];
    render(<div data-mono-motion="ready"><ProductProfile {...base} resource={ready()}
      openSectionRequest={{ section: "help", revision: 1 }}
      helpActions={{ receive: { allowed: true, onOpen: () => { openings.push("receive"); } } }} /></div>);
    open("Получить");
    const cta = screen.getByRole("button", { name: "Открыть получение" });
    cta.focus(); fireEvent.click(screen.getByRole("button", { name: "Назад в профиль" }));
    expect(screen.getByRole("heading", { name: "Профиль" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Открыть получение" })).toBeNull();
    fireEvent.click(cta); expect(openings).toEqual([]);
  });
  it("returns focus before inert, excludes outgoing actions and unmounts them only after close", async () => {
    render(motionProfile());
    const personal = screen.getByRole("button", { name: "Личные данные" });
    personal.focus();
    fireEvent.click(personal);
    expect(personal).toHaveFocus();
    const panel = section("Личные данные");
    const edit = screen.getByRole("button", { name: "Изменить контакты" });
    edit.focus();
    const toggleAttribute = panel.toggleAttribute.bind(panel);
    vi.spyOn(panel, "toggleAttribute").mockImplementation((name, force) => {
      if (name === "inert" && force) expect(personal).toHaveFocus();
      return toggleAttribute(name, force);
    });
    fireEvent.click(personal);
    expect(personal).toHaveFocus();
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).toContainElement(edit);
    expect(screen.queryByRole("button", { name: "Изменить контакты" })).not.toBeInTheDocument();
    await animations.finish(panel);
    expect(panel).toHaveAttribute("hidden");
    expect(edit).not.toBeInTheDocument();
    expect(panel).not.toHaveTextContent("fresh@example.test");
  });

  it("reverses rapid toggles, ignores old completion and exposes at most one group", async () => {
    render(motionProfile());
    const personal = screen.getByRole("button", { name: "Личные данные" });
    fireEvent.click(personal);
    const panel = section("Личные данные");
    fireEvent.click(personal);
    fireEvent.click(personal);
    await animations.finish(panel, 0);
    expect(panel).not.toHaveAttribute("inert");
    expect(panel).not.toHaveAttribute("aria-hidden");
    expect(section("Личные данные")).toBe(panel);
    open("Безопасность");
    expect(screen.getAllByRole("region", { name: /^(Личные данные|Настройки|Безопасность|Помощь и документы)$/ })).toHaveLength(1);
    expect(personal).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("inert");
    expect(document.getElementById(personal.getAttribute("aria-controls")!)).toBe(panel);
    await animations.finish(panel);
    expect(panel).toHaveAttribute("hidden");
  });

  it.each(["loading", "error"] as const)("removes contacts, protection data and actions during exit when resource becomes %s", status => {
    const supplied = ready({ email: "fresh@example.test", verification: "verified", twoFactor: "enabled" });
    const { container, rerender } = render(motionProfile(supplied));
    open("Личные данные");
    const personal = section("Личные данные");
    open("Безопасность");
    const security = section("Безопасность");
    open("Безопасность");
    expect(personal).toHaveTextContent("fresh@example.test");
    expect(security).toHaveTextContent("Подтверждена");
    rerender(motionProfile(status === "loading" ? { status } : { status, retryable: false }));
    expect(personal).toHaveAttribute("inert");
    expect(security).toHaveAttribute("inert");
    expect(container).not.toHaveTextContent("fresh@example.test");
    expect(container).not.toHaveTextContent("Подтверждена");
    expect(container).not.toHaveTextContent("Включена");
    expect(container.querySelectorAll("[inert] button")).toHaveLength(0);
  });

  it("uses immediate final states for static scenes and system reduced motion", async () => {
    const { rerender } = render(motionProfile(ready(), "static"));
    open("Личные данные");
    const personal = section("Личные данные");
    open("Личные данные");
    expect(personal).toHaveAttribute("hidden");
    expect(personal.querySelector("dl")).toBeNull();
    expect(animations.requests).toHaveLength(0);
    rerender(motionProfile());
    open("Личные данные");
    open("Личные данные");
    expect(personal).not.toHaveAttribute("hidden");
    await animations.reduceMotion();
    expect(personal).toHaveAttribute("hidden");
    expect(personal.querySelector("dl")).toBeNull();
    open("Личные данные");
    open("Личные данные");
    expect(personal).toHaveAttribute("hidden");
  });
});
