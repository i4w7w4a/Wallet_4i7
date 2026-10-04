"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { commerceIssueMessage, commerceRouteKey, type BuyFlowProps, type BuyQuote, type CommerceUnit } from "../commerce";
import { CurrencyLogo } from "../currency-logo";
import { useBuyFlow } from "./use-buy-flow";
import styles from "./buy-flow.module.css";
export type { BuyFlowProps } from "../commerce";

export function BuyFlow(props: BuyFlowProps) {
  return <BuySession key={commerceRouteKey(props.route)} {...props} />;
}

function BuySession(props: BuyFlowProps) {
  const [route] = useState(() => Object.freeze({ ...props.route }));
  const { privacy, onViewHistory, showCloseButton = true } = props;
  const flow = useBuyFlow({ ...props, route });
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const { stage, data, method, simulation } = flow;
  const pending = stage === "pending";
  const success = simulation?.result.status === "simulated-success";
  const title = flow.loading ? "Готовим покупку" : !data ? "Покупка недоступна"
    : stage === "method" ? "Способ оплаты" : stage === "amount" ? "Сумма покупки"
      : stage === "review" ? "Проверьте покупку" : pending ? "Симуляция выполняется"
        : success ? "Симуляция завершена" : "Симуляция не выполнена";
  const error = flow.loadIssue ?? flow.issue;
  const quote = stage === "result" ? simulation?.quote : flow.quote;
  const mask = (value: string) => privacy ? "••••" : value;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [stage, flow.loading]);
  useEffect(() => { if (flow.issue && !privacy) amountInput.current?.focus({ preventScroll: true }); }, [flow.issue, privacy]);

  return <section className={styles.flow} aria-label="Демонстрационная покупка" data-buy-stage={stage}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); flow.close(); }
    }}>
    <div className={styles.toolbar}>
      <button className={styles.textButton} type="button" disabled={pending} onClick={flow.back}>
        <span aria-hidden="true">←</span> Назад
      </button>
      <span className={styles.demo}>Демо</span>
      {showCloseButton && <button className={styles.textButton} type="button" disabled={pending} onClick={flow.close}>Закрыть</button>}
    </div>
    <div className={styles.route}>
      <span className={styles.asset}><CurrencyLogo assetId={route.assetId} /></span>
      <span className={styles.routeIdentity}><strong>{route.symbol}</strong><span>{route.accountLabel}</span></span>
      <span className={styles.network}>{route.networkLabel}</span>
    </div>

    <div key={`${stage}:${flow.loading}`} className={styles.step}>
      <div className={styles.stepHeading}>
        <h3 ref={heading} tabIndex={-1}>{title}</h3>
        {data && !pending && stage !== "result" && <span className={styles.stepNumber} aria-label="Шаг">
          {stage === "method" ? "1 / 3" : stage === "amount" ? "2 / 3" : "3 / 3"}
        </span>}
      </div>
      {error && <p role="alert" id={`${id}-error`} className={styles.error}>{commerceIssueMessage(error)}</p>}
      {flow.loading && <p role="status" className={styles.status}>Загружаем условия демо-покупки…</p>}
      {!flow.loading && !data && <div className={styles.empty}>
        <p className={styles.note}>{flow.retryable ? "Повторите загрузку условий или вернитесь к выбору счёта."
          : "Вернитесь к выбору счёта, чтобы выбрать доступное направление."}</p>
        {flow.retryable && <button className={styles.primary} type="button" onClick={flow.retry}>Повторить загрузку</button>}
      </div>}

      {data && stage === "method" && <form className={styles.form} onSubmit={event => { event.preventDefault(); flow.continueMethod(); }}>
        <fieldset className={styles.methods}>
          <legend className={styles.label}>Оплата в демо</legend>
          {data.methods.map(value => <label key={value.id} className={styles.method}>
            <input type="radio" name={`${id}-method`} value={value.id} aria-label={value.label}
              checked={flow.methodId === value.id} disabled={privacy} onChange={() => flow.chooseMethod(value.id)} />
            <span><strong>{value.label}</strong><span>{value.currency} · демонстрационный способ</span></span>
          </label>)}
        </fieldset>
        <p className={styles.note}>Это симуляция. Оплата и зачисление средств не выполняются.</p>
        {privacy && <p className={styles.hint}>Суммы скрыты. Откройте их, чтобы продолжить.</p>}
        <button className={styles.primary} type="submit" disabled={privacy || !method}>Продолжить</button>
      </form>}

      {data && method && stage === "amount" && <form className={styles.form} onSubmit={event => { event.preventDefault(); void flow.requestQuote(); }}>
        <p className={styles.hint}>{method.label} · {method.currency}</p>
        {privacy ? <p className={styles.privacy} role="status">Суммы скрыты. Откройте их, чтобы продолжить.</p> : <>
          <label className={styles.label} htmlFor={`${id}-amount`}>Сумма, {method.currency}</label>
          <div className={styles.amountInput}>
            <input ref={amountInput} id={`${id}-amount`} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
              value={flow.amount} maxLength={128} placeholder="0" required
              aria-invalid={flow.issue && ["invalid-amount", "precision", "below-minimum", "above-maximum"].includes(flow.issue.code) || undefined}
              aria-describedby={`${id}-limits${error ? ` ${id}-error` : ""}`}
              onChange={event => flow.changeAmount(event.target.value)} />
            <span aria-hidden="true">{method.currency}</span>
          </div>
        </>}
        <p id={`${id}-limits`} className={styles.hint}>{privacy ? "Демо-лимиты скрыты"
          : `Демо-лимиты: ${method.terms.minimum}–${method.terms.maximum} ${method.currency}`}</p>
        <p className={styles.note}>Курс и комиссия — пример. Итог появится перед подтверждением.</p>
        {flow.quoting && <p className={styles.status} role="status">Рассчитываем демо-покупку…</p>}
        <button className={styles.primary} type="submit" disabled={privacy || flow.quoting || !flow.amount.trim()}>Проверить покупку</button>
      </form>}

      {data && quote && stage === "review" && <div className={styles.review}>
        <p className={styles.hint}>Будет зачислено в демо</p>
        <p className={styles.amount}>{mask(`${quote.credit.quantity} ${quote.credit.symbol}`)}</p>
        <PurchaseDetails quote={quote} methodLabel={method?.label ?? "Демо-оплата"} privacy={privacy} />
        <p className={styles.note}>Симуляция: оплата и зачисление средств не выполняются. Баланс сохранится.</p>
        {privacy && <p className={styles.hint}>Откройте суммы, чтобы подтвердить симуляцию.</p>}
        <button className={styles.primary} type="button" disabled={privacy} onClick={() => void flow.submit()}>Подтвердить симуляцию</button>
      </div>}

      {data && pending && <div className={styles.outcome}>
        <span className={styles.resultMark} aria-hidden="true">…</span>
        <p className={styles.status} role="status">Ожидаем завершения демо-покупки.</p>
        <p className={styles.note}>Дождитесь результата, чтобы закрыть панель или сменить счёт.</p>
      </div>}

      {data && simulation && quote && stage === "result" && <div className={styles.outcome}>
        <span className={styles.resultMark} aria-hidden="true">{success ? "✓" : "!"}</span>
        <p className={styles.hint}>{success ? "Зачисление в симуляции" : "Расчёт зачисления"}</p>
        <p className={styles.amount}>{mask(`${quote.credit.quantity} ${quote.credit.symbol}`)}</p>
        <PurchaseDetails quote={quote} methodLabel={method?.label ?? "Демо-оплата"} privacy={privacy} />
        <p className={styles.resultText}>{success ? "Средства не списаны и не зачислены. Баланс сохранён."
          : "Симуляция не выполнена. Средства не списаны. Измените сумму или получите новый расчёт."}</p>
        {success ? <button className={styles.primary} type="button" onClick={flow.close}>Готово</button>
          : <button className={styles.primary} type="button" onClick={flow.editAmount}>Изменить сумму</button>}
        {onViewHistory && <button className={styles.secondary} type="button" onClick={onViewHistory}>В истории</button>}
      </div>}
    </div>
  </section>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function unitLabel(unit: CommerceUnit): string { return unit.kind === "fiat" ? unit.currency : unit.symbol; }

function PurchaseDetails({ quote, methodLabel, privacy }: { quote: BuyQuote; methodLabel: string; privacy: boolean }) {
  const mask = (value: string) => privacy ? "••••" : value;
  return <div className={styles.quote}>
    <dl className={styles.details}>
      <Detail label="Способ">{methodLabel}</Detail>
      <Detail label="Оплата">{mask(`${quote.payment.amount} ${quote.payment.currency}`)}</Detail>
      <Detail label="Комиссия">{quote.fee.status === "known" ? mask(`${quote.fee.amount} ${unitLabel(quote.fee.unit)}`) : "Неизвестна"}</Detail>
      <Detail label="Всего к оплате">{mask(`${quote.debit.amount} ${quote.debit.currency}`)}</Detail>
      <Detail label="На счёт">{quote.credit.accountLabel}</Detail>
      <Detail label="Сеть">{quote.credit.networkLabel}</Detail>
    </dl>
    <p className={styles.hint}>{privacy ? "Демо-курс скрыт" : quote.rate.label}</p>
  </div>;
}
