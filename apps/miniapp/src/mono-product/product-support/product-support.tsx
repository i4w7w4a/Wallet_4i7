import { isProfileLinkAllowed, type ProductProfileResource } from "../profile";
import styles from "./product-support.module.css";

export function ProductSupportContent({ resource }: { resource: ProductProfileResource }) {
  const support = resource.status === "ready" && resource.data.support && isProfileLinkAllowed(resource.data.support.href)
    ? resource.data.support : null;
  const telegram = support !== null && new URL(support.href).hostname === "t.me";
  const label = support?.label.trim() || "Связаться с поддержкой";
  const message = resource.status === "loading" ? "Загружаем контакт поддержки…"
    : resource.status === "error" ? "Не удалось загрузить контакт поддержки."
      : "Контакт поддержки пока не подключён";

  return <div className={styles.support}>
    {support ? <>
      <p className={styles.message}>Временные контакты поддержки</p>
      <ul className={styles.channels} role="list" aria-label="Временные контакты поддержки">
        <li>
          <a className={`${styles.row} ${styles.contact}`} href={support.href} target="_blank" rel="noopener noreferrer">
            <SupportChannelIcon channel={telegram ? "telegram" : "contact"} />
            <span className={styles.copy}>
              {telegram ? <>
                <span className={styles.name}>Telegram</span>
                <span className={styles.detail}>{label}</span>
              </> : <span className={styles.name}>{label}</span>}
            </span>
            <svg className={styles.arrow} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
              <path d="M4 12 12 4M5 4h7v7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </li>
        <li className={`${styles.row} ${styles.disabled}`} aria-disabled="true">
          <SupportChannelIcon channel="email" />
          <span className={styles.copy}><span className={styles.name}>Почта</span><span className={styles.detail}>Пока недоступна</span></span>
        </li>
        <li className={`${styles.row} ${styles.disabled}`} aria-disabled="true">
          <SupportChannelIcon channel="whatsapp" />
          <span className={styles.copy}><span className={styles.name}>WhatsApp</span><span className={styles.detail}>Пока недоступен</span></span>
        </li>
      </ul>
    </> : <p className={styles.message} role="status" aria-busy={resource.status === "loading"}>{message}</p>}
  </div>;
}

function SupportChannelIcon({ channel }: { channel: "telegram" | "contact" | "email" | "whatsapp" }) {
  const paths = {
    telegram: "m21 3-6 18-4-8-8-4 18-6ZM21 3 11 13",
    contact: "M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l2-2",
    email: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm-2 2 9 6 9-6",
    whatsapp: "M20 11.5a8 8 0 0 1-8 8 8 8 0 0 1-4-.9L3 21l1.5-5A8 8 0 1 1 20 11.5ZM8 7.5l2-.5 1 2-1.3 1c.6 1.3 1.5 2.2 2.8 2.8l1-1.3 2 1-.5 2c-3.7.4-6.4-2.3-6-6Z",
  };
  return <svg className={styles.channelIcon} width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[channel]} />
  </svg>;
}
