# `/mono` — точка восстановления 2026-09-17

Рабочая ветка: `codex/skin-lab-v2` в `.worktrees/26-integration-review`. Изменения не закоммичены; существующие пользовательские изменения и V1 не сбрасывать. Это изолированный дизайн-прототип, не готовый общий SkinHost/Skin Lab.

## Что сделано

- Approved built-in optical JSON `1 · Ledger` с положительным `ior: 1.34` сохранён без изменений.
- Все design controls вынесены из телефона в fixed sibling rails: слева `Варианты / Экран`, справа `Среда / Оптика`. Центральная `.mono-page` не содержит лабораторных controls.
- Секции rails сворачиваются независимо; master switch скрывает обе rails без смещения preview и без потери expanded state. Ни collapse, ни global hide не сбрасывают optical draft.
- Добавлены четыре реальные ширины preview `320 / 390 / 430 / 480`: без transform-scale, с container queries/`cqw`, синхронной шириной fixed nav и clamp на узком host.
- Ниже `1200px` rails работают как dismissible drawers со scrim, Escape, `inert` и возвратом focus к launcher.
- Правый замёрзший столбец shader по-прежнему защищён зеркальной UV-адресацией. Повторная светлая рейка на присланном снимке локализована в CSS: Promo hover окрашивал неизменную по толщине полную border-кромку в `#cacaca` поверх inset-рамки. Теперь border прозрачен. Отдельно OGL resize использует transform-safe `clientWidth/clientHeight`, а не временно уменьшенный DOMRect: это закрывает потенциальный fallback-край, но не доказано как причина той же снятой на скриншот полосы.
- Текст визуальных controls больше не выделяется, но баланс остаётся копируемым.
- Добавлены независимые темы `dark/light` и фоны `iris/tide/strata`, локальное versioned preview storage, сдержанные цветовые кромки. Светлая тема — pearl/ceramic, Promo остаётся тёмным focal object.
- `tide` теперь использует чистую velocity/energy model: первый sample не создаёт удар, быстрый жест набирает силу постепенно, медленный drift остаётся ниже порога, idle гасит энергию. Импульсы ограничены временем, расстоянием и шестью DOM-узлами. Второй canvas/context/RAF не добавлен.
- Material Lab встроен в правую rail. Live draft каждого direction переживает collapse/hide; только `Применить` пишет normalised preview candidate.
- Reduced-motion при включении на лету гасит атмосферу. Pointer-отклик живёт только на `.mono-page`: движение по внешней rail не вызывает его, но раскрытая desktop-секция «Оптика» сама по себе не отключает реакцию при наведении на сцену.
- Live `prefers-reduced-motion` и `saveData` теперь переводят Promo `webgl -> fallback`, освобождают renderer/RAF и после снятия ограничения создают один новый engine с актуальным preset/settings.
- Ранняя тема/фон устанавливаются до первого paint через path-scoped inline script на `<html>`; React-owned `<main>` до hydration не мутируется. При строгой CSP понадобится nonce.
- Исправлена прорисовка графика: бывший dash 260 px обрывал линию при экранной длине ~444 px; теперь 520 px и линия доходит до конечной отметки.
- Документы `AGENTS.md`, `README.md`, `architecture.md`, `mono-ledger-v1.md`, `source-catalog.md` обновлены под текущие решения и ограничения.

## Подтверждено в текущей итерации

- miniapp unit: `11/11` в двух файлах; сюда входит новая детерминированная регрессия velocity-driven Tide.
- `@wallet/ui` unit: `133/133` в пятнадцати файлах; resize test доказывает выбор layout-box `400×158` при временном transformed DOMRect `394×155.63`.
- miniapp typecheck и targeted source ESLint — green.
- `mono-workbench` E2E: `5/5` — controls вне preview, реальные widths+nav, draft preservation, master hide без сдвига, compact drawers/Escape/focus return.
- Production build успешно поднимался повторно через Playwright webServer.
- Полный `/mono` E2E пока не помечать green: старые dialog/mobile selectors нужно мигрировать на rail architecture. Full repo E2E содержит прежние несвязанные Dashboard visual failures и был остановлен; V1 snapshots не переписывать.

## Следующий безопасный шаг

1. Мигрировать старые `/mono` E2E selectors с dialog/top labbar на sibling rails и прогнать полный mono gate.
2. Провести визуальный review workbench на desktop `1440×1000` и compact `390×844`, отдельно проверить Tide и цикл `1 -> 2 -> 3 -> 1`.
3. После утверждения сохранить новые `/mono` screenshots; старые V1 эталоны не переписывать автоматически.
4. Не коммитить и не менять approved Ledger JSON без отдельного решения владельца.

## Открытые границы

Фоновая «Волна» — визуальный finite velocity-driven wake, а не shader-fluid. Для настоящего полноэкранного смещения воды нужен единый OGL compositor с одним context/RAF и отдельная проверка производительности/доступности. Общий randomizer, locks, Undo/Redo, Font Lab, независимые draft slots и product SkinHost ещё не реализованы.
