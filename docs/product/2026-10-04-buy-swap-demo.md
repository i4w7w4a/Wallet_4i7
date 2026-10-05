# MONO — законченные демосценарии покупки и обмена

Владелец разрешил разработку и новые окна исполнителей 4 октября 2026. Base: `b9b5faebf5e6bf0168c7b1c1d0f36b589e935e5b`, branch `codex/product-ux-20261003`, canonical checkout `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`. Цель — рабочий локальный React-фронтенд для визуальной оценки. Реальные платежи и публикация этой волны не разрешены.

## Результат

«Купить»: конкретный актив/сеть/счёт зачисления → демонстрационный способ оплаты → сумма → понятные оплата/получение/комиссия → явное подтверждение симуляции → ожидание → результат → одна запись истории.

«Обмен»: конкретное размещение источника → разрешённое назначение → «Отдаю / Получаю» → расчёт/комиссия/срок актуальности → подтверждение симуляции → ожидание → двухсторонняя запись истории.

Основание: текущие `product-state-map.md`, `react-frontend-handoff.md`, `2026-10-03-product-ux.md`, последующие решения владельца и фактический код. Buy/Swap уже есть в action-модели, но текущий demo snapshot не выдаёт их capabilities, а продолжение в ProductOverlay — заглушка. Send/Receive остаются рабочими. Реальные методы покупки, разрешённые пары, тарифы и backend DTO не согласованы; этой волной они не назначаются.

## Global Constraints

- Astra — root coordinator; ВСЕ другие окна и helpers — `gpt-6.1-sol`, reasoning `max`. Новые видимые окна по задачам ниже. Helpers разрешены для самостоятельного узкого участка или анализа с явными границами файлов; не плодить одинаковые review/test-прогоны. Обратные сообщения координатору разрешены прямым запросом владельца оркестрировать эти окна; назначения другим пользовательским чатам проходят через root.
- Все команды используют canonical checkout выше, даже если окно создано у проекта со старым cwd. Общая рабочая копия, отдельные owned paths. Не создавать worktrees/ветки автоматически, не reset/clean/stash чужие изменения. Foreign `apps/miniapp/next-env.d.ts` не трогать и не коммитить. Коммиты только exact owned paths, без `git add .`, push или merge.
- Только demo: никакого provider SDK, checkout redirect, ввода карты/персональных данных/ключей, API клиента, подписания, реальных переводов, кошельков или QR. Порты явно `mode: 'demo'`, операции называются симуляциями. Демо-метод называется «Демо-оплата» и не изображает подключённый банк. Курс/fee/TTL — подписанные примеры, не реальные тарифы. Не менять балансы snapshot, battery pools или published/history volume.
- Unknown business data не означает разрешение или нулевую комиссию. Конкретные ID счёта/актива/сети и capability обязательны. All — агрегат, не источник. Отдельная allowlist пар и способов; активный счёт сам не разрешает действие. Для отсутствующих условий/метода/пары — объяснимое состояние, не fake success.
- Денежные quantities — decimal strings, вычисления точные integer/decimal helpers, не floating-point суммы. Не выводить доступный остаток из fiat-оценки. Swap debit с комиссией в той же валюте не превышает известный available; сторонняя fee currency требует собственного известного funding. При неизвестном остатке/комиссии/funding подтверждение закрыто.
- Quote связан с полным запросом (route, method/pair, quantity, обе стороны), имеет identity и expiresAt. Правки/смена маршрута/порта инвалидируют его. Поздние ответы не восстанавливают старый расчёт. Двойной submit закрыт; принятой попытке принадлежит стабильный operation/idempotency ID. Истечение quote после принятия не превращает pending в новую попытку.
- Результат использует снимок принятого расчёта; несоответствующие ID/суммы/единицы не превращаются в успех. Ошибка загрузки/quote не равна выполненной финансовой операции. Терминальный результат попадает в историю один раз. До ответа операция не считается успешной; ETA не придумывать, fake процент/он-чейн hash не показывать.
- Controller хранит черновики отдельно по полному маршруту/действию; UI владеет шагами, порт передаётся через props. Quote не восстанавливается из черновика. Pending не теряется незаметно из-за закрытия: в этой первой demo-волне закрытие/смена контекста во время принятого submit блокируется коротким понятным сообщением, пока не придёт результат/ошибка. Escape до submit закрывает панель и сохраняет draft; после результата закрытие доступно. Симуляция должна завершаться или давать recoverable error, не ловушку бесконечного ожидания. При unmount — cleanup без позднего UI-update; повторные terminal callbacks дедуплицирует controller.
- Одна живая сцена/controller/material host. Семь пресетов и их материалы, статическая `/concepts/`, V1/Stitch, сервер и public main не меняются. Не внедрять выбранную A/B/C-компоновку: выбор ещё у заказчицы. Батарейку не превращать в ускоритель, не заявлять покрытие новых операций без контракта; #42 остаётся отдельным вопросом. Светлая унификация #59 и общая доработка motion #58 не входят.
- Дизайн продолжает нынешние компактные панели: одна общая мягкая поверхность, ясная типографика и отступы, без отдельной рамки на каждом поле. Buy/Swap используют одинаковую визуальную грамматику, отдельные CSS Modules, текущие переменные темы/типографики и иконки. Не выдавать CSS blur за настоящий WebGL glass и не добавлять canvas/библиотеки/настройки. Одна явная CTA текущего шага; итог и предупреждение видны до подтверждения, не за hover.
- Поведение движения: спокойный короткий переход шага около 220–300ms, существующая easing `cubic-bezier(.2,0,0,1)`, zero overshoot, малое смещение. Не анимировать финансовые числа/count-up/blur, не добавлять постоянные loops. Respect existing static/calm/system reduced motion; motion не удерживает старые приватные данные. Touch44, focus-visible, Escape/back/focus return и читаемый320px.
- Privacy распространяется на суммы, поля, итог, receipt и историю новых операций. Во время скрытия не отправлять форму; данные не должны оставаться видимыми в aria-label/tooltip/title. Контакты/адреса клиента в fixtures запрещены.
- Быстрый цикл: точечный RED/GREEN для нового финансового/lifecycle поведения; затем один независимый обзор только новых стыков без повтора тестов. Один ORACLE typecheck/build/start3184 после готовых handoffs, один связный root browser pass. Никаких full-suite/lint/build после каждого коммита. Повтор — только после конкретного исправления. Общие настройки и опубликованные snapshots не использовать как тестовые данные.

## Интерфейсы и порядок

Task1 сначала фиксирует небольшой `commerce-contract.md` в workspace плана и реальные type exports; сообщает `CONTRACT_READY`. Root передаёт его задачам2/3/4. Пока этого нет, они могут изучить свои точки интеграции, подготовить UX/тестовые сценарии, но не изобретать параллельные типы. После фиксации imports/signatures меняются только согласованным сообщением root и обновлением manifest.

Предпочтительные имена: `BuyRoute`, `SwapRoute`, `BuyDraft`, `SwapDraft`, `BuyPort`, `SwapPort`, `CommerceSimulation`, `createDemoCommercePorts(snapshot)`. `loadRoute`, `quote`, `submit` принимают AbortSignal; submit — quote + idempotencyKey. Route-action narrowing через intersection с `ProductActionRoute`, не `Extract` над нынешним non-receive union (получится never).

Экспорты UI: `BuyFlow`/`BuyFlowProps`, `SwapFlow`/`SwapFlowProps`. Общая граница props: route, port, privacy, initialDraft, onDraftChange, onSimulationResult, optional onViewHistory, onBack, onClose. Callback занятости submit для host close/context guard должен быть зафиксирован Task1 вместе с props contract; ничего не включать в battery usage автоматически.

Task1 supplies deterministic demo fixtures for a SMALL explicit set of existing routes and one same-network swap pair. Exact IDs/precision/rates/limits are recorded in the contract manifest, visually marked demo, and used by integration capabilities. No automatic cross-chain exchange/bridge or limit orders. New global resource loading/auth/onboarding work is deferred; only local loading/error/empty/unsupported states for these flows enter this slice.

## Task 1 — Общие контракты, точные расчёты и demo ports

Owner: новое окно «NOVEX — Покупка/обмен: контракты». Owns only `apps/miniapp/src/mono-product/commerce/**` plus its workspace contract/report. НЕ трогать core, demo-adapter/controller/product-sheet, history, Buy/Swap UI. Imports существующих amount helpers допустимы; не рефакторить Send/Receive ради общего framework. Новые переиспользуемые helpers размещать в commerce.

Прочитай Global Constraints и минимальный текущий wiring. Сначала опубликуй `CONTRACT_READY` (types и workspace manifest) со стабильными exports, Flow props integration contract, fixture routes/methods/pairs и ownership accepted submit. Затем реализуй guards и `createDemoCommercePorts(snapshot)` в тех же owned paths. Buy leg — отдельная fiat amount/currency и crypto destination с IDs; Swap — две полные crypto legs. Не использовать общий голый quantity для разных единиц.

Load returns ready/unavailable/error; quote/result contracts distinguish explicit demo success/failure and incomplete/mismatched values. Демо-порт не делает network calls, создаёт результат только после explicit submit и поддерживает AbortSignal/idempotency. Известная однотипная комиссия учтена в debit, net credit показан отдельно; unknown закрывает confirm. Проверки quote/request/result находятся здесь для обоих UI, не дублировать их в двух хуках. Для purchase «funding» внешнего демо-метода не проверяется криптобалансом получателя; это явный вид funding, не unlimited real payment permission.

Targeted RED/GREEN: decimal/precision/limits, unknown available/funding, полная binding/invalidation/expiry, stale result mismatch, idempotency and abort, only explicit configured route/method/pair. Сначала докажи несколько критичных failures, затем дополни минимальную реализацию; не плодить сотни похожих cases. Type declarations учитывают ES2022 и текущий tsconfig, без findLast/new runtime APIs.

Report: `.superpowers/sdd/2026-10-04-buy-swap-demo/task-1-report.md`, contract: `commerce-contract.md` там же. Вернуть коротко CONTRACT_READY и затем DONE/concerns + owned commits + command/count. Без build/start/push/deploy. Helpers SOL6.1MAX можно использовать для независимого decimal/guard анализа или узкого owned модуля, не для повторного reviewer ladder.

## Task 2 — Купить: законченный компактный flow

Owner: новое окно «NOVEX — Купить: демосценарий». Owns only `apps/miniapp/src/mono-product/buy/**` and report. Зависит от Task1 CONTRACT_READY; до него только UX/стыки/сценарии проверок. Read-only примеры Send/Receive, не менять их/sharedCSS/ports/history/controller.

Реализуй `BuyFlow`: load exact destination → ready method selection → raw fiat amount → quote/review (оплата, crypto credit, fee, account/network, demo notice) → explicit «Подтвердить симуляцию» → pending → demo result / useful error → «В истории». Не поля карты, не реальные бренды банков, не внешний redirect. Неподдерживаемый маршрут/нет метода/ошибка загрузки — короткое объяснение и доступный back/retry, без пустой половины экрана.

Пользователь может вернуться и исправить сумму без потери draft; старый quote более не авторизует подтверждение. Pending guard сообщает host, current attempt нельзя запустить повторно. Errors сохраняют редактируемый ввод; terminal success очищает только свой draft. Privacy masked values/inputs and blocked confirmation obey shared policy. onSimulationResult отдаёт проверенный immutable result один раз; запись истории не делается внутри UI. Сохрани полезность при reduced/static без fake delays.

UI: компактные labels, одна ведущая сумма, ясный итог, current theme vars и сдержанный glass-like fallback существующей панели без нового shader. Финансовые значения не прыгают. Общую тему/motion settings не редактировать. Согласуй с Swap owner через root однотипные spacing/header/CTA, но держи свои CSS Modules и не создавай новый design system.

Targeted component/hook RED/GREEN: amount→review→pending→terminal, invalidated/expired quote нельзя submit, duplicate submit, rejected/mismatched/late responses, back restores draft, privacy hides values and blocks submit, empty/error/retry. Используй реальные guards Task1 и controlled deferred port для async boundaries; тесты не должны доказывать только mock.calls. Report `task-2-report.md`, commits exact buy/**. Без build/browser/server/publish.

## Task 3 — Обмен: две стороны и понятный расчёт

Owner: новое окно «NOVEX — Обмен: демосценарий». Owns only `apps/miniapp/src/mono-product/swap/**` and report. Зависит от Task1 CONTRACT_READY; до него только UX/стыки/сценарии проверок. Не менять buy/commerce/shared controller/history/core.

Реализуй `SwapFlow`: load source placement → choose one of explicitly allowed destination routes → «Отдаю / Получаю» → quote/review → explicit demo submit → pending → demo result / useful error → «В истории». Обе стороны показывают актив, сумму, счёт/сеть; доступный остаток источника не подменяется общей оценкой. Расчёт net credit/fee/expiry из порта; не вычислять live курс из portfolio fiat values. До расчёта Получаю — «После расчёта», не0.

Визуально две связанные области в одной поверхности, без россыпи вложенных квадратов. Если reverse control есть, он доступен только при явно разрешённом обратном маршруте и known source; не переставлять подписи при сохранении старого quote. Можно оставить reverse за пределами первого среза, если нет соответствующего offered route. Не добавлять bridge, limit orders, график/свечи, slippage tuning или новые настройки без supplied contract.

Изменение суммы/назначения сбрасывает quote. Full request binding и guards Task1 обязательны; known available с total debit. Pending, privacy, drafts, onSimulationResult/close/context guard — тот же контракт, что Buy. Не писать самостоятельно историю и не изменять fixture balance.

Targeted RED/GREEN: exact source/destination pair, available vs total debit/unknown, quote stale/expiry/invalidation, rejected or mismatched result, duplicate submit, back/draft/privacy, terminal result carries BOTH accepted legs. Report `task-3-report.md`, commits exact swap/**. Без build/browser/server/publish.

## Task 4 — Интеграция маршрутов, черновиков и двухсторонней истории

Owner: новое окно «NOVEX — Покупка/обмен: интеграция». Owns `demo-adapter.ts`, `product-controller.ts`, `product-sheet.tsx`, their focused tests, product activity/history/recent/receipt + filtering files, `asset-workspace/asset-workspace-data.ts` and relevant tests, necessary exact core demo capabilities file(s), and narrow host bindings only if required. НЕ писать commerce/**, buy/**, swap/**, appearance, material/shader code, global motion, packages/ui legacy V1. Если обнаружен общий файл вне карты — коротко root, не silent expansion.

Зависит от Task1 CONTRACT_READY; можно заранее спроектировать/проверить текущий journal/filter path, но не придумывать второй контракт. Получи Task2/3 completed components перед final wiring tests. Покажи новые входы из main actions и asset placement только для явного fixture support. Сохрани нынешнюю компоновку и все четыре material targets. Быстрый выбор активов/сети — компактный, без больших пустых sheet с тремя кнопками. Принятые Send/Receive popovers даже для единственного route сохраняются.

Передавай stable ports, controller-owned drafts, checked terminal result callbacks, history navigation. Busy guard блокирует host close/смену контекста только на принятом pending; не терять форму при теме/appearance. Удаление route/смена adapter инвалидирует старые requests, callback старой flow не должен перезаписать чужой draft/активную операцию.

Одна commerce simulation ID → одна history record. Модель сохраняет discriminator buy/swap и обе стороны, а не две фиктивные send/receive записи. Существующие Send/Receive/internal records совместимы. Amounts в list/recent/receipt подписаны по единицам; Swap показывает debit и net credit, Buy fiat payment и crypto receipt. «Сумма операции» не смешивает валюты. Asset filters/workspace показывают Swap по любой стороне без удвоения в All; account/network scoping использует стороны. Направление и status независимы, swap не изображается failed send. Privacy скрывает все обе стороны во всех новых строках/aria/receipt.

Targeted integration RED/GREEN: main action→supported flow, no offered route→reason, exact terminal dedup→two-leg history/filter/receipt, drafts isolated by action+route, busy close/context blocked then released, original Send/Receive/int-transfer behavior preserved with minimal affected smoke (не весь suite). Не включать общий async account resource wrapper или новый onboarding в эту волну. Report `task-4-report.md` + touched paths/exports/code concerns. Без typecheck/build/start/deploy; это ORACLE.

## Task 5 — Единая локальная сборка и приёмка

Owner: существующий ORACLE, dispatch только по exact source после четырёх reports и одного focused cross-contract source review. Не менять implementation files, scope fixes вернуть owner. Один общий typecheck/build/local3184 start, при actual fix повторить только упавшую проверку. Сохранить local3185 и public /concepts/, live main85d33, семь snapshots/history. Не push/merge/deploy.

Root проходит один связный browser-only mobile-width сценарий Buy→result→history и Swap→result→обе стороны history; видит loading/review/pending в разумной мере, не повторяет producer matrix. Владелец решает визуальную приёмку. Report `task-5-report.md` содержит exactSHA/buildID/launchID/PID, commands, ограничения. Публичный выпуск только по следующему отдельному решению.

## Следующие этапы, не включённые автоматически

Пустой кошелёк/первый вход, общий async data/auth resource, live API и реальная оплата, механика батарейки, общий Light5, выбранная A/B/C-композиция. Эти темы остаются видимыми в backlog, но не раздувают текущие четыре задачи.
