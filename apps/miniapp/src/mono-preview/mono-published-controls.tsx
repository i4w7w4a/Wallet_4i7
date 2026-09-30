"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeMonoAppearanceEnvelope, type MonoAppearanceEnvelope } from "./mono-preset-envelope";
import type { MonoPublishedSlot } from "./mono-published-contract";
import styles from "./mono-published-controls.module.css";

type Props = {
  slot: MonoPublishedSlot;
  disabled?: boolean;
  getSnapshot: () => Promise<MonoAppearanceEnvelope | null>;
};
type Remote = { slot: MonoPublishedSlot; revision: number; published: boolean; loading: boolean; error: boolean };

function exactPublicOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return url.origin === value && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password &&
    (url.protocol === "https:" || (local && url.protocol === "http:")) ? value : null;
}

export function MonoPublishedPresetControls(props: Props) {
  return <PublishedControls key={props.slot} {...props} />;
}

function PublishedControls({ slot, disabled = false, getSnapshot }: Props) {
  const alive = useRef(false);
  const readEpoch = useRef(0);
  const disabledNow = useRef(disabled);
  const busyNow = useRef(false);
  const [remote, setRemote] = useState<Remote>({ slot, revision: 0, published: false, loading: true, error: false });
  const [publicOrigin, setPublicOrigin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState("Проверяю публикацию…");
  const path = `/p/${slot}`;
  const publicLink = publicOrigin ? `${publicOrigin}${path}` : null;

  useEffect(() => { disabledNow.current = disabled; }, [disabled]);

  const readRemote = useCallback(async (epoch: number): Promise<void> => {
    const configResponse = await fetch("/api/mono-published/config", { cache: "no-store", credentials: "omit" });
    if (!configResponse.ok) throw new Error("Публикация не настроена.");
    const config: unknown = await configResponse.json();
    const origin = exactPublicOrigin(config && typeof config === "object" ?
      (config as { publicOrigin?: unknown }).publicOrigin : null);
    if (!origin) throw new Error("Неверный публичный адрес.");
    if (!alive.current || readEpoch.current !== epoch) return;
    setPublicOrigin(origin);
    const response = await fetch(`/api/mono-published/${slot}`, { cache: "no-store", credentials: "omit" });
    if (!alive.current || readEpoch.current !== epoch) return;
    if (response.status === 404) {
      setRemote({ slot, revision: 0, published: false, loading: false, error: false });
      setStatus("Публичный адрес ещё не заполнен.");
      return;
    }
    if (!response.ok) throw new Error("Не удалось проверить публикацию.");
    const value: unknown = await response.json();
    if (!alive.current || readEpoch.current !== epoch) return;
    if (!value || typeof value !== "object" || (value as { slot?: unknown }).slot !== slot ||
        !Number.isSafeInteger((value as { revision?: unknown }).revision) ||
        (value as { revision: number }).revision < 1) throw new Error("Неверный ответ публикации.");
    const revision = (value as { revision: number }).revision;
    setRemote({ slot, revision, published: true, loading: false, error: false });
    setStatus(`Опубликована ревизия ${revision}.`);
  }, [slot]);

  useEffect(() => {
    alive.current = true;
    const epoch = ++readEpoch.current;
    void readRemote(epoch).catch(() => {
      if (alive.current && readEpoch.current === epoch) {
        setPublicOrigin(null);
        setRemote({ slot, revision: 0, published: false, loading: false, error: true });
        setStatus("Публикация временно недоступна.");
      }
    });
    return () => { alive.current = false; };
  }, [readRemote, slot]);

  async function publish() {
    if (disabledNow.current || busyNow.current || remote.loading || remote.error || remote.slot !== slot ||
        !publicOrigin || conflict) return;
    const expectedRevision = remote.revision;
    busyNow.current = true;
    setBusy(true);
    setStatus("Подготавливаю принятый снимок…");
    try {
      const source = await getSnapshot();
      if (!alive.current || disabledNow.current) return;
      if (!source) { setStatus("Есть незавершённая проба или сохранение. Сначала завершите её."); return; }
      const snapshot = normalizeMonoAppearanceEnvelope(source);
      if (!alive.current || disabledNow.current) return;
      const response = await fetch(`/api/mono-published/${slot}`, {
        method: "PUT", credentials: "omit", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision, snapshot }),
      });
      if (!alive.current) return;
      if (response.status === 409) {
        setConflict(true); setStatus("Адрес изменён в другом окне. Обновите статус перед новой публикацией."); return;
      }
      if (!response.ok) {
        setStatus(response.status === 413 ? "Снимок слишком велик." :
          response.status === 422 ? "Снимок не прошёл проверку." :
          response.status === 403 ? "Сервер отклонил запрос публикации." : "Сервер не сохранил публикацию.");
        return;
      }
      const value: unknown = await response.json();
      if (!alive.current) return;
      if (!value || typeof value !== "object" || (value as { slot?: unknown }).slot !== slot ||
          !Number.isSafeInteger((value as { revision?: unknown }).revision) ||
          (value as { revision: number }).revision <= expectedRevision) throw new Error("Неверный ответ публикации.");
      const revision = (value as { revision: number }).revision;
      setRemote({ slot, revision, published: true, loading: false, error: false });
      setStatus(`Опубликована ревизия ${revision}. Адрес остался прежним.`);
    } catch { if (alive.current) setStatus("Публикация не выполнена. Проверьте снимок и соединение."); }
    finally { busyNow.current = false; if (alive.current) setBusy(false); }
  }

  async function copy() {
    if (!publicLink || !remote.published || remote.error) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      if (alive.current) setStatus("Публичная ссылка скопирована.");
    } catch { if (alive.current) setStatus(`Ссылка: ${publicLink}`); }
  }

  async function refresh() {
    const epoch = ++readEpoch.current;
    setConflict(false);
    setRemote(before => ({ ...before, loading: true }));
    try { await readRemote(epoch); }
    catch {
      if (alive.current && readEpoch.current === epoch) {
        setPublicOrigin(null);
        setRemote(before => ({ ...before, loading: false, error: true }));
        setStatus("Не удалось обновить статус публикации.");
      }
    }
  }

  return <section className={styles.root} aria-label={`Публикация пресета ${slot}`}>
    <div className={styles.heading}><strong>Адрес {slot}</strong><code>{path}</code></div>
    <div className={styles.actions}>
      {remote.published && !remote.error && publicLink && remote.slot === slot && <>
        <a className={styles.iconAction} href={publicLink} target="_blank" rel="noopener noreferrer"
          aria-label="Открыть готовый кошелёк" title="Открыть готовый кошелёк"><span aria-hidden="true">↗</span></a>
        <button className={styles.iconAction} type="button" onClick={() => void copy()}
          aria-label="Скопировать ссылку" title="Скопировать ссылку"><span aria-hidden="true">⧉</span></button>
      </>}
      <button className={styles.publish} type="button" data-mono-publish-action="publish" data-mono-publish-slot={slot}
        disabled={disabled || busy || remote.loading || remote.error || remote.slot !== slot || !publicOrigin || conflict}
        onClick={() => void publish()}>{remote.published ? "Обновить" : "Опубликовать"}</button>
      {(conflict || remote.error) && <button className={styles.iconAction} type="button"
        onClick={() => void refresh()} aria-label="Обновить статус" title="Обновить статус">
        <span aria-hidden="true">↻</span></button>}
    </div>
    <p role="status" aria-live="polite" className={styles.status}>{status}</p>
  </section>;
}
