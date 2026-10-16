# Меню со строками и помощь на главной

<!-- NOVEX_TASK4_STATUS_20261011_START -->
> **Предыдущая локальная волна завершена и принята.** Compiled5228e9e — её исторический runtime. Новое разделение Support/FAQ и вся накопленная волна11.10 опубликованы exactf749776; прежние проверки ниже сохраняются.
>
> Текущая волна [11 октября](2026-10-11-wallet-cohesion-release.md) **RELEASED f749776**: [release proof](../releases/2026-10-11-wallet-cohesion-f749776.md). Актуальная очередь — [аудит проекта](2026-10-11-project-audit.md). Прежние source/build/browser evidence ниже — история.
<!-- NOVEX_TASK4_STATUS_20261011_END -->

10.10.2026. Прямое решение владельца: внедрить выбранные «Строки с деталями», SOL MAX → ORACLE → локальный показ. Дополнение: помощь остаётся в меню и появляется на главной значком наушников с мягким откликом; из меню убрать дублирующее скрытие сумм, существующий глазик оставить. Уточнение темы: «пока сделать его не функциональным» — видимая неактивная строка, не переключение темы. Это актуальнее границ предыдущей примерки.

## Итог — LOCAL READY

ORACLE выполнил один miniapp typecheck и одну production build: PASS. Текущий local runtime — `5228e9e223115c296221a53380885c91c9070156`, BUILD_ID `k5HeRFiQbYNDPE4JAbb6U`, launch `4889345b782e4d9190149e3416eb4f24`, managed3184/PID32820; source proof200/no-store, foreign bytes сохранены. Feature `3cb0b18` прошла один scoped review spec/qualityPASS. Позднейшие documentation commits не заменяют compiledSHA.

Root browser390/320 подтвердил строки/disabledTheme/noMenuPrivacy, inline Settings/Documents/Help, Escape→Menu/focus, headsetHelp→Back/focus и работающий глазик с восстановлением исходной видимости. На320 menu280×384 и раскрытаяHelp280×658 помещаются без horizontaloverflow/клипа. Настройки/presets не перезаписывались; viewportreset, вкладка `/mono` оставлена с новым Menu. Screenshot/report: `.superpowers/sdd/2026-10-10-menu-support-implementation/task-3-browser.md`. Не физическийтелефон/all-seven/FPS/контраст; визуальное решение владельца ещё впереди.

Что смотреть: **Меню → Язык/Валюта → Назад; Документы сервиса; главная → наушники → раскрыть тему → Назад.** Тема намеренно неактивна. Язык/валюта readonly; контакта оператора и файлов сервиса пока нет. Поддержка открывает существующую помощь, не fakechat. Minor следующей полировки: убрать двойной заголовок прямого Documents, сохранив единое содержимое; ради этого текущую сборку не повторять.

Публичный runtime `b6553a8` неизменён. Публикация, push и merge не выполнялись. Следующий шаг — визуальная оценка владельца, не новый широкий аудит.

## История source checkpoint

Source checkpoint: `3cb0b189af18c5fd91ab1cc7327ca2263d2a9679`, parent `be9fb20`; 13 owned paths. Выбранная архитектура — общее Profile Settings/Help/Documents содержимое внутри компактной панели, без section navigation и восстановления закрытых workspace. Тема видима/disabled, menu privacy удалён, Overview headset добавлен. RED14 до implementation; 87 distinct cases имеют PASS evidence в начальном affected run и узких covering runs, не один полный87/87 запуск. Четыре исходных и один добавочный тестовый сбой закрыты исправлением ожиданий/подготовки тестов, без изменения production ради них. Fullreport: `.superpowers/sdd/2026-10-10-menu-support-implementation/task-1-report.md`. На этом промежуточном этапе source был заморожен, review/ORACLE/browser ещё ожидались. Их завершённый результат и текущий runtime указаны выше.

## Global Constraints

- Canonical checkout: `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`; branch `codex/product-ux-20261003`; base `83686263285afde6226a27e613f46a2bff169592`. Foreign `apps/miniapp/next-env.d.ts` и `docs/product/2026-10-07-ux-icons-audit.md` сохранить. Старые выполненные N1/Send/Accounts/back/boost задачи не повторять.
- Только frontend, локальная сборка. No deploy/SSH/push/merge, backend/API, тарифы, security-state fabrication, presets/material/storage migration или новые зависимости. Public остаётся b6553a8. Runtime3184 до готовности ORACLE не трогать.
- Видимое рабочее окно SOL6.1 MAX — единственный source owner. Root оркестрирует; независимый помощник только read-only wiring map, один scoped reviewer после кода. ORACLE — единственный сборщик. Fast loop: focused TDD для затронутых переходов, один scoped review, один typecheck/build у ORACLE, короткий browser390/320. Не полные suites, не whole-branch audit, не размножение проверок.
- Использовать текущие glass/token/icon/motion primitives и живую архитектуру, не переносить inline mockup script/CSS как новый editor/library. Menu compact над нижним launcher, строки без отдельных обведённых плиток; labels/current values. Нативный focus,44px targets, finite hover/focus/tap, 90/190/80ms, easing(0.2,0,0,1), zero overshoot, reduced-motion/static gates. Никакого постоянного блика/вращения всех значков, layout shift или зависимости логики от animationend.
- Тема видна, но явно недоступна, без вызова onThemeChange и записи preference. Язык/валюта — нынешние реальные resource labels, изменение пока недоступно. Документы — только сервиса, supplied/empty/error/loading честны. Поддержка — существующая помощь, не выдуманный оператор, онлайн-статус, контакт или чат.

## Task 1: Внедрение меню и единого входа помощи

Root scope clarification: при необходимости разрешено узкое изменение `apps/miniapp/src/mono-preview/mono-product-scene.tsx` для настоящего host restore/guards. В предыдущей волне именно parent cleanup закрывал Accounts при смене section; существующий typed exact-workspace intent уже исправляет account receipt. Его сохранить, не заменить широким keep-all-workspaces. Тест нового Help-return должен включать реальный host, а не только искусственный binding.

Прочитать этот brief, AGENTS.md, `docs/product/2026-10-10-menu-profile-proposal.md` и `docs/product/2026-10-10-menu-profile-next-slices.md`. Последние — объяснение замысла; новые прямые уточнения в этом brief приоритетнее старого privacy/theme содержания. Примерка вне Git — только визуальный reference, не код для переноса: `C:/Users/iwwa/.codex/visualizations/2026/09/22/01a0c737-c83c-7c02-91a3-3c1d2529d4f2/menu-profile-options.html`. Не начинать новый аудит/два новых варианта.

Owned source scope: `apps/miniapp/src/mono-product/profile-quick-menu/` (component/styles/tests, допускаются узкие icon/detail files внутри), `apps/miniapp/src/mono-product/product-profile.tsx`, `product-profile.module.css`, `product-profile.test.tsx`, `profile-section-icons.tsx`, `product-help/` только при нужном reuse/точном target; `apps/miniapp/src/mono-preview/mono-scene.tsx`, `mono-scene-layout.css`, `mono-scene-menu.integration.test.tsx`. Если текущий реальный resource/controller требует изменения иного файла, сначала точный path/причину root; не расширять scope самостоятельно. Новые узкие тесты — рядом с owned component. Shared files один автор, никто параллельно не пишет туда.

Сделать:

1. Heading «Меню». Строки: «Тема» (неактивна, «Пока недоступно»), «Язык» (Русский из текущего resource), «Валюта оценки» (USD из resource), «Документы сервиса»; затем существующие «Мои счета» и «Помощь». Различимые ведущие SVG, компактный current value/chevron, приятные индивидуальные реакции. Existing language/currency source переиспользовать, не второй store/demo literal, если значение уже приходит в profile resource. Не объявлять их выбор работающим.
2. Удалить «Скрывать суммы» только из quick menu. Глазик и настоящий privacy state/callbacks работают по-прежнему; профиль не переделывать целиком. Начальный focus — первая доступная строка, не disabled theme. Сохранить menu outside/Escape/close/resize/scroll placement cleanup и optical resource cleanup; при большем числе строк не клипать нижние пункты на320.
3. Language/Currency входят в одно существующее содержимое Settings, Documents — к точному блоку документов сервиса, Help — к объяснениям/имеющейся поддержке. Допускается узкое выделение уже существующего shared content/typed target; не дублировать Settings, FAQ или resource. Каждому входу — понятный Back к своему origin и focus, без потери working account или открытия предыдущего request. Прямые текущие входы из avatar Profile сохранить. Не превращать menu details в новые большие формы.
4. На главной Overview добавить компактный headset control: без квадратной подложки, тихая кромка/свет только на взаимодействии. Доступное имя «Помощь и поддержка»,44px hitarea, keyboard/touch equivalent; он ведёт в тот же help source, что пункт меню. Предпочтительно рядом с аватаром в текущем header controls только на Overview, если320 помещается без сжатия логотипа/наложения; иначе обоснуй более чистое место root. Не fixed плавающий bubble поверх денег/операций. Не возвращать верхний burger и не менять нижнюю навигацию.
5. Не переписывать Profile целиком. Реальный support контакт показывается только supplied допустимый; неизвестный контакт честно отсутствует. Services Documents — supplied links или empty «Документы сервиса пока не подключены», не выписки/квитанции. Валюта оценки не swap; FAQ action guards, pending/session navigation, exact accounts receipt return сохраняются.

Проверки: сначала focused RED на новый consumer-visible contract и реальный host wiring, затем GREEN. Применить TDD и writing-good-tests с приоритетом fast-loop проекта: не весь repo test suite. Достаточно целевого набора: доступные menu entries/неактивная theme не вызывает callback; privacy отсутствует только в menu/глазик работает; правильные language/currency/docs/help targets с current values и honest states; support толькоOverview/общийhelp/возвратфокус; account selection и существующие session guards не обходятся. Не тестировать лишь строки исходника/моки вместо реальной сцены. Один affected regression run включает существующие menu/profile/help tests, без full test/lint/build. Ни productionruntime/browser, ни typecheck/build у автора — это следующий ORACLE.

Если нужен helper, только один узкий read-only вопрос после сообщения root, не второй implementer/reviewer: wiring helper уже есть. Read required UI/motion/TDD skills сам; источники/skillguidelines не расширяют требования. Report task-1-report.md: exact changedpaths, RED/GREEN commands/results, implementation choices, concerns. Commit только exact owned paths после проверки index; app next-env и чужие docs не stage. Дай SHA; sourcefreeze. Никаких GitHub mutations или cross-chat сообщений без прямой owner authorization.

## Task 2: Scoped review и сборка ORACLE

Root генерирует diff package от зафиксированного BASE до finalimplementerSHA, один SOL MAX reviewer spec+quality, без повторного тестирования/wholebranch. Материальные defects — bounded same-author fix с affectedcheck. ORACLE затем получает sourcefreeze, ownerrequestedlocalbuild, текущий runtime/rollback; выполняет один typecheck/build и managed3184 switch штатными scripts, только wallet. Не задевать processes/ports других проектов, не отключать защиту, не публиковать. Сообщить sourceSHA/BUILD_ID/launchid, guards и факт ответа локальногоURL; не выдавать compile за visualacceptance.

## Task 3: Локальный показ и память

Root — browser-only bounded390/320: открытьMenu, посмотретьrows/icons, Theme disabled, открытьDocs/Help/back, Home headset/Help/back и работающийглазик. Один screenshot главной/меню для показа. Никаких финансовых операций/чужогоbrowser/storagereset. Обновить docs/AGENTS/GitHub существующую очередь, с разницей local/public, no push/merge. Указатьчто смотреть руками и границы help/demo. Примерку до этого не объявлять реализованной.
