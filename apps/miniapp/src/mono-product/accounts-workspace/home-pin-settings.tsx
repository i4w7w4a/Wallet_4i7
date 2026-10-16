"use client";

import { useId, useState } from "react";
import type { ProductAccountKind } from "@wallet/core";
import { HOME_PIN_LIMIT, normalizeHomePins, type AccountGroup } from "../home-pins";
import { AccountContextIcon } from "../product-account-chooser";
import { AccountKindIcon } from "./account-kind-icon";
import { UNAVAILABLE_ACCOUNT_SLOTS } from "./account-catalogue";
import styles from "./home-pin-settings.module.css";

export type HomePinSettingsProps = {
  groups: readonly AccountGroup[];
  pinnedKinds: readonly ProductAccountKind[];
  totalOnly: boolean;
  onToggle(kind: ProductAccountKind): boolean;
  onTotalOnlyChange(totalOnly: boolean): boolean;
};

export function HomePinSettings({ groups, pinnedKinds, totalOnly, onToggle, onTotalOnlyChange }: HomePinSettingsProps) {
  const hintId = useId();
  const [message, setMessage] = useState("");
  const selectable = groups.filter(group => group.kind !== "private");
  const selected = normalizeHomePins(pinnedKinds, selectable.filter(group => group.available).map(group => group.kind));
  function toggle(group: AccountGroup) {
    if (!group.available) return;
    const adding = !selected.includes(group.kind);
    const replaced = adding && selected.length >= HOME_PIN_LIMIT ? groups.find(candidate => candidate.kind === selected[0]) : null;
    if (!onToggle(group.kind)) return;
    setMessage(replaced ? `«${replaced.label}» заменён на «${group.label}». На главной остаются два кошелька.`
      : adding && totalOnly ? "Показываем выбранные кошельки. Режим «Только общий баланс» выключен." : "");
  }
  return <fieldset className={styles.pinSettings} aria-describedby={hintId}>
    <legend>На главной</legend>
    <label className={styles.pinChoice}>
      <AccountContextIcon className={styles.icon} stacked />
      <span>Только общий баланс</span>
      <input type="checkbox" checked={totalOnly} onChange={event => {
        if (onTotalOnlyChange(event.target.checked)) setMessage("");
      }} />
    </label>
    <p className={styles.modeHint}>{totalOnly
      ? "Выбор сохранён. Снимите галочку, чтобы вернуть кошельки, или выберите другой кошелёк."
      : "Общий баланс всегда включает все счета. Выбор кошелька выключает режим «Только общий баланс»."}</p>
    <div className={styles.pinChoices}>
      {selectable.map(group => <label key={group.kind} className={styles.pinChoice} data-unavailable={!group.available}>
        <AccountKindIcon kind={group.kind} className={styles.icon} />
        <span className={styles.copy}><span id={`${hintId}-${group.kind}-label`}>{group.label}</span>
          {!group.available && <small id={`${hintId}-${group.kind}-hint`}>Пока недоступен</small>}</span>
        <input type="checkbox" checked={selected.includes(group.kind)} disabled={!group.available}
          aria-labelledby={`${hintId}-${group.kind}-label`}
          aria-describedby={!group.available ? `${hintId}-${group.kind}-hint` : undefined}
          onChange={() => toggle(group)} />
      </label>)}
      {UNAVAILABLE_ACCOUNT_SLOTS.map(slot => <label key={slot.key} className={styles.pinChoice} data-unavailable="true">
        {slot.iconKind ? <AccountKindIcon kind={slot.iconKind} className={styles.icon} /> : <AccountContextIcon className={styles.icon} />}
        <span className={styles.copy}><span id={`${hintId}-${slot.key}-label`}>{slot.label}</span>
          <small id={`${hintId}-${slot.key}-hint`}>{slot.explanation}</small></span>
        <input type="checkbox" checked={false} disabled aria-labelledby={`${hintId}-${slot.key}-label`}
          aria-describedby={`${hintId}-${slot.key}-hint`} />
      </label>)}
    </div>
    <p id={hintId} className={styles.pinHint}>До двух кошельков. Третий доступный выбор заменит самый давно выбранный.</p>
    {message && <p role="status" className={styles.pinHint}>{message}</p>}
  </fieldset>;
}
