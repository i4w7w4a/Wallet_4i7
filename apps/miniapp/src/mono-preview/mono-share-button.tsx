"use client";

import { useState } from "react";
import "./mono-share-button.css";

export type MonoShareButtonProps = { createLink: () => Promise<string>; disabled?: boolean };
export function MonoShareButton({ createLink, disabled = false }: MonoShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function generate() {
    setBusy(true); setLink(""); setError(""); setStatus("");
    try { setLink(await createLink()); }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось создать ссылку."); }
    finally { setBusy(false); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Ссылка скопирована");
    } catch { setStatus("Выделите ссылку и скопируйте её вручную."); }
  }

  return <section className="mono-share" aria-label="Поделиться оформлением">
    <button type="button" disabled={disabled || busy} onClick={() => { void generate(); }}>
      {busy ? "Готовим ссылку…" : "Получить ссылку"}
    </button>
    {link && <>
      <p>Ссылка сохраняет этот вид. Последующие изменения в неё не попадут.</p>
      <input aria-label="Ссылка на оформление" readOnly value={link} onFocus={event => event.currentTarget.select()} />
      <div className="mono-share__actions">
        <button type="button" onClick={() => { void copy(); }}>Скопировать</button>
        <a href={link} target="_blank" rel="noopener noreferrer">Открыть готовый вид</a>
      </div>
    </>}
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
  </section>;
}
