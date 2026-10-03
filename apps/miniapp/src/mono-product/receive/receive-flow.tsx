"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { ExternalReceive } from "./receive-external";
import { InternalReceive } from "./receive-internal";
import type { ReceiveDataPort, ReceiveFlowProps, ReceiveLoadResult, ReceiveRequest,
  ReceiveRoute, ReceiveUnavailableReason } from "./receive-types";
import styles from "./receive.module.css";

export function ReceiveFlow(props: ReceiveFlowProps) {
  const { route } = props;
  if (route.action !== "receive" ||
    (route.receiveMode !== "external-address" && route.receiveMode !== "internal-transfer")) {
    return <ReceiveFrame {...props} state="unavailable"><Unavailable reason="route-unavailable" /></ReceiveFrame>;
  }

  // Reset local choices immediately on route changes, before any new asynchronous result.
  const key = JSON.stringify([route.accountId, route.assetId, route.networkId, route.receiveMode]);
  return <ReceiveRouteContent key={key} {...props} route={route} />;
}

function ReceiveRouteContent(props: ReceiveFlowProps & { route: ReceiveRoute }) {
  const { route, dataPort, privacy, renderQr, onClose } = props;
  const { accountId, assetId, networkId, receiveMode } = route;
  const request = useMemo<ReceiveRequest>(() => ({ accountId, assetId, networkId, receiveMode }),
    [accountId, assetId, networkId, receiveMode]);
  const [attempt, setAttempt] = useState(0);
  const backButton = useRef<HTMLButtonElement>(null);
  const [completed, setCompleted] = useState<{
    port: ReceiveDataPort; attempt: number; result: ReceiveLoadResult;
  } | null>(null);
  const state: ReceiveLoadResult | { status: "loading" } =
    completed?.port === dataPort && completed.attempt === attempt ? completed.result : { status: "loading" };

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = validateResult(request, await dataPort.load(request, { signal: controller.signal }));
        if (!controller.signal.aborted) setCompleted({ port: dataPort, attempt, result });
      } catch {
        if (!controller.signal.aborted) setCompleted({ port: dataPort, attempt,
          result: { status: "error", reason: "load-failed", retryable: true } });
      }
    }
    void load();
    return () => controller.abort();
  }, [request, dataPort, attempt]);

  return <ReceiveFrame {...props} state={state.status} backButtonRef={backButton}>
    <div key={state.status} className={styles.state} aria-busy={state.status === "loading"}>
      {state.status === "loading" && <div className={styles.empty} role="status">
        <span className={styles.stateMark} aria-hidden="true">…</span>
        <strong>{receiveMode === "external-address" ? "Загружаем реквизиты" : "Проверяем счета-источники"}</strong>
        <p>Выбранный маршрут сохранён.</p>
      </div>}
      {state.status === "unavailable" && <Unavailable reason={state.reason} />}
      {state.status === "error" && <div className={styles.empty}>
        <div role="alert">
          <strong>{state.reason === "route-mismatch" ? "Данные не подходят выбранному маршруту" :
            state.reason === "unsafe-destination" ? "Реквизиты не предназначены для демо" : "Не удалось загрузить данные"}</strong>
          <p>Реквизиты скрыты. {state.retryable ? "Попробуйте ещё раз или выберите другой маршрут." : "Вернитесь к выбору маршрута."}</p>
        </div>
        {state.retryable && <button type="button" className={styles.button} onClick={() => {
          backButton.current?.focus();
          setAttempt(value => value + 1);
        }}>Повторить</button>}
      </div>}
      {state.status === "ready" && (state.data.mode === "external-address"
        ? <ExternalReceive key={privacy ? "private" : "visible"} route={route} destination={state.data}
            privacy={privacy} renderQr={renderQr} />
        : <InternalReceive route={route} destination={state.data} onClose={onClose} />)}
    </div>
  </ReceiveFrame>;
}

function ReceiveFrame({ route, onBack, onClose, onAssetDetails, showCloseButton = true, state, children, backButtonRef }:
  ReceiveFlowProps & { state: string; children: ReactNode; backButtonRef?: Ref<HTMLButtonElement> }) {
  const titleId = useId();
  const internal = route.action === "receive" && route.receiveMode === "internal-transfer";
  return <section className={styles.flow} aria-labelledby={titleId} data-receive-state={state}>
    <div className={styles.navigation}>
      <button type="button" ref={backButtonRef} className={styles.back} onClick={() => onBack(route)}>
        <span aria-hidden="true">←</span>Назад к выбору маршрута
      </button>
      {showCloseButton && <button type="button" className={styles.close} aria-label="Закрыть получение" onClick={onClose}>×</button>}
    </div>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>{internal ? "МЕЖДУ СЧЕТАМИ" : "ВНЕШНЕЕ ПОПОЛНЕНИЕ"}</p>
        <h3 id={titleId}>{internal ? "Внутреннее пополнение" : `Получить ${route.symbol}`}</h3></div>
      <span className={styles.demoBadge}>ДЕМО</span>
    </header>
    <dl className={styles.context}>
      <div><dt>Счёт{internal ? " зачисления" : ""}</dt><dd>{route.accountLabel}</dd></div>
      {onAssetDetails ? <div className={styles.assetContext}>
        <dt>Актив и сеть</dt>
        <dd><button type="button" className={styles.assetButton}
          aria-label={`Подробнее об активе ${route.symbol} в сети ${route.networkLabel}`} onClick={onAssetDetails}>
          <strong>{route.symbol}</strong><span>{route.networkLabel}</span><span aria-hidden="true">↗</span>
        </button></dd>
      </div> : <>
        <div><dt>Актив</dt><dd>{route.symbol}</dd></div>
        <div><dt>Сеть</dt><dd>{route.networkLabel}</dd></div>
      </>}
    </dl>
    {children}
  </section>;
}

const unavailableCopy: Record<ReceiveUnavailableReason, [string, string]> = {
  "account-inactive": ["Счёт не активирован", "Для пополнения нужна активация счёта. В демо она не выполняется."],
  "account-unavailable": ["Счёт недоступен", "Сейчас получить средства на этот счёт нельзя. Выберите другой счёт."],
  "route-unavailable": ["Получение недоступно", "Этот счёт не поддерживает выбранный способ получения, актив или сеть."],
  "destination-not-connected": ["Реквизиты пока недоступны", "Адрес для этого маршрута ещё не предоставлен. Выберите другой маршрут или вернитесь позже."],
  "sources-not-connected": ["Счета-источники пока недоступны", "Для внутреннего пополнения нужен подходящий счёт-источник. В этом демо такие связи ещё не заданы."],
};

function Unavailable({ reason }: { reason: ReceiveUnavailableReason }) {
  const [title, description] = unavailableCopy[reason];
  return <div className={styles.empty} role="status">
    <span className={styles.stateMark} aria-hidden="true">—</span>
    <strong>{title}</strong><p>{description}</p>
  </div>;
}

function validateResult(request: ReceiveRequest, result: ReceiveLoadResult): ReceiveLoadResult {
  if (result.status !== "ready") return result;
  const data = result.data;
  if (data.accountId !== request.accountId || data.assetId !== request.assetId ||
      data.networkId !== request.networkId || data.mode !== request.receiveMode) {
    return { status: "error", reason: "route-mismatch", retryable: true };
  }
  if (data.mode === "external-address") {
    if (data.safety !== "demo-non-payable" || typeof data.reference !== "string" ||
        !/^DEMO-NON-PAYABLE:\S+$/.test(data.reference)) {
      return { status: "error", reason: "unsafe-destination", retryable: false };
    }
  } else {
    const ids = new Set<string>();
    for (const source of data.sources) {
      if (!source.accountId || source.accountId === request.accountId || ids.has(source.accountId) ||
          source.assetId !== request.assetId || source.networkId !== request.networkId ||
          !["available", "inactive", "unavailable"].includes(source.status)) {
        return { status: "error", reason: "route-mismatch", retryable: true };
      }
      ids.add(source.accountId);
    }
  }
  return result;
}
