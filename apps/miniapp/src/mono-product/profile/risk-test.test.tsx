import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ProductRiskTest } from "./risk-test";
import type { ProductRiskAnswers, ProductRiskQuestion } from "./types";

afterEach(cleanup);

export const questions: readonly ProductRiskQuestion[] = [
  { id: "fixture-a", title: "Тестовый вопрос A", options: [{ id: "a-1", label: "Вариант A1" }, { id: "a-2", label: "Вариант A2" }] },
  { id: "fixture-b", title: "Тестовый вопрос B", description: "Только синтетическое содержание проверки.",
    options: [{ id: "b-1", label: "Вариант B1" }, { id: "b-2", label: "Вариант B2" }] },
];
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

// Catches skipping an unanswered step, losing an earlier choice on Back, or saving before review.
it("validates supplied steps, preserves Back choices and saves only the reviewed answer map", () => {
  const saved: ProductRiskAnswers[] = [];
  render(<ProductRiskTest questions={questions} onBack={() => {}} onSaveAnswers={answers => saved.push(answers)} />);
  expect(screen.queryByRole("radio")).toBeNull(); click("Начать тест");
  expect(screen.getByRole("group", { name: "Тестовый вопрос A" })).toBeInTheDocument();
  click("Далее");
  expect(screen.getByRole("alert")).toHaveTextContent(/выберите.*вариант/i);
  expect(screen.getByRole("radio", { name: "Вариант A1" })).toHaveFocus();
  expect(saved).toEqual([]);
  fireEvent.click(screen.getByRole("radio", { name: "Вариант A2" })); click("Далее");
  expect(screen.getByRole("group", { name: "Тестовый вопрос B" })).toBeInTheDocument();
  click("Назад"); expect(screen.getByRole("radio", { name: "Вариант A2" })).toBeChecked();
  click("Далее"); fireEvent.click(screen.getByRole("radio", { name: "Вариант B1" })); click("Далее");
  const review = screen.getByRole("region", { name: "Проверьте ответы" });
  expect(review).toHaveTextContent("Тестовый вопрос A"); expect(review).toHaveTextContent("Вариант A2");
  expect(review).toHaveTextContent("Тестовый вопрос B"); expect(review).toHaveTextContent("Вариант B1");
  expect(saved).toEqual([]); expect(screen.queryByRole("radio")).toBeNull();
  click("Назад"); expect(screen.getByRole("radio", { name: "Вариант B1" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "Вариант B2" })); click("Далее");
  click("Сохранить ответы");
  expect(saved).toEqual([{ "fixture-a": "a-2", "fixture-b": "b-2" }]);
  expect(screen.getByRole("status")).toHaveTextContent(/только в демонстрационной сессии/i);
  expect(screen.getByRole("button", { name: "Вернуться в профиль" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Сохранить ответы" })).toBeNull();
});

// Catches the disappearing question taking keyboard focus away on Back to the intro.
it("focuses the start action when Back returns from the first question to the intro", () => {
  render(<ProductRiskTest questions={questions} onBack={() => {}} />);
  click("Начать тест"); click("Назад");
  expect(screen.getByRole("button", { name: "Начать тест" })).toHaveFocus();
});

// Catches accepting an obsolete supplied answer as a valid choice.
it("does not advance for an answer that is absent from the supplied options", () => {
  render(<ProductRiskTest questions={questions} answers={{ "fixture-a": "removed-option" }} onBack={() => {}} />);
  click("Начать тест");
  expect(screen.getAllByRole("radio").every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
  click("Далее");
  expect(screen.getByRole("group", { name: "Тестовый вопрос A" })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toBeVisible();
});

// Catches prior questionnaire text or choices surviving a supplied-content replacement.
it("returns to the intro with fresh options when the questionnaire is replaced", () => {
  const { rerender } = render(<ProductRiskTest questions={questions} onBack={() => {}} />);
  click("Начать тест"); fireEvent.click(screen.getByRole("radio", { name: "Вариант A2" })); click("Далее");
  const replacement = [{ id: "fixture-c", title: "Новый тестовый вопрос", options: [{ id: "c-1", label: "Новый вариант" }] }];
  rerender(<ProductRiskTest questions={replacement} onBack={() => {}} />);
  expect(screen.queryByRole("radio")).toBeNull(); click("Начать тест");
  const group = screen.getByRole("group", { name: "Новый тестовый вопрос" });
  expect(within(group).getByRole("radio", { name: "Новый вариант" })).not.toBeChecked();
  expect(screen.queryByText("Тестовый вопрос B")).toBeNull();
});

// Catches a ready-looking test with no way to select a required answer.
it("keeps malformed supplied questions pending instead of starting an impossible step", () => {
  render(<ProductRiskTest questions={[{ id: "empty-fixture", title: "Пустой вопрос", options: [] }]} onBack={() => {}} />);
  expect(screen.queryByRole("button", { name: "Начать тест" })).toBeNull();
  expect(screen.getByRole("region", { name: "Тест о рисках" })).toHaveTextContent(/материал|вопросы/i);
});
