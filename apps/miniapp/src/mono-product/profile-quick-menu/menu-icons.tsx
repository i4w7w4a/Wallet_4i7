export type MenuIconName = "theme" | "language" | "currency" | "documents" | "support" | "home";

/** Small MONO primitives; same viewBox/stroke as the existing profile family. */
export function MenuIcon({ name }: { name: MenuIconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "theme" && <>
      <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
      <path d="M17 2v3M20 7h3M19 4l2-2" />
    </>}
    {name === "home" && <>
      <path d="m3 10 9-7 9 7v10H3V10Z" />
      <g data-menu-icon-gesture="home"><path d="M9 20v-7h6v7" /></g>
    </>}
    {name === "language" && <>
      <path d="M3 5h12M9 3v2M5 5c1 5 4 8 8 10M13 5c-1 5-4 8-9 11" />
      <g data-menu-icon-gesture="language"><path d="m14 21 4-10 4 10M15.4 17.5h5.2" /></g>
    </>}
    {name === "currency" && <>
      <circle cx="12" cy="12" r="9" />
      <g data-menu-icon-gesture="currency"><path d="M12 6v12M15 8.5c-.7-.8-1.7-1.2-3-1.2-1.7 0-3 1-3 2.3 0 3.4 6 1.4 6 4.8 0 1.3-1.3 2.3-3 2.3-1.3 0-2.3-.4-3-1.2" /></g>
    </>}
    {name === "documents" && <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <g data-menu-icon-gesture="documents"><path d="M14 3v6h6M8 13h8M8 17h6" /></g>
    </>}
    {name === "support" && <>
      <path d="M3 13v-2a9 9 0 0 1 18 0v2M19 19a3 3 0 0 1-3 3h-3" />
      <path d="M11 22h2" />
      <g data-menu-icon-gesture="support"><rect x="3" y="11" width="4" height="8" rx="2" /><rect x="17" y="11" width="4" height="8" rx="2" /></g>
    </>}
  </svg>;
}
