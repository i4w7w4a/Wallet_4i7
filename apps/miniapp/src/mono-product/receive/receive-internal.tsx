import { useId, useLayoutEffect, useRef, useState } from "react";
import type { InternalReceiveDestination, ReceiveRoute } from "./receive-types";
import styles from "./receive.module.css";

export function InternalReceive({ route, destination, onClose }: {
  route: ReceiveRoute; destination: InternalReceiveDestination; onClose: () => void;
}) {
  const radioName = useId(), reviewTitleId = useId();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [step, setStep] = useState<"sources" | "review">("sources");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const selectedInput = useRef<HTMLInputElement>(null);
  const source = destination.sources.find(candidate => candidate.accountId === sourceId && candidate.status === "available");
  useLayoutEffect(() => {
    if (step === "review") reviewHeading.current?.focus();
    else selectedInput.current?.focus();
  }, [step]);

  if (step === "review" && source) return <section className={styles.review} aria-labelledby={reviewTitleId}>
    <button type="button" className={styles.back} onClick={() => setStep("sources")}>
      <span aria-hidden="true">←</span>Назад к счетам-источникам
    </button>
    <h4 id={reviewTitleId} ref={reviewHeading} tabIndex={-1}>Маршрут пополнения</h4>
    <div className={styles.transferPath} role="group" aria-label="Направление пополнения">
      <div><span>Откуда</span><strong>{source.accountLabel}</strong></div>
      <span className={styles.pathArrow} aria-hidden="true">↓</span>
      <div><span>Куда</span><strong>{route.accountLabel}</strong></div>
    </div>
    <p className={styles.reviewAsset}>{route.symbol} · {route.networkLabel}</p>
    <div className={styles.operationNote}><strong>Перевод не выполнен</strong>
      <p>Комиссия пока неизвестна. Сумма и подтверждение недоступны.</p></div>
    <button type="button" className={styles.primaryButton} onClick={onClose}>Готово</button>
  </section>;

  if (!destination.sources.length) return <div className={styles.empty} role="status">
    <strong>Нет доступных счетов-источников</strong><p>Для внутреннего пополнения нужен другой подходящий счёт в сети {route.networkLabel}.</p>
  </div>;

  const available = destination.sources.some(candidate => candidate.status === "available");
  return <div>
    <p className={styles.intro}>Выберите счёт для пополнения.</p>
    <fieldset className={styles.sources}>
      <legend>Откуда</legend>
      {destination.sources.map(candidate => <label key={candidate.accountId} className={styles.source}
        data-selected={candidate.accountId === sourceId} data-unavailable={candidate.status !== "available"}>
        <input type="radio" name={radioName} checked={candidate.accountId === sourceId}
          ref={candidate.accountId === sourceId ? selectedInput : undefined} disabled={candidate.status !== "available"}
          onChange={() => setSourceId(candidate.accountId)} />
        <span><strong>{candidate.accountLabel}</strong><small>{candidate.status === "inactive"
          ? "Нужна активация счёта" : candidate.status === "unavailable" ? "Недоступен для этого маршрута"
          : `${route.symbol} · ${route.networkLabel}`}</small></span>
      </label>)}
    </fieldset>
    <div className={styles.receiveTarget}>
      <span aria-hidden="true">↓</span><div><span>Куда</span><strong>{route.accountLabel}</strong></div>
    </div>
    {!available && <p className={styles.supportNote} role="status">Нет доступных счетов-источников. Выберите другой маршрут.</p>}
    <p className={styles.demoNote}>Средства не перемещаются.</p>
    <button type="button" className={styles.primaryButton} disabled={!source} onClick={() => setStep("review")}>Проверить маршрут</button>
  </div>;
}
