"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_VISUAL_EFFECTS,
  normalizeVisualEffects,
  type PreferenceStorage,
  type VisualEffectsConfig,
} from "@wallet/core";

export const VISUAL_EFFECTS_STORAGE_KEY = "wallet4i7.visual.v1";

export type VisualEffectsController = {
  effects: VisualEffectsConfig;
  setEffects(patch: Partial<VisualEffectsConfig>): void;
  resetEffects(): void;
};

const VisualEffectsContext = createContext<VisualEffectsController | null>(null);

export function useVisualEffects(): VisualEffectsController {
  const value = useContext(VisualEffectsContext);

  if (value === null) {
    throw new Error("useVisualEffects должен вызываться внутри VisualEffectsProvider");
  }

  return value;
}

export function VisualEffectsProvider(props: {
  storage: PreferenceStorage;
  children: ReactNode;
}) {
  const { storage, children } = props;
  const loaded = useMemo(() => readStoredEffects(storage), [storage]);
  const [effects, setEffectsState] = useState<VisualEffectsConfig>(loaded.effects);
  const [recovered, setRecovered] = useState(loaded.corrupted);
  const persistFrame = useRef<number | null>(null);

  const persistEffects = useCallback(
    (next: VisualEffectsConfig) => {
      if (persistFrame.current !== null) {
        cancelAnimationFrame(persistFrame.current);
      }

      persistFrame.current = requestAnimationFrame(() => {
        persistFrame.current = null;
        storage.setItem(VISUAL_EFFECTS_STORAGE_KEY, JSON.stringify(next));
      });
    },
    [storage],
  );

  useEffect(() => {
    if (loaded.corrupted) {
      persistEffects(loaded.effects);
    }
  }, [loaded, persistEffects]);

  useEffect(
    () => () => {
      if (persistFrame.current !== null) {
        cancelAnimationFrame(persistFrame.current);
      }
    },
    [],
  );

  const setEffects = useCallback(
    (patch: Partial<VisualEffectsConfig>) => {
      setEffectsState((current) => {
        const next = normalizeVisualEffects({ ...current, ...patch });
        persistEffects(next);
        return next;
      });
    },
    [persistEffects],
  );

  const resetEffects = useCallback(() => {
    const next = { ...DEFAULT_VISUAL_EFFECTS };
    setRecovered(false);
    setEffectsState(next);
    persistEffects(next);
  }, [persistEffects]);

  const controller = useMemo<VisualEffectsController>(
    () => ({ effects, setEffects, resetEffects }),
    [effects, resetEffects, setEffects],
  );

  return (
    <VisualEffectsContext.Provider value={controller}>
      {recovered ? (
        <div role="status">Эффекты сброшены: сохранённые настройки повреждены</div>
      ) : null}
      {children}
    </VisualEffectsContext.Provider>
  );
}

function readStoredEffects(storage: PreferenceStorage): {
  effects: VisualEffectsConfig;
  corrupted: boolean;
} {
  const raw = storage.getItem(VISUAL_EFFECTS_STORAGE_KEY);

  if (raw === null || raw === "") {
    return { effects: { ...DEFAULT_VISUAL_EFFECTS }, corrupted: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const validVersion =
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { version?: unknown }).version === 1;

    return {
      effects: normalizeVisualEffects(parsed),
      corrupted: !validVersion,
    };
  } catch {
    return { effects: { ...DEFAULT_VISUAL_EFFECTS }, corrupted: true };
  }
}
