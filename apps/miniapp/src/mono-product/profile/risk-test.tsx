"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ProductRiskAnswers, ProductRiskQuestion } from "./types";
import { ProfilePanel } from "./profile-panel";
import styles from "../product-profile.module.css";

export type ProductRiskTestProps = {
  questions?: readonly ProductRiskQuestion[];
  answers?: ProductRiskAnswers;
  onSaveAnswers?(answers: ProductRiskAnswers): void;
  onBack(): void;
};

const purpose = "Тест помогает обсудить понимание рисков и ожидания от сервиса. Он не даёт финансовой рекомендации и не определяет доступ к операциям в этой демонстрации.";

export function ProductRiskTest({ questions = [], ...props }: ProductRiskTestProps) {
  const complete = questions.length > 0 && new Set(questions.map(question => question.id)).size === questions.length &&
    questions.every(question => question.id.trim() && question.title.trim() && question.options.length > 0 &&
      new Set(question.options.map(option => option.id)).size === question.options.length &&
      question.options.every(option => option.id.trim() && option.label.trim()));
  if (complete) return <RiskTestSteps key={JSON.stringify(questions)} questions={questions} {...props} />;
  return <ProfilePanel title="Тест о рисках" onBack={props.onBack}>
    <div data-profile-risk-test className={styles.sharedContent}>
      <p className={styles.panelCopy}>{purpose}</p>
      <p className={styles.note}>Вопросы пока подготавливаются. Когда материалы будут предоставлены, здесь появятся шаги теста и просмотр ответов.</p>
    </div>
  </ProfilePanel>;
}

function RiskTestSteps({ questions, answers = {}, onSaveAnswers, onBack }: ProductRiskTestProps & {
  questions: readonly ProductRiskQuestion[];
}) {
  const prefix = useId();
  const reviewTitleId = `${prefix}-review`;
  const [step, setStep] = useState(-1);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(questions.flatMap(question => {
    const selected = question.options.find(option => option.id === answers[question.id]);
    return selected ? [[question.id, selected.id]] : [];
  })));
  const [missingAnswer, setMissingAnswer] = useState(false);
  const questionTitle = useRef<HTMLLegendElement>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const firstOption = useRef<HTMLInputElement>(null);
  const startAction = useRef<HTMLButtonElement>(null);
  const returnAction = useRef<HTMLButtonElement>(null);
  const question = step >= 0 && step < questions.length ? questions[step] : null;
  const reviewing = step === questions.length;
  const saved = step > questions.length;
  useLayoutEffect(() => {
    if (step >= 0 && step < questions.length) questionTitle.current?.focus({ preventScroll: true });
    else if (step === questions.length) reviewTitle.current?.focus({ preventScroll: true });
    else if (step > questions.length) returnAction.current?.focus({ preventScroll: true });
    else startAction.current?.focus({ preventScroll: true });
  }, [step, questions.length]);
  function back() {
    if (step < 0) onBack();
    else { setMissingAnswer(false); setStep(current => current - 1); }
  }
  function next() {
    if (!question?.options.some(option => option.id === draft[question.id])) {
      setMissingAnswer(true); firstOption.current?.focus({ preventScroll: true }); return;
    }
    setMissingAnswer(false); setStep(current => current + 1);
  }
  return <ProfilePanel title="Тест о рисках" onBack={back} onClose={onBack} backLabel={step < 0 ? "Назад в профиль" : "Назад"}>
    <div data-profile-risk-test className={styles.sharedContent}>
      {step < 0 && <>
        <p className={styles.panelCopy}>{purpose}</p>
        <p className={styles.note}>Выберите один ответ на каждом шаге. Можно вернуться назад и проверить все ответы перед сохранением в демонстрационной сессии.</p>
        <button type="button" ref={startAction} className={styles.primaryAction} onClick={() => setStep(0)}>Начать тест</button>
      </>}
      {question && <form className={styles.riskForm} onSubmit={event => { event.preventDefault(); next(); }}>
        <p className={styles.note}>Вопрос {step + 1} из {questions.length}</p>
        <fieldset className={styles.riskQuestion} aria-describedby={missingAnswer ? `${prefix}-error` : undefined}>
          <legend className={styles.questionTitle} ref={questionTitle} tabIndex={-1}>{question.title}</legend>
          {question.description && <p className={styles.note}>{question.description}</p>}
          <div className={styles.riskOptions}>{question.options.map((option, index) => <label className={styles.riskOption} key={option.id}>
            <input ref={index === 0 ? firstOption : undefined} type="radio" name={`${prefix}-${question.id}`} value={option.id}
              checked={draft[question.id] === option.id} aria-invalid={missingAnswer ? true : undefined}
              onChange={() => { setDraft(current => ({ ...current, [question.id]: option.id })); setMissingAnswer(false); }} />
            <span>{option.label}</span>
          </label>)}</div>
          {missingAnswer && <p className={styles.fieldError} id={`${prefix}-error`} role="alert">Выберите один вариант, чтобы продолжить.</p>}
        </fieldset>
        <button type="submit" className={styles.primaryAction}>Далее</button>
      </form>}
      {reviewing && <section className={styles.sharedContent} aria-labelledby={reviewTitleId}>
        <h3 className={styles.questionTitle} id={reviewTitleId} ref={reviewTitle} tabIndex={-1}>Проверьте ответы</h3>
        <dl className={styles.riskReview}>{questions.map(question => <div key={question.id}>
          <dt>{question.title}</dt><dd>{question.options.find(option => option.id === draft[question.id])?.label}</dd>
        </div>)}</dl>
        <p className={styles.note}>Ответы сохраняются только в демонстрационной сессии. Оценка и финансовые рекомендации не формируются.</p>
        {!onSaveAnswers && <p id={`${prefix}-save-unavailable`} className={styles.note}>Сохранение ответов здесь не подключено.</p>}
        <button type="button" className={styles.primaryAction} disabled={!onSaveAnswers}
          aria-describedby={!onSaveAnswers ? `${prefix}-save-unavailable` : undefined} onClick={() => {
            if (!onSaveAnswers) return;
            onSaveAnswers(Object.fromEntries(questions.map(question => [question.id, draft[question.id]])));
            setStep(questions.length + 1);
          }}>Сохранить ответы</button>
      </section>}
      {saved && <>
        <p className={styles.panelCopy} role="status">Ответы сохранены только в демонстрационной сессии. Это не результат оценки и не финансовая рекомендация.</p>
        <button type="button" ref={returnAction} className={styles.primaryAction} onClick={onBack}>Вернуться в профиль</button>
      </>}
    </div>
  </ProfilePanel>;
}
