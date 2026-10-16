# MONO — счета и внутренний перевод

Владелец разрешил разбить следующий срез на агентов и поручил ORACLE общую сборку. Реализуем только счета/выбор маршрута + законченный внутренний demo transfer. Обмен, покупка, расширение профиля и публикация на VPS — не эта волна.

Canonical checkout: `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`; branch `codex/product-ux-20261003`; base `ccd6681`. Runtime до начала волны `33a22ef`, origin `http://127.0.0.1:3184/mono`. Итоговая сборка указана ниже.

## Global Constraints

- Свой React frontend, только явные симуляции. Не менять balances, battery charges, внешние APIs, опубликованные snapshots или семь appearance presets. Ни подписания, ни реальных адресов/переводов. Не копировать клиентские данные.
- Internal route разрешается только явным binding source/destination/asset/network плюс текущими capabilities/status; send capability сама по себе не разрешает внутренний перевод. Только одна и та же сеть/валюта, разные счета. All — обзор, не источник.
- Read-only ReceiveDataPort не превращать в mutating API. Отдельный optional InternalTransferPort. Unknown available / недоступная пара закрывают подтверждение. Суммы decimal strings, без Number/parseFloat для денег. 128 символов — UI bound, не финансовый лимит.
- Fee для единственного существующего demo binding custody → depositary USDC/Ethereum — явно условные 0 USDC. Это fixture, не утверждённый тариф backend. Батарейка не участвует и не анимируется от этого сценария. Известный доступный остаток берётся только из exact source holding, не из общей оценки USD/quantity fallback.
- Draft только в host session memory: target account/asset/network → sourceAccountId + raw amount. Закрытие/возврат/смена оформления/privacy сохраняют draft, но не восстанавливают quote, confirmation или result. Успех очищает свой draft. Ничего в localStorage или appearance JSON.
- Существующий glass host и motion сохраняются. Компактная типографика и отступы, без новых квадратных рамок на каждую строку. Touch44, focus/back/escape, privacy без сумм в DOM/aria/title, reduced-motion/static. Короткое направление перехода 200–240ms, zero overshoot; цифры неподвижны. Новых dependencies/canvas/RAF нет.
- Существующие Astra MAX чаты, допускаются узкие SOL6.1 MAX helpers. Параллельные непересекающиеся owned paths. Контроллер читает отчёты/diffs один раз; только focused RED/GREEN, один общий typecheck/build и root browser pass. Пользовательский быстрый цикл заменяет широкие skill review/test ladders, новые worktrees/install/baseline suites не нужны. Старые отчёты не удалять.
- ORACLE единственный владелец preview: текущий3184 работает до общего freeze. Предупреждение перед stop, один verified build/start, exact source/buildId. Только browser UI, не native desktop. Без push/deploy/merge. Чужой generated next-env.d.ts сохраняется.

## Task 1: Контракт и demo port внутреннего перевода

Исполнитель — существующий Send Astra MAX. Canonical checkout/branch/base и Global Constraints выше. Прочитать AGENTS, scoped Next guide если нужен, TDD. Owned только НОВАЯ папка `apps/miniapp/src/mono-product/internal-transfer/**`. Старые send/**, receive/**, core, controller и sheet не изменять. Сначала закрепить типы/index отдельным маленьким commit и сообщить root; затем реализация/test commit. Другие агенты могут начать по приведённому контракту.

Публичные exports из internal-transfer/index.ts (без React):

```ts
type InternalTransferDraft = { sourceAccountId: string | null; amount: string };
type InternalTransferRequest = { sourceAccountId: string; destinationAccountId: string; assetId: string; networkId: string; amount: string };
type InternalTransferQuote = { mode: 'demo'; id: string; request: InternalTransferRequest; sourceAccountLabel: string; destinationAccountLabel: string; symbol: string; networkLabel: string; available: string; assetDebit: string; fee: { amount: string; symbol: string }; expiresAt: number };
type InternalTransferIssue = 'unsupported-route' | 'invalid-amount' | 'unknown-available' | 'insufficient-asset' | 'expired-quote' | 'invalid-quote' | 'unavailable';
type InternalTransferQuoteResult = { status: 'quoted'; quote: InternalTransferQuote } | { status: 'unavailable'; issue: InternalTransferIssue };
type InternalTransferResult = { mode: 'demo'; status: 'simulated-success' } | { mode: 'demo'; status: 'simulated-failure'; reason: 'rejected' | 'expired' | 'unavailable' };
type InternalTransferSimulation = { simulationId: string; quote: InternalTransferQuote; result: InternalTransferResult };
interface InternalTransferPort { readonly mode: 'demo'; quote(request: InternalTransferRequest, options: { signal: AbortSignal }): Promise<InternalTransferQuoteResult>; submit(command: { quote: InternalTransferQuote; idempotencyKey: string }, options: { signal: AbortSignal }): Promise<InternalTransferResult>; }
```

- Factory `createDemoInternalTransferPort(snapshot: Readonly<ProductSnapshot>, bindings: readonly DemoInternalReceiveBinding[], options?)`. Binding импортировать type-only из receive/receive-types либо совместимый structural type без дублирования runtime permissions. Options допускают injected clock и конечные abortable demo delays/outcome для явных примеров. Default quote около150ms, submit около450ms; no timers after abort. No random/render time side effects; IDs генерировать только при commands.
- Quote: exact binding, оба account active, target internal receive capability, source send capability, точное source holding с известным valid available. Дублирующие/неоднозначные source holdings не складывать молча. Normalize comma/dot exact text, >0, raw<=128, <=available; не выдумывать token decimals. Fee fixture0, assetDebit=amount; quote TTL60s; canonical request/labels из snapshot. Вход snapshot не мутировать.
- Submit не доверяет присланным amount/fee/label и полям quote: сверить со своим выданным snapshot, сроком, route, current capability/available. Idempotency key обязателен, повтор не создаёт вторую симуляцию; защита mismatch key/quote. Хранение ограничено жизнью port/разумным bounded cache, без storage. Никаких actual ledger mutations.
- Export `validateInternalTransferQuote(request, quote, now): InternalTransferIssue | null` и `normalizeInternalTransferAmount(raw): string | null` для UI guard до submit. Validate exact request identity, demo marker, nonblank IDs/labels, known available, same-asset fee fixture, expiry и денежные строки. Это boundary, не общий event bus.
- Focused RED/GREEN: binding exactness/self/cross-network/inactive denied; unknown available vs insufficient; decimals exact; forged/stale quote; duplicate/aborted submit; snapshot balances/battery unchanged. Один self-read, no build/typecheck/full Send suite.

Report `.superpowers/sdd/2026-10-03-internal-transfer/task-1-report.md`; short DONE/commits/checks/concerns. Любое изменение публичного контракта сначала root, не молчаливое расхождение.

## Task 2: Законченный экран внутреннего пополнения

Исполнитель — существующий Receive Astra MAX. Owned только receive/**. Не internal-transfer implementation, не controller/sheet/history. Прочитать AGENTS, scoped Next docs, TDD, motion-design/animation-basics. Использовать общие Global Constraints и exact types Task1 через `../internal-transfer`.

Additive ReceiveFlowProps:
`internalTransferPort?: InternalTransferPort; initialInternalDraft?: InternalTransferDraft; onInternalDraftChange?(draft: InternalTransferDraft | null): void; onInternalSimulationResult?(event: InternalTransferSimulation): void; onViewInternalHistory?(): void`.

- Старый read-only external Receive и его amount/request/copy/share не трогать. Если internalTransferPort отсутствует — прежняя честная route-only версия совместима, не fake success.
- Internal: источник (единственный доступный можно выбрать автоматически) → сумма → явный demo расчёт → «Подтвердить симуляцию» → pending → результат/«В истории». Откуда/Куда постоянно ясны; одинаковые сеть и актив рядом, не три дублирующихся context-card. Сумма как основное поле, source selection компактная, форма в одобренной glass sheet. Доступный остаток/комиссия из quote, не из вымышленной локальной арифметики. Inline invalid/insufficient/unknown объясняются рядом с полем. Для quote result ожидание не придумывать.
- Draft raw input/source живут выше privacy/remount child; emit только на user edit, не затирать initial seed эффектом. При смене source/amount/route/port старый quote/result немедленно не подтверждаем, async latest-wins/AbortSignal. Asset details roundtrip сохраняет ввод. Privacy убирает input/amount/fee из DOM и блокирует quote/confirm, без потери draft. Pending read-only; close/unmount abort, late callback не пишет историю закрытого flow.
- Перед submit независимая validateInternalTransferQuote; snapshot принятого quote скопировать до await. Один idempotency key на попытку; lock защищает быстрые двойные клики. Simulation ID из стабильного instance ID + монотонного event counter (не random на render); result callback ровно один, лишь на принятый success/failure, не quote error/abort. «Назад/Изменить» требует нового quote. Успех clear draft; failed сохраняет для правки. Battery callbacks не включать.
- Смысл результата: «Симуляция завершена. Средства между счетами не перемещены». Fee0 обозначена комиссией примера, а не обещанием бесплатного реального перевода. Unknown real business rules остаются за backend. Не добавлять payable QR/адреса/Max/новую лабораторию.
- Короткий осмысленный переход между review/result, не бесконечные эффекты и не раскачивание цифр. При узком viewport suffix валюты не сжимается и действия доступны с прокруткой. Существующий фокус/Back/host Close сохраняются.
- Одна focused серия для internal quote→review→result callback, source/change invalidation/stale abort, duplicate submit, privacy+draft; старую external матрицу не повторять, если её не менял. No server/build/typecheck. Обновить INTEGRATION.md коротко.

Commit exact owned paths; report `.superpowers/sdd/2026-10-03-internal-transfer/task-2-report.md`. Если порт ещё не реализован, можно писать UI/tests по exact contract без temporary production stubs.

## Task 3: Компактный выбор счёта и маршрута

Исполнитель — существующий UX Astra MAX. Owned НОВЫЕ `product-account-chooser.tsx`, `product-route-chooser.tsx`, `product-chooser.module.css`, их focused tests. Не менять product-sheet/controller, history/recent, product-home.css или темы; ORACLE заменит старые inline chooser на exports. Прочитать AGENTS/scoped docs/TDD/motion skills.

Contract:
`ProductAccountChooser({ snapshot, context, balanceHidden, onSelectContext })` из core ProductSnapshot/AccountContext.
`ProductRouteChooser({ routes, holdings, action, balanceHidden, focusRouteKey?, onSelectRoute })` где routes readonly ProductActionRoute[], holdings readonly ProductHolding[], action ProductActionKind; callback exact route. key совпадает с `productRouteKey` (можно импортировать готовый helper, не менять его). Пустое route reason остаётся у host.

- Account chooser: лёгкие строки, ясные account label/status, выбранный контекст; All общая оценка, не доступно к отправке. Балансы скрыты при privacy. Unavailable account можно просмотреть как контекст, но не создать по нему action. Не выдумывать account names/activation.
- Route chooser: вместо плоской пачки дублирующих button-card — небольшой выбор доступного счёта (если их несколько) и внутри активов/сетей. Выбор счёта внутри picker НЕ меняет global context сам. Не делать три обязательных экрана: одиночный источник/сеть не требует лишнего тапа. Строка явно отличает внешнее получение и «Между счетами». Получение на пустое Хранилище доступно по capability, отсутствие holding не блокирует receive.
- Отобразить доступную crypto сумму только если known exact holding.availableQuantity; не подменять её quantity/fiat. Для receive достаточны актив/сеть/способ, не загромождать. Privacy скрывает financial labels, включая aria.
- focusRouteKey после Back автоматически раскрывает группу нужного счёта и фокусирует exact route без клика/автовыбора. Никакого auto onSelectRoute на render/effect; однонаправленный route auto-open принадлежит controller ORACLE. Стабильные keys, no source guess from symbol.
- Компактный calm UI, без heavy-card на каждый row, мягкий локальный selection accent, focus44/reduced modes. Пресеты/материалы кнопок верхнего меню untouched.
- Один focused набор: exact account/asset/network callbacks; same symbol different networks; internal vs external receive; privacy; focus-route reveal; account totals not spendable. Не запускать build/общий typecheck.

Commit only owned files; report `.superpowers/sdd/2026-10-03-internal-transfer/task-3-report.md`.

## Task 4: ORACLE — интеграция, история, память и preview

Исполнитель — существующий ORACLE Astra MAX. Owned common demo-adapter, product-controller, product-sheet и scoped integration tests; demo-activity/operation-receipt-view/history/recent + asset-workspace history selector только необходимые стыки внутреннего перевода. Не файлы Task1/2/3. Прочитать AGENTS/scoped docs/TDD; контракты выше.

- Использовать один explicit demo binding для read-only Receive и нового port, без рассинхронизации. createMonoDemoFlowPorts возвращает internalTransfer. Read-only receive data contract остаётся read-only. Не трогать snapshot fixtures/balances/battery.
- Session internalTransferDrafts keyed destination/asset/network/mode, stable save command. Save только legitimate internal route/source из explicit binding, raw<=128, clear по null. Source change invalidates quote в UI, closing/reopen/skin/privacy restores только raw draft. Не сохранять confirmation/quote/result/storage. Подключить additive Receive props Task2 и result/history CTA. Внешний request draft не теряется.
- RecordInternalTransferSimulation принимает validated snapshot event с mode demo, revalidates точную source+target capability/binding/amount; dedupe simulationId. Пример fee не становиться ledger. Успех clear соответствующий draft; failed не clear. Одна activity в All, видна также при scope любого участника. Additive internalTransfer metadata: source/destination IDs и labels. Source side outgoing, target side incoming; сохранить stable activity ID при projection. Не создавать две независимые операции в All. Не объединять по symbol.
- Новый узкий helper для account-scoped projection/filter применить в ProductHistory, ProductRecentActivity и asset-workspace matching по exact asset/network/account. Обычные внешние/legacy entries не изменяются. Внутренний row ясно назван «Между счетами · демо», receipt показывает Откуда/Куда/сеть/сумму/комиссию примера, privacy маскирует финансы. CTA из результата открывает exact single entry с текущим scope target/source и сохраняет готовое semantic focus из предыдущей волны. Не вводить новый icon pack/settings ради этого.
- Подключить Task3 account/route choosers в существующий ProductSheet, убрать superseded inline UI/helper только если больше не используется. openIntent может сразу выбрать единственный exact route. Back при единственном route возвращается/закрывает корректно без auto-open loop; placement path сохранён. All не превращается в source, выбранный account не меняется от промежуточной группы picker.
- Focused integration: полный custody→depositary USDC path → one All entry → source/target history projection; unrelated network excluded; repeated result deduped; no balance/battery mutation; draft close/appearance/privacy; existing external receive draft compatible. Не повторять целые sender/receiver/history matrices.
- После handoff трёх исполнителей один scoped review на diff от ccd6681, один miniapp typecheck/build. Текущий3184 держать до freeze, warning root→verified stop/build/start→READY exact SHA/buildId. Root проходит один browser путь390px. Без VPS/push.

Report `.superpowers/sdd/2026-10-03-internal-transfer/task-4-report.md`; сперва ждать contract commit Task1, независимые integration заготовки допустимы. Если contract не стыкуется — root решает, не добавлять вторую parallel API.

## Итог локальной волны — 2026-10-03

- Все четыре задачи интегрированы. Новый выбор счёта и маршрута, внутреннее demo-пополнение Основной → Хранилище (USDC/Ethereum), расчёт/подтверждение/результат, память черновика в текущей сессии и переход к одной операции в истории. В контексте источника она исходящая, получателя — входящая; в «Все счета» не дублируется.
- Коммиты: контракт `3c20a46`, проекция истории `05575b6`, choosers `3fb1102`, port `9ff5209`, Receive `4894e4a` + компактная правка `7016417`, интеграция `eb53490`.
- Source/runtime: `eb53490ef2277958dfe748e48284a6c8603dde92`; build `mOplij_3NWoOFqcLn_Eyx`; preview `http://127.0.0.1:3184/mono`. ORACLE выполнил одну production-сборку и штатный verified start, проверив identity и HTTP 200. Общий typecheck и целевые проверки компонентов/стыков прошли; полные смежные suites не повторялись.
- Root прочитал исходники и стыки один раз, устранил повторяющийся контекст/intro через владельцев модулей. Финальный browser walkthrough не завершён: инструмент отклонил доступ к вкладке по browser security policy. Обход не выполнялся. Визуальная оценка передана владельцу; новых скриншотов этой волны нет. Физический телефон и все темы не проверялись.
- Это симуляция: реальные средства не перемещаются, остатки и батарейка не списываются; комиссия 0 — явный demo-пример, не будущий тариф. Пресеты и материалы не изменены. Только локальные commits, без push/merge/VPS. Чужой generated `next-env.d.ts` сохранён вне коммитов.

Короткий путь просмотра: «Получить» → «Хранилище» → USDC → ввести сумму → «Рассчитать пример» → «Подтвердить симуляцию» → «В истории». Завершение этой волны не означает готовность реального backend; обмен/покупка/вывод остаются отдельными следующими сценариями.
