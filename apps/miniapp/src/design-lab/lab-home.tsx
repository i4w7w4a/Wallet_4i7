import { LAB_ITEMS, LabGlyph, LabNavigation, type LabId } from "./lab-navigation";
import styles from "./lab-navigation.module.css";

export function LabHome({ enabled = ["home"] }: { enabled?: readonly LabId[] }) {
  const workshops = LAB_ITEMS.filter(item => item.id !== "home" && enabled.includes(item.id));
  return <main className={styles.home}>
    <div className={styles.shell}>
      <LabNavigation active="home" enabled={enabled} />
      <header className={styles.intro}>
        <span className={styles.eyebrow}>NOVEX / DESIGN LAB</span>
        <h1>Лаборатория</h1>
        <p>Выберите доступную мастерскую для работы с оформлением и поведением интерфейса.</p>
      </header>
      {workshops.length > 0 && <section className={styles.cards} aria-label="Доступные мастерские">
        {workshops.map(item => <a className={styles.card} key={item.id} href={item.href}>
          <span className={styles.icon}><LabGlyph path={item.path} /></span>
          <span className={styles.copy}><strong>{item.title}</strong><span>{item.purpose}</span></span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </a>)}
      </section>}
    </div>
  </main>;
}
