import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, expect, it } from "vitest";
import { AvatarControl } from "./avatar-control";

afterEach(cleanup);

function ProfileEntry({ disabled = false }: { disabled?: boolean }) {
  const [section, setSection] = useState("Обзор");
  const [submitted, setSubmitted] = useState(false);
  return <form onSubmit={event => { event.preventDefault(); setSubmitted(true); }}>
    <AvatarControl aria-label="Открыть профиль" fallback="А" disabled={disabled}
      onClick={() => setSection("Профиль")} />
    <h1>{section}</h1>
    <output aria-label="Форма отправлена">{submitted ? "Да" : "Нет"}</output>
  </form>;
}

// A lost onClick or missing button type breaks direct profile entry or submits the host form.
it("opens the host profile action without submitting its enclosing form", () => {
  render(<ProfileEntry />);

  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));

  expect(screen.getByRole("heading", { name: "Профиль" })).toBeInTheDocument();
  expect(screen.getByLabelText("Форма отправлена")).toHaveTextContent("Нет");
});

// A wrapper ref prevents the host from returning keyboard focus to the actual control.
it("returns focus through a ref to its native root button", () => {
  const ref = createRef<HTMLButtonElement>();
  const { container } = render(<AvatarControl ref={ref} aria-label="Открыть профиль"
    aria-current="page" fallback="А" className="host-placement" />);
  const button = screen.getByRole("button", { name: "Открыть профиль" });

  expect(ref.current).toBe(button);
  expect(container.firstElementChild).toBe(button);
  expect(button.tagName).toBe("BUTTON");
  expect(button).toHaveAttribute("aria-current", "page");
  expect(button).toHaveClass("host-placement");
  ref.current?.focus();
  expect(button).toHaveFocus();
});

// Losing native disabled would allow a guarded host action to run.
it("keeps a disabled profile entry from invoking the host action", () => {
  render(<ProfileEntry disabled />);

  fireEvent.click(screen.getByRole("button", { name: "Открыть профиль" }));

  expect(screen.getByRole("button", { name: "Открыть профиль" })).toBeDisabled();
  expect(screen.getByRole("heading", { name: "Обзор" })).toBeInTheDocument();
});

// Revealing an unready/broken image loses the supplied fallback and can leave an empty target.
it("shows the supplied fallback until the decorative portrait is ready", () => {
  const { container } = render(<AvatarControl aria-label="Открыть профиль"
    avatarSrc="/media/mono/profile/candidate-a.webp" fallback=" а " />);
  const image = container.querySelector("img")!;

  expect(screen.getByText("А")).toBeVisible();
  expect(image).not.toBeVisible();
  expect(image).toHaveAttribute("alt", "");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();

  fireEvent.load(image);

  expect(image).toBeVisible();
  expect(screen.getByText("А")).not.toBeVisible();
});

// Sticky image failure would suppress a later local source; replacing the button would lose focus.
it("recovers from an image error when the source changes while retaining the focused button", () => {
  const ref = createRef<HTMLButtonElement>();
  const { container, rerender } = render(<AvatarControl ref={ref} aria-label="Открыть профиль"
    avatarSrc="/media/mono/profile/missing.webp" fallback="А" />);
  const button = screen.getByRole("button", { name: "Открыть профиль" });
  button.focus();

  fireEvent.error(container.querySelector("img")!);

  expect(screen.getByText("А")).toBeVisible();
  expect(container.querySelector("img")).toBeNull();
  expect(button).toHaveFocus();

  rerender(<AvatarControl ref={ref} aria-label="Открыть профиль"
    avatarSrc="/media/mono/profile/candidate-b.webp" fallback="А" />);
  const nextImage = container.querySelector("img")!;
  expect(nextImage).toHaveAttribute("src", "/media/mono/profile/candidate-b.webp");
  expect(screen.getByText("А")).toBeVisible();

  fireEvent.load(nextImage);

  expect(nextImage).toBeVisible();
  expect(ref.current).toBe(button);
  expect(button).toHaveFocus();
});

// A missing source must not turn the accessible profile control into an image-only dependency.
it("remains an accessible focus target with no portrait or supplied initial", () => {
  const { container } = render(<AvatarControl aria-label="Открыть профиль" />);
  const button = screen.getByRole("button", { name: "Открыть профиль" });

  button.focus();

  expect(button).toHaveFocus();
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});
