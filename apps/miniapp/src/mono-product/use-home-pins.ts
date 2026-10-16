"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductAccountKind, ProductSnapshot } from "@wallet/core";
import { defaultHomePins, HOME_PINS_STORAGE_KEY, LEGACY_HOME_PINS_STORAGE_KEY, normalizeHomePins,
  parseHomePinPreference, selectAccountGroups, toggleHomePinPreference, type HomePinPreference } from "./home-pins";

export function useHomePins(snapshot: Readonly<ProductSnapshot>, persist = true) {
  const groups = useMemo(() => selectAccountGroups(snapshot), [snapshot]);
  const availableKinds = useMemo(() => groups.filter(group => group.available).map(group => group.kind), [groups]);
  const availableRef = useRef(availableKinds);
  availableRef.current = availableKinds;
  // Server and first client render use the same supplied snapshot defaults.
  const [preference, setPreference] = useState<HomePinPreference | null>(null);
  const pinnedKinds = normalizeHomePins(preference?.groups ?? defaultHomePins(groups), availableKinds);
  const totalOnly = preference?.totalOnly ?? false;
  const current = useRef<HomePinPreference>({ groups: pinnedKinds, totalOnly });
  current.current = { groups: pinnedKinds, totalOnly };
  useEffect(() => {
    if (!persist) return;
    try {
      const stored = parseHomePinPreference(window.localStorage.getItem(HOME_PINS_STORAGE_KEY), availableRef.current) ??
        parseHomePinPreference(window.localStorage.getItem(LEGACY_HOME_PINS_STORAGE_KEY), availableRef.current);
      setPreference(stored);
    }
    catch { /* The in-memory defaults and controls remain available. */ }
  }, [persist]);
  useEffect(() => {
    setPreference(previous => {
      if (!previous) return previous;
      const valid = normalizeHomePins(previous.groups, availableKinds);
      return valid.length === previous.groups.length && valid.every((kind, index) => kind === previous.groups[index])
        ? previous : { ...previous, groups: valid };
    });
  }, [availableKinds]);
  useEffect(() => {
    if (!persist || !preference) return;
    try {
      window.localStorage.setItem(HOME_PINS_STORAGE_KEY, JSON.stringify({ version: 2,
        groups: normalizeHomePins(preference.groups, availableKinds), totalOnly: preference.totalOnly }));
    } catch { /* Denied storage must not undo in-memory choices. */ }
  }, [preference, persist, availableKinds]);

  function togglePin(kind: ProductAccountKind): boolean {
    const next = toggleHomePinPreference(current.current, kind, availableKinds);
    if (!next) return false;
    current.current = next; setPreference(next);
    return true;
  }
  function setTotalOnly(value: boolean): boolean {
    const next = { ...current.current, totalOnly: value };
    current.current = next; setPreference(next);
    return true;
  }
  return { groups, pinnedKinds, totalOnly, togglePin, setTotalOnly };
}
