# План реализации первого мобильного шаблона Wallet_4i7

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ ДОПОЛНИТЕЛЬНЫЙ SKILL: используйте `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans` и выполняйте план по задачам. Для отслеживания используются шаги с checkbox (`- [ ]`).

**Цель:** создать работающий premium liquid-dark шаблон Telegram Mini App с общим web-ядром, интерактивной главной страницей, Theme Studio, функциональным Liquid Glass и оптимизированным hero-видео.

**Архитектура:** pnpm workspace содержит приложение `apps/miniapp` и независимые пакеты `core`, `platform`, `ui`. Telegram и браузер подключаются через `PlatformBridge`; финансовые данные предоставляет детерминированный mock-репозиторий; тема применяется через CSS custom properties. Видео находится только в `BalanceHero`, имеет poster fallback и не проникает в бизнес-логику.

**Технологии:** Node.js 24, pnpm 10, TypeScript, Next.js 16, React 19, Tailwind CSS 4, Motion 13, ESLint 10, Vitest 5, React Testing Library 16, Playwright 1.63, axe-core, ffmpeg, Git LFS.

**Спецификация:** `docs/superpowers/specs/2026-09-12-wallet-mvp-design.md`

## Общие ограничения

- Весь текст документации, Issues, Pull Requests и пользовательского интерфейса пишется на русском; технические идентификаторы остаются английскими.
- Изменения выполняются в отдельных worktree и ветках `feat/5-wallet-foundation`, `feat/6-platform-bridge`, `feat/7-theme-glass`, `feat/8-liquid-media`, `feat/9-dashboard` и `test/10-app-e2e`; прямые коммиты в `main` запрещены.
- Первый этап содержит только mock-данные и не выполняет реальные финансовые операции.
- Telegram `initData` не считается подтверждённой авторизацией и не используется для защищённых действий.
- `packages/core` не импортирует React, Next.js, DOM или Telegram API.
- Liquid Glass применяется к функциональному слою; финансовые карточки используют облегчённые тёмные поверхности.
- Четыре пользовательских цвета: `background`, `surface`, `accent`, `glassTint`.
- Основной текст сохраняет контраст не ниже 4.5:1, крупный текст и границы контролов — не ниже 3:1.
- Поддерживаются `prefers-reduced-motion`, повышенный контраст и fallback без `backdrop-filter`.
- Hero-видео не содержит аудио, текста и логотипов; при reduced motion, `saveData` и ошибке показывается постер.
- WebGL и постоянная симуляция жидкости не входят в первый этап.
- `localStorage` содержит только несекретную тему и состояние демонстрационного интерфейса.
- Исходное видео хранится через Git LFS; оптимизированные runtime-файлы доступны обычному checkout и деплою.
- Каждая задача проходит собственный red-green цикл, статические проверки и отдельный коммит.

## Карта файлов

```text
Wallet_4i7/
├── .gitattributes
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
├── eslint.config.mjs
├── assets/
│   └── source/
│       └── liquid-hero-source.mp4
├── scripts/
│   └── media/
│       ├── encode-liquid-hero.mjs
│       └── encode-liquid-hero.test.mjs
├── apps/
│   └── miniapp/
│       ├── app/
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── public/media/
│       │   ├── liquid-hero.mp4
│       │   ├── liquid-hero.webm
│       │   └── liquid-hero-poster.avif
│       ├── src/app-providers.tsx
│       ├── e2e/dashboard.spec.ts
│       ├── next.config.ts
│       ├── package.json
│       ├── playwright.config.ts
│       ├── postcss.config.mjs
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   ├── core/
│   │   ├── src/index.ts
│   │   ├── src/models.ts
│   │   ├── src/theme.ts
│   │   ├── src/wallet-repository.ts
│   │   ├── src/mock-wallet-repository.ts
│   │   ├── src/theme.test.ts
│   │   └── src/mock-wallet-repository.test.ts
│   ├── platform/
│   │   ├── src/index.ts
│   │   ├── src/platform-bridge.ts
│   │   ├── src/browser-platform-adapter.ts
│   │   ├── src/telegram-platform-adapter.ts
│   │   ├── src/detect-platform.ts
│   │   └── src/platform.test.ts
│   └── ui/
│       ├── src/index.ts
│       ├── src/theme/theme-provider.tsx
│       ├── src/theme/theme-studio.tsx
│       ├── src/theme/theme-provider.test.tsx
│       ├── src/primitives/glass-surface.tsx
│       ├── src/primitives/action-button.tsx
│       ├── src/primitives/bottom-sheet.tsx
│       ├── src/primitives/primitives.test.tsx
│       ├── src/media/hero-video.tsx
│       ├── src/media/hero-video.test.tsx
│       ├── src/dashboard/profile-header.tsx
│       ├── src/dashboard/balance-hero.tsx
│       ├── src/dashboard/quick-actions.tsx
│       ├── src/dashboard/liquid-promo-card.tsx
│       ├── src/dashboard/asset-list-card.tsx
│       ├── src/dashboard/portfolio-summary-card.tsx
│       ├── src/dashboard/bottom-navigation.tsx
│       ├── src/dashboard/demo-action-sheet.tsx
│       ├── src/dashboard/section-placeholder.tsx
│       ├── src/dashboard/dashboard.tsx
│       └── src/dashboard/dashboard.test.tsx
└── docs/
    └── assets/liquid-hero.md
```

Каждый файл имеет одну ответственность. `dashboard.tsx` только собирает секции; модели, тема, платформенные эффекты, видео и модальные состояния остаются в своих модулях.

## Задача 1. Поднять workspace и минимальное приложение

**Результат:** чистый checkout устанавливается одной командой, тестируется и показывает минимальную мобильную страницу.

**Файлы:**

- создать `package.json`;
- создать `pnpm-workspace.yaml`;
- создать `tsconfig.base.json`;
- создать `vitest.workspace.ts`;
- создать `eslint.config.mjs`;
- создать `apps/miniapp/package.json`;
- создать `apps/miniapp/next.config.ts`;
- создать `apps/miniapp/postcss.config.mjs`;
- создать `apps/miniapp/tsconfig.json`;
- создать `apps/miniapp/vitest.config.ts`;
- создать `apps/miniapp/app/layout.tsx`;
- создать `apps/miniapp/app/page.tsx`;
- создать `apps/miniapp/app/globals.css`;
- создать `apps/miniapp/src/smoke.test.tsx`.

**Публичный контракт:** корневые команды `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck` и `pnpm lint`.

- [ ] Создать корневой workspace с `packageManager: "pnpm@10.33.2"`, `engines.node: ">=24"` и scripts: `dev` запускает `@wallet/miniapp`, `build`, `test` и `typecheck` используют `pnpm -r`, а `lint` запускает `eslint .`.

- [ ] Создать `apps/miniapp/package.json` с Next.js 16.3.5, React 19.3, Tailwind CSS 4.3, Motion 13.2, Vitest 5, jsdom и React Testing Library 16; в корне добавить ESLint 10.10 и `eslint-config-next` 16.3.5.

- [ ] Установить зависимости и зафиксировать lockfile:

```powershell
pnpm install
```

- [ ] Написать падающий smoke-тест:

```tsx
import { render, screen } from "@testing-library/react";
import Page from "../app/page";

it("показывает название Wallet_4i7", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { name: "Wallet_4i7" })).toBeVisible();
});
```

- [ ] Запустить тест и подтвердить ожидаемое падение из-за отсутствующего заголовка:

```powershell
pnpm --filter @wallet/miniapp test --run
```

- [ ] Реализовать минимальные `layout.tsx` и `page.tsx`; metadata содержит `Wallet_4i7`, viewport использует `viewport-fit=cover`, язык документа — `ru`.

- [ ] В `globals.css` добавить базовый reset, чёрный фон, `color-scheme: dark`, safe-area переменные и ограничение приложения `max-width: 480px` только для browser preview.

- [ ] Запустить проверки:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

- [ ] Закоммитить результат:

```powershell
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts eslint.config.mjs apps/miniapp
git commit -m "build(workspace): создать основу мобильного приложения (#5)"
```

## Задача 2. Реализовать общее ядро и mock-репозиторий

**Результат:** приложение получает типизированный снимок кошелька и безопасную конфигурацию темы без React и Telegram.

**Файлы:**

- создать `packages/core/package.json`;
- создать `packages/core/tsconfig.json`;
- создать `packages/core/src/models.ts`;
- создать `packages/core/src/theme.ts`;
- создать `packages/core/src/wallet-repository.ts`;
- создать `packages/core/src/mock-wallet-repository.ts`;
- создать `packages/core/src/theme.test.ts`;
- создать `packages/core/src/mock-wallet-repository.test.ts`;
- создать `packages/core/src/index.ts`.

**Контракты:**

```ts
export type ThemeConfig = {
  version: 1;
  background: string;
  surface: string;
  accent: string;
  glassTint: string;
  radius: number;
  density: number;
  glassOpacity: number;
  glassBlur: number;
  highlightIntensity: number;
  refractionIntensity: number;
  motionIntensity: number;
};

export type WalletSnapshot = {
  profile: { name: string; shortAddress: string; avatarUrl: string | null };
  balance: { amount: number; currency: "USD"; change24h: number; hidden: boolean };
  chart: Record<"1D" | "1W" | "1M" | "1Y" | "ALL", number[]>;
  assets: Array<{ symbol: string; name: string; amount: number; value: number; change24h: number; sparkline: number[] }>;
  notifications: Array<{ id: string; title: string; unread: boolean }>;
};

export interface WalletRepository {
  getSnapshot(): Promise<WalletSnapshot>;
}

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

- [ ] Написать падающие тесты `normalizeTheme` на допустимые диапазоны, некорректный hex, неизвестную версию и восстановление безопасной темы.

- [ ] Запустить `pnpm --filter @wallet/core test --run` и убедиться, что функция отсутствует.

- [ ] Реализовать `DEFAULT_THEME`, `normalizeTheme`, `deriveThemeTokens` и расчёт контрастного текста. Входные четыре цвета сохраняются, производные `textPrimary`, `textMuted`, `border` корректируются до требуемого контраста.

- [ ] Написать падающий тест репозитория: пять периодов графика существуют, активы детерминированы, сумма `value` совпадает с общим балансом с допустимым округлением.

- [ ] Реализовать `MockWalletRepository` с неизменяемыми fixtures и искусственной задержкой только при явно переданном `latencyMs`.

- [ ] Экспортировать публичные типы и функции только из `src/index.ts`; добавить `exports` в package manifest.

- [ ] Запустить:

```powershell
pnpm --filter @wallet/core test --run
pnpm --filter @wallet/core typecheck
```

- [ ] Закоммитить:

```powershell
git add packages/core
git commit -m "feat(core): добавить модели кошелька и темы (#5)"
```

## Задача 3. Добавить платформенный мост Telegram/Web

**Результат:** UI использует один интерфейс для safe-area, Back Button, haptic и жизненного цикла.

**Файлы:**

- создать `packages/platform/package.json`;
- создать `packages/platform/tsconfig.json`;
- создать `packages/platform/src/platform-bridge.ts`;
- создать `packages/platform/src/browser-platform-adapter.ts`;
- создать `packages/platform/src/telegram-platform-adapter.ts`;
- создать `packages/platform/src/detect-platform.ts`;
- создать `packages/platform/src/platform.test.ts`;
- создать `packages/platform/src/index.ts`.

**Контракт:**

```ts
export type PlatformUser = { id: string; name: string; username?: string; avatarUrl?: string };
export type SafeArea = { top: number; right: number; bottom: number; left: number };

export interface PlatformBridge {
  readonly kind: "telegram" | "browser";
  getUser(): PlatformUser;
  getSafeArea(): SafeArea;
  isActive(): boolean;
  haptic(type: "selection" | "impact" | "success" | "warning"): void;
  setBackHandler(handler: (() => void) | null): () => void;
  subscribeActivity(handler: (active: boolean) => void): () => void;
  openLink(url: string): void;
}
```

- [ ] Написать падающие тесты: без `window.Telegram` выбирается browser; browser haptic не бросает ошибку; Telegram-адаптер подписывает и снимает Back Button; неизвестный метод даёт fallback.

- [ ] Запустить `pnpm --filter @wallet/platform test --run` и подтвердить падение.

- [ ] Реализовать `BrowserPlatformAdapter` без прямой вибрации и с профилем `Holder / 0x3a…f79D`.

- [ ] Описать минимальный локальный тип Telegram WebApp API вместо распространения `any` по коду. Не сохранять и не интерпретировать `initData` как доказательство авторизации.

- [ ] Реализовать `TelegramPlatformAdapter`: safe-area, user, Back Button, haptic, activity events, `openLink`, feature detection и idempotent cleanup.

- [ ] Реализовать `detectPlatformBridge(windowLike)` с безопасной работой при SSR.

- [ ] Запустить тесты и typecheck пакета, затем общий `pnpm test`.

- [ ] Закоммитить:

```powershell
git add packages/platform
git commit -m "feat(platform): изолировать Telegram и браузерный API (#6)"
```

## Задача 4. Создать runtime-тему и Theme Studio

**Результат:** четыре цвета и геометрические параметры меняют экран без перезагрузки и сохраняются локально.

**Файлы:**

- создать `packages/ui/package.json`;
- создать `packages/ui/tsconfig.json`;
- создать `packages/ui/src/theme/theme-provider.tsx`;
- создать `packages/ui/src/theme/theme-studio.tsx`;
- создать `packages/ui/src/theme/theme-provider.test.tsx`;
- создать `packages/ui/src/index.ts`.

**Контракт:**

```ts
export type ThemeController = {
  theme: ThemeConfig;
  setTheme(patch: Partial<ThemeConfig>): void;
  resetTheme(): void;
};

export function ThemeProvider(props: {
  storage: PreferenceStorage;
  children: React.ReactNode;
}): JSX.Element;
```

- [ ] Написать падающий тест: изменение `accent` обновляет `--color-accent` на корневом контейнере и сохраняет объект с `version: 1` под ключом `wallet4i7.theme.v1`.

- [ ] Добавить падающие тесты на повреждённый JSON, reset, ограничение slider-значений и восстановление фокуса после закрытия Theme Studio.

- [ ] Запустить `pnpm --filter @wallet/ui test --run` и подтвердить ожидаемое падение.

- [ ] Реализовать Theme context без глобального state manager. CSS-переменные формируются из `deriveThemeTokens`, а запись в storage объединяется по одному animation frame.

- [ ] Реализовать Theme Studio как доступную панель с четырьмя color input и диапазонами из спецификации. Для каждого input есть видимая подпись и числовое значение.

- [ ] Добавить уведомление только при сбросе повреждённой темы; движение каждого бегунка не отправляется в live region.

- [ ] Запустить тесты, typecheck и проверить, что пакет не импортирует `next/*` или Telegram API:

```powershell
pnpm --filter @wallet/ui test --run
pnpm --filter @wallet/ui typecheck
rg "from ['\"](next|@telegram)" packages/ui packages/core
```

- [ ] Закоммитить:

```powershell
git add packages/ui
git commit -m "feat(theme): добавить Theme Studio и runtime-токены (#7)"
```

## Задача 5. Реализовать Liquid Glass и Motion-примитивы

**Результат:** кнопки, навигация и панели получают единое стеклянное поведение с доступными fallback.

**Файлы:**

- создать `packages/ui/src/primitives/glass-surface.tsx`;
- создать `packages/ui/src/primitives/action-button.tsx`;
- создать `packages/ui/src/primitives/bottom-sheet.tsx`;
- создать `packages/ui/src/primitives/primitives.test.tsx`;
- создать `packages/ui/src/primitives/primitives.css`;
- изменить `packages/ui/src/index.ts`.

**Контракты:**

```tsx
export function GlassSurface(props: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "regular" | "clear";
  interactive?: boolean;
}): JSX.Element;

export function BottomSheet(props: {
  open: boolean;
  title: string;
  onClose(): void;
  children: React.ReactNode;
}): JSX.Element | null;
```

- [ ] Написать падающие тесты: `GlassSurface` имеет variant-маркер; ActionButton вызывает callback один раз; BottomSheet закрывается по Escape, удерживает фокус и возвращает его инициатору.

- [ ] Запустить тесты пакета и подтвердить падение.

- [ ] Реализовать CSS-слои regular glass: backdrop blur/saturation, tint, тёмная кромка, внутренний specular highlight и мягкая тень. Clear разрешить только для небольших controls.

- [ ] Добавить `@supports not (backdrop-filter: blur(1px))` с контрастным `surface`; добавить media query reduced transparency/increased contrast через поддерживаемые web-возможности и data-атрибут приложения.

- [ ] Реализовать Motion states: press scale, spring return, sheet enter/exit. Значения умножаются на `motionIntensity`; reduced motion заменяет spatial transition на fade.

- [ ] Не добавлять Liquid Glass в content cards и не вкладывать стеклянную поверхность в другую стеклянную поверхность.

- [ ] Запустить тесты и typecheck.

- [ ] Закоммитить:

```powershell
git add packages/ui/src/primitives packages/ui/src/index.ts
git commit -m "feat(ui): создать Liquid Glass и Motion-примитивы (#7)"
```

## Задача 6. Подготовить и подключить hero-видео

**Результат:** переданный исходник воспроизводится бесшовно, занимает не более 3.5 МБ на runtime-формат и имеет надёжный poster fallback.

**Исходник:**

- локальный файл: `C:\Users\iwwa\Downloads\2026-09-12T00-17-22_generation.mp4`;
- SHA-256: `9D0E6DB8BAC057C3F44EA500E5751EA33C4046E35FEDE80F5F04E62A062005A0`;
- H.264 Main, yuv420p, 1080×1440, 24 FPS, 8.75 с, 9 929 363 байта, без audio stream;
- начало и конец не являются одинаковыми, поэтому требуется seam crossfade.

**Файлы:**

- создать `.gitattributes`;
- добавить через Git LFS `assets/source/liquid-hero-source.mp4`;
- создать `scripts/media/encode-liquid-hero.mjs`;
- создать `scripts/media/encode-liquid-hero.test.mjs`;
- создать `docs/assets/liquid-hero.md`;
- создать производные файлы в `apps/miniapp/public/media/`;
- создать `packages/ui/src/media/hero-video.tsx`;
- создать `packages/ui/src/media/hero-video.test.tsx`;
- изменить `packages/ui/src/index.ts`.

**Контракт:**

```tsx
export function HeroVideo(props: {
  active: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  className?: string;
}): JSX.Element;
```

- [ ] Настроить LFS только для исходных media:

```powershell
git lfs track "assets/source/*.mp4"
New-Item -ItemType Directory -Force assets/source | Out-Null
Copy-Item -LiteralPath 'C:\Users\iwwa\Downloads\2026-09-12T00-17-22_generation.mp4' -Destination 'assets/source/liquid-hero-source.mp4'
git lfs ls-files
```

- [ ] Написать падающий Node-тест для экспортируемой `buildVideoFilter()`: строка содержит trim `0.60–8.15`, crossfade `0.60`, concat, crop 1080×1350 и scale 720×900.

- [ ] Реализовать cross-platform Node script, который проверяет SHA-256, наличие ffmpeg/ffprobe и строит три результата. Видео начинается с исходного времени 0.60, идёт до 8.15, затем crossfade смешивает хвост 8.15–8.75 с головой 0–0.60; конец совпадает с началом цикла.

- [ ] Кодировать MP4 командой с `libx264`, `-crf 25`, `-preset slow`, `-pix_fmt yuv420p`, `-movflags +faststart`; WebM — `libvpx-vp9`, `-crf 34`, `-b:v 0`, `-row-mt 1`; poster — AVIF из кадра после seam.

- [ ] Запустить pipeline:

```powershell
node scripts/media/encode-liquid-hero.mjs
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of json apps/miniapp/public/media/liquid-hero.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of json apps/miniapp/public/media/liquid-hero.webm
```

- [ ] Проверить, что каждый видеофайл не превышает 3 500 000 байт, poster — 250 000 байт, а аудиопоток отсутствует. Если размер превышен, увеличить CRF на 2 и повторить; геометрию и FPS не менять.

- [ ] Написать падающие компонентные тесты: reduced motion и saveData не рендерят `<video>`; обычный режим показывает poster и оба source; `active=false` вызывает pause; ошибка video оставляет poster.

- [ ] Реализовать `HeroVideo` с `muted`, `autoPlay`, `loop`, `playsInline`, `preload="metadata"`, `aria-hidden="true"`. Poster расположен абсолютно и не исчезает до `loadeddata`.

- [ ] В `docs/assets/liquid-hero.md` записать источник, SHA-256, параметры, команду воспроизведения pipeline и правило замены будущими версиями.

- [ ] Запустить Node и component tests, затем визуально просмотреть минимум два полных цикла в Safari/WebKit-совместимом браузере.

- [ ] Закоммитить:

```powershell
git add .gitattributes assets/source scripts/media apps/miniapp/public/media packages/ui/src/media packages/ui/src/index.ts docs/assets/liquid-hero.md
git commit -m "feat(media): добавить оптимизированное liquid-видео (#8)"
```

## Задача 7. Собрать интерактивную главную страницу

**Результат:** экран соответствует premium liquid-dark направлению, все видимые действия работают на mock-данных.

**Файлы:**

- создать `packages/ui/src/dashboard/profile-header.tsx`;
- создать `packages/ui/src/dashboard/balance-hero.tsx`;
- создать `packages/ui/src/dashboard/quick-actions.tsx`;
- создать `packages/ui/src/dashboard/liquid-promo-card.tsx`;
- создать `packages/ui/src/dashboard/asset-list-card.tsx`;
- создать `packages/ui/src/dashboard/portfolio-summary-card.tsx`;
- создать `packages/ui/src/dashboard/bottom-navigation.tsx`;
- создать `packages/ui/src/dashboard/demo-action-sheet.tsx`;
- создать `packages/ui/src/dashboard/section-placeholder.tsx`;
- создать `packages/ui/src/dashboard/dashboard.tsx`;
- создать `packages/ui/src/dashboard/dashboard.css`;
- создать `packages/ui/src/dashboard/dashboard.test.tsx`;
- изменить `packages/ui/src/index.ts`.

**Контракт:**

```tsx
export function Dashboard(props: {
  snapshot: WalletSnapshot;
  platform: PlatformBridge;
  video: { active: boolean; reducedMotion: boolean; saveData: boolean };
}): JSX.Element;
```

- [ ] Написать падающий тест на структуру: профиль, баланс, пять периодов, четыре action buttons, promo, assets, portfolio и четыре nav items доступны по роли и русскому имени.

- [ ] Написать падающие interaction tests: каждый action открывает собственный sheet; панель «Получить» показывает демонстрационный QR без камеры; период меняет path графика; hide balance скрывает цифры; asset row открывает mock-details; поиск, уведомления и Theme Studio доступны; нижняя навигация меняет активный раздел и видимый mock-контент.

- [ ] Написать падающий тест Back Button: сначала закрывает sheet, затем возвращает предыдущий section; cleanup удаляет handler.

- [ ] Реализовать секции небольшими компонентами. `Dashboard` содержит композицию и состояние выбранного периода/панели, но не расчёт темы и не прямые Telegram-вызовы.

- [ ] Нарисовать график и sparklines доступным SVG с фиксированным `viewBox`; скрытые декоративные SVG имеют `aria-hidden`, график баланса получает текстовое описание изменения.

- [ ] Реализовать content cards как тёмные `surface` с тонкой рамкой и статичным бликом. Применять `GlassSurface` только к actions, bottom navigation, search/notification buttons и sheet controls.

- [ ] Добавить тёмную маску слева в `BalanceHero`, video справа/сзади и минимальную высоту, одинаковую для poster и video. Сумма не пересекается с яркими бликами на контрольных viewport.

- [ ] Для всех demo submit показывать итог «Демо: данные не отправлены»; не использовать формулировки об успешном реальном переводе.

- [ ] Запустить component tests, typecheck и Story/preview вручную на ширинах 320, 390, 430 и 480 px.

- [ ] Закоммитить:

```powershell
git add packages/ui/src/dashboard packages/ui/src/index.ts
git commit -m "feat(dashboard): собрать интерактивную главную страницу (#9)"
```

## Задача 8. Соединить приложение, Telegram lifecycle и E2E

**Результат:** приложение работает в браузере и mock Telegram shell, проходит финальные проверки и документировано.

**Файлы:**

- создать `apps/miniapp/src/app-providers.tsx`;
- изменить `apps/miniapp/app/page.tsx`;
- изменить `apps/miniapp/app/layout.tsx`;
- изменить `apps/miniapp/app/globals.css`;
- создать `apps/miniapp/playwright.config.ts`;
- создать `apps/miniapp/e2e/dashboard.spec.ts`;
- создать `apps/miniapp/e2e/telegram.spec.ts`;
- создать `apps/miniapp/e2e/accessibility.spec.ts`;
- создать или изменить `README.md`;
- создать `docs/architecture/frontend.md`.

**Поток композиции:**

```text
page.tsx
  → MockWalletRepository.getSnapshot()
  → AppProviders(PlatformBridge + ThemeProvider)
  → Dashboard(snapshot, platform, videoState)
```

- [ ] Написать падающий E2E browser-сценарий: загрузка, открытие четырёх action sheets, смена периода, изменение accent, перезагрузка и восстановление темы.

- [ ] Написать падающий Telegram-сценарий через `page.addInitScript`: mock WebApp содержит user, safeArea, BackButton, HapticFeedback и activity events; проверить вызовы ready/haptic/back и остановку видео при deactivated.

- [ ] Написать падающий accessibility-сценарий: последовательная клавиатурная навигация, trap/restore focus в sheet, Escape, отсутствие горизонтального overflow и axe-проверка без серьёзных нарушений.

- [ ] Реализовать `AppProviders`: SSR-safe определение platform, подписка на activity/visibility, reduced motion, feature-detected saveData и передача `window.localStorage` только на клиенте.

- [ ] Подключить providers и Dashboard. До клиентской инициализации показывать стабильный server-rendered poster shell без hydration mismatch.

- [ ] Настроить Playwright с проектами `chromium-mobile` и `telegram-mobile`, viewport 390×844, trace при первом retry и webServer `pnpm --filter @wallet/miniapp dev`.

- [ ] Добавить screenshot assertions для стандартной темы, четырёх контрольных палитр, reduced motion, fallback без backdrop-filter и высокого viewport.

- [ ] В README на русском описать установку, запуск, тесты, mock Telegram mode, media pipeline и предупреждение об отсутствии реальных операций.

- [ ] В `docs/architecture/frontend.md` зафиксировать границы `core/platform/ui/app`, поток данных, правила Liquid Glass и добавление будущего `apps/web`.

- [ ] Запустить полный набор проверок:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @wallet/miniapp exec playwright test
git diff --check
```

- [ ] Проверить production build в обычном браузере и Telegram test environment; приложить в Pull Request screenshots/video и результаты команд.

- [ ] Закоммитить:

```powershell
git add apps/miniapp README.md docs/architecture/frontend.md
git commit -m "test(app): завершить Telegram-интеграцию и E2E (#10)"
```

## Порядок Issues и интеграции

Из Issue #1 созданы связанные задачи:

1. Issue #5 — workspace + core contracts;
2. Issue #6 — platform adapters;
3. Issue #7 — theme + UI primitives;
4. Issue #8 — media pipeline;
5. Issue #9 — dashboard composition;
6. Issue #10 — app integration + E2E.

Задача 1 публикует контракты первой. Задачи 2, 3 и 4 могут выполняться параллельно после её merge. Dashboard начинается после принятия `ThemeConfig`, `PlatformBridge`, `GlassSurface` и `HeroVideo`. Финальная интеграция начинается после merge зависимых Pull Request. Перемещения общих файлов выполняет назначенный агент-интегратор.

## Финальная проверка результата

- [ ] Все критерии спецификации сопоставлены с задачами 1–8.
- [ ] Исходное видео совпадает с зафиксированным SHA-256.
- [ ] Runtime MP4/WebM и poster проходят ограничения размера и ffprobe.
- [ ] `packages/core` не содержит imports React, Next.js, DOM или Telegram.
- [ ] Все интерактивные элементы имеют тестируемый результат.
- [ ] Ни один demo-flow не сообщает о реальном переводе.
- [ ] Theme Studio сохраняет и восстанавливает тему.
- [ ] Reduced motion, saveData, inactive Telegram и video error показывают poster.
- [ ] Все проверки из задачи 8 завершены с кодом 0.
- [ ] В PR приложены визуальные доказательства и русскоязычная передача работы.
