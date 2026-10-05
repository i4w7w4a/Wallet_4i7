import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { WalletProfile } from "@wallet/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductProfileDetails, ProductProfileResource } from "./profile";
import type { ProductHelpActions, ProductHelpTopicId } from "./product-help";
import { ProductProfile } from "./product-profile";
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

describe("ProductProfile", () => {
  it("hides theme choice while shared privacy remains controlled during server loading", () => {
    const privacy = vi.fn(), theme = vi.fn();
    const { rerender } = render(<ProductProfile profile={profile} balanceHidden={false} onBalanceHiddenChange={privacy}
      theme="dark" onThemeChange={theme} resource={{ status: "loading" }} />);
    expect(screen.queryByRole("group", { name: "Тема оформления" })).toBeNull();
    expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
    const toggle = screen.getByRole("button", { name: "Скрыть суммы" });
    toggle.focus();
    fireEvent.click(toggle);
    expect(privacy).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole("button", { name: "Скрыть суммы" })).toHaveAttribute("aria-pressed", "false");
    rerender(<ProductProfile profile={profile} balanceHidden onBalanceHiddenChange={privacy}
      theme="light" onThemeChange={theme} resource={{ status: "loading" }} />);
    expect(toggle).toHaveFocus();
    expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
    expect(theme).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("group", { name: "Тема оформления" })).toBeNull();
    expect(privacy).toHaveBeenCalledWith(true);
    expect(theme).not.toHaveBeenCalled();
    rerender(<ProductProfile {...local} resource={{ status: "error", retryable: false }} onRetry={retry} />);
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
    rerender(<ProductProfile {...local} resource={{ status: "error", retryable: true }} />);
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
  });

  it("omits the theme placeholder and shows short unsupported-action notes without fake controls", () => {
    render(<ProductProfile {...base} theme="dark" />);
    expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
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

describe("ProductProfile help handoff", () => {
  // Catches a default help UI that offers actions without host eligibility/callbacks.
  it("hosts four read-only topics in the existing help group when helpActions is omitted", () => {
    render(<ProductProfile {...base} />);
    open("Помощь и документы");
    const help = within(section("Помощь и документы"));
    expect(help.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(help.getAllByText(/это демо.*не перемещают реальные средства/i)).toHaveLength(1);
    open("Отправить");
    const send = within(help.getByRole("region", { name: "Отправить" }));
    expect(send.getByText("Открытие этой операции сейчас недоступно.")).toBeInTheDocument();
    expect(send.queryByRole("button")).not.toBeInTheDocument();
    expect(help.getByText("Контакт поддержки пока не указан.")).toBeInTheDocument();
    expect(help.getByText("Документы пока не подключены.")).toBeInTheDocument();
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
    render(<ProductProfile {...base} helpActions={helpActions} />);
    expect(screen.queryByRole("button", { name: "Получить" })).not.toBeInTheDocument();
    open("Помощь и документы");
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
      const help = within(section("Помощь и документы"));
      expect(help.getAllByRole("region")).toHaveLength(1);
      fireEvent.click(help.getByRole("button", { name: topic.cta }), { detail: 0 });
      expect(openings.at(-1)).toBe(topic.id);
    }
    expect(openings).toEqual(["receive", "send", "buy", "swap"]);
    expect(payloads).toEqual([[], [], [], []]);
  });

  // Catches inner state being reset by profile updates/remounts or request focus being stolen on the same revision.
  it("preserves the selected topic through profile updates and existing revision-based help requests", () => {
    const openings: string[] = [];
    const request = { section: "help" as const, revision: 1 };
    const helpActions: ProductHelpActions = { send: { allowed: true, onOpen: () => { openings.push("send"); } } };
    const { rerender } = render(<ProductProfile {...base} resource={ready()}
      openSectionRequest={request} helpActions={helpActions} />);
    const helpTrigger = screen.getByRole("button", { name: "Помощь и документы" });
    expect(helpTrigger).toHaveFocus();
    const send = screen.getByRole("button", { name: "Отправить" });
    send.focus();
    fireEvent.click(send, { detail: 0 });
    expect(send).toHaveFocus();
    expect(send).toHaveAttribute("aria-expanded", "true");
    rerender(<ProductProfile {...base} balanceHidden theme="light" resource={{ status: "loading" }}
      openSectionRequest={{ ...request }} helpActions={{ send: { allowed: false, reason: "Завершите текущий сценарий." } }} />);
    expect(send).toHaveFocus();
    expect(send).toHaveAttribute("aria-expanded", "true");
    expect(section("Отправить")).toHaveTextContent("Завершите текущий сценарий.");
    expect(screen.queryByRole("button", { name: "Открыть отправку" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показать суммы" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/^(Тема|Светлая|Тёмная)$/)).toBeNull();
    open("Личные данные");
    expect(screen.queryByRole("button", { name: "Отправить" })).not.toBeInTheDocument();

    rerender(<ProductProfile {...base} resource={ready()} helpActions={helpActions}
      openSectionRequest={{ section: "help", revision: 2 }} />);
    expect(helpTrigger).toHaveFocus();
    expect(screen.getByRole("button", { name: "Отправить" })).toHaveAttribute("aria-expanded", "true");
    expect(within(section("Помощь и документы")).getAllByRole("region")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Открыть отправку" }));
    expect(openings).toEqual(["send"]);
  });
});

describe("ProductProfile disclosure motion", () => {
  let animations: ReturnType<typeof disclosureTestAnimations>;
  beforeEach(() => { animations = disclosureTestAnimations(); });
  afterEach(() => animations.restore());
  const motionProfile = (resource = ready({ email: "fresh@example.test" }), mode = "ready") =>
    <div data-mono-motion={mode}><ProductProfile {...base} resource={resource} actions={{ "edit-contacts": () => undefined }} /></div>;

  // Catches nested help CTAs remaining active or losing the correct outer launcher on profile-group close.
  it("returns focus to the help group and blocks its nested action during the outer close", async () => {
    const openings: string[] = [];
    render(<div data-mono-motion="ready"><ProductProfile {...base}
      helpActions={{ receive: { allowed: true, onOpen: () => { openings.push("receive"); } } }} /></div>);
    open("Помощь и документы");
    const help = section("Помощь и документы");
    open("Получить");
    const cta = screen.getByRole("button", { name: "Открыть получение" });
    cta.focus();
    open("Помощь и документы");
    expect(screen.getByRole("button", { name: "Помощь и документы" })).toHaveFocus();
    expect(help).toHaveAttribute("inert");
    expect(help).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: "Открыть получение" })).not.toBeInTheDocument();
    fireEvent.click(cta);
    expect(openings).toEqual([]);
    await animations.finish(help);
    expect(help).toHaveAttribute("hidden");
    expect(cta).not.toBeInTheDocument();
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
