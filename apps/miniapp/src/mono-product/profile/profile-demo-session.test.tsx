import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { WalletProfile } from "@wallet/core";
import { AvatarControl } from "../avatar-control";
import { ProductProfile } from "../product-profile";
import { useProfileDemoSession } from "./use-profile-demo-session";
import type { ProductProfileResource, ProductRiskQuestion } from "./types";

afterEach(cleanup);

const sourceProfile: WalletProfile = { name: "Исходный профиль", shortAddress: "demo-session…1", avatarUrl: null };
const sourceResource: ProductProfileResource = { status: "ready", data: {
  email: "original@example.test", phone: null, languageLabel: "Русский", valuationCurrencyLabel: "USD",
  verification: "unknown", twoFactor: "unknown", addressAllowlist: "unknown", support: null, documents: [],
} };
const questions: readonly ProductRiskQuestion[] = [{ id: "session-question", title: "Синтетический вопрос",
  options: [{ id: "one", label: "Тестовый вариант один" }, { id: "two", label: "Тестовый вариант два" }] }];
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function SceneLikeHost({ profile = sourceProfile, resource = sourceResource, identityKey = profile.shortAddress }: {
  profile?: WalletProfile; resource?: ProductProfileResource; identityKey?: string;
}) {
  const [visible, setVisible] = useState(true);
  const session = useProfileDemoSession({ profile, resource, identityKey, avatarSrc: "/session-fixture.webp" });
  return <main>
    <AvatarControl aria-label={visible ? "Закрыть профиль" : "Открыть профиль"} avatarSrc={session.avatarSrc}
      fallback={session.profile.name} onClick={() => setVisible(current => !current)} />
    <button type="button" onClick={() => setVisible(false)}>Другой раздел</button>
    {visible && <ProductProfile profile={profile} session={session} riskQuestions={questions}
      balanceHidden={false} onBalanceHiddenChange={() => {}} />}
  </main>;
}

// Catches storing contacts inside the conditional view or splitting the header/Profile identity.
it("keeps all saved contacts through Profile unmount/remount and shares the header portrait", () => {
  const { container } = render(<SceneLikeHost />);
  expect(Array.from(container.querySelectorAll("img")).map(img => img.getAttribute("src")))
    .toEqual(["/session-fixture.webp", "/session-fixture.webp"]);
  click("Личные данные"); click("Изменить контакты");
  change("Имя", "Сохранённое имя"); change("Эл. почта", "saved@example.test");
  change("Телефон", "+0 000 000 0000"); change("Telegram", "@session_fixture");
  change("Дополнительная эл. почта", "saved-extra@example.test"); click("Сохранить");
  expect(within(screen.getByRole("button", { name: "Закрыть профиль" })).getByText("С")).toBeInTheDocument();
  click("Другой раздел"); expect(screen.queryByRole("heading", { name: "Профиль" })).toBeNull();
  click("Открыть профиль"); click("Личные данные"); click("Изменить контакты");
  for (const [label, value] of [["Имя", "Сохранённое имя"], ["Эл. почта", "saved@example.test"],
    ["Телефон", "+0 000 000 0000"], ["Telegram", "@session_fixture"], ["Дополнительная эл. почта", "saved-extra@example.test"]]) {
    expect(screen.getByLabelText(label)).toHaveValue(value);
  }
});

// Catches supplied-question answers being lost with the view or clearing when reopened.
it("keeps saved risk answers in the live parent session across navigation", () => {
  render(<SceneLikeHost />);
  click("Тест о рисках"); click("Начать тест");
  fireEvent.click(screen.getByRole("radio", { name: "Тестовый вариант два" })); click("Далее"); click("Сохранить ответы");
  click("Вернуться в профиль"); expect(screen.getByRole("button", { name: "Тест о рисках" })).toHaveFocus();
  click("Другой раздел"); click("Открыть профиль"); click("Тест о рисках"); click("Начать тест");
  expect(screen.getByRole("radio", { name: "Тестовый вариант два" })).toBeChecked();
});

// Catches a reference-based reset that throws away memory on an ordinary host rerender.
it("preserves saved values when equivalent source objects are re-created", () => {
  const { rerender } = render(<SceneLikeHost />);
  click("Личные данные"); click("Изменить контакты"); change("Эл. почта", "memory@example.test"); click("Сохранить");
  if (sourceResource.status !== "ready") throw new Error("fixture must be ready");
  rerender(<SceneLikeHost profile={{ ...sourceProfile }} resource={{ ...sourceResource, data: { ...sourceResource.data } }} />);
  expect(screen.getByRole("region", { name: "Личные данные" })).toHaveTextContent("memory@example.test");
});

// Catches exposing the previous user's saved values or an open unsaved form after identity changes.
it.each(["host-key", "profile-source"])("clears another identity's saved values and open draft on %s replacement", replacement => {
  const { container, rerender } = render(<SceneLikeHost identityKey="user-a" />);
  click("Личные данные"); click("Изменить контакты"); change("Эл. почта", "previous-user@example.test"); click("Сохранить");
  click("Изменить контакты"); change("Telegram", "@unsaved_previous");
  const nextProfile = replacement === "host-key" ? sourceProfile : { ...sourceProfile, name: "Другой исходный профиль" };
  rerender(<SceneLikeHost profile={nextProfile} identityKey={replacement === "host-key" ? "user-b" : "user-a"} />);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(container).not.toHaveTextContent("previous-user@example.test");
  expect(container).not.toHaveTextContent("@unsaved_previous");
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("heading", { name: "Профиль" })).toHaveFocus();
  click("Изменить контакты"); expect(screen.getByLabelText("Эл. почта")).toHaveValue("original@example.test");
  expect(screen.getByLabelText("Telegram")).toHaveValue("");
});

// Catches hidden profile data lingering during a loading/error source replacement.
it.each(["loading", "error"] as const)("removes a contact draft immediately when its resource becomes %s", status => {
  const { container, rerender } = render(<SceneLikeHost />);
  click("Личные данные"); click("Изменить контакты"); change("Эл. почта", "private-draft@example.test");
  rerender(<SceneLikeHost resource={status === "loading" ? { status } : { status, retryable: false }} />);
  expect(container.querySelector("[data-profile-contact-editor]")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(container).not.toHaveTextContent("original@example.test");
  expect(container).not.toHaveTextContent("private-draft@example.test");
});

// Catches an old Save closure writing into a new user session after the source changed.
it("ignores stale save callbacks and resets saved risk answers on identity replacement", () => {
  const { result, rerender } = renderHook(({ identityKey }) => useProfileDemoSession({ profile: sourceProfile, resource: sourceResource, identityKey }),
    { initialProps: { identityKey: "user-a" } });
  const staleContacts = result.current.saveContacts, staleRisk = result.current.saveRiskAnswers;
  act(() => result.current.saveRiskAnswers({ "session-question": "two" }));
  rerender({ identityKey: "user-b" });
  act(() => {
    staleContacts({ displayName: "Устаревшее имя", email: "stale@example.test", phone: "", telegram: "", additionalEmail: "" });
    staleRisk({ "session-question": "two" });
  });
  expect(result.current.contacts.email).toBe("original@example.test");
  expect(result.current.profile.name).toBe("Исходный профиль");
  expect(result.current.riskAnswers).toEqual({});
});

// Catches a value-based guard reviving a retired contact callback when A returns after B.
it("ignores a retired contact save after returning to the same identity", () => {
  const { result, rerender } = renderHook(({ identityKey }) => useProfileDemoSession({ profile: sourceProfile, resource: sourceResource, identityKey }),
    { initialProps: { identityKey: "user-a" } });
  const retiredSave = result.current.saveContacts;
  rerender({ identityKey: "user-b" });
  rerender({ identityKey: "user-a" });
  act(() => retiredSave({ displayName: "Имя прошлой сессии A", email: "retired-a@example.test", phone: "", telegram: "", additionalEmail: "" }));
  expect(result.current.contacts.email).toBe("original@example.test");
  expect(result.current.profile.name).toBe("Исходный профиль");
  act(() => result.current.saveContacts({ displayName: "Имя новой сессии A", email: "current-a@example.test", phone: "", telegram: "", additionalEmail: "" }));
  expect(result.current.contacts.email).toBe("current-a@example.test");
  expect(result.current.profile.name).toBe("Имя новой сессии A");
});

// Catches a retired risk-answer callback restoring old answers in a fresh A session.
it("ignores a retired risk save after returning to the same identity", () => {
  const { result, rerender } = renderHook(({ identityKey }) => useProfileDemoSession({ profile: sourceProfile, resource: sourceResource, identityKey }),
    { initialProps: { identityKey: "user-a" } });
  const retiredSave = result.current.saveRiskAnswers;
  act(() => retiredSave({ "session-question": "two" }));
  rerender({ identityKey: "user-b" });
  rerender({ identityKey: "user-a" });
  expect(result.current.riskAnswers).toEqual({});
  act(() => retiredSave({ "session-question": "two" }));
  expect(result.current.riskAnswers).toEqual({});
  act(() => result.current.saveRiskAnswers({ "session-question": "one" }));
  expect(result.current.riskAnswers).toEqual({ "session-question": "one" });
});

// Catches a generation reset on security/documents refresh instead of an identity replacement.
it("keeps saved contacts and risk answers when only security and document facts refresh", () => {
  const { result, rerender } = renderHook(({ resource }) => useProfileDemoSession({ profile: sourceProfile, resource }),
    { initialProps: { resource: sourceResource } });
  act(() => {
    result.current.saveContacts({ displayName: "Сохранённое имя", email: "memory@example.test", phone: "", telegram: "", additionalEmail: "" });
    result.current.saveRiskAnswers({ "session-question": "two" });
  });
  if (sourceResource.status !== "ready") throw new Error("fixture must be ready");
  rerender({ resource: { status: "ready", data: { ...sourceResource.data, verification: "verified", twoFactor: "enabled",
    documents: [{ id: "terms", title: "Материал из источника", href: "https://docs.example.test/current" }] } } });
  expect(result.current.contacts.email).toBe("memory@example.test");
  expect(result.current.profile.name).toBe("Сохранённое имя");
  expect(result.current.riskAnswers).toEqual({ "session-question": "two" });
  expect(result.current.resource).toMatchObject({ status: "ready", data: { email: "memory@example.test", verification: "verified", twoFactor: "enabled",
    documents: [{ id: "terms", title: "Материал из источника", href: "https://docs.example.test/current" }] } });
});
