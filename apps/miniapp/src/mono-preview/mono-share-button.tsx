"use client";

import { useState } from "react";
import "./mono-share-button.css";

export type MonoShareButtonProps = { sourceKey: string; createLink: () => Promise<string>; disabled?: boolean };
function localLink(link: string): boolean {
  const host = new URL(link).hostname;
  return host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || host.startsWith("127.");
}
export function MonoShareButton({ sourceKey, ...props }: MonoShareButtonProps) {
  return <MonoShareSnapshot key={sourceKey} {...props} />;
}

function MonoShareSnapshot({ createLink, disabled = false }: Omit<MonoShareButtonProps, "sourceKey">) {
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
    <button type="button" data-mono-share-create disabled={disabled || busy} onClick={() => { void generate(); }}>
      {busy ? "Готовим ссылку…" : "Получить ссылку"}
    </button>
    {link && <>
      {localLink(link) && <p>Локальная ссылка · на этом компьютере</p>}
      <p>Снимок сохранённого оформления. Изменения после создания в ссылку не попадут.</p>
      {link.length > 4000 && <p>Длинная ссылка: мессенджер может её обрезать. Сохраните JSON из меню пресета.</p>}
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
