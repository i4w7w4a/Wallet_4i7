import type { ProductProfileSection } from "./product-profile";
import styles from "./product-profile.module.css";

// Lucide 1.52.0, commit 500620a2e8123f8d1db191538886dc0c223f69a9 (ISC).
// Original geometry; JSX, shared stroke and motion groups adapted for MONO.
// Source hashes and complete upstream notices: docs/assets/profile-section-icons.md.
export function ProfileSectionIcon({ section }: { section: ProductProfileSection }) {
  return <svg className={styles.sectionIcon} data-profile-section-icon={section}
    width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {section === "personal" && <>
      <path d="M16 2v2" />
      <path d="M8 2v2" />
      <g className={`${styles.iconGesture} ${styles.contactPortrait}`}>
        <path d="M17.915 21a6 6 0 10-12 0" />
        <circle cx="12" cy="11" r="4" />
      </g>
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </>}
    {section === "settings" && <g className={`${styles.iconGesture} ${styles.cogGesture}`}>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </g>}
    {section === "security" &&
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />}
    {section === "help" && <>
      <path d="M12 5v16" />
      <g className={`${styles.iconGesture} ${styles.bookPage}`}>
        <path d="M16 13h2" />
        <path d="M16 9h2" />
      </g>
      <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
      <path d="M6 13h2" />
      <path d="M6 9h2" />
    </>}
  </svg>;
}
