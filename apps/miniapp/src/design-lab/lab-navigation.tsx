import styles from "./lab-navigation.module.css";

export const LAB_ITEMS = [
  { id: "home", title: "Лаборатория", href: "/design-lab", purpose: "Общий вход в мастерские дизайна.", path: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { id: "atmosphere", title: "Фоны", href: "/design-lab/atmosphere", purpose: "Материал и движение фоновой сцены.", path: "M2 8c2.5-2 5.5-2 8 0s5.5 2 8 0 5.5-2 8 0M2 14c2.5-2 5.5-2 8 0s5.5 2 8 0 5.5-2 8 0" },
  { id: "buttons", title: "Кнопки", href: "/design-lab/buttons", purpose: "Поверхность, кромка и иконка действий.", path: "M4 4h16v16H4zM8 8h8v8H8z" },
  { id: "motion", title: "Отклик", href: "/design-lab/motion", purpose: "Поведение кнопок при нажатии и наведении.", path: "M3 12h12m-4-4 4 4-4 4M17 5a7 7 0 0 1 0 14" },
  { id: "type", title: "Шрифты", href: "/design-lab/type", purpose: "Набор и ритм типографики MONO.", path: "M4 5h16M12 5v14M8 19h8" },
  { id: "scene", title: "Сцена", href: "/design-lab/scene", purpose: "Композиция элементов экрана MONO.", path: "M3 4h18v16H3zM7 9h10M7 13h6M7 17h10" },
] as const;

export type LabId = (typeof LAB_ITEMS)[number]["id"];
export type LabNavigationProps = { active: LabId; enabled?: readonly LabId[] };

export function LabGlyph({ path }: { path: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>;
}

/** Plain links preserve each workshop's beforeunload warning for unsaved drafts. */
export function LabNavigation({ active, enabled = ["home"] }: LabNavigationProps) {
  return <nav className={styles.navigation} aria-label="Мастерские">
    {LAB_ITEMS.filter(item => enabled.includes(item.id)).map(item =>
      <a className={styles.link} key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}>
        <LabGlyph path={item.path} /><span>{item.title}</span>
      </a>)}
  </nav>;
}
