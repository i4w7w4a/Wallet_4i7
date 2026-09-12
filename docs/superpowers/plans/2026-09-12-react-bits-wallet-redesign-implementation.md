# React Bits Wallet Redesign Implementation Plan

> **Для агентных исполнителей:** ОБЯЗАТЕЛЬНЫЙ ПОДНАВЫК: используйте `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans`, выполняйте задачи по порядку и отмечайте шаги `- [ ]`.

**Goal:** Превратить главную страницу Wallet_4i7 в цельную мобильную Web Threads-сцену с выразительным liquid-glass интерфейсом, живой настройкой четырёх цветов и сохранением всех текущих demo-взаимодействий.

**Architecture:** Доменный пакет хранит versioned-конфигурацию визуальных эффектов без React и DOM. UI-пакет содержит адаптированные исходники React Bits, отдельный visual provider и Wallet-компоненты; Mini App передаёт только platform/runtime capabilities и storage. В DOM работает один WebGL2 canvas, а отсутствие WebGL, reduced motion, saveData и неактивное приложение переводят сцену на статический poster без потери функциональности.

**Tech Stack:** TypeScript 5.9.2, React 19.3.0, Next.js 16.3.5, Vitest 5, Testing Library, Motion 13.2.0, OGL 1.0.11, Playwright 1.63.0, CSS, React Bits TS-CSS registry.

**Spec:** `docs/superpowers/specs/2026-09-12-react-bits-wallet-redesign-design.md`

## Global Constraints

- Перед началом исполнитель полностью читает spec и корневой `AGENTS.md`, если он появился в актуальном `origin/main`.
- Upstream React Bits зафиксирован на commit `3a1c7f2f9f94ed833934ab5c2635760b9e644583`; источник: `https://github.com/DavidHDev/react-bits`.
- Registry: `https://reactbits.dev/r/{name}.json`; импортируются только варианты `TS-CSS`.
- Runtime-зависимости: добавить только `ogl@1.0.11`; сохранить существующий `motion@13.2.0`. Не добавлять GSAP, Three.js, Rapier, Matter.js или postprocessing.
- React Bits используется как исходный код внутри продукта, а не переэкспортируется как самостоятельная библиотека; provenance и MIT + Commons Clause notice обязательны.
- На странице разрешён ровно один WebGL canvas и один постоянный animation loop.
- Максимальный DPR: `1.5` при viewport до 480 px включительно и `2` на большем viewport.
- `threadCount` всегда нормализуется в диапазоне `1..10`.
- `prefers-reduced-motion`, `saveData`, неактивный host, скрытая вкладка и ошибка WebGL2 включают статический fallback.
- `prefers-reduced-transparency` отключает `backdrop-filter` и заменяет glass непрозрачной surface.
- Интерактивные цели имеют размер не менее 44×44 px, русские accessible names и видимый `:focus-visible`.
- В action/header/navigation controls запрещены Unicode/emoji icons; используется собственный SVG-набор Wallet_4i7 на сетке 24×24, без новой icon runtime-зависимости.
- Финансовые операции остаются демонстрационными; существующие sheets, Telegram Back Button, поиск, уведомления и смена разделов не регрессируют.
- GitHub-коммиты, Issue/PR-тексты и новая проектная документация пишутся на русском.

---

## Карта файлов

### Новые файлы

- `components.json` — конфигурация официального React Bits registry для shadcn CLI.
- `THIRD_PARTY_NOTICES.md` — лицензия, upstream SHA и перечень адаптаций.
- `packages/core/src/visual-effects.ts` — versioned contract, defaults и нормализация shader-настроек.
- `packages/core/src/visual-effects.test.ts` — диапазоны, enum, booleans и восстановление повреждённых данных.
- `packages/ui/src/appearance/visual-effects-provider.tsx` — storage, controller и React context.
- `packages/ui/src/appearance/visual-effects-provider.test.tsx` — persistence и независимое восстановление visual preset.
- `packages/ui/src/appearance/wallet-visual-layer.tsx` — связь theme/runtime с одной WebThreads-сценой.
- `packages/ui/src/appearance/wallet-visual-layer.css` — fixed canvas, scrims, noise и fallback poster.
- `packages/ui/src/appearance/wallet-visual-layer.test.tsx` — отображение активной сцены и fallback.
- `packages/ui/src/appearance/web-threads-lab.tsx` — полный набор управляемых shader-параметров.
- `packages/ui/src/appearance/web-threads-lab.test.tsx` — labels, изменение, reset и клавиатура.
- `packages/ui/src/react-bits/web-threads/web-threads.tsx` — React lifecycle над адаптированным OGL engine.
- `packages/ui/src/react-bits/web-threads/web-threads-engine.ts` — renderer/program/uniforms и безопасный cleanup.
- `packages/ui/src/react-bits/web-threads/web-threads.css` — canvas layout.
- `packages/ui/src/react-bits/web-threads/web-threads.test.tsx` — один context, update без recreation, pause и dispose.
- `packages/ui/src/react-bits/glass-action/glass-action.tsx` и `.css` — контролируемая адаптация GlassIcons.
- `packages/ui/src/icons/wallet-icon.tsx`, `wallet-icon.css` и `wallet-icon.test.tsx` — единый SVG-набор из двенадцати резких промо-иконок.
- `packages/ui/src/react-bits/spotlight-surface/spotlight-surface.tsx` и `.css` — surface с fine-pointer spotlight.
- `packages/ui/src/react-bits/wallet-count-up/wallet-count-up.tsx` — locale/currency адаптация CountUp.
- `packages/ui/src/react-bits/gradient-text/gradient-text.tsx` и `.css` — короткий animated accent.
- `packages/ui/src/react-bits/click-spark/click-spark.tsx` и `.css` — canvas-отклик только после activation.
- `packages/ui/src/react-bits/wallet-gooey-nav/wallet-gooey-nav.tsx` и `.css` — controlled bottom navigation.
- `packages/ui/src/react-bits/react-bits-adapters.test.tsx` — доступность и lifecycle адаптаций.
- `apps/miniapp/playwright.config.ts` — мобильный Chromium preview.
- `apps/miniapp/e2e/dashboard.visual.spec.ts` — viewport, palette, fallback и screenshot-проверки.
- `apps/miniapp/e2e/dashboard.performance.spec.ts` — canvas/RAF/long-task budget.

### Изменяемые файлы

- `packages/core/src/index.ts` — публичные visual types/functions.
- `packages/ui/package.json`, `pnpm-lock.yaml` — `ogl@1.0.11`.
- `packages/ui/src/index.ts` — только Wallet-facing exports.
- `packages/ui/src/theme/theme-provider.tsx` — публичный `ThemeController`, CSS tokens и capability data attributes.
- `packages/ui/src/theme/theme-studio.tsx`, `theme-studio.css` — быстрая палитра + Web Threads Lab.
- `packages/ui/src/dashboard/dashboard.tsx`, `dashboard.css` — visual layer и новая композиция.
- `packages/ui/src/dashboard/profile-header.tsx` — glass header controls.
- `packages/ui/src/dashboard/balance-hero.tsx` — hero без video-card, CountUp и chart composition.
- `packages/ui/src/dashboard/quick-actions.tsx` — GlassAction + ClickSpark.
- `packages/ui/src/dashboard/liquid-promo-card.tsx` — SpotlightSurface + GradientText.
- `packages/ui/src/dashboard/asset-list-card.tsx` — цельная spotlight surface.
- `packages/ui/src/dashboard/portfolio-summary-card.tsx` — цельная allocation surface.
- `packages/ui/src/dashboard/bottom-navigation.tsx` — controlled WalletGooeyNav.
- `packages/ui/src/dashboard/dashboard-visuals.css`, `dashboard-controls.css` — mobile art direction.
- `apps/miniapp/src/app-providers.tsx` — runtime capabilities и VisualEffectsProvider.
- `apps/miniapp/src/smoke.test.tsx` — WebThreads/fallback/storage интеграция.
- `apps/miniapp/package.json`, корневой `package.json`, `pnpm-lock.yaml` — Playwright scripts/dev dependency.
- `apps/miniapp/app/globals.css` — mobile shell, font stack и poster fallback.
- `docs/assets/liquid-hero.md` — новая роль видео как fallback/reserve asset.

---

### Task 1: Зафиксировать registry, лицензию и зависимости

**Files:**
- Create: `components.json`
- Create: `THIRD_PARTY_NOTICES.md`
- Modify: `packages/ui/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: официальный registry `https://reactbits.dev/r/{name}.json`.
- Produces: воспроизводимая registry-конфигурация, лицензионный gate и установленный `ogl@1.0.11`; сами исходники переносятся после RED в Tasks 4–6.

- [ ] **Step 1: Создать registry-конфигурацию**

Добавить `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "apps/miniapp/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "packages/ui/src/react-bits",
    "utils": "packages/ui/src",
    "ui": "packages/ui/src",
    "lib": "packages/ui/src",
    "hooks": "packages/ui/src"
  },
  "registries": {
    "@react-bits": "https://reactbits.dev/r/{name}.json"
  }
}
```

- [ ] **Step 2: Проверить registry до копирования кода**

Run:

```powershell
$names = 'WebThreads-TS-CSS','GlassIcons-TS-CSS','SpotlightCard-TS-CSS','CountUp-TS-CSS','GradientText-TS-CSS','ClickSpark-TS-CSS','GooeyNav-TS-CSS'
$names | ForEach-Object { (Invoke-RestMethod "https://reactbits.dev/r/$_.json").name }
```

Expected: выводит ровно семь указанных имён без HTTP/JSON ошибок.

- [ ] **Step 3: Установить только разрешённые зависимости**

Run:

```bash
pnpm --filter @wallet/ui add ogl@1.0.11 --save-exact
pnpm --filter @wallet/ui add motion@13.2.0 --save-exact
```

Expected: `packages/ui/package.json` содержит `ogl: "1.0.11"` и `motion: "13.2.0"`; GSAP/Three/Rapier/Matter отсутствуют. Компоненты пока не копируются, чтобы каждый следующий review-gate сохранил честный RED → GREEN цикл.

- [ ] **Step 4: Добавить provenance и notice**

В начале каждого перенесённого `.tsx/.css` добавить:

```text
Adapted for Wallet_4i7 from React Bits at commit
3a1c7f2f9f94ed833934ab5c2635760b9e644583.
Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
```

В `THIRD_PARTY_NOTICES.md` перечислить семь upstream путей:

```markdown
# Сторонние компоненты

## React Bits

- Источник: https://github.com/DavidHDev/react-bits
- Commit: `3a1c7f2f9f94ed833934ab5c2635760b9e644583`
- Copyright (c) 2026 David Haz
- Лицензия: MIT + Commons Clause License Condition v1.0
- Условие: компоненты используются внутри Wallet_4i7 и не распространяются как отдельная библиотека.

Используемые upstream-файлы:

- `src/ts-default/Backgrounds/WebThreads/WebThreads.tsx` и `WebThreads.css`;
- `src/ts-default/Components/GlassIcons/GlassIcons.tsx` и `GlassIcons.css`;
- `src/ts-default/Components/SpotlightCard/SpotlightCard.tsx` и `SpotlightCard.css`;
- `src/ts-default/TextAnimations/CountUp/CountUp.tsx`;
- `src/ts-default/TextAnimations/GradientText/GradientText.tsx` и `GradientText.css`;
- `src/ts-default/Animations/ClickSpark/ClickSpark.tsx`;
- `src/ts-default/Components/GooeyNav/GooeyNav.tsx` и `GooeyNav.css`.

Изменения: controlled callbacks, русская локализация, доступность,
lifecycle/fallback, единая тема и mobile budgets.
```

- [ ] **Step 5: Проверить dependency и license gate**

Run:

```bash
pnpm install --frozen-lockfile
pnpm why ogl motion gsap three @react-three/fiber matter-js @dimforge/rapier3d-compat
git diff --check
```

Expected: `ogl 1.0.11` и `motion 13.2.0` присутствуют; запрещённые runtime-пакеты не появляются; `git diff --check` молчит.

- [ ] **Step 6: Commit**

```bash
git add components.json THIRD_PARTY_NOTICES.md packages/ui/package.json pnpm-lock.yaml
git commit -m "chore(ui): зафиксировать исходники React Bits"
```

---

### Task 2: Создать доменный контракт Web Threads

**Files:**
- Create: `packages/core/src/visual-effects.ts`
- Create: `packages/core/src/visual-effects.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `PreferenceStorage` только на уровне типов потребителей; сам модуль storage не использует.
- Produces: `VisualEffectsConfig`, `DEFAULT_VISUAL_EFFECTS`, `normalizeVisualEffects(input)` и `ThreadFanMode`.

- [ ] **Step 1: Написать failing tests нормализации**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_VISUAL_EFFECTS, normalizeVisualEffects } from "./visual-effects";

describe("normalizeVisualEffects", () => {
  it("ограничивает shader-параметры безопасными диапазонами", () => {
    expect(normalizeVisualEffects({
      ...DEFAULT_VISUAL_EFFECTS,
      speed: 99,
      threadCount: 18.7,
      position: -2,
      opacity: 4,
      grainIntensity: -1,
      pointerStrength: 9,
    })).toMatchObject({
      speed: 3,
      threadCount: 10,
      position: 0,
      opacity: 1,
      grainIntensity: 0,
      pointerStrength: 1,
    });
  });

  it("округляет threadCount и восстанавливает enum/booleans", () => {
    const result = normalizeVisualEffects({
      ...DEFAULT_VISUAL_EFFECTS,
      threadCount: 4.6,
      fanMode: "outside",
      mirror: "yes",
      shimmer: 1,
    });
    expect(result.threadCount).toBe(5);
    expect(result.fanMode).toBe(DEFAULT_VISUAL_EFFECTS.fanMode);
    expect(result.mirror).toBe(DEFAULT_VISUAL_EFFECTS.mirror);
    expect(result.shimmer).toBe(DEFAULT_VISUAL_EFFECTS.shimmer);
  });

  it("сбрасывает неизвестную версию и повреждённый input", () => {
    expect(normalizeVisualEffects({ ...DEFAULT_VISUAL_EFFECTS, version: 2 })).toEqual(DEFAULT_VISUAL_EFFECTS);
    expect(normalizeVisualEffects(null)).toEqual(DEFAULT_VISUAL_EFFECTS);
  });
});
```

- [ ] **Step 2: Подтвердить RED**

Run: `pnpm --filter @wallet/core test -- visual-effects.test.ts`

Expected: FAIL — модуль `./visual-effects` не найден.

- [ ] **Step 3: Реализовать точный contract и defaults**

```ts
export type ThreadFanMode = "center" | "left" | "right";

export type VisualEffectsConfig = {
  version: 1;
  speed: number;
  threadCount: number;
  frequency: number;
  spread: number;
  taper: number;
  position: number;
  fanMode: ThreadFanMode;
  glow: number;
  falloff: number;
  thickness: number;
  brightness: number;
  opacity: number;
  mirror: boolean;
  shimmer: boolean;
  grain: boolean;
  grainIntensity: number;
  pointerInteraction: boolean;
  pointerStrength: number;
};

export const DEFAULT_VISUAL_EFFECTS = {
  version: 1,
  speed: 0.75,
  threadCount: 7,
  frequency: 3,
  spread: 0.55,
  taper: 0.18,
  position: 0.46,
  fanMode: "right",
  glow: 0.08,
  falloff: 2,
  thickness: 0.65,
  brightness: 1.25,
  opacity: 0.92,
  mirror: true,
  shimmer: true,
  grain: true,
  grainIntensity: 0.08,
  pointerInteraction: true,
  pointerStrength: 0.22,
} as const satisfies VisualEffectsConfig;

const FAN_MODES = new Set<ThreadFanMode>(["center", "left", "right"]);

export function normalizeVisualEffects(input: unknown): VisualEffectsConfig {
  if (!isRecord(input) || input.version !== 1) return { ...DEFAULT_VISUAL_EFFECTS };
  return {
    version: 1,
    speed: numberIn(input.speed, 0, 3, DEFAULT_VISUAL_EFFECTS.speed),
    threadCount: Math.round(numberIn(input.threadCount, 1, 10, DEFAULT_VISUAL_EFFECTS.threadCount)),
    frequency: numberIn(input.frequency, 0.5, 8, DEFAULT_VISUAL_EFFECTS.frequency),
    spread: numberIn(input.spread, 0, 1, DEFAULT_VISUAL_EFFECTS.spread),
    taper: numberIn(input.taper, 0, 1, DEFAULT_VISUAL_EFFECTS.taper),
    position: numberIn(input.position, 0, 1, DEFAULT_VISUAL_EFFECTS.position),
    fanMode: typeof input.fanMode === "string" && FAN_MODES.has(input.fanMode as ThreadFanMode)
      ? input.fanMode as ThreadFanMode : DEFAULT_VISUAL_EFFECTS.fanMode,
    glow: numberIn(input.glow, 0.01, 0.25, DEFAULT_VISUAL_EFFECTS.glow),
    falloff: numberIn(input.falloff, 0.5, 4, DEFAULT_VISUAL_EFFECTS.falloff),
    thickness: numberIn(input.thickness, 0.1, 2, DEFAULT_VISUAL_EFFECTS.thickness),
    brightness: numberIn(input.brightness, 0.1, 3, DEFAULT_VISUAL_EFFECTS.brightness),
    opacity: numberIn(input.opacity, 0, 1, DEFAULT_VISUAL_EFFECTS.opacity),
    mirror: booleanOr(input.mirror, DEFAULT_VISUAL_EFFECTS.mirror),
    shimmer: booleanOr(input.shimmer, DEFAULT_VISUAL_EFFECTS.shimmer),
    grain: booleanOr(input.grain, DEFAULT_VISUAL_EFFECTS.grain),
    grainIntensity: numberIn(input.grainIntensity, 0, 0.5, DEFAULT_VISUAL_EFFECTS.grainIntensity),
    pointerInteraction: booleanOr(input.pointerInteraction, DEFAULT_VISUAL_EFFECTS.pointerInteraction),
    pointerStrength: numberIn(input.pointerStrength, 0, 1, DEFAULT_VISUAL_EFFECTS.pointerStrength),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
```

- [ ] **Step 4: Экспортировать контракт и подтвердить GREEN**

В `packages/core/src/index.ts` добавить named exports всех четырёх символов. Run:

```bash
pnpm --filter @wallet/core test -- visual-effects.test.ts
pnpm --filter @wallet/core typecheck
```

Expected: новый test file PASS, typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/visual-effects.ts packages/core/src/visual-effects.test.ts packages/core/src/index.ts
git commit -m "feat(core): добавить настройки визуальных эффектов"
```

---

### Task 3: Добавить независимый visual provider и storage

**Files:**
- Create: `packages/ui/src/appearance/visual-effects-provider.tsx`
- Create: `packages/ui/src/appearance/visual-effects-provider.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `PreferenceStorage`, `VisualEffectsConfig`, `DEFAULT_VISUAL_EFFECTS`, `normalizeVisualEffects` из `@wallet/core`.
- Produces: `VISUAL_EFFECTS_STORAGE_KEY`, `VisualEffectsController`, `VisualEffectsProvider`, `useVisualEffects`.

- [ ] **Step 1: Написать failing provider tests**

Проверить четыре сценария: defaults без записи, восстановление валидной записи, независимый reset, повреждённый JSON с `role=status`. Ключ строго:

```ts
export const VISUAL_EFFECTS_STORAGE_KEY = "wallet4i7.visual.v1";
```

Основная проверка live update:

```tsx
function Probe() {
  const { effects, setEffects, resetEffects } = useVisualEffects();
  return (
    <>
      <output aria-label="Скорость">{effects.speed}</output>
      <button onClick={() => setEffects({ speed: 2.5 })}>Ускорить</button>
      <button onClick={resetEffects}>Сбросить эффекты</button>
    </>
  );
}
```

После `fireEvent.click("Ускорить")` выполнить `vi.runAllTimers()` и ожидать сохранённый normalized JSON. Повреждение visual key не должно удалять `wallet4i7.theme.v1`.

- [ ] **Step 2: Подтвердить RED**

Run: `pnpm --filter @wallet/ui test -- visual-effects-provider.test.tsx`

Expected: FAIL — provider exports отсутствуют.

- [ ] **Step 3: Реализовать controller**

```ts
export type VisualEffectsController = {
  effects: VisualEffectsConfig;
  setEffects(patch: Partial<VisualEffectsConfig>): void;
  resetEffects(): void;
};
```

Provider создаёт `VisualEffectsContext<VisualEffectsController | null>`, читает storage один раз через `useMemo(() => readStoredEffects(storage), [storage])`, хранит normalized config в `useState`, а запись группирует одним `requestAnimationFrame`. Точная логика чтения:

```ts
function readStoredEffects(storage: PreferenceStorage) {
  const raw = storage.getItem(VISUAL_EFFECTS_STORAGE_KEY);
  if (raw == null || raw === "") {
    return { effects: { ...DEFAULT_VISUAL_EFFECTS }, corrupted: false };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const validVersion = typeof parsed === "object" && parsed !== null
      && (parsed as { version?: unknown }).version === 1;
    return { effects: normalizeVisualEffects(parsed), corrupted: !validVersion };
  } catch {
    return { effects: { ...DEFAULT_VISUAL_EFFECTS }, corrupted: true };
  }
}
```

`setEffects` вычисляет `normalizeVisualEffects({ ...current, ...patch })`, обновляет state и планирует запись. `resetEffects` создаёт новую копию defaults и планирует запись. Cleanup отменяет pending frame; при `corrupted=true` effect один раз записывает восстановленный visual config и выводит `role="status"` с текстом `Эффекты сброшены: сохранённые настройки повреждены`. Ошибка hook вне provider: `useVisualEffects должен вызываться внутри VisualEffectsProvider`.

- [ ] **Step 4: Экспортировать только Wallet API и подтвердить GREEN**

Из `packages/ui/src/index.ts` экспортировать controller/provider/key/hook, но не сырые upstream `WebThreads`, `GlassIcons` и другие React Bits symbols.

Run:

```bash
pnpm --filter @wallet/ui test -- visual-effects-provider.test.tsx
pnpm --filter @wallet/ui typecheck
```

Expected: tests/typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/appearance/visual-effects-provider.tsx packages/ui/src/appearance/visual-effects-provider.test.tsx packages/ui/src/index.ts
git commit -m "feat(ui): сохранять настройки Web Threads"
```

---

### Task 4: Адаптировать WebThreads в один управляемый visual layer

**Files:**
- Create: `packages/ui/src/react-bits/web-threads/web-threads-engine.ts`
- Create: `packages/ui/src/react-bits/web-threads/web-threads.tsx`
- Create: `packages/ui/src/react-bits/web-threads/web-threads.css`
- Create: `packages/ui/src/react-bits/web-threads/web-threads.test.tsx`
- Create: `packages/ui/src/appearance/wallet-visual-layer.tsx`
- Create: `packages/ui/src/appearance/wallet-visual-layer.css`
- Create: `packages/ui/src/appearance/wallet-visual-layer.test.tsx`

**Interfaces:**
- Consumes: `ThemeConfig`, `VisualEffectsConfig`, upstream `WebThreads` shader, `ogl`.
- Produces: `VisualRuntimeCapabilities`, `WebThreadsEngine`, `createWebThreadsEngine`, `WalletVisualLayer`.

- [ ] **Step 1: Написать failing lifecycle tests**

Зафиксировать интерфейсы:

```ts
export type VisualRuntimeCapabilities = {
  hostActive: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  saveData: boolean;
  coarsePointer: boolean;
};

export type WebThreadsEngine = {
  update(input: WebThreadsEngineInput): void;
  setRunning(running: boolean): void;
  dispose(): void;
};

export type WebThreadsColors = {
  color1: string;
  color2: string;
  color3: string;
  backgroundColor: string;
};

export type WebThreadsEngineInput = {
  effects: VisualEffectsConfig;
  colors: WebThreadsColors;
  viewportWidth: number;
  mouseInteraction: boolean;
  onUnavailable(reason: "webgl2" | "context-lost"): void;
};

export type WebThreadsProps = {
  effects: VisualEffectsConfig;
  colors: WebThreadsColors;
  active: boolean;
  coarsePointer: boolean;
  onUnavailable(reason: "webgl2" | "context-lost"): void;
  engineFactory?: typeof createWebThreadsEngine;
};
```

Через injected `engineFactory` проверить: mount создаёт engine один раз; изменение colors/effects вызывает `update` без нового factory call; `active=false` вызывает `setRunning(false)`; unmount вызывает `dispose` один раз. Проверить `canvas[data-web-threads]`, `aria-hidden=true` и отсутствие второго canvas после rerender.

- [ ] **Step 2: Подтвердить RED**

Run: `pnpm --filter @wallet/ui test -- web-threads.test.tsx wallet-visual-layer.test.tsx`

Expected: FAIL — модули visual layer отсутствуют.

- [ ] **Step 3: Забрать pinned WebThreads после RED**

Run:

```bash
pnpm dlx shadcn@4.21.0 add @react-bits/WebThreads-TS-CSS --yes
pnpm --filter @wallet/ui add ogl@1.0.11 --save-exact
```

Сверить импортированный shader с raw-файлом на pinned commit `https://raw.githubusercontent.com/DavidHDev/react-bits/3a1c7f2f9f94ed833934ab5c2635760b9e644583/src/ts-default/Backgrounds/WebThreads/WebThreads.tsx`, затем перенести его в `packages/ui/src/react-bits/web-threads` и выполнить разделение engine/wrapper ниже.

- [ ] **Step 4: Перенести shader и отделить imperative engine**

Из pinned upstream сохранить vertex/fragment shaders, `FAN_MODE`, `hexToRgb`, OGL `Renderer/Program/Mesh/Triangle`, resize, intersection и pointer math. `createWebThreadsEngine(canvas, input)` должен:

```ts
const dpr = input.viewportWidth <= 480
  ? Math.min(window.devicePixelRatio || 1, 1.5)
  : Math.min(window.devicePixelRatio || 1, 2);
```

- создать только WebGL2 renderer;
- выставить uniforms из всех полей `VisualEffectsConfig`;
- изменять существующие uniforms в `update`;
- запускать RAF только из `setRunning(true)` и не дублировать уже запущенный loop;
- отменять RAF, disconnect `ResizeObserver`/`IntersectionObserver`, удалять listeners, `gl.getExtension("WEBGL_lose_context")?.loseContext()` и удалять canvas resources в `dispose`;
- на `webglcontextlost` вызвать `event.preventDefault()` и `onUnavailable("context-lost")` без автоматического retry loop.

- [ ] **Step 5: Реализовать React wrapper и fallback**

`WebThreads` получает `colors`, `effects`, `active`, `onUnavailable` и внутренний `engineFactory=createWebThreadsEngine`. Pointer interaction фактически включать только при `effects.pointerInteraction && !coarsePointer`.

`WalletVisualLayer({ runtime }: { runtime: VisualRuntimeCapabilities })` читает `theme` и `effects` из providers и вычисляет:

```ts
const animated = runtime.hostActive
  && runtime.documentVisible
  && !runtime.reducedMotion
  && !runtime.saveData;

const colors = {
  color1: theme.accent,
  color2: theme.glassTint,
  color3: deriveThemeTokens(theme).textPrimary,
  backgroundColor: theme.background,
};
```

Root получает `data-active={animated ? "true" : "false"}`. При reduced motion или saveData WebThreads не монтируется. При временном `hostActive=false`/`documentVisible=false` существующий engine остаётся смонтированным, получает `setRunning(false)`, а поверх canvas показывается poster. DOM layer: fixed root `data-wallet-visual-layer`, WebThreads canvas и/или `<img src="/media/liquid-hero-poster.avif" alt="" data-visual-fallback>`, затем отдельные `mask`, `scrim`, `noise` spans. После `onUnavailable` canvas удаляется, а fallback остаётся до следующего remount.

- [ ] **Step 6: Подтвердить GREEN и resource budget**

Run:

```bash
pnpm --filter @wallet/ui test -- web-threads.test.tsx wallet-visual-layer.test.tsx
pnpm --filter @wallet/ui typecheck
```

Expected: lifecycle tests PASS; ни один test не оставляет pending RAF/timers/observers.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/react-bits/web-threads packages/ui/src/appearance/wallet-visual-layer*
git commit -m "feat(ui): добавить управляемую сцену Web Threads"
```

---

### Task 5: Создать премиальные content-эффекты

**Files:**
- Create: `packages/ui/src/react-bits/spotlight-surface/spotlight-surface.tsx`
- Create: `packages/ui/src/react-bits/spotlight-surface/spotlight-surface.css`
- Create: `packages/ui/src/react-bits/wallet-count-up/wallet-count-up.tsx`
- Create: `packages/ui/src/react-bits/gradient-text/gradient-text.tsx`
- Create: `packages/ui/src/react-bits/gradient-text/gradient-text.css`
- Create: `packages/ui/src/react-bits/react-bits-adapters.test.tsx`

**Interfaces:**
- Consumes: existing `motion@13.2.0`, Theme CSS variables.
- Produces: `SpotlightSurface`, `WalletCountUp`, `GradientText` for Dashboard only.

- [ ] **Step 1: Написать failing adapter tests**

Проверить:

```tsx
render(<WalletCountUp value={12437.82} locale="ru-RU" currency="USD" reducedMotion />);
expect(screen.getByText(/12.*437/)).toHaveTextContent("12 437,82");

render(<SpotlightSurface finePointer={false}>Активы</SpotlightSurface>);
fireEvent.pointerMove(screen.getByText("Активы"), { clientX: 20, clientY: 10 });
expect(screen.getByText("Активы").closest("[data-spotlight]")).toHaveAttribute("data-spotlight", "disabled");
```

Также проверить, что `GradientText reducedMotion` не создаёт animation frame и выдаёт обычный читаемый text node.

- [ ] **Step 2: Подтвердить RED**

Run: `pnpm --filter @wallet/ui test -- react-bits-adapters.test.tsx`

Expected: FAIL — адаптеры отсутствуют.

- [ ] **Step 3: Реализовать SpotlightSurface**

Перед адаптацией забрать исходники после подтверждённого RED:

```bash
pnpm dlx shadcn@4.21.0 add @react-bits/SpotlightCard-TS-CSS @react-bits/CountUp-TS-CSS @react-bits/GradientText-TS-CSS --yes
pnpm --filter @wallet/ui add motion@13.2.0 --save-exact
```

Сверить их с raw-файлами pinned commit из `THIRD_PARTY_NOTICES.md`, переместить через `git mv` в папки карты файлов и сохранить provenance headers.

API:

```ts
type SpotlightSurfaceProps = PropsWithChildren<{
  as?: "section" | "article" | "div";
  className?: string;
  finePointer: boolean;
  spotlightColor?: string;
}>;
```

Сохранить upstream pointer-coordinate идею, но обновлять `--spotlight-x/y/color` только при `finePointer=true`. Использовать один псевдоэлемент, без RAF и без `backdrop-filter`; `data-spotlight="enabled|disabled"` обязателен для тестов.

- [ ] **Step 4: Реализовать WalletCountUp и GradientText**

`WalletCountUp` API:

```ts
type WalletCountUpProps = {
  value: number;
  locale: string;
  currency: string;
  reducedMotion: boolean;
  duration?: number;
  className?: string;
};
```

Форматировать каждое spring update через `Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })`. При reduced motion сразу вывести финальную строку и не вызывать `useSpring`. Для соблюдения Rules of Hooks разделить на `StaticAmount` и `AnimatedAmount`, выбор делать в родительском компоненте.

`GradientText` сохранить на `motion/react`, но добавить `reducedMotion`; в этом режиме рендерить `<span className="wallet-gradient-text wallet-gradient-text--static">` без `useAnimationFrame`. Применять только к коротким строкам.

- [ ] **Step 5: Подтвердить GREEN**

Run:

```bash
pnpm --filter @wallet/ui test -- react-bits-adapters.test.tsx
pnpm --filter @wallet/ui typecheck
```

Expected: PASS, `act` warnings отсутствуют.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/react-bits/spotlight-surface packages/ui/src/react-bits/wallet-count-up packages/ui/src/react-bits/gradient-text packages/ui/src/react-bits/react-bits-adapters.test.tsx
git commit -m "feat(ui): добавить живые content-эффекты"
```

---

### Task 6: Создать glass actions, sparks и controlled gooey navigation

**Files:**
- Create: `packages/ui/src/icons/wallet-icon.tsx`
- Create: `packages/ui/src/icons/wallet-icon.css`
- Create: `packages/ui/src/icons/wallet-icon.test.tsx`
- Create: `packages/ui/src/react-bits/glass-action/glass-action.tsx`
- Create: `packages/ui/src/react-bits/glass-action/glass-action.css`
- Create: `packages/ui/src/react-bits/click-spark/click-spark.tsx`
- Create: `packages/ui/src/react-bits/click-spark/click-spark.css`
- Create: `packages/ui/src/react-bits/wallet-gooey-nav/wallet-gooey-nav.tsx`
- Create: `packages/ui/src/react-bits/wallet-gooey-nav/wallet-gooey-nav.css`
- Modify: `packages/ui/src/react-bits/react-bits-adapters.test.tsx`

**Interfaces:**
- Consumes: React nodes/callbacks и Theme CSS variables.
- Produces: `WalletIcon`, keyboard-safe `GlassAction`, event-driven `ClickSpark`, controlled `WalletGooeyNav<T>`.

- [ ] **Step 1: Написать failing tests SVG-системы и расширить adapter tests**

В `wallet-icon.test.tsx` отрендерить все имена `send|receive|swap|buy|search|notifications|appearance|home|portfolio|explore|settings|eye` и для каждого проверить ровно один `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">`, отсутствие text nodes и отсутствие `transform: scale()` на SVG. Проверить `GlassAction` click/Enter и 44 px class contract; ClickSpark не запрашивает RAF до pointer activation, создаёт один canvas и отменяет RAF при unmount; nav вызывает callback один раз и синхронизирует external active id.

```tsx
const onChange = vi.fn();
const items = [
  { id: "home", label: "Главная", icon: <span /> },
  { id: "settings", label: "Настройки", icon: <span /> },
] as const;
const { rerender } = render(
  <WalletGooeyNav
    items={items}
    activeId="home"
    onChange={onChange}
    reducedMotion={false}
  />,
);
fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
expect(onChange).toHaveBeenCalledWith("settings");
rerender(<WalletGooeyNav items={items} activeId="settings" onChange={onChange} reducedMotion={false} />);
expect(screen.getByRole("button", { name: "Настройки" })).toHaveAttribute("aria-current", "page");
```

- [ ] **Step 2: Подтвердить RED**

Run: `pnpm --filter @wallet/ui test -- react-bits-adapters.test.tsx`

Expected: FAIL на новых imports/assertions.

- [ ] **Step 3: Реализовать точные controlled APIs**

Перед адаптацией забрать исходники после подтверждённого RED:

```bash
pnpm dlx shadcn@4.21.0 add @react-bits/GlassIcons-TS-CSS @react-bits/ClickSpark-TS-CSS @react-bits/GooeyNav-TS-CSS --yes
```

Сверить их с raw-файлами pinned commit из `THIRD_PARTY_NOTICES.md`, переместить через `git mv` в папки карты файлов и сохранить provenance headers.

```ts
type GlassActionProps = {
  label: string;
  icon: ReactNode;
  onAction(): void;
  className?: string;
};

export type WalletIconName =
  | "send" | "receive" | "swap" | "buy"
  | "search" | "notifications" | "appearance" | "eye"
  | "home" | "portfolio" | "explore" | "settings";

type WalletIconProps = {
  name: WalletIconName;
  size?: 20 | 24 | 28;
  className?: string;
};

type ClickSparkProps = PropsWithChildren<{
  color: string;
  reducedMotion: boolean;
  count?: number;
  duration?: number;
}>;

type GooeyNavItem<T extends string> = { id: T; label: string; icon: ReactNode };
type WalletGooeyNavProps<T extends string> = {
  items: readonly GooeyNavItem<T>[];
  activeId: T;
  onChange(id: T): void;
  reducedMotion: boolean;
};
```

`WalletIcon` выбирает только заранее определённый JSX path/group, использует `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.7}`, `strokeLinecap="round"`, `strokeLinejoin="round"`; отдельные filled accents допускаются только с `fill="currentColor"` и opacity. GlassAction сохраняет upstream front/back объём, но принимает callback и использует `button`. Его promo plate состоит из `glass-action__core`, `glass-action__lens` и `glass-action__rim`; icon располагается над ними без blur, чтобы штрихи оставались резкими. ClickSpark хранит sparks в ref и запускает RAF только если массив непуст; reduced motion вызывает children action без canvas animation. GooeyNav не содержит `href` или внутренний active state; положение indicator обновляется из `activeId`, particles создаются только после пользовательской смены, все timeout/RAF id хранятся в sets и очищаются на unmount.

- [ ] **Step 4: Подтвердить GREEN без timer leaks**

Run:

```bash
pnpm --filter @wallet/ui test -- wallet-icon.test.tsx react-bits-adapters.test.tsx
pnpm --filter @wallet/ui typecheck
```

Expected: PASS; `vi.getTimerCount()` равен 0 после cleanup.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/icons packages/ui/src/react-bits/glass-action packages/ui/src/react-bits/click-spark packages/ui/src/react-bits/wallet-gooey-nav packages/ui/src/react-bits/react-bits-adapters.test.tsx
git commit -m "feat(ui): добавить liquid glass взаимодействия"
```

---

### Task 7: Пересобрать Dashboard как единую premium-сцену

**Files:**
- Modify: `packages/ui/src/dashboard/dashboard.tsx`
- Modify: `packages/ui/src/dashboard/profile-header.tsx`
- Modify: `packages/ui/src/dashboard/balance-hero.tsx`
- Modify: `packages/ui/src/dashboard/quick-actions.tsx`
- Modify: `packages/ui/src/dashboard/liquid-promo-card.tsx`
- Modify: `packages/ui/src/dashboard/asset-list-card.tsx`
- Modify: `packages/ui/src/dashboard/portfolio-summary-card.tsx`
- Modify: `packages/ui/src/dashboard/bottom-navigation.tsx`
- Modify: `packages/ui/src/dashboard/dashboard.css`
- Modify: `packages/ui/src/dashboard/dashboard-visuals.css`
- Modify: `packages/ui/src/dashboard/dashboard-controls.css`
- Modify: `packages/ui/src/dashboard/dashboard.test.tsx`
- Modify: `packages/ui/src/dashboard/dashboard-visuals.test.tsx`
- Modify: `packages/ui/src/dashboard/dashboard-controls.test.tsx`

**Interfaces:**
- Consumes: `VisualRuntimeCapabilities`, `WalletVisualLayer`, `useTheme`, `useVisualEffects` и адаптеры Tasks 4–6.
- Produces: новый `Dashboard` API с `runtime` вместо `video`, при сохранённых wallet callbacks/overlays.

- [ ] **Step 1: Переписать tests на новую композицию**

Новый Dashboard contract:

```ts
export function Dashboard(props: {
  snapshot: WalletSnapshot;
  platform: PlatformBridge;
  runtime: VisualRuntimeCapabilities;
})
```

Tests должны ожидать `[data-wallet-visual-layer]` рядом с контентом, открытый hero без `<video>`, balance region, четыре quick-action buttons, один assets surface, один portfolio surface и controlled navigation. Сохранить все существующие tests на sheets, haptic, Back Button, search, notifications и balance visibility.

- [ ] **Step 2: Подтвердить RED**

Run:

```bash
pnpm --filter @wallet/ui test -- dashboard.test.tsx dashboard-visuals.test.tsx dashboard-controls.test.tsx
```

Expected: FAIL — старый `video` contract/DOM не соответствует новой сцене.

- [ ] **Step 3: Встроить visual layer и переразложить hero**

Корень Dashboard:

```tsx
<div className="wallet-dashboard" data-platform={platform.kind} style={shellStyle}>
  <WalletVisualLayer runtime={runtime} />
  <div className="wallet-dashboard__foreground">
    <ProfileHeader
      profile={snapshot.profile}
      unreadCount={unreadCount}
      onSearch={() => setOverlay({ type: "search" })}
      onNotifications={() => setOverlay({ type: "notifications" })}
      onTheme={() => setOverlay({ type: "theme" })}
      reducedMotion={runtime.reducedMotion}
    />
    <main className="wallet-dashboard__content">
      {activeSection === "home" ? (
        <DashboardHome
          snapshot={snapshot}
          period={period}
          balanceHidden={balanceHidden}
          runtime={runtime}
          onPeriodChange={setPeriod}
          onToggleHidden={() => {
            platform.haptic("selection");
            setBalanceHidden(value => !value);
          }}
          onAction={openAction}
          onSelectAsset={asset => setOverlay({ type: "asset", asset })}
        />
      ) : <SectionPlaceholder section={activeSection} />}
    </main>
    <div className="wallet-dashboard__navigation">
      <BottomNavigation
        activeSection={activeSection}
        reducedMotion={runtime.reducedMotion}
        onSectionChange={selectSection}
      />
    </div>
  </div>
</div>
```

В том же файле выделить локальный `DashboardHome` с указанной сигнатурой; overlays (`DemoActionSheet`, Theme Studio и `InformationSheet`) оставить после `wallet-dashboard__foreground` с текущими props. В `onToggleHidden` внутри `DashboardHome` сначала вызвать переданный callback; haptic остаётся в callback родительского Dashboard, как в текущей реализации.

```ts
type DashboardHomeProps = {
  snapshot: WalletSnapshot;
  period: ChartPeriod;
  balanceHidden: boolean;
  runtime: VisualRuntimeCapabilities;
  onPeriodChange(period: ChartPeriod): void;
  onToggleHidden(): void;
  onAction(action: DashboardAction): void;
  onSelectAsset(asset: WalletAsset): void;
};

function DashboardHome(props: DashboardHomeProps) {
  return (
    <>
      <BalanceHero
        balance={{ ...props.snapshot.balance, hidden: props.balanceHidden }}
        chart={props.snapshot.chart}
        period={props.period}
        reducedMotion={props.runtime.reducedMotion}
        onPeriodChange={props.onPeriodChange}
        onToggleHidden={props.onToggleHidden}
      />
      <QuickActions
        reducedMotion={props.runtime.reducedMotion}
        onAction={props.onAction}
      />
      <LiquidPromoCard
        finePointer={!props.runtime.coarsePointer}
        reducedMotion={props.runtime.reducedMotion}
        onOpen={() => props.onAction("swap")}
      />
      <AssetListCard
        assets={props.snapshot.assets}
        finePointer={!props.runtime.coarsePointer}
        onSelect={props.onSelectAsset}
      />
      <PortfolioSummaryCard
        balance={props.snapshot.balance}
        assets={props.snapshot.assets}
        finePointer={!props.runtime.coarsePointer}
      />
    </>
  );
}
```

`BalanceHero` удалить import/props `HeroVideo`. Сумму рендерить `WalletCountUp`, если она не скрыта; greeting, change, chart и periods оставить семантически доступными. Hero без рамки и solid card: минимальная высота 340 px, сумма `clamp(2.65rem, 12vw, 4.6rem)`, chart смещён вправо, слева остаётся scrim и безопасная зона для цифр.

- [ ] **Step 4: Подключить максимум выбранных React Bits эффектов**

- Header: три round `GlassAction`; avatar получает один статический edge glow.
- Quick actions: каждый action обёрнут в один `ClickSpark`, внутри `GlassAction`; callback сначала вызывает существующий `openAction`.
- Promo: `SpotlightSurface` + `GradientText` для `Swap smarter`; без второго animated background.
- Assets и portfolio: по одной `SpotlightSurface`; строки активов не получают вложенный glass.
- Bottom navigation: `WalletGooeyNav<DashboardSection>` получает текущий `activeSection` и `selectSection`.
- Reduced motion/coarse pointer брать только из `runtime`, не делать повторные media queries в leaf-компонентах.

- [ ] **Step 5: Выполнить mobile art direction CSS**

Зафиксировать layout budgets:

```css
.wallet-dashboard__foreground { position: relative; z-index: 1; width: min(100%, 480px); margin-inline: auto; }
.wallet-dashboard__content { display: grid; gap: clamp(18px, 5vw, 28px); padding-bottom: 116px; }
.wallet-dashboard__navigation { position: fixed; z-index: 12; bottom: max(10px, var(--dashboard-safe-bottom)); width: min(calc(100% - 24px), 456px); }
.wallet-material-surface { background: color-mix(in srgb, var(--color-surface) 78%, transparent); border: 1px solid color-mix(in srgb, var(--color-text-primary) 14%, transparent); }
```

Glass применяется только header/quick/nav controls. Добавить breakpoints `max-width:359px` и `min-width:430px`; ни один компонент не использует фиксированную ширину больше viewport. Focus ring располагается выше glow layers через `position/z-index`.

- [ ] **Step 6: Подтвердить GREEN и отсутствие старого active video**

Run:

```bash
pnpm --filter @wallet/ui test -- dashboard.test.tsx dashboard-visuals.test.tsx dashboard-controls.test.tsx react-bits-adapters.test.tsx
pnpm --filter @wallet/ui typecheck
rg -n "HeroVideo|liquid-hero\.(mp4|webm)" packages/ui/src/dashboard
```

Expected: tests/typecheck PASS; `rg` не находит video usage в Dashboard.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/dashboard
git commit -m "feat(ui): пересобрать главную страницу кошелька"
```

---

### Task 8: Расширить Theme Studio до Web Threads Lab

**Files:**
- Create: `packages/ui/src/appearance/web-threads-lab.tsx`
- Create: `packages/ui/src/appearance/web-threads-lab.test.tsx`
- Modify: `packages/ui/src/theme/theme-studio.tsx`
- Modify: `packages/ui/src/theme/theme-studio.css`
- Modify: `packages/ui/src/theme/theme-provider.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useVisualEffects`, `VisualEffectsConfig`.
- Produces: быстрая палитра и все shader controls в одном доступном dialog.

- [ ] **Step 1: Написать failing Lab tests**

Проверить labels: `Скорость`, `Количество нитей`, `Частота`, `Разброс`, `Сужение`, `Положение`, `Режим веера`, `Свечение`, `Затухание`, `Толщина`, `Яркость`, `Прозрачность нитей`, `Зеркальность`, `Мерцание`, `Зерно`, `Интенсивность зерна`, `Реакция на указатель`, `Сила указателя`. Изменение `Количество нитей` с `7` на `9` должно немедленно менять context output и после RAF записывать `threadCount:9` в visual key.

- [ ] **Step 2: Подтвердить RED**

Run: `pnpm --filter @wallet/ui test -- web-threads-lab.test.tsx theme-provider.test.tsx`

Expected: FAIL — Lab/visual controls отсутствуют.

- [ ] **Step 3: Реализовать declarative field descriptors**

```ts
const RANGE_FIELDS = [
  ["speed", "Скорость", 0, 3, 0.05],
  ["threadCount", "Количество нитей", 1, 10, 1],
  ["frequency", "Частота", 0.5, 8, 0.1],
  ["spread", "Разброс", 0, 1, 0.01],
  ["taper", "Сужение", 0, 1, 0.01],
  ["position", "Положение", 0, 1, 0.01],
  ["glow", "Свечение", 0.01, 0.25, 0.01],
  ["falloff", "Затухание", 0.5, 4, 0.05],
  ["thickness", "Толщина", 0.1, 2, 0.05],
  ["brightness", "Яркость", 0.1, 3, 0.05],
  ["opacity", "Прозрачность нитей", 0, 1, 0.01],
  ["grainIntensity", "Интенсивность зерна", 0, 0.5, 0.01],
  ["pointerStrength", "Сила указателя", 0, 1, 0.01],
] as const;
```

Fan mode — `<select>` с `center/left/right` и русскими labels. `mirror`, `shimmer`, `grain`, `pointerInteraction` — checkboxes. Отдельные кнопки `Сбросить эффекты` и `Сбросить всю тему`; первая не меняет palette, вторая вызывает оба reset метода.

- [ ] **Step 4: Сохранить dialog/focus поведение Theme Studio**

Theme Studio остаётся `role=dialog`, Escape закрывает, focus trap и восстановление предыдущего focus сохраняются. Разделить DOM на `<section aria-labelledby="palette-title">` и `<details><summary>Web Threads Lab</summary><WebThreadsLab /></details>`. При ширине до 359 px fields становятся одной колонкой; range и value остаются на одной строке.

- [ ] **Step 5: Подтвердить GREEN**

Run:

```bash
pnpm --filter @wallet/ui test -- web-threads-lab.test.tsx theme-provider.test.tsx hydration.test.tsx
pnpm --filter @wallet/ui typecheck
```

Expected: PASS; hydration tests не сообщают mismatch.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/appearance/web-threads-lab* packages/ui/src/theme
git commit -m "feat(ui): добавить Web Threads Lab"
```

---

### Task 9: Подключить Mini App, E2E и финальные quality gates

**Files:**
- Modify: `apps/miniapp/src/app-providers.tsx`
- Modify: `apps/miniapp/src/smoke.test.tsx`
- Modify: `apps/miniapp/app/globals.css`
- Create: `apps/miniapp/playwright.config.ts`
- Create: `apps/miniapp/e2e/dashboard.visual.spec.ts`
- Create: `apps/miniapp/e2e/dashboard.performance.spec.ts`
- Modify: `apps/miniapp/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/assets/liquid-hero.md`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `ThemeProvider`, `VisualEffectsProvider`, `Dashboard(runtime)`.
- Produces: browser/Telegram runtime wiring, repeatable mobile preview и release evidence.

- [ ] **Step 1: Написать failing Mini App smoke tests**

Заменить video pause test на visual-layer tests:

```ts
it("останавливает Web Threads, когда вкладка скрыта", async () => {
  render(await Page());
  await screen.findByRole("region", { name: "Баланс" });
  expect(document.querySelector("[data-wallet-visual-layer]")).toHaveAttribute("data-active", "true");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  await waitFor(() => expect(document.querySelector("[data-wallet-visual-layer]")).toHaveAttribute("data-active", "false"));
});
```

Добавить tests на `saveData=true`, reduced motion и восстановление `VISUAL_EFFECTS_STORAGE_KEY`. В jsdom WebGL unavailable должен отображать `[data-visual-fallback]`, а Dashboard оставаться кликабельным.

- [ ] **Step 2: Подтвердить RED**

Run: `pnpm --filter @wallet/miniapp test -- smoke.test.tsx`

Expected: FAIL — App всё ещё передаёт `video` и не содержит VisualEffectsProvider.

- [ ] **Step 3: Реализовать единый runtime capability object**

В `AppProviders` вычислить:

```ts
const runtime: VisualRuntimeCapabilities = {
  hostActive,
  documentVisible,
  reducedMotion,
  reducedTransparency: useMediaFlag("(prefers-reduced-transparency: reduce)"),
  saveData,
  coarsePointer: useMediaFlag("(pointer: coarse)"),
};
```

Provider order:

```tsx
<ThemeProvider storage={storage}>
  <VisualEffectsProvider storage={storage}>
    <Dashboard snapshot={displaySnapshot} platform={platform} runtime={runtime} />
  </VisualEffectsProvider>
</ThemeProvider>
```

Hooks вызываются безусловно до early return. PosterShell остаётся SSR shell. Обновить globals: system font stack `Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, full-height dark canvas и browser max-width без рамки.

- [ ] **Step 4: Подтвердить smoke GREEN**

Run:

```bash
pnpm --filter @wallet/miniapp test -- smoke.test.tsx
pnpm --filter @wallet/miniapp typecheck
```

Expected: PASS; Telegram user и Back Button tests сохраняются.

- [ ] **Step 5: Добавить Playwright mobile harness**

Run: `pnpm --filter @wallet/miniapp add -D @playwright/test@1.63.0 --save-exact`

Добавить package scripts miniapp `"start": "next start -p 3000"`, `"test:e2e": "playwright test"`, root `"test:e2e": "pnpm --filter @wallet/miniapp test:e2e"`. Config:

```ts
export default defineConfig({
  testDir: "./e2e",
  webServer: { command: "pnpm build && pnpm start", port: 3000, reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:3000", colorScheme: "dark", trace: "retain-on-failure" },
  projects: [{ name: "mobile-chromium", use: { ...devices["iPhone 13"] } }],
});
```

- [ ] **Step 6: Добавить visual/E2E matrix**

В `dashboard.visual.spec.ts` параметризовать widths `[320, 390, 430, 480]`. Для каждого: открыть `/`, ждать `[data-wallet-visual-layer]`, проверить `document.documentElement.scrollWidth <= innerWidth`, quick action click/dialog close, navigation, theme dialog. Для воспроизводимого WebGL screenshot перед reload сохранить visual preset с `speed:0`, `shimmer:false`, `grain:false`; затем выполнить:

```ts
await expect(page).toHaveScreenshot(`dashboard-${paletteName}-${width}.png`, {
  fullPage: true,
  animations: "disabled",
});
```

Параметризовать четыре палитры через localStorage до reload:

```ts
const palettes = [
  ["ocean", "#05070B", "#111620", "#5B8CFF", "#7C6CFF"],
  ["aurora", "#020B0D", "#0B1A1C", "#00E7C7", "#5B8CFF"],
  ["violet", "#080511", "#171124", "#A56CFF", "#4F8CFF"],
  ["ember", "#100705", "#21120F", "#FF7A45", "#FF3D8D"],
] as const;
```

Запустить вложенную матрицу `widths × palettes`, то есть 16 screenshot cases. Ещё один default-palette case на 390 px проверяет исходные настройки без localStorage. Палитру записывать как полный `ThemeConfig` с `version:1` и неизменёнными numeric defaults, чтобы тест проверял реальное восстановление provider, а не CSS injection.

Отдельные tests эмулируют reduced motion и принудительно подменяют `HTMLCanvasElement.prototype.getContext` на `null`, ожидая fallback и доступные buttons.

- [ ] **Step 7: Добавить performance assertions**

В production preview проверить:

```ts
expect(await page.locator("canvas[data-web-threads]").count()).toBeLessThanOrEqual(1);
expect(await page.locator("video").count()).toBe(0);
```

До navigation установить `PerformanceObserver` для `longtask`, после прогрева 2 секунды нажать `Обменять`, ожидать dialog за 250 ms и утверждать, что нет long task `>100ms`. Скрытие вкладки эмулировать точным вызовом:

```ts
await page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "hidden",
  });
  document.dispatchEvent(new Event("visibilitychange"));
});
await expect(page.locator("[data-wallet-visual-layer]")).toHaveAttribute("data-active", "false");
```

- [ ] **Step 8: Обновить документацию fallback asset**

В `docs/assets/liquid-hero.md` зафиксировать: mp4/webm больше не загружаются главной страницей; `liquid-hero-poster.avif` — fallback при WebGL/reduced-motion/saveData; source video остаётся резервным asset для будущих сцен.

- [ ] **Step 9: Прогнать полный quality gate**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
pnpm why gsap three @react-three/fiber matter-js @dimforge/rapier3d-compat
git diff --check
git status --short
```

Expected: все test/typecheck/lint/build/E2E команды exit 0; запрещённые packages отсутствуют; diff check молчит; status содержит только ожидаемые файлы Task 9.

- [ ] **Step 10: Commit**

```bash
git add apps/miniapp package.json pnpm-lock.yaml docs/assets/liquid-hero.md packages/ui/src/index.ts
git commit -m "test(app): проверить React Bits preview на мобильных"
```

---

## Финальная ручная приёмка

- [ ] Запустить `pnpm dev` и открыть `http://localhost:3000` при ширине 390 px.
- [ ] Убедиться глазами, что WebThreads — единая сцена страницы, hot core справа и не пересекает сумму.
- [ ] Проверить четыре quick actions, search, notifications, theme, asset sheet и все четыре nav tabs.
- [ ] Изменить четыре цвета: фон, surfaces, нити, glass edges и chart меняются в одном кадре.
- [ ] Изменить каждый Web Threads Lab control и после reload подтвердить сохранение.
- [ ] Проверить светлую/контрастную пользовательскую палитру: balance и labels остаются читаемыми.
- [ ] В DevTools отключить WebGL и включить reduced motion/saveData: poster виден, UI остаётся полноценным.
- [ ] На touch viewport убедиться, что pointer spotlight отключён, но press/spark/haptic feedback работают согласно accessibility mode.
- [ ] Снять финальные 390×844 и 430×932 screenshots для PR и добавить русское описание ограничений/проверок.
