import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoProfileResource, type ProductProfileResource } from "../profile";
import { ProductSupportContent } from "./index";

afterEach(cleanup);

function ready(support: { label: string; href: string } | null): ProductProfileResource {
  const resource = createDemoProfileResource();
  if (resource.status !== "ready") throw new Error("Expected the ready demo profile fixture");
  return { ...resource, data: { ...resource.data, support,
    documents: [{ id: "terms", title: "Документ сервиса", href: "https://example.org/terms" }] } };
}

describe("ProductSupportContent", () => {
  // Catches a fabricated destination, document/FAQ content or an extra navigation shell.
  it("renders only the supplied contact as one safe external link", () => {
    render(<ProductSupportContent resource={ready({ label: "Написать в поддержку", href: "https://example.org/support" })} />);
    const contact = screen.getByRole("link", { name: "Написать в поддержку" });
    expect(contact).toHaveAttribute("href", "https://example.org/support");
    expect(contact).toHaveAttribute("target", "_blank");
    expect(contact).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  // Catches an unnamed contact when a supplied label is empty or whitespace.
  it.each(["", "  "])("provides an accessible contact name for an empty supplied label", label => {
    render(<ProductSupportContent resource={ready({ label, href: "https://example.org/support" })} />);
    expect(screen.getByRole("link", { name: "Связаться с поддержкой" })).toHaveAttribute("href", "https://example.org/support");
  });

  // Catches a missing contact being presented as an available action.
  it("explains a missing contact without inventing an action", () => {
    render(<ProductSupportContent resource={ready(null)} />);
    expect(screen.getByRole("status")).toHaveTextContent("Контакт поддержки пока не подключён");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Catches bypassing the existing profile-link safety policy.
  it.each(["javascript:alert(1)", "http://example.org/support", "//example.org/support",
    "https://user:password@example.org/support", "https://example.org/support path"])(
    "keeps a disallowed supplied contact unavailable: %s", href => {
      render(<ProductSupportContent resource={ready({ label: "Написать в поддержку", href })} />);
      expect(screen.getByRole("status")).toHaveTextContent("Контакт поддержки пока не подключён");
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

  // Catches loading/error being silently flattened into missing contact.
  it.each([
    { resource: { status: "loading" } as ProductProfileResource, copy: "Загружаем контакт поддержки", busy: true },
    { resource: { status: "error", retryable: true } as ProductProfileResource, copy: "Не удалось загрузить контакт поддержки", busy: false },
    { resource: { status: "error", retryable: false } as ProductProfileResource, copy: "Не удалось загрузить контакт поддержки", busy: false },
  ])("shows $resource.status honestly without an unavailable retry command", ({ resource, copy, busy }) => {
    render(<ProductSupportContent resource={resource} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(copy);
    expect(status).toHaveAttribute("aria-busy", String(busy));
    expect(status).not.toHaveTextContent("Контакт поддержки пока не подключён");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Catches a stale external contact after resource/session changes.
  it("removes the old contact as soon as the current resource becomes unavailable", () => {
    const { rerender } = render(<ProductSupportContent resource={ready({ label: "Первый контакт", href: "https://example.org/first" })} />);
    const oldContact = screen.getByRole("link", { name: "Первый контакт" });
    rerender(<ProductSupportContent resource={{ status: "loading" }} />);
    expect(oldContact).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(<ProductSupportContent resource={ready({ label: "Текущий контакт", href: "https://example.org/current" })} />);
    expect(screen.getByRole("link", { name: "Текущий контакт" })).toHaveAttribute("href", "https://example.org/current");
    rerender(<ProductSupportContent resource={ready(null)} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("temporary support channels", () => {
  // Catches arbitrary HTTPS destinations or a lookalike host acquiring Telegram branding.
  it("uses Telegram branding only for the exact t.me host and keeps other allowed HTTPS contacts neutral", () => {
    const { rerender } = render(<ProductSupportContent resource={ready({ label: "@re_pick", href: "https://t.me/re_pick" })} />);
    const telegram = screen.getByRole("link", { name: "Telegram @re_pick" });
    expect(telegram).toHaveAttribute("href", "https://t.me/re_pick");
    const plane = telegram.querySelector('svg[viewBox="0 0 24 24"] path')!.getAttribute("d");
    for (const href of ["https://example.org/support", "https://t.me.host/re_pick", "https://example.org/support?next=https://t.me/re_pick"]) {
      rerender(<ProductSupportContent resource={ready({ label: "Связь с командой", href })} />);
      const contact = screen.getByRole("link", { name: "Связь с командой" });
      expect(contact).toHaveAttribute("href", href);
      expect(screen.queryByText("Telegram")).not.toBeInTheDocument();
      expect(contact.querySelector('svg[viewBox="0 0 24 24"] path')!.getAttribute("d")).not.toBe(plane);
      expect(screen.getAllByRole("link")).toHaveLength(1);
    }
    for (const label of ["", "  "]) {
      rerender(<ProductSupportContent resource={ready({ label, href: "https://example.org/support" })} />);
      expect(screen.getByRole("link", { name: "Связаться с поддержкой" })).toHaveAttribute("href", "https://example.org/support");
      expect(screen.queryByText("Telegram")).not.toBeInTheDocument();
    }
  });

  // Catches the production demo omitting or misrouting the owner's temporary Telegram contact.
  it("exposes Telegram with the owner-supplied destination and two unavailable channels", () => {
    render(<ProductSupportContent resource={createDemoProfileResource()} />);
    const channels = screen.getByRole("list", { name: "Временные контакты поддержки" });
    expect(within(channels).getAllByRole("listitem")).toHaveLength(3);
    const telegram = within(channels).getByRole("link", { name: "Telegram @re_pick" });
    expect(telegram).toHaveAttribute("href", "https://t.me/re_pick");
    expect(telegram).toHaveAttribute("target", "_blank");
    expect(telegram).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(channels).getAllByRole("link")).toHaveLength(1);
    expect(within(channels).getByText("Почта")).toBeInTheDocument();
    expect(within(channels).getByText("WhatsApp")).toBeInTheDocument();
  });

  // Catches placeholders acquiring fake mailto/tel/WhatsApp links or keyboard/click actions.
  it("keeps email and WhatsApp unavailable when clicked without inventing contact details", () => {
    render(<ProductSupportContent resource={ready({ label: "@re_pick", href: "https://t.me/re_pick" })} />);
    const channels = screen.getByRole("list", { name: "Временные контакты поддержки" });
    for (const [name, status] of [["Почта", "Пока недоступна"], ["WhatsApp", "Пока недоступен"]]) {
      const row = within(channels).getByText(name!).closest("li")!;
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(within(row).getByText(status!)).toBeInTheDocument();
      expect(row.querySelector("a, button, [href], [tabindex]")).toBeNull();
      fireEvent.click(row);
      fireEvent.keyDown(row, { key: "Enter" });
    }
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Telegram @re_pick" })).toHaveAttribute("href", "https://t.me/re_pick");
  });

  // Catches a hardcoded Telegram fallback overriding supplied or unavailable resources.
  it("takes its active channel from the supplied resource and keeps missing loading and error honest", () => {
    const { rerender } = render(<ProductSupportContent resource={ready({ label: "Другой контакт", href: "https://t.me/other_contact" })} />);
    expect(screen.getByRole("link", { name: "Telegram Другой контакт" })).toHaveAttribute("href", "https://t.me/other_contact");
    expect(screen.queryByRole("link", { name: /@re_pick/ })).not.toBeInTheDocument();
    for (const resource of [ready(null), { status: "loading" }, { status: "error", retryable: false }] as ProductProfileResource[]) {
      rerender(<ProductSupportContent resource={resource} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    }
  });
});
