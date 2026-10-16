# MONO: узнаваемая операция и отправка на свой счёт

Дата: 10.10.2026. Решение владельца: запустить первые два задания SOL MAX, контракт API параллельно; сборка только через ORACLE, затем локальная примерка.

Продолжение `2026-10-10-account-overview-plan.md`, не повтор его завершённых Task1–3. База этой волны — docs HEAD4a538a2; исходный local runtimef36658d, publicb6553a8. Главная с общим итогом/двумя закреплениями уже опубликована. Домашний pending entry, его exact receipt/History и Back/focus уже реализованы локально.

## Global Constraints

- Canonical checkout: `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, branch `codex/product-ux-20261003`. Старые cwd рабочих окон не использовать.
- Только локальная разработка/сборка. Нет public deploy, SSH/DNS/Caddy, preset publication, push/merge или изменения соседних проектов. Второй сервер явно отложен владельцем.
- Семь presets, материалы, оптика, Lab/storage, privacy и существующие финансовые/security/battery правила сохраняются. Новые backend capabilities, тарифы, пары переводов или права не выдумываются.
- Демо остаётся явно демо. Никаких реальных переводов/API, ложных ETA, процентов или изменения балансов по симуляции.
- Сохранять точные account/asset/network IDs, route/session guards, accepted-submit lease, черновики, Back/focus. Общий итог и группа счетов не становятся источником перевода.
- Использовать существующие icons, CurrencyLogo, typography/material tokens и формы. Нет новой библиотеки, гарнитуры, редактора, постоянной анимации или большого рефакторинга.
- Чужие файлы `apps/miniapp/next-env.d.ts` и `docs/product/2026-10-07-ux-icons-audit.md` не трогать/не staging. Каждый исполнитель пишет только свои paths; расширение границы сначала согласовать с root.
- По явному решению владельца Task1/Task2/Task3 идут параллельно в непересекающихся файлах. Root владеет интеграционным решением и документацией очереди; только Task2 может менять controller/sheet. Один index: staging/commit исполнителей только по отдельному GO root, в последовательных слотах, точные owned paths.
- Целевой RED→GREEN набор на изменяемое поведение, без повторных полных suite/lint/build. Один общий затронутый typecheck после заморозки кода у ORACLE, по одному scoped review каждой независимой source-дельты (без повторного общего ревью), затем один local build и bounded browser pass. Проверка не заменяет визуального решения владельца.
- Исполнители не запускают сервер, build, deploy или собственных ревьюеров. Узкого read-only помощника SOL MAX можно подключить только для непересекающегося анализа; не повторять аудит друг друга.

## Task 1: Подробности в «В процессе»

Владелец — существующее окно `Astra: UX`, исполнитель GPT-6.1 SOL MAX. Только presentation refinement уже готового N1.

### Что сделать

1. Сохранить compact entry над chronological recent, ready0 hidden, loading/error/retry, single→exact receipt и many→pending History. Не менять навигацию и контракт onOpen.
2. Для одного pending показать узнаваемость: «В процессе · 1», направление + asset label, затем network label + account label. Небольшой logo актива слева; статус не передавать одним цветом. Пример ожидаемой композиции: «Получение USDC», «Ethereum · Основной». Это пример из fixtures, не hardcoded content.
3. Переиспользовать `getHistoryPresentation`/`getProductActivityLabels`: buy/swap не называть обычным получением, для swap сохранять пару активов/сетей; internal transfer отличать от внешнего и использовать supplied source/destination labels. Валюта и сеть — разные поля. Не выбирать другую запись при неизвестном/неоднозначном ID.
4. Для нескольких pending — полный count уникальных событий, максимум две уникальные подписи активов/пар в компактной сводке, при остальных — нейтральное «…». Не показывать произвольно выбранную операцию как единственную и не делать второй список истории. Нажатие по всей строке ведёт в существующую pending-выборку.
5. Явную подпись «Примеры и симуляции» сохранить, либо заменить одинаково ясным компактным демо-маркером с доступным пояснением. Не придавать демо вид реальной сети. Суммы, комиссии, адреса и новые сроки в этот entry не добавлять.
6. Существующая гарнитура; различать данные weight/size/spacing. Вторичные данные не микротекст11px: ориентир12–13px, основной recognizer14px. Tokens имеют приоритет над случайными цветами. Без дополнительной рамки/карточки, валюту/сеть не прятать за hover. Удобный target>=44CSSpx, focus-visible. Длинные названия переносятся без overflow/обрезания смысла на320.
7. CurrencyLogo брать по supplied canonical asset identity, неизвестный актив — существующий neutral fallback, не logo сети/чужой монеты. Не менять общий каталог логотипов.

### Owned files

`apps/miniapp/src/mono-product/product-pending-activity.tsx`, `.module.css`, `.test.tsx`; при необходимости `pending-activity.ts` и его существующий/соседний узкий test. Дополнение root: ровно одна миграция старого exact accessible-description assertion в `product-home-overview.integration.test.tsx`, поскольку description теперь содержит metadata плюс demo; остальные navigation assertions не менять. Только этот затронутый case через `-t`, не полный Home suite. History presentation и CurrencyLogo только читать. Не менять mono-scene, controller, Send/Receive, shared history UI/tests, core/fixtures или root docs.

### Проверка / handoff

Добавить targeted RED для missing metadata, корректной single identity и many summary; затем GREEN. В этот же ограниченный набор включить no money leak (видимое и aria), commerce/internal labels, unknown asset fallback и сохранённый onOpen ID/null. Не повторять прежние33 N1 проверки и whole suite. CSS/320 проверит root в общей сборке.

После готовности — report, список owned paths и запрос commit slot. Не staging/commit до GO root. В report exact RED/GREEN commands/results, решения/ограничения; затем короткий DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED.

## Task 2: «Отправить» → «На свой счёт»

Владелец — существующее Send-окно, исполнитель GPT-6.1 SOL MAX. Новый вход в готовый internal-transfer, не новая финансовая реализация.

### Что сделать

1. В компактном Send entry дать понятный выбор «На свой счёт / На внешний адрес». Внешний адрес сохраняет действующий Send. Для внутреннего пути использовать существующие internal receive binding/data port и ReceiveFlow/InternalTransferFlow, quote/submit/receipt/session. Не копировать второй перевод, не превращать receive route в send route обходом resolveIntent.
2. Internal путь начинается от источника: если источник/asset/network уже явно выбран в Send/asset/account entry, сохранить его и предложить только совместимое supplied назначение. При общем обзоре выбрать конкретное размещение; итог «Все средства» не может быть источником. В форме явно понятны «Откуда» и «Куда».
3. Разрешённость только по существующим supplied internal bindings/capabilities. Сейчас demo binding один: custody→depositary, USDC/Ethereum; не расширять его, не подменять неизвестный фиат/другие сети/аккаунты. При отсутствии доступной пары — честное объяснение и рабочий внешний путь, не fake успех и не silent подмена источника.
4. Переиспользовать destination-oriented форму с минимальным source-locked handoff. Технический путь выбирает исполнитель после чтения; сначала зафиксировать коротко origin/source/destination/Back контракт в отчёте. Если нужна несовместимая переделка core/ports, эскалировать вместо обхода guard.
5. Back из внутреннего сценария возвращает к соответствующему Send выбору и фокусу; прежний вход через Receive и его Back не ломаются. Выбранный источник, raw quantity/recipient drafts и рабочий account context не меняются молча. Демо-результат записывается один раз прежним способом.
6. Pending/accepted-submit guard имеет приоритет над Close/Back/сменой источника. Смена adapter/session/snapshot invalidates старый handoff; старые результаты не записываются в другую session. Выбор назначения/пары не создаёт quote/submit до прежнего явного пользовательского шага.
7. Компактная поверхность, существующие glyphs/materials; мягкий текущий отклик без новой motion-системы. Без больших пустот, новых карточек/квадратов и переноса entry вниз экрана.

### Owned files

`apps/miniapp/src/mono-product/send-menu.tsx` и его CSS/tests; необходимый narrow delta `action-route-menu.tsx`/CSS/tests, `product-sheet.tsx`, `product-controller.ts` и его выделенные integration tests; `receive/receive-flow.tsx`, `receive/receive-internal-transfer.tsx`/связанные props/tests только для handoff/source lock. Связанные локальные product types допустимы при необходимости; подтвердить root точный перечень перед записью. Не менять core/fixtures/demo bindings, quote/submit/fee math, N1 files, mono-scene, asset/account workspaces, package/lockfiles/root docs. Если без mono-scene нельзя — сначала запросить ownership root.

### Проверка / handoff

Один targeted RED→GREEN набор: новый выбор/переход; source сохранён, неразрешённая пара не появляется; Back/focus; исходный external Send и Receive entry; draft/accepted-submit/session invalidation для нового handoff. Финансовый результат не симулировать вне текущего demo. Полные старые flow suites не повторять без конкретной причины.

Report с exact tests/results, source/destination/Back контрактом и changed paths; запрос последовательного commit slot root. Без build/server/typecheck повторов/public/GitHub. При finding — один узкий regression, не расширение проекта.

## Task 3: Контракт чтения операций API

Владелец — отдельный SOL MAX документатор. Только новый `docs/product/2026-10-10-activity-api-contract.md`, остальные файлы read-only. Не менять docs root, GitHub, source/index/HEAD, не подключать backend.

Один прикладной документ для разработчика заказчицы:

- Что уже принимает MONO: activities/activityStatus/retryActivities, ProductActivity, internal participants, commerce legs; текущий adapter.kind только demo — это не готовый real API.
- Предлагаемый read-only сценарий списка операций кошелька/счёта; endpoints/DTO/transport явно proposal, не существующий контракт заказчицы.
- Stable event/account/asset/network IDs, обе стороны internal transfer, направление относительно scope, дедупликация, decimal-string money/unit/precision, времена/timezone, понятные statuses/unknown handling.
- Pagination и полнота pending: загруженная страница истории не доказывает отсутствие ожидающих операций. Нужен явно согласованный complete snapshot/pending feed либо счётчик+fetch exact item; выбрать один минимальный рекомендуемый путь и обозначить альтернативу, не менять N1runtime сейчас.
- Freshness/revision/loading/error/retry, финальные и изменившиеся статусы, удалённый/недоступный ID, account scope, race/session isolation. Не придумывать стадии/ETA.
- Небольшие synthetic DTO→ProductActivity примеры и таблица mapping; без реальных адресов/персональных данных/ключей. Demo/example не подменять live без отдельного adapter/UI решения.
- Список необходимых ответов backend: identity/auth/access policy, реальные statuses/доставка updates/полнота/точность. Не проектировать auth заново, не утверждать KYC/custody/battery правила.
- Короткие acceptance criteria для будущей интеграции. Ни HTTP-клиент, ни OpenAPI генератор, ни runtime зависимости сейчас не нужны.

Report в task3report, root проверит документ и сохранит его отдельным owned docs commit после source commits. Это подготовка, не согласованное заказчицей API и не реализация подключения.

## Task 4: Общая локальная примерка ORACLE

После двух готовых source частей и их однократного scoped review: последовательные source commits, freeze SHA; ORACLE один affected typecheck и один production build, штатный preview3184. Готовую Task1 можно проверить параллельно реализации Task2; её не перечитывают в отдельном повторном общем ревью. Если типы не проходят — вернуть точный finding владельцу, не менять чужой код.

Не пересобирать и не перезапускать3184 посреди source работы. Перед заменой .next-review остановить только принадлежащий manager preview; после запуска вернуть source/BUILD_ID/launch/PID и краткий report. Никаких SSH/Linux/public/deploy/preset writes. Root делает один bounded browser pass: pending metadata→receipt/Back; Send→internal source/destination→Back, external доступен; ширина320/390, без реальной транзакции. Сохранить реальные screenshots, затем показать владельцу локально.

## Статус этой волны

Последующее решение владельца 10.10.2026: локальная примерка принята («всё ок»). Новая отдельная дельта — [контекстная батарейка и нижнее меню](2026-10-10-contextual-boost-menu.md); она не означает публичный выпуск предыдущей волны. Ниже сохранены факты исходной реализации и её технической примерки.

Последнее уточнение владельца: API делает backend-разработчик, согласование позже. Готовый proposal сохраняется как отложенный материал; новый контракт/опросник сейчас не расширяем и фронтенд ожиданием API не блокируем.

- Task1: source `5542e36`, scoped review Approved без findings; 17 целевых component tests и один затронутый Home case пройдены. Подробности не раскрывают суммы/комиссии/адреса.
- Task2: source `d559f98`, scoped review Approved без findings. Новый вход переиспользует прежний internal transfer, не создаёт второй финансовый сценарий. 19 целевых integration tests пройдены (11 новых + 8 существующих); Back/focus, черновики, session и accepted-submit защищены в пределах нового handoff. Общий typecheck выявил TS2683 только в новом test mock; type-only `this: HTMLElement` исправлен в `41f3c1c`, повторный typecheck PASS. Runtime-код этим fix не менялся.
- Task3: [предложение API-контракта](2026-10-10-activity-api-contract.md) подготовлено и прочитано root. Это документ для согласования с backend, не подключённое API и не утверждённые правила заказчицы.
- Task4: ORACLE выполнил одну production-сборку и запустил [локальный MONO](http://127.0.0.1:3184/mono), source `41f3c1c53c5abaa8a59cc9d296c0894457395425`, BUILD_ID `FhJSuc7moEUd5a1GXkINU`. Source proof HTTP200/no-store совпал; managed preview RUNNING. Чужие файлы сохранены побайтно. Первоначальный typecheck RED и последующий PASS записаны в отчёте, широкие suite/review не повторялись.
- Root browser: 390 — metadata → exact pending receipt → Back/focus; Send → свой USDC/Ethereum → Основной/Хранилище → Back к источнику → внешний Send → восстановленный внутренний draft. На320 проверены читаемость pending/internal и скрытые суммы; видимого horizontal overflow нет. Quote/submit не запускались. Тестовый ввод очищен, исходные preset1/480/privacyvisible/панели восстановлены. Это ограниченная проверка, не full seven-preset/device/performance gate и не визуальная приёмка владельца.
- Публичный runtime остаётся `b6553a8`. Публикация, push и merge этой волны не разрешены. Предыдущие Task1–3 главной/N1 завершены и не повторяются. Root синхронизирует текущие задачи GitHub после готовности, не удаляя историю и не переоткрывая выполненные этапы.

## Что оценить руками

1. На главной прокрутить к «В процессе»: хватает ли направления, валюты, сети и счёта для узнавания операции без открытия деталей?
2. «Отправить» → «На свой счёт» → USDC / Ethereum: понятны ли «Откуда» и «Куда»? «Назад к выбору отправки» сохраняет исходный выбор; внешний путь рядом.
3. Единственная текущая demo-пара — Основной → Хранилище, USDC/Ethereum. Другие реальные разрешения, комиссии и маршруты должен дать backend; этот выпуск их не утверждает.

Следующий шаг — визуальное решение владельца по этой локальной волне. Account-detail pending остаётся follow-up; новый source-этап ещё не назначен. API proposal можно передать backend-разработчику для ответов на открытые вопросы, но его endpoint/DTO пока не согласованы.

Текущие задачи: [#65 — N1](https://github.com/i4w7w4a/Wallet_4i7/issues/65), [#51 — собственный перевод](https://github.com/i4w7w4a/Wallet_4i7/issues/51), [#43 — React/API handoff](https://github.com/i4w7w4a/Wallet_4i7/issues/43); очередь обновляется в [существующем комментарии #40](https://github.com/i4w7w4a/Wallet_4i7/issues/40#issuecomment-6091952803), без удаления старой истории.

Локальные evidence этой волны: `.superpowers/sdd/2026-10-10-pending-send-wave/` — reports/reviews, `task-4-local-build.md`, `task-5-browser.md` и screenshots. Внешняя оболочка launcher с Tee-Object осталась активна после READY; причина не исследовалась, exit этой оболочки не заявлен. Отдельный manager status/source proof и работа UI подтверждены, ради оболочки рабочий preview не перезапускали.
