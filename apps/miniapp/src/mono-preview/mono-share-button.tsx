"use client";

import { useEffect, useRef, useState } from "react";
import "./mono-share-button.css";

export type MonoShareButtonProps = {
  sourceKey: string;
  createLink: () => Promise<string>;
  disabled?: boolean;
  /** Same-tab navigation keeps the browser Back path to the saved editor. */
  openLink?: (link: string) => void;
};

function localLink(link: string): boolean {
  const host = new URL(link).hostname;
  return host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || host.startsWith("127.");
}

export function MonoShareButton({ sourceKey, ...props }: MonoShareButtonProps) {
  return <MonoShareSnapshot key={sourceKey} {...props} />;
}

function MonoShareSnapshot({ createLink, disabled = false, openLink = link => window.location.assign(link) }:
  Omit<MonoShareButtonProps, "sourceKey">) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  async function resolve(): Promise<string | null> {
    if (running.current) return null;
    running.current = true;
    setBusy(true); setLink(""); setError(""); setStatus("");
    try {
      const result = await createLink();
      return alive.current ? result : null;
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку.");
      return null;
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function open() {
    const result = await resolve();
    if (!result || !alive.current) return;
    try { openLink(result); }
    catch { setError("Не удалось открыть кошелёк. Скопируйте ссылку и откройте её вручную."); setLink(result); }
  }

  async function copy() {
    const result = await resolve();
    if (!result || !alive.current) return;
    setLink(result);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(result);
      if (alive.current) setStatus("Ссылка скопирована");
    } catch {
      if (alive.current) setStatus("Выделите ссылку и скопируйте её вручную.");
    }
  }

  return <section className="mono-share" aria-label="Поделиться готовым кошельком">
    <div className="mono-share__actions">
      <button type="button" data-mono-share-action="open" disabled={disabled || busy}
        onClick={() => { void open(); }}>{busy ? "Готовим…" : "Открыть кошелёк"}</button>
      <button type="button" data-mono-share-action="copy" disabled={disabled || busy}
        aria-label="Скопировать ссылку" title="Скопировать ссылку" onClick={() => { void copy(); }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
        </svg>
      </button>
    </div>
    {link && <div className="mono-share__link">
      {localLink(link) && <p>Локальная ссылка · на этом компьютере</p>}
      {link.length > 4000 && <p>Длинная ссылка: мессенджер может её обрезать. Сохраните JSON из меню пресета.</p>}
      <input aria-label="Ссылка на кошелёк" readOnly value={link}
        onFocus={event => event.currentTarget.select()} />
    </div>}
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
  </section>;
}
