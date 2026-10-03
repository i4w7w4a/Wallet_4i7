import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ExternalReceiveDestination, ReceiveQrRenderer, ReceiveRoute } from "./receive-types";
import styles from "./receive.module.css";

const subscribe = () => () => {};
const unavailableOnServer = () => false;
const clipboardAvailable = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";
const shareAvailable = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
type Feedback = { kind: "idle" | "pending" | "success" | "error"; message: string };

export function ExternalReceive({ route, destination, privacy, renderQr }: {
  route: ReceiveRoute; destination: ExternalReceiveDestination; privacy: boolean; renderQr?: ReceiveQrRenderer;
}) {
  const canCopy = useSyncExternalStore(subscribe, clipboardAvailable, unavailableOnServer);
  const canShare = useSyncExternalStore(subscribe, shareAvailable, unavailableOnServer);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle", message: "" });
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function perform(action: "copy" | "share") {
    if (privacy || busy.current || (action === "copy" ? !canCopy : !canShare)) return;
    busy.current = true;
    setFeedback({ kind: "pending", message: action === "copy" ? "Копируем…" : "Открываем меню «Поделиться»…" });
    try {
      if (action === "copy") await navigator.clipboard.writeText(destination.reference);
      else await navigator.share({ title: `Демо · ${route.symbol} · ${route.networkLabel}`,
        text: `ДЕМОНСТРАЦИЯ — НЕ ДЛЯ ОПЛАТЫ\n${route.symbol} · ${route.networkLabel}\n${destination.reference}` });
      if (active.current) setFeedback({ kind: "success", message: action === "copy"
        ? "Демо-реквизиты скопированы." : "Действие «Поделиться» завершено." });
    } catch (error) {
      if (!active.current) return;
      // Browser exceptions can come from another realm (WebViews and test environments).
      const cancelled = action === "share" && typeof error === "object" && error !== null &&
        "name" in error && error.name === "AbortError";
      setFeedback(cancelled ? { kind: "idle", message: "Меню «Поделиться» закрыто." } : {
        kind: "error", message: action === "copy"
          ? "Не удалось скопировать. Выделите реквизиты и скопируйте вручную."
          : "Не удалось открыть меню «Поделиться». Реквизиты можно скопировать.",
      });
    } finally {
      busy.current = false;
    }
  }

  const qr = privacy ? null : renderQr?.({ value: destination.reference, testOnly: true,
    accountId: destination.accountId, assetId: destination.assetId, networkId: destination.networkId });

  return <>
    <p className={styles.networkWarning}><span aria-hidden="true">!</span>
      <span>Для {route.symbol} нужна сеть {route.networkLabel}. Другая сеть может привести к потере средств.</span>
    </p>
    <div className={styles.destination}>
      <div className={styles.destinationVisual}>
        {privacy ? <><span className={styles.placeholderMark} aria-hidden="true">—</span><strong>Реквизиты скрыты</strong></>
          : qr ? <div className={styles.qr} role="img" aria-label="Тестовый QR демо-реквизитов — не для оплаты">{qr}</div>
          : <><span className={styles.placeholderMark} aria-hidden="true">↓</span><strong>QR не подключён</strong>
              <span>Демо-реквизиты ниже — не платёжный адрес.</span></>}
      </div>
      <div className={styles.reference}>
        <span className={styles.eyebrow}>ДЕМО-РЕКВИЗИТЫ · {route.networkLabel}</span>
        {privacy ? <p>Выключите скрытие данных, чтобы увидеть реквизиты.</p> : <code>{destination.reference}</code>}
      </div>
    </div>
    <p className={styles.demoNote}>Не отправляйте средства. Это демонстрация, реквизиты не принимают платежи.</p>
    <div className={styles.actions}>
      <button type="button" className={styles.primaryButton} disabled={privacy || !canCopy || feedback.kind === "pending"}
        aria-label="Копировать демо-реквизиты" onClick={() => void perform("copy")}>Копировать</button>
      <button type="button" className={styles.button} disabled={privacy || !canShare || feedback.kind === "pending"}
        aria-label="Поделиться демо-реквизитами" onClick={() => void perform("share")}>Поделиться</button>
    </div>
    {!privacy && (!canCopy || !canShare) && <p className={styles.supportNote}>{!canCopy
      ? "Копирование недоступно в этом браузере. Выделите демо-реквизиты и скопируйте вручную."
      : "Меню «Поделиться» недоступно в этом браузере. Реквизиты можно скопировать."}</p>}
    <p className={styles.feedback} role={feedback.kind === "error" ? "alert" : "status"} aria-atomic="true">{feedback.message}</p>
  </>;
}
