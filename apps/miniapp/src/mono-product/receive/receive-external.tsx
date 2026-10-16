import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ExternalReceiveDestination, ReceiveQrRenderer, ReceiveRoute } from "./receive-types";
import { buildReceiveRequestText, normalizeReceiveRequestAmount, RECEIVE_REQUEST_AMOUNT_MAX_LENGTH } from "./receive-request";
import styles from "./receive.module.css";

const subscribe = () => () => {};
const unavailableOnServer = () => false;
const clipboardAvailable = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";
const shareAvailable = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
type BrowserAction = "copy-reference" | "copy-request" | "share";
type Feedback = { kind: "idle" | "pending" | "success" | "error"; message: string; action?: BrowserAction };

export function ExternalReceive({ route, destination, privacy, renderQr, requestAmount, onRequestAmountChange }: {
  route: ReceiveRoute; destination: ExternalReceiveDestination; privacy: boolean; renderQr?: ReceiveQrRenderer;
  requestAmount: string; onRequestAmountChange: (amount: string) => void;
}) {
  const amountId = useId();
  const canCopy = useSyncExternalStore(subscribe, clipboardAvailable, unavailableOnServer);
  const canShare = useSyncExternalStore(subscribe, shareAvailable, unavailableOnServer);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle", message: "" });
  const normalized = normalizeReceiveRequestAmount(requestAmount);
  const requestText = buildReceiveRequestText({ symbol: route.symbol, networkLabel: route.networkLabel,
    reference: destination.reference, rawAmount: requestAmount });
  const amountError = normalized.status !== "invalid" ? null : normalized.reason === "too-long"
    ? "В поле можно ввести до 128 символов." : normalized.reason === "non-positive"
      ? "Сумма должна быть больше нуля." : "Введите положительную сумму обычным числом, без степени.";
  const pending = feedback.kind === "pending";
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function perform(action: BrowserAction) {
    const text = action === "copy-reference" ? destination.reference : requestText;
    if (privacy || busy.current || text === null || (action === "share" ? !canShare : !canCopy)) return;
    busy.current = true;
    setFeedback({ kind: "pending", action, message: action === "share" ? "Открываем меню «Поделиться»…" : "Копируем…" });
    try {
      if (action !== "share") await navigator.clipboard.writeText(text);
      else await navigator.share({ title: `Демо · ${route.symbol} · ${route.networkLabel}`,
        text });
      if (active.current) setFeedback({ kind: "success", action, message: action === "copy-reference"
        ? "Демо-реквизиты скопированы." : action === "copy-request" ? "Запрос скопирован." : "Действие «Поделиться» завершено." });
    } catch (error) {
      if (!active.current) return;
      // Browser exceptions can come from another realm (WebViews and test environments).
      const cancelled = action === "share" && typeof error === "object" && error !== null &&
        "name" in error && error.name === "AbortError";
      setFeedback(cancelled ? { kind: "idle", action, message: "Меню «Поделиться» закрыто." } : {
        kind: "error", action, message: action === "copy-reference"
          ? "Не удалось скопировать. Выделите реквизиты и скопируйте вручную."
          : action === "copy-request" ? "Не удалось скопировать запрос. Попробуйте ещё раз."
            : "Не удалось открыть меню «Поделиться». Запрос можно скопировать.",
      });
    } finally {
      busy.current = false;
    }
  }

  const qr = privacy ? null : renderQr?.({ value: destination.reference, testOnly: true,
    accountId: destination.accountId, assetId: destination.assetId, networkId: destination.networkId });

  return <>
    {!privacy && <div className={styles.requestAmount}>
      <div className={styles.amountLabel}><label htmlFor={amountId}>Желаемая сумма</label><span>Необязательно</span></div>
      <div className={styles.amountInput}>
        <input id={amountId} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
          maxLength={RECEIVE_REQUEST_AMOUNT_MAX_LENGTH} placeholder="Без суммы" value={requestAmount} disabled={pending}
          aria-invalid={amountError ? true : undefined} aria-describedby={`${amountId}-hint${amountError ? ` ${amountId}-error` : ""}`}
          onChange={event => {
            if (busy.current) return;
            setFeedback({ kind: "idle", message: "" });
            onRequestAmountChange(event.currentTarget.value);
          }} />
        <span>{route.symbol}</span>
      </div>
      <p id={`${amountId}-hint`} className={styles.amountHint}>Это пожелание, не расчёт операции.</p>
      {amountError && <p id={`${amountId}-error`} className={styles.amountError} role="alert">{amountError}</p>}
    </div>}
    <section className={styles.destination} aria-label="Неплатёжные реквизиты">
      <div className={styles.reference}>
        <div className={styles.referenceHeading}>
          <span className={styles.eyebrow}>ЗАПРОС НА ПОЛУЧЕНИЕ</span>
          <span className={styles.nonPayable}>Не для оплаты</span>
        </div>
        {privacy ? <div className={styles.privacyNotice}><strong>Реквизиты скрыты</strong>
          <p>Выключите скрытие данных, чтобы увидеть реквизиты.</p></div> : <>
          {requestText !== null ? <div role="group" aria-label="Предпросмотр запроса" className={styles.requestPreview}>
            <div className={styles.requestSummary}>
              <strong>{normalized.status === "valid" ? `${normalized.amount} ${route.symbol}` : route.symbol}</strong>
              <span>{route.networkLabel}</span>
            </div>
            <code>{destination.reference}</code>
          </div> : <code>{destination.reference}</code>}
        </>}
        <div className={styles.referenceTools}>
          <button type="button" className={styles.copyReference} disabled={privacy || !canCopy || pending}
            onClick={() => void perform("copy-reference")}>
            <ActionIcon kind="copy" state={feedback.action === "copy-reference" ? feedback.kind : "idle"} />
            <span>Скопировать реквизиты</span>
          </button>
          {!privacy && !qr && <p className={styles.qrHint}>QR не подключён</p>}
        </div>
        {!privacy && qr && <div className={styles.qr} role="img" aria-label="Тестовый QR демо-реквизитов — не для оплаты">{qr}</div>}
      </div>
    </section>
    <p className={styles.networkWarning}><span aria-hidden="true">!</span>
      <span>Для {route.symbol} нужна сеть {route.networkLabel}. Средства из другой сети могут быть потеряны.</span>
    </p>
    <div className={styles.actions}>
      <button type="button" className={styles.primaryButton} disabled={privacy || !canCopy || pending || requestText === null}
        onClick={() => void perform("copy-request")}>
        <ActionIcon kind="copy" state={feedback.action === "copy-request" ? feedback.kind : "idle"} /><span>Скопировать запрос</span>
      </button>
      <button type="button" className={styles.button} disabled={privacy || !canShare || pending || requestText === null}
        aria-label="Поделиться запросом" onClick={() => void perform("share")}>
        <ActionIcon kind="share" state={feedback.action === "share" ? feedback.kind : "idle"} /><span>Поделиться</span>
      </button>
    </div>
    {!privacy && (!canCopy || !canShare) && <p className={styles.supportNote}>{!canCopy
      ? "Копирование недоступно в этом браузере. Выделите демо-реквизиты и скопируйте вручную."
      : "Поделиться недоступно. Запрос можно скопировать."}</p>}
    <p className={styles.feedback} role={feedback.kind === "error" ? "alert" : "status"} aria-atomic="true">{feedback.message}</p>
  </>;
}

function ActionIcon({ kind, state }: { kind: "copy" | "share"; state: Feedback["kind"] }) {
  return <svg className={styles.actionIcon} data-state={state} width="18" height="18" viewBox="0 0 20 20"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {state === "success" ? <path d="m4 10 4 4 8-9" /> : state === "pending"
      ? <path d="M4 10h.1M10 10h.1M16 10h.1" strokeWidth="3" /> : kind === "copy"
        ? <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M12 4V3H3v9h1" /></>
        : <><path d="M10 12V3m-4 4 4-4 4 4" /><path d="M4 11v6h12v-6" /></>}
  </svg>;
}
