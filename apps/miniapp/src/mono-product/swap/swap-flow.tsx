"use client";

import { useEffect, useId, useRef, useState } from "react";
import { commerceIssueMessage, commerceRouteKey, readCommerceDecimal, type CryptoPlacement, type SwapFlowProps } from "../commerce";
import { CurrencyLogo } from "../currency-logo";
import { formatQuantity } from "../product-format";
import { useSwapFlow } from "./use-swap-flow";
import styles from "./swap-flow.module.css";
export type { SwapFlowProps } from "../commerce";

export function SwapFlow(props: SwapFlowProps) {
  return <SwapSession key={commerceRouteKey(props.route)} {...props} />;
}

function SwapSession(props: SwapFlowProps) {
  const [route] = useState(props.route);
  const flow = useSwapFlow({ ...props, route });
  const fieldId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const { privacy } = props;
  const quote = flow.result?.quote ?? flow.quote;
  const destination = quote?.credit ?? flow.pair?.destination ?? null;
  const sourcePlacement = quote?.source ?? route;
  const mask = (quantity: string, symbol: string) => `${privacy ? "••••" : formatQuantity(quantity)} ${symbol}`;
  const success = flow.result?.result.status === "simulated-success";
  const title = flow.loading ? "Готовим обмен" : !flow.data ? "Обмен недоступен"
    : flow.stage === "edit" ? "Что обмениваем" : flow.stage === "review" ? "Проверьте обмен"
      : flow.stage === "pending" ? "Обмен в обработке" : success ? "Симуляция завершена" : "Симуляция не выполнена";
  const available = flow.data ? readCommerceDecimal(flow.data.terms.available) : null;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [flow.stage, flow.loading]);
  useEffect(() => {
    if (flow.issue && ["invalid-amount", "precision", "below-minimum", "above-maximum", "insufficient-asset", "insufficient-fee"].includes(flow.issue.code)) {
      amountInput.current?.focus({ preventScroll: true });
    }
  }, [flow.issue]);

  return <section className={styles.flow} aria-label="Демонстрационный обмен" data-swap-stage={flow.stage}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); flow.close(); }
    }}>
    <div className={styles.toolbar}>
      <button type="button" className={styles.textButton} disabled={flow.pending} onClick={flow.back}>
        <span aria-hidden="true">←</span> Назад
      </button>
      <span className={styles.demo}>Демо</span>
      {props.showCloseButton && <button type="button" className={styles.textButton} disabled={flow.pending} onClick={flow.close}>Закрыть</button>}
    </div>
    <div key={flow.loading ? "load" : flow.stage} className={styles.step}>
      <div className={styles.heading}>
        <h3 ref={heading} tabIndex={-1}>{title}</h3>
        {flow.data && (flow.stage === "edit" || flow.stage === "review") && <span className={styles.stepNumber}>
          {flow.stage === "edit" ? "1 / 2" : "2 / 2"}
        </span>}
      </div>
      {flow.issue && <p id={`${fieldId}-error`} className={styles.error} role="alert">{commerceIssueMessage(flow.issue)}</p>}
      {flow.loading && <p className={styles.status} role="status">Загружаем условия обмена…</p>}
      {!flow.loading && !flow.data && flow.retryable && <button type="button" className={styles.primary} onClick={flow.loadAgain}>Повторить загрузку</button>}
      {flow.data && flow.data.pairs.length === 0 && <p className={styles.status}>Для этого источника нет доступных пар обмена.</p>}
      {flow.data && flow.data.pairs.length > 0 && <>
        {flow.restoredDraft && flow.stage === "edit" && <p className={styles.note}>Черновик · расчёт нужно получить заново.</p>}
        <form onSubmit={event => { event.preventDefault(); if (flow.stage === "edit") void flow.calculate(); }}>
          <div className={styles.legs}>
            <section aria-label="Отдаю" className={styles.leg}>
              <label className={styles.label} htmlFor={flow.stage === "edit" ? `${fieldId}-amount` : undefined}>Отдаю</label>
              <Placement placement={sourcePlacement} />
              {flow.stage === "edit" ? <div className={styles.amountInput}>
                <input ref={amountInput} id={`${fieldId}-amount`} type="text" inputMode="decimal" autoComplete="off"
                  aria-label={`Отдаю, ${route.symbol}`} aria-describedby={flow.issue ? `${fieldId}-error` : undefined}
                  value={privacy ? "" : flow.sourceAmount} placeholder={privacy ? "Суммы скрыты" : "Сумма"}
                  disabled={privacy} onChange={event => flow.changeAmount(event.target.value)} />
                <span>{route.symbol}</span>
              </div> : <p className={styles.amount}>{quote ? mask(quote.source.quantity, quote.source.symbol) : "После расчёта"}</p>}
              {flow.stage === "edit" && <p className={styles.hint}>
                {privacy ? `Доступно: •••• ${route.symbol}` : available !== null
                  ? `Доступно: ${formatQuantity(available)} ${route.symbol}` : "Доступный остаток неизвестен"}
              </p>}
            </section>
            <div className={styles.connector} aria-hidden="true">↓</div>
            <section aria-label="Получаю" className={styles.leg}>
              <span className={styles.label}>Получаю</span>
              {destination ? <Placement placement={destination} /> : <p className={styles.hint}>Выберите направление обмена</p>}
              {flow.stage === "edit" && <>
                <label className={styles.choiceLabel} htmlFor={`${fieldId}-pair`}>Актив получения</label>
                <select id={`${fieldId}-pair`} className={styles.select} value={flow.pairId ?? ""} disabled={privacy}
                  onChange={event => flow.changePair(event.target.value)}>
                  <option value="">Выберите направление</option>
                  {flow.data.pairs.map(pair => <option key={pair.id} value={pair.id}>
                    {pair.destination.symbol} · {pair.destination.accountLabel} · {pair.destination.networkLabel}
                  </option>)}
                </select>
              </>}
              <p className={quote ? styles.amount : styles.after}>{quote ? mask(quote.credit.quantity, quote.credit.symbol) : "После расчёта"}</p>
            </section>
          </div>
          {quote && <dl className={styles.details}>
            <div><dt>Комиссия · демо</dt><dd>{quote.fee.status === "known" ? mask(quote.fee.amount,
              quote.fee.unit.kind === "crypto" ? quote.fee.unit.symbol : quote.fee.unit.currency) : "Неизвестна"}</dd></div>
            <div className={styles.total}><dt>Всего списывается</dt><dd>{mask(quote.debit.quantity, quote.debit.symbol)}</dd></div>
            <div><dt>Курс · пример</dt><dd>{privacy ? "Курс скрыт" : quote.rate.label.replace(/^Демо-курс:\s*/, "")}</dd></div>
            {flow.stage === "review" && <div><dt>Расчёт действует до</dt><dd>
              {new Date(quote.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </dd></div>}
          </dl>}
          {(flow.stage === "edit" || flow.stage === "review") && <p className={styles.note}>
            Демонстрационный обмен. Курс и комиссия — пример; балансы не изменятся.
          </p>}
          {privacy && <p className={styles.note}>Суммы скрыты. Покажите их, чтобы продолжить обмен.</p>}
          {flow.stage === "edit" && <button type="submit" className={styles.primary}
            disabled={privacy || !flow.pair || flow.working === "quote"}>
            {flow.working === "quote" ? "Рассчитываем…" : "Рассчитать обмен"}
          </button>}
          {flow.working === "quote" && <p className={styles.status} role="status">Рассчитываем демонстрационный обмен…</p>}
          {flow.stage === "review" && <button type="button" className={styles.primary} disabled={privacy} onClick={() => void flow.submit()}>Подтвердить симуляцию</button>}
        </form>
        {flow.stage === "pending" && <p className={styles.status} role="status">
          Ожидаем результат демонстрационного обмена. Дождитесь ответа, чтобы закрыть панель.
        </p>}
        {flow.stage === "result" && <div className={styles.outcome}>
          <span className={styles.resultMark} aria-hidden="true">{success ? "✓" : "!"}</span>
          <p>{success ? "Демонстрационный обмен завершён. Балансы не изменены."
            : "Симуляция завершилась отказом. Средства не перемещены; показан принятый расчёт."}</p>
          {props.onViewHistory && <button type="button" className={styles.primary} onClick={props.onViewHistory}>В истории</button>}
          {!success && <button type="button" className={props.onViewHistory ? styles.textButton : styles.primary} onClick={flow.recalculate}>Новый расчёт</button>}
          <button type="button" className={props.onViewHistory || !success ? styles.secondary : styles.primary} onClick={flow.close}>Готово</button>
        </div>}
      </>}
      {flow.notice && <p className={styles.note} role="status">{flow.notice}</p>}
    </div>
  </section>;
}

function Placement({ placement }: { placement: CryptoPlacement }) {
  return <div className={styles.route}>
    <CurrencyLogo assetId={placement.assetId} className={styles.asset} />
    <span className={styles.identity}><strong>{placement.symbol}</strong><span>{placement.accountLabel}</span></span>
    <span className={styles.network}>{placement.networkLabel}</span>
  </div>;
}
