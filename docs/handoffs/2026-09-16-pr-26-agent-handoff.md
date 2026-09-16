# Передача разработки: Draft PR #26

Дата передачи: 2026-09-16

## Точка входа

- Репозиторий: `https://github.com/i4w7w4a/Wallet_4i7`
- Draft PR: `#26` — `feat(ui): премиальный React Bits Dashboard для Mini App (#23)`
- Рабочая ветка: `feat/23-react-bits-dashboard`
- Base PR: `feat/10-miniapp-preview`
- Проверенный кодовый checkpoint: `d229a73237deba87bcc54df27d034a8bbb267ad6`
- Основная задача: Issue `#23`, остаётся открытой
- PR не объединён и не переведён из Draft

Перед началом обязательно выполнить `git fetch --prune origin` и проверить, что локальный
`HEAD` совпадает с актуальным `origin/feat/23-react-bits-dashboard`. Handoff-коммит с этим
документом будет находиться поверх указанного кодового checkpoint.

## Что уже реализовано

- Главная мобильного кошелька с WebThreads, Liquid Glass, SVG-иконками и интерактивными controls.
- Вся живая сцена ограничена шириной `min(100vw, 480px)` и центрируется на широком viewport.
- За пределами приложения используется статичный чёрный фон без WebGL, шума и theme tint.
- WebThreads, Theme Studio и BottomSheet не выходят за границы мобильной сцены.
- Pointer за пределами canvas, включая правую и нижнюю границы, не активирует shader.
- DPR WebGL рассчитывается по ширине canvas, а не по ширине desktop viewport.
- Мобильная типографическая шкала сохранена; desktop-размеры ограничены шириной приложения.
- Исправлен React Strict Mode lifecycle crash при повторном создании WebGL engine.

## Проверенное состояние

На кодовом checkpoint `d229a73`:

- `pnpm test` — 149/149;
- `pnpm typecheck` — успешно;
- `pnpm lint` — успешно;
- `pnpm build` — успешно;
- функциональные E2E в установленном Google Chrome — 10/10;
- один WebGL canvas, runtime `pageErrors=[]`;
- независимый review: Critical/Important замечаний нет;
- рабочее дерево было чистым.

Штатный `pnpm test:e2e` требует managed Chromium `1243`, которого нет в текущем окружении.
Команда завершается до выполнения сценариев с сообщением об отсутствующем executable.
Существующие pixel-baselines создавались в другом Windows/browser окружении, поэтому их нельзя
обновлять автоматически без осознанного визуального утверждения.

## Визуальное доказательство

- Desktop 1024×900:
  `apps/miniapp/e2e/evidence/contained-app-desktop-1024x900.png`
- Mobile baselines:
  `apps/miniapp/e2e/dashboard.visual.spec.ts-snapshots/`
- Pointer recording:
  `apps/miniapp/e2e/evidence/web-threads-pointer-390x844.webm`

## Документы решения

- Дизайн границ сцены:
  `docs/superpowers/specs/2026-09-16-contained-mobile-app-scene-design.md`
- План реализации:
  `docs/superpowers/plans/2026-09-16-contained-mobile-app-scene-implementation.md`
- Исходный redesign:
  `docs/superpowers/specs/2026-09-12-react-bits-wallet-redesign-design.md`

## Как продолжить

На новом компьютере:

```bash
git clone https://github.com/i4w7w4a/Wallet_4i7.git
cd Wallet_4i7
git fetch --prune origin
git switch --track origin/feat/23-react-bits-dashboard
corepack enable
pnpm install --frozen-lockfile
pnpm test
```

В уже клонированном репозитории не использовать одну физическую папку одновременно несколькими
агентами. Создать отдельный worktree от актуальной удалённой ветки:

```bash
git fetch --prune origin
git worktree add .worktrees/26-next-agent -b agent/26-next-step origin/feat/23-react-bits-dashboard
```

Если следующий агент продолжает именно PR #26, он должен либо работать в
`feat/23-react-bits-dashboard`, либо после проверки отправлять свою ветку через отдельный PR.
Нельзя выполнять force-push, объединять PR #26 или закрывать Issue #23 без явного решения владельца.

## Правила передачи

- GitHub Issue, PR, review-комментарии и commit messages вести на русском языке.
- Перед работой прочитать этот handoff, Issue #23, PR #26 и документы решения.
- Перед изменениями выполнить `git fetch --prune origin` и проверить базовый SHA.
- Один агент — одна отдельная ветка и отдельный worktree/clone.
- Не менять lockfile и зависимости без необходимости и отдельного объяснения.
- Для дефектов использовать RED→GREEN; перед push запускать релевантные тесты и полный quality gate.
- Не обновлять visual snapshots только ради зелёного теста: сначала проверить изображение человеком.
- Не объединять Draft PR и не закрывать Issue вручную без команды владельца.

## Рекомендуемый следующий шаг

Открыть текущий production build глазами на мобильной ширине 390/430 px и на desktop 1024 px.
После визуального решения владельца либо перейти к следующей дизайн-итерации в отдельной ветке,
либо установить точную версию managed Chromium и воспроизводимо обновить visual baselines.
