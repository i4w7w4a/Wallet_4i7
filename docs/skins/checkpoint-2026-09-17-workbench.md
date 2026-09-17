# Checkpoint · MONO workbench · 2026-09-17

Эта запись — точка безопасного продолжения после лимита. Она описывает фактическое состояние рабочей копии, а не новый план и не утверждение production preset.

## Где продолжать

- Worktree: `C:\Users\iwwa\Documents\1BANK\.worktrees\26-integration-review`
- Branch: `codex/skin-lab-v2`
- Рабочая копия намеренно dirty: большая часть `/mono`, документации и тестов пока untracked. Ничего не reset/checkout/delete.
- Коммит и публикация не запрашивались.
- Production preview: `http://localhost:3102/mono` (текущая exec session `33486`). После финального Playwright build старый `next start` был перезапущен и визуально проверен. Следующая сборка может снова сделать его ссылки на CSS устаревшими; проверить вид глазами и при необходимости перезапустить только точно идентифицированный процесс этого worktree. Не считать HTTP 200 доказательством корректного оформления.

## Последняя воля владельца

1. Убрать лабораторное меню из мобильной сцены и оставить телефон чистым.
2. Разнести быстрые и тонкие настройки по боковым полосам.
3. Каждая группа сворачивается отдельно; один общий «мега-переключатель» скрывает/возвращает весь chrome без потери draft.
4. Добавить четыре настоящих размера preview: `320 / 390 / 430 / 480`.
5. Смягчить `Волну`: она должна постепенно набирать энергию от скорости мыши, а не бить полноразмерными кольцами с первого движения.
6. Устранить яркую правую полосу Promo по корню.
7. Утверждённый Ledger JSON оставить дословно неизменным.

## Что уже реализовано

### Workbench и четыре размера

- `mono-preview.tsx` теперь рендерит:
  - fixed sibling rail `quick` слева: варианты `1/2/3`, размеры `320/390/430/480`, ссылка V1;
  - fixed sibling rail `fine` справа: environment и встроенная оптика;
  - центральный `.mono-preview-frame` с чистым `[data-mono-preview]`.
- `.mono-labbar` полностью удалён из телефона.
- Четыре секции (`variants`, `viewport`, `environment`, `optics`) имеют независимый collapse state.
- Общий `Скрыть панели / Показать панели` не меняет preset/environment/draft и не сдвигает центр preview.
- Ниже `1200px` rails становятся взаимоисключающими drawers: открытый получает `role=dialog`, `aria-modal`, начальный фокус и Tab trap; телефон становится `inert`. `Escape` закрывает и возвращает focus launcher-кнопке; закрытые rails получают `aria-hidden` + `inert`. CSS скрывает rails ещё до hydration.
- Реальные размеры построены через named container `mono-preview`, `cqw` и container queries. Это не CSS scale.
- Fixed nav и fixed atmosphere используют `--mono-preview-width`; на узком физическом экране ширина clamp-ится без horizontal overflow.
- Отступы `320/390/430/480` разрешаются container cascade, а не шириной host. Навигация не обрезает заголовок активов при смене каждого из трёх направлений на четырёх размерах.
- Workbench chrome имеет собственные стабильные шрифтовые/easing tokens, hover среды и минимум `44px` для touch controls; тема телефона не протекает в rails.
- Основные файлы: `mono-preview.tsx`, новый `mono-workbench.css`, переделанные `mono-glass-tuner.tsx/.css`.

### Оптика

- Старый вложенный modal `<dialog>` удалён. `MonoGlassTuner` встроен в правый rail; сам компактный drawer является доступным modal dialog, desktop rail — нет.
- Collapse/global hide не сбрасывают несохранённые значения.
- `Apply` сохраняет candidate, но не закрывает rail.
- Клавиши `1/2/3` работают при открытой оптике и игнорируются только в form/contenteditable/IME контексте.
- Утверждённые Ledger defaults не менялись.

### Волна

- Добавлен pure модуль `mono-tide-motion.ts` и 5 детерминированных unit tests.
- Первый pointer sample только инициализирует поверхность.
- Скорость сглаживается без нового RAF; энергия выводится через smoothstep.
- Pulse требует energy/time/distance gates; максимум 6 конечных DOM-импульсов.
- После idle накопленная скорость рассеивается.
- CSS pulse стал направленным эллипсом с energy-driven размером/opacity/scale/duration; прежний удар `180px × scale(1.7, opacity .69, max 8)` удалён.

### Правая полоса Promo

- Форензика двух скриншотов показала: видимая полоса имела точный `RGB(202,202,202)` — это `#cacaca` из hover border, поверх второй полной inset-рамки. Это был CSS chrome, а не сам shader.
- Uniform hover/press border escalation удалён.
- Внешняя рамка теперь прозрачна; материальный отклик — неравномерный top/left edge light и мягкая тень.
- Дополнительно закрыта отдельная resize-уязвимость: OGL buffer теперь берёт `clientWidth/clientHeight`, а не трансформированный DOMRect во время Frost `scale(0.985)`. Она могла дать похожий fallback-край, но на присланном снимке как причина не установлена.
- Добавлен unit regression: layout `400×158`, transformed rect `394×155.63` должен дать `setSize(400,158)`.
- В `mono-optics-edge.spec.ts` добавлен цикл `Ledger → Frost → Mercury → Ledger` с проверкой прозрачного right border и совпадения canvas/root geometry.
- Hover/press optical shadow перенесён в последний слой каскада и работает в обеих темах без возвращения прямоугольного border.

### Правила агента

Корневой `AGENTS.md` дополнен обязательными правилами про sibling rails, реальные container widths, inert drawers, сохранение draft, velocity-driven Tide, запрет равномерной светлой Promo-рамки и transform-safe canvas sizing.

## Уже подтверждено

- `pnpm --filter @wallet/miniapp typecheck` — pass.
- Targeted ESLint изменённых TS/TSX файлов — pass.
- `pnpm --filter @wallet/miniapp test` — `11/11` pass.
- `pnpm --filter @wallet/ui test` — `133/133` pass.
- Полный `/mono` Playwright suite — `39/39` pass; `mono-workbench.spec.ts` — `6/6`.
- Production build многократно успешно выполнялся Playwright webServer.
- Ручной visual QA:
  - desktop `1440×1000`: rails не сдвигают телефон, композиция собрана;
  - mobile `390×844`: rails закрыты по умолчанию, телефон чистый, launchers находятся в отдельной верхней полосе;
  - правой яркой полосы Promo на статическом кадре нет.
- Отдельно осмотрены production-сцены: desktop workbench, mobile `390×844`, light pearl/ceramic и light Tide; компактная Material Lab читается без вторжения в телефон.
- Локальные QA screenshots лежат в ignored `apps/miniapp/test-results/` и не должны коммититься.

## Границы и следующий шаг

- Миграция старых `/mono` E2E завершена. Полный repo E2E остаётся отдельной задачей: там обнаружены прежние `dashboard.visual.spec.ts` failures, V1 snapshots ради V2 не обновлять.
- Это визуальный workbench, ещё не общий Skin Lab. Randomize/locks/Undo/Redo, три независимых draft-слота, Font Lab и перенос в product shell не реализованы. Не выдавать кнопки `1/2/3` за такие слоты: сейчас они переключают фиксированные visual directions.
- Следующий осмысленный шаг — получить визуальную оценку владельца для композиции, четырех размеров, двух тем и трёх фонов; затем проектировать Font Lab и воспроизводимый randomizer со schema/locks, не смешивая эти функции с утверждением optical default.
- Перед следующим кодовым изменением проверить dirty tree и этот checkpoint. Не reset/checkout/delete; коммит и публикация не запрашивались.

## Инварианты, которые нельзя потерять

- Exact approved Ledger JSON остаётся неизменным (`ior: 1.34`, `flowMode: 5`, остальные значения из `AGENTS.md`/`mono-ledger-v1.md`).
- Один WebGL canvas/context и один optical RAF.
- Promo text остаётся live DOM.
- Rails не становятся частью `.mono-page`.
- Collapse/hide никогда не равны cancel/reset draft.
- Размер preview не имитируется transform scale.
- Tide не получает второй persistent RAF/timer.
- Не возвращать полную прямоугольную hover-рамку Promo.
