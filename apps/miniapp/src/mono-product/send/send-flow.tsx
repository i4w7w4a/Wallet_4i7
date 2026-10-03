"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ProductActionRoute } from "@wallet/core";
import type { SendPort, SendQuote } from "./send-port";
import { mockSendPort } from "./mock-send-port";
import { sendIssueMessage, sendRouteKey } from "./send-validation";
import { useSendFlow } from "./use-send-flow";
import styles from "./send-flow.module.css";

export type SendBatteryActivity = { poolId: string; phase: "using" };

export type SendFlowProps = {
  route: ProductActionRoute;
  port?: SendPort;
  privacy?: boolean;
  onBack(): void;
  onClose(): void;
  onBatteryActivityChange?(activity: SendBatteryActivity | null): void;
};

export function SendFlow({ port = mockSendPort, ...props }: SendFlowProps) {
  return <SendSession key={sendRouteKey(props.route)} {...props} port={port} />;
}

function SendSession({ route: selectedRoute, port, privacy = false, onBack, onClose, onBatteryActivityChange }: SendFlowProps & { port: SendPort }) {
  // Equivalent route objects from appearance renders must not reset the form.
  const [route] = useState(selectedRoute);
  const flow = useSendFlow(route, port);
  const fieldId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { stage, data, quote } = flow;
  const pending = stage === "pending";
  // Pending is entered only after validateQuote succeeds in submit. Expiry after
  // submission does not end the accepted operation's hold; result/reset does.
  const activePoolId = data && pending && quote?.feeFunding.kind === "battery" ? quote.feeFunding.pool.id : null;
  useBatteryActivity(activePoolId, onBatteryActivityChange);
  const error = flow.loadIssue ?? flow.issue;
  const mask = (value: string) => privacy ? "••••" : value;
  const resultSuccess = flow.result?.status === "simulated-success";
  const title = flow.loading ? "Готовим перевод" : !data ? "Отправка недоступна"
    : stage === "recipient" ? "Кому отправляем"
      : stage === "amount" ? "Сумма перевода"
        : stage === "review" ? "Проверьте перевод"
          : stage === "pending" ? "Симуляция перевода"
            : resultSuccess ? "Симуляция завершена" : "Симуляция не выполнена";

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [stage, flow.loading]);

  return <section className={styles.flow} aria-label="Демонстрационная отправка" data-send-stage={stage}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}>
    <div className={styles.toolbar}>
      <button type="button" className={styles.textButton} disabled={pending} onClick={() => flow.back(onBack)}>
        <span aria-hidden="true">←</span> Назад
      </button>
      <span className={styles.demo}>DEMO · ОТПРАВКА</span>
    </div>

    <div className={styles.route}>
      <span className={styles.asset} aria-hidden="true">{route.symbol.slice(0, 1)}</span>
      <div className={styles.routeIdentity}><strong>{route.symbol}</strong><span>{route.accountLabel}</span></div>
      <span className={styles.network}>{route.networkLabel}</span>
    </div>
    <p className={styles.note}>Тестовый сценарий. Средства не отправляются.</p>

    <div key={stage} className={styles.step}>
      <div className={styles.stepHeading}>
        <h3 ref={heading} tabIndex={-1}>{title}</h3>
        {data && stage !== "result" && stage !== "pending" && <span className={styles.stepNumber} aria-label="Шаг">
          {stage === "recipient" ? "1 / 3" : stage === "amount" ? "2 / 3" : "3 / 3"}
        </span>}
      </div>
      {error && <p id={`${fieldId}-error`} role="alert" className={styles.error}>{sendIssueMessage(error)}</p>}
      {flow.loading && <p className={styles.status} role="status">Загружаем условия маршрута…</p>}
      {!flow.loading && !data && flow.loadIssue?.code === "unavailable" &&
        <button className={styles.primary} type="button" onClick={flow.loadAgain}>Повторить загрузку</button>}

      {data && stage === "recipient" && <form className={styles.form} onSubmit={event => { event.preventDefault(); void flow.continueRecipient(); }}>
        <label className={styles.label} htmlFor={`${fieldId}-recipient`}>{data.recipient.label}</label>
        <input id={`${fieldId}-recipient`} type={privacy ? "password" : "text"} value={flow.recipient.address}
          className={styles.input} autoComplete="off" autoCapitalize="none" spellCheck={false}
          placeholder={data.recipient.placeholder} required
          aria-invalid={flow.issue?.code === "invalid-recipient" || undefined}
          aria-describedby={`${fieldId}-recipient-hint${error ? ` ${fieldId}-error` : ""}`}
          onChange={event => flow.changeRecipient({ ...flow.recipient, address: event.target.value })} />
        <p id={`${fieldId}-recipient-hint`} className={styles.hint}>{data.recipient.hint}</p>
        {data.recipient.memo && <>
          <label className={styles.label} htmlFor={`${fieldId}-memo`}>{data.recipient.memo.label}
            {!data.recipient.memo.required && <span> · необязательно</span>}</label>
          <input id={`${fieldId}-memo`} type={privacy ? "password" : "text"} value={flow.recipient.memo ?? ""}
            className={styles.input} autoComplete="off" autoCapitalize="none" spellCheck={false}
            required={data.recipient.memo.required} aria-describedby={`${fieldId}-memo-hint`}
            onChange={event => flow.changeRecipient({ ...flow.recipient, memo: event.target.value })} />
          <p id={`${fieldId}-memo-hint`} className={styles.hint}>{data.recipient.memo.hint ?? "Дополнительные реквизиты получателя."}</p>
        </>}
        {flow.working === "recipient" && <p role="status" className={styles.status}>Проверяем получателя…</p>}
        <button type="submit" className={styles.primary} disabled={!flow.recipient.address.trim() || flow.working === "recipient"}>
          Продолжить
        </button>
      </form>}

      {data && stage === "amount" && <form className={styles.form} onSubmit={event => {
        event.preventDefault(); if (quote) flow.review(); else void flow.requestQuote();
      }}>
        <div className={styles.recipientLine}>
          <div><span className={styles.hint}>Получатель</span><bdi>{mask(flow.validatedRecipient?.address ?? "")}</bdi></div>
          <button type="button" className={styles.textButton} aria-label="Изменить получателя" onClick={flow.editRecipient}>Изменить</button>
        </div>
        <label className={styles.label} htmlFor={`${fieldId}-amount`}>Сумма, {route.symbol}</label>
        <div className={styles.amountInput}>
          <input id={`${fieldId}-amount`} type={privacy ? "password" : "text"} inputMode="decimal" autoComplete="off"
            value={flow.amount} onChange={event => flow.changeAmount(event.target.value)} placeholder="0" required
            aria-describedby={`${fieldId}-available${error ? ` ${fieldId}-error` : ""}`}
            aria-invalid={flow.issue && ["invalid-amount", "precision", "below-minimum", "above-maximum", "insufficient-asset"].includes(flow.issue.code) || undefined} />
          <span aria-hidden="true">{route.symbol}</span>
        </div>
        <p className={styles.hint} id={`${fieldId}-available`}>Доступно: {data.terms.available === null ? "пока неизвестно" : mask(`${data.terms.available} ${route.symbol}`)}</p>
        {(data.terms.minimum !== undefined || data.terms.maximum !== undefined) && <p className={styles.hint}>
          {privacy ? "Лимиты скрыты" : [data.terms.minimum === undefined ? null : `От ${data.terms.minimum} ${route.symbol}`,
            data.terms.maximum === undefined ? null : `До ${data.terms.maximum} ${route.symbol}`].filter(Boolean).join(" · ")}
        </p>}
        {flow.working === "quote" ? <p className={styles.status} role="status">Рассчитываем комиссию…</p>
          : quote ? <QuoteDetails quote={quote} privacy={privacy} />
            : <p className={styles.feeUnknown}>Комиссия ещё не рассчитана</p>}
        {quote ? <button type="submit" className={styles.primary}>Проверить перевод</button>
          : <button type="submit" className={styles.primary} disabled={!flow.amount.trim() || flow.working === "quote"}>Рассчитать комиссию</button>}
      </form>}

      {data && quote && stage === "review" && <div className={styles.review}>
        <p className={styles.amount}>{mask(`${quote.request.amount} ${route.symbol}`)}</p>
        <dl className={styles.details}>
          <Detail label="Со счёта">{route.accountLabel}</Detail>
          <Detail label="Сеть">{route.networkLabel}</Detail>
          <Detail label="Получатель"><bdi>{mask(quote.request.recipient.address)}</bdi></Detail>
          {quote.request.recipient.memo && <Detail label={data.recipient.memo?.label ?? "Дополнительные реквизиты"}>
            <bdi>{mask(quote.request.recipient.memo)}</bdi>
          </Detail>}
          {quote.assetDebit !== quote.request.amount && <Detail label={`Всего со счёта, ${route.symbol}`}>{mask(quote.assetDebit)}</Detail>}
        </dl>
        <QuoteDetails quote={quote} privacy={privacy} />
        <p className={styles.note}>Сумма и комиссия тестовые. Подтверждение запустит только симуляцию.</p>
        <button className={styles.primary} type="button" onClick={() => void flow.submit()}>Подтвердить симуляцию</button>
      </div>}

      {pending && <div className={styles.outcome}>
        <span className={styles.resultMark} aria-hidden="true">…</span>
        <p role="status" className={styles.status}>Выполняется симуляция. Дождитесь результата.</p>
        {activePoolId !== null && <PendingBatteryNote />}
      </div>}

      {stage === "result" && flow.result && <div className={styles.outcome}>
        <span className={styles.resultMark} aria-hidden="true">{resultSuccess ? "✓" : "!"}</span>
        <p className={styles.resultText}>{resultSuccess ? "Средства не отправлены. Это результат симуляции."
          : flow.result.status === "simulated-failure" && flow.result.reason === "expired"
            ? "Срок расчёта истёк. Для повторной симуляции нужен новый расчёт."
            : "Симуляция прервана. Средства не отправлены; можно получить новый расчёт и повторить."}</p>
        {quote?.feeFunding.kind === "battery" && <p className={styles.note}>{resultSuccess
          ? "Демо: показан этап списания после успеха. Реальный пул не изменён."
          : "Пул не изменён. Правила возврата заряда для реальной операции пока неизвестны."}</p>}
        {resultSuccess ? <button className={styles.primary} type="button" onClick={onClose}>Готово</button>
          : <button className={styles.primary} type="button" onClick={() => void flow.requestQuote()}>Пересчитать и повторить</button>}
        {!resultSuccess && <button className={styles.secondary} type="button" onClick={onClose}>Закрыть</button>}
      </div>}
    </div>
  </section>;
}

function useBatteryActivity(poolId: string | null, onChange: SendFlowProps["onBatteryActivityChange"]) {
  const listener = useRef(onChange);
  // Update only after commit. Handler identity changes do not replay activity or
  // create a parent setState -> render -> notification loop.
  useEffect(() => { listener.current = onChange; }, [onChange]);
  useEffect(() => { listener.current?.(poolId === null ? null : { poolId, phase: "using" }); }, [poolId]);
  // This keyed route session owns its cleanup. Old async results are already
  // suppressed by useSendFlow's generation guard and cannot publish afterward.
  useEffect(() => () => { listener.current?.(null); }, []);
}

function subscribeDocumentVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function documentVisible() { return document.visibilityState === "visible"; }
function serverVisible() { return false; }

function PendingBatteryNote() {
  const visible = useSyncExternalStore(subscribeDocumentVisibility, documentVisible, serverVisible);
  return <p className={`${styles.note} ${styles.batteryPending}`}>
    <svg className={styles.batteryIndicator} viewBox="0 0 28 18" role="img" aria-label="Батарейка используется" data-visible={visible}>
      <rect x="1" y="2" width="23" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M26 6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect className={styles.batteryCharge} x="4" y="5" width="17" height="8" rx="1.5" fill="currentColor" />
    </svg>
    <span>Демо: заряд показан как временно удержанный. Остаток пула не меняется.</span>
  </p>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function QuoteDetails({ quote, privacy }: { quote: SendQuote; privacy: boolean }) {
  const funding = quote.feeFunding;
  return <div className={styles.quote}>
    <dl className={styles.details}>
      <Detail label="Комиссия сети">{quote.networkFee.status === "known"
        ? privacy ? "••••" : `${quote.networkFee.amount} ${quote.networkFee.symbol}` : "Неизвестна"}</Detail>
      <Detail label="Оплата комиссии">{funding.kind === "battery" ? "Батарейка · демо" : "Средства счёта · демо"}</Detail>
    </dl>
    {funding.kind === "battery" && <details className={styles.battery}>
      <summary>Общий пул · {funding.pool.networkLabel}</summary>
      <p>Для этой симуляции: {privacy ? "••••" : funding.charges} заряд. Пул общий для подходящих счетов этой сети,
        включая «{quote.request.route.accountLabel}».</p>
      <p>При обработке — временное удержание; после успеха — списание. В демо остаток пула не меняется.
        Правила возврата при ошибке пока неизвестны.</p>
    </details>}
    <p className={styles.hint}>Демо-расчёт ограничен по времени. При изменении данных потребуется новый.</p>
  </div>;
}
