# MONO — мягкие раскрытия и переходы

Основание: пользователь видит резкое раскрытие четырёх разделов профиля, смену нижних разделов и вход в актив из «Мои средства». Просит анализ, варианты и работу отдельных окон. База `8733e78`, canonical checkout `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, branch `codex/product-ux-20261003`; текущий local/public runtime `85d33d2` не менять до общего handoff.

## Global Constraints

- Меняется motion, не композиция, тексты финансовых сценариев, capability/routing, battery semantics, семь пресетов или material schema. Гипотеза ускорения батарейкой отложена в GitHub #42. Новая светлая тема — отдельный read-only анализ, не часть этой реализации.
- Сохранять drafts, выбранный счёт, privacy, историю и callback contracts. Не перемонтировать whole MonoScene/controller ради анимации. Не клонировать финансовые DOM-ветки, не оставлять исходящий контент интерактивным, не запускать второй canvas/renderer или постоянный RAF. Не анимировать фон вместе с разделами. Header, context line и нижняя навигация остаются стабильными.
- Browser-only, никаких native app/mouse действий. Не читать/менять чужие формы или экспортировать весь localStorage. Семь опубликованных snapshots не записывать. Сервер, GitHub push/merge/deploy и presets без отдельного release handoff не менять.
- Видимые рабочие чаты GPT-6.1 SOL MAX; их узкие внутренние помощники GPT-6.1 SOL MEDIUM только при независимой пользе. Параллельность в непересекающихся файлах. ORACLE единственный build/start owner. Не добавлять новую библиотеку, Motion 13.2.0 уже установлен; CSS/WAAPI/Motion выбирать по задаче, не для демонстрации инструмента.
- Пользовательский быстрый цикл заменяет generic SDD лестницу: один focused RED/GREEN на новый lifecycle/accessibility, один root source review, одна ORACLE typecheck/build/local start, один связный браузерный просмотр. Не повторять suites финансовых flows и прежние проверки. Не удалять чужую работу; foreign `apps/miniapp/next-env.d.ts` исключить из commits. Commit только exact owned paths.
- Уважать `[data-mono-motion="static"]`, effects-disabled/calm, системный reduced-motion, inactive/hidden: сразу корректное конечное состояние. Без пространственной анимации при reduced/static, без первого flash/intro. Никаких новых пользовательских motion-переключателей или persistence.

## Причина и варианты

Профиль сейчас переключает `hidden/display:none`, монтирует содержимое только при expanded; CSS анимирует opacity200ms, а не занимаемую высоту. Закрытие мгновенное. ProductHoldings также условно монтирует списки. MonoScene напрямую переключает section/asset branches, без общей content-transition границы; scroll/focus/rebase уже есть и должны сохраниться.

Варианты для владельца: «Спокойный поток» (базовая примерка), «Более тягучий», «Сдержанный быстрый». До ответа реализуем первый, остальные — предложения, не три новых движка/лаборатоории. Общая кривая `cubic-bezier(.2,0,0,1)`, overshoot0, текст без scale/blur и финансовые цифры без countup.

Базовая примерка: disclosure open320ms/close240ms, мелкое появление текста до4px и opacity, chevron согласован с раскрытием; раздел enter280ms/смещение6px, asset forward/back300ms/смещение12px. Прозрачность не должна давать пустой кадр/чёрный flash. Отзыв на нажатие немедленный, анимация не задерживает command/submit или блокирует следующий выбор. Быстрые повторные действия — latest-wins, без очереди эффектов. Глобальные CSS vars `--mono-product-reveal-open:320ms`, `--mono-product-reveal-close:240ms`, `--mono-product-motion-ease:cubic-bezier(.2,0,0,1)` может объявить Task2; Task1 использует те же fallback values, поэтому не ждёт чужого кода.

Источники/примеры: [Motion exit lifecycle](https://motion.dev/docs/react-animate-presence), [Motion layout/size](https://motion.dev/docs/react-layout-animations). Это ориентиры, не требование копировать demo/масштабировать текст. Использованы motion-design и animation-basics: движение объясняет раскрытие/иерархию; внутренний банковский UI не получает bounce или дополнительный ambient loop.

## Task 1: Профиль и раскрытие средств

Owner: существующий UX-чат `01a1008d-2139-7430-8ae1-a8b791ad6290`, SOL6.1 MAX. Читать Global Constraints и свой brief. Owned: `product-profile.tsx`, `product-profile.module.css`, `product-profile.test.tsx`; `product-holdings.tsx` и узкий новый holdings-motion test; маленький общий disclosure primitive/hook и CSS под `apps/miniapp/src/mono-product/motion/` с префиксом `disclosure-*`. НЕ mono-scene, controller, asset-workspace, nav helper, общий product-home.css или чужие tests. Если старый тест требует правки, сначала сообщить конкретный файл/причину root.

1. Исправить причину: плавно менять реально занимаемую высоту при открытии/закрытии, не один opacity. Динамическая высота без фиксированного max-height; последующие строки должны двигаться плавно. Сохранить текущий appearance, отсутствие новых рамок и открытие максимум одной группы профиля.
2. Один небольшой disclosure mechanism для Profile и Funds/placements. Содержимое сохраняется только на время закрытия, затем unmount/hidden; closing/closed immediately inert и вне accessibility navigation. Не держать устаревшие resource contacts/security при loading/error ради exit; stale content удалить сразу, контейнер может закрыться отдельно. Privacy обновляется немедленно. Не кешировать ReactNode со старым financial state.
3. Rapid open/close/open обратим из текущего состояния; без таймерной очереди и зависания невидимых элементов. Если фокус внутри закрываемого блока — вернуть к его launcher до inert; обычное открытие фокус не крадёт. Chevron и content согласованы.
4. «Мои средства» плавно раскрывает список; размещения монеты тоже. Нажатие самой монеты по-прежнему вызывает точный onOpenAsset, его page transition принадлежит Task2. Не превращать списки в invalid ul/div структуру, сохранить aria-controls/IDs, keyboard/touch44 и action routing.
5. Один focused RED/GREEN: открытие/закрытие lifecycle, отсутствие focusable outgoing, rapid toggle, resource/privacy freshness; минимальный интеграционный case Profile/Funds. Tests реального поведения, не только mocks. JSDOM не выдавать за проверку плавности; real height animation проверит root браузером.

Read applicable skills and their required test reference yourself. Report `.superpowers/sdd/2026-10-04-soft-product-motion/task-1-report.md`: exact commits/files, commands/results, какой механизм выбран и почему, static/reduced behavior, concerns. No build/start/push/deploy. Передавать brief и отчёт, не всю историю.

## Task 2: Разделы и вход/выход в актив

Owner: существующее окно Motion `01a0cc64-d029-7510-8293-df38289c9fe3`, SOL6.1 MAX. Работать именно в canonical mono-showcase checkout выше, НЕ старом cwd2cfe. Читать Global Constraints и свой brief. Owned: `apps/miniapp/src/mono-preview/mono-scene.tsx`; новые `product-view-motion.*` (helper/component/CSS/test) под `apps/miniapp/src/mono-product/motion/`. Не Profile/Holdings/disclosure files, controller, product flows, shader/material/preset schema. Глобальную stylesheet заменить нельзя; новая scoped CSS импортируется в mono-scene.

1. Добавить минимальную устойчивую content motion boundary для section overview/assets/history/profile и asset workspace forward/back. Сохранять один живой финансовый content tree: предпочтительно finite entry transition текущего DOM с opacity+малой трансляцией, без remount controller и exit-копий canvas/форм. Не делать многослойные DOM snapshots или большие ViewTransition рефакторы ради crossfade. Если выбираешь другой механизм, коротко сообщи конкретный tradeoff до расширения scope.
2. Первое открытие без intro. Переходы только при semantic view identity: section + assetId; тема/privacy/новые данные/holding selection/обычный rerender не запускают повторный вход. Для asset forward/back направление различимо и малоамплитудно; bottom nav направления стабильны, без вылета на ширину экрана.
3. Header/context/nav/background не ездят. Существующие scroll reset, MATERIAL_VIEWPORT_MOTION_REBASE_EVENT и exact asset title/return focus сохранить. Нельзя отменять onOpenAsset или focus в недоступном closing container. Smooth scroll сам по себе не подмена page transition. Выбранный account и drafts остаются выше motion layer.
4. Rapid navigation отменяет старую конечную animation, не задерживает команды и не проигрывает очередь; no persistent RAF/timer/listener leaks. Respect existing mono-motion gate и reduced/hidden; закончить/отменить движение при отключении, не показать исчезнувшее содержимое. CSS-transform не должен оставлять clipping/offscreen controls после завершения.
5. Объявить scoped общие disclosure CSS vars из секции вариантов (Task1 имеет fallback). Не добавлять пользовательский control или сохранять flavor в presets. Motion13.2 уже установлен; при WAAPI сохранить понятный static fallback. Не апгрейдить dependency/lockfile.
6. Focused RED/GREEN на view identity, cancellation/latest-wins и отсутствие повторов на privacy/theme rerender; один targeted integration case actual scene/asset path. No full suites, builds or browser server start.

Read applicable skills/test reference yourself. Report `.superpowers/sdd/2026-10-04-soft-product-motion/task-2-report.md`: commits/files/checks, mechanism, сохранение one-tree/focus/scroll, concerns. No build/start/push/deploy. Не подхватывать старые незавершённые задачи своего чата.

## Task 3: ORACLE — единая локальная примерка

Только после обоих producer reports и root source review. Один общий typecheck/build/start3184 по принятому launcher, с предупреждением перед короткой паузой. Вернуть exact source/buildId/launch/PID. Не запускать producer suites повторно. Новый серверный deploy, GitHub push/merge или publication snapshots этой волной пока не поручены. Root смотрит Profile open/close, section changes, Funds→asset→Back на390px и передаёт владельцу ссылку. Проба не является визуальным утверждением.
