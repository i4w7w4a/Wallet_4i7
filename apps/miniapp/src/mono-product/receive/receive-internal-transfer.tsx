import { useId, useLayoutEffect, useRef } from "react";
import type { InternalTransferIssue, InternalTransferQuote } from "../internal-transfer";
import { useInternalReceiveTransfer, type InternalReceiveTransferOptions } from "./use-internal-receive-transfer";
import base from "./receive.module.css";
import styles from "./receive-internal-transfer.module.css";

const issueText: Record<InternalTransferIssue, string> = {
  "unsupported-route": "Эта пара счетов недоступна. Выберите другой источник.",
  "invalid-amount": "Введите положительную сумму обычным числом, без степени.",
  "unknown-available": "Доступный остаток неизвестен. Подтверждение пока недоступно.",
  "insufficient-asset": "Недостаточно доступных средств. Уменьшите сумму.",
  "expired-quote": "Расчёт устарел. Рассчитайте пример ещё раз.",
  "invalid-quote": "Расчёт не подходит этому переводу. Запросите новый.",
  unavailable: "Не удалось получить результат. Попробуйте рассчитать пример ещё раз.",
};

export function InternalTransferReceive(props: InternalReceiveTransferOptions & {
  onClose: () => void; onViewHistory?: () => void;
}) {
  const { route, destination, draft, privacy, onClose, onViewHistory } = props;
  const model = useInternalReceiveTransfer(props);
  const amountId = useId(), sourceName = useId(), phaseId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const previousStage = useRef(model.stage);
  const form = model.stage === "edit" || model.stage === "quoting";
  const chooseSource = form && !privacy && (!model.source || destination.sources.filter(source => source.status === "available").length > 1);
  const issue = model.issue ?? (form && draft.amount.trim() && !model.amount ? "invalid-amount" : null);
  useLayoutEffect(() => {
    if (model.stage !== previousStage.current) {
      if (model.stage === "review" || model.stage === "pending" || model.stage === "result") heading.current?.focus();
      else if (model.stage === "edit" && !privacy) input.current?.focus();
      previousStage.current = model.stage;
    }
  }, [model.stage, privacy]);

  return <div className={styles.transfer}>
    <div className={styles.direction} role="group" aria-label="Направление пополнения">
      {chooseSource ? <fieldset className={styles.sources}>
        <legend>Откуда</legend>
        {destination.sources.map(source => <label key={source.accountId} className={styles.source}
          data-selected={source.accountId === model.sourceId}>
          <input type="radio" name={sourceName} checked={source.accountId === model.sourceId}
            disabled={source.status !== "available"} onChange={() => model.changeSource(source.accountId)} />
          <span>{source.accountLabel}{source.status !== "available" && <small>{source.status === "inactive"
            ? "Нужна активация" : "Недоступен для этого перевода"}</small>}</span>
        </label>)}
        {!destination.sources.length && <p className={styles.note}>Подходящих счетов пока нет.</p>}
      </fieldset> : <div className={styles.readonlySource}><span>Откуда</span>
        <strong>{model.quote?.sourceAccountLabel ?? model.source?.accountLabel ?? "Источник не выбран"}</strong></div>}
      <div className={styles.target}><span aria-hidden="true">↓</span><div><span>Куда</span>
        <strong>{route.accountLabel}</strong></div></div>
    </div>

    {form ? <form onSubmit={event => { event.preventDefault(); void model.calculate(); }}>
      {privacy ? <p className={styles.note}>Суммы скрыты. Выключите скрытие данных для расчёта.</p> : <>
        <label className={styles.amountLabel} htmlFor={amountId}>Сумма пополнения</label>
        <div className={styles.amountInput}><input ref={input} id={amountId} type="text" inputMode="decimal"
          autoComplete="off" spellCheck={false} maxLength={128} placeholder="0" value={draft.amount}
          aria-invalid={issue ? true : undefined} aria-describedby={`${amountId}-hint${issue ? ` ${amountId}-issue` : ""}`}
          onChange={event => model.changeAmount(event.currentTarget.value)} /><span>{route.symbol}</span></div>
        <p id={`${amountId}-hint`} className={styles.note}>Доступный остаток и комиссия появятся после расчёта.</p>
        {issue && <p id={`${amountId}-issue`} className={styles.issue} role="alert">{issueText[issue]}</p>}
      </>}
      {model.stage === "quoting" && <p className={styles.note} role="status">Рассчитываем пример…</p>}
      <button type="submit" className={base.primaryButton} disabled={!model.canCalculate}>Рассчитать пример</button>
    </form> : <section key={model.stage} className={styles.phase} aria-labelledby={phaseId}>
      <h4 id={phaseId} ref={heading} tabIndex={-1}>{model.stage === "review" ? "Проверка пополнения"
        : model.stage === "pending" ? "Выполняем симуляцию"
          : model.result?.status === "simulated-success" ? "Симуляция завершена" : "Симуляция не выполнена"}</h4>
      {privacy ? <p className={styles.note}>Суммы скрыты.</p> : model.quote && <QuoteSummary quote={model.quote} />}
      {model.stage === "review" && <>
        <p className={styles.note}>Это расчёт примера. Реальная комиссия пока неизвестна.</p>
        <div className={styles.actions}>
          <button type="button" className={base.primaryButton} disabled={privacy} onClick={() => void model.confirm()}>Подтвердить симуляцию</button>
          <button type="button" className={base.button} onClick={model.edit}>Изменить</button>
        </div>
      </>}
      {model.stage === "pending" && <p className={styles.note} role="status">Ожидаем результат симуляции. Средства не перемещаются.</p>}
      {model.stage === "result" && <>
        <p className={styles.resultNote}>Средства между счетами не перемещены.</p>
        {model.result?.status === "simulated-failure" && <p className={styles.note}>{model.result.reason === "expired"
          ? "Расчёт устарел. Для новой попытки нужен новый расчёт." : model.result.reason === "rejected"
            ? "Пример отклонён. Можно изменить сумму и попробовать снова." : "Симуляция сейчас недоступна. Можно попробовать снова."}</p>}
        <div className={styles.actions}>
          {onViewHistory && <button type="button" className={base.primaryButton} onClick={onViewHistory}>В истории</button>}
          <button type="button" className={onViewHistory ? base.button : base.primaryButton} onClick={onClose}>Готово</button>
          <button type="button" className={base.button} onClick={model.edit}>{model.result?.status === "simulated-success" ? "Новое пополнение" : "Изменить"}</button>
        </div>
      </>}
    </section>}
  </div>;
}

function QuoteSummary({ quote }: { quote: InternalTransferQuote }) {
  return <dl className={styles.quote}>
    <div className={styles.amountRow}><dt>Сумма</dt><dd>{quote.request.amount} <span>{quote.symbol}</span></dd></div>
    <div><dt>Доступно на счёте</dt><dd>{quote.available} {quote.symbol}</dd></div>
    <div><dt>Комиссия примера</dt><dd>{quote.fee.amount} {quote.fee.symbol}</dd></div>
    <div><dt>Списание в примере</dt><dd>{quote.assetDebit} {quote.symbol}</dd></div>
  </dl>;
}
