# Карточка актива: от обзора к действию

Согласовано владельцем: «Хорошо делай» после предложения полноценной карточки актива. База: `6209f38`, ветка `codex/product-ux-20261003`. Канонический checkout: `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`.

## Результат

Нажатие на валюту открывает отдельный экран внутри кошелька: количество этой валюты, оценка, размещения по счетам/сетям, отправка и получение из выбранного размещения, история этой валюты. Закрытие операции возвращает к выбранной валюте. Это фронтенд с честными демонстрационными данными, не подключение платежей.

### Передано на визуальную оценку — 3 октября 2026

- GitHub: [задача48](https://github.com/i4w7w4a/Wallet_4i7/issues/48), продолжение epic40.
- Реализация: `44a55d1` (identity истории), `ea37529` (экран/вход), `800dc089f1245e237bc938e6956ba6008ff17c6a` (интеграция).
- Локальная production-сборка: `http://127.0.0.1:3184/mono`, build `V5d9VzHsmhrNcoAZljgOA`, runtime source `800dc089`. Публичного deploy или push в этой итерации не было.
- Адресные тесты данных/UI/контроллера и miniapp typecheck прошли, production build успешен. Без повторных полных матриц.
- Root прошёл в браузере при390×844: Мои средства → USD Coin → Основной/Ethereum → Отправить → Закрыть → Назад. Подтверждены exact network, сохранённый выбор, общий контекст «Все счета» и возвращение фокуса на USD Coin. Временный viewport сброшен; карточка оставлена открытой.
- Мобильный скриншот: `C:/Users/iwwa/.novex-ops/product-ux/2026-10-03/asset-workspace-mobile.jpg`. Физический телефон в этой итерации не проверялся.
- Существующие пресеты/материалы не изменялись. История и операции демонстрационные; точечная визуальная доработка — по обратной связи владельца.

## Ограничения

- Не менять семь оформлений, сохранённые пресеты, материалы, существующие фоны и одобренную стеклянную панель.
- Общая стоимость — оценка; доступность отправки определяется только конкретным счётом, активом и сетью. Не суммировать доступное между сетями.
- Денежные количества — decimal strings; суммирование без floating point. Не изобретать курсы, комиссии, графики, ETA или правила батарейки.
- Состояние продукта принадлежит контроллеру выше сменяемого оформления. Финансовые черновики не попадают в пресеты/localStorage.
- Раздельные владельцы файлов, существующие чаты Astra MAX; вспомогательный исполнитель SOL 6.1 MAX. Быстрый цикл: адресные тесты связей, одна интеграционная проверка и одна сборка. Не запускать повторные полные матрицы.
- Только браузерные инструменты, без native computer use. Не обходить запрет управления вкладкой error/data:. Работа локально, без VPS/deploy.
- Пока идёт код, текущая production-сборка на 3184 продолжает работать. Её переключает только ORACLE после готовности.

## Общий контракт

Новый компонент экспортируется из `apps/miniapp/src/mono-product/asset-workspace/index.ts`:

```ts
type ProductAssetWorkspaceProps = {
  view: MonoProductView;
  assetId: string;
  selectedHoldingId: string | null;
  onSelectHolding: (holdingId: string) => void;
  onBack: () => void;
  onPlacementAction: (holdingId: string, action: "send" | "receive") => void;
  onExpandActivity: (id: string | null) => void;
  onRetryActivities?: () => void;
};
```

Компонент не импортирует новые команды контроллера: только существующий `MonoProductView` и callbacks. Контроллер добавляет `view.assetWorkspace: {assetId: string; holdingId: string | null} | null` и команды `openAsset`, `selectAssetHolding`, `closeAsset`. Единственное размещение можно выбирать сразу; при нескольких выбор обязателен, первого по умолчанию нет. `ProductHoldings` получает optional `onOpenAsset?: (assetId: string) => void`.

История получает optional `assetId?: string; networkId?: string` в `ProductActivity`, без ломания старых потребителей. Новая карточка фильтрует по точному `assetId`, текущей области счетов и, если выбрано размещение, точным `accountId` + `networkId`. Записи без identity не угадываются по тикеру/названию сети. Новые события симуляции содержат identity.

## Task 1: Identity и согласованные примеры истории

Исполнитель: SOL 6.1 MAX, подзадача оркестратора. Работать только в каноническом checkout выше; прочитать корневой AGENTS.md, scoped AGENTS и TDD/writing-good-tests перед правками. Пользователь просит минимальные полезные проверки.

Владение: только `apps/miniapp/src/mono-product/demo-activity.ts`, его существующие/новые тесты. Не трогать adapter/controller/scene/UI. Прочитать `packages/core/src/wallet-product-demo.ts` для точных identity.

1. Добавить optional `assetId` и `networkId` в ProductActivity. Старую `createDemoActivities` сохранить совместимой; её USDT/TON примеры нельзя превратить в USDC только переименованием.
2. Добавить `createSnapshotDemoActivities(snapshot: ProductSnapshot): readonly ProductActivity[]` — небольшой стабильный набор явно демонстрационных записей на основе реальных размещений snapshot. Например USDC Ethereum и Solana, ETH; не больше одной записи на размещение, максимум 4. Идентичности брать из holding, accountLabel из snapshot. Синтетическая quantity не меняет баланс и не выдаётся за восстановленную историю. `mode: "example"`, стабильные id/даты, никаких адресов/txhash/выдуманных комиссий.
3. Один адресный тест набора доказывает соответствие asset/account/network и стабильность, включая неизвестный account. Не запускать полные suite/build.
4. Commit только своих файлов. Отчёт в `.superpowers/sdd/2026-10-03-asset-workspace/task-1-report.md`: commit, команда/итог теста, экспорт, риски. Коротко сообщить корню DONE/CONCERNS.

## Task 2: Экран актива и вход из списка

Исполнитель: существующий чат «NOVEX — UX-рывок: главная и активы», Astra MAX. Работать в `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, ветка `codex/product-ux-20261003`, база6209f38. Не исторический cwd чата. Прочитать AGENTS.md, apps/miniapp/AGENTS.md и нужные локальные Next docs. Пользователь требует быстрый цикл, несколько полезных тестов, не полную матрицу.

Владение: новая папка `apps/miniapp/src/mono-product/asset-workspace/**`, `product-holdings.tsx`, `product-holdings.test.tsx`, узкие дополнения `product-home.css` только для входа. Не редактировать controller, scene, adapter, shared sheet, demo-activity и текущие flow-папки.

Создать `ProductAssetWorkspace`/тип props с экспортом из `asset-workspace/index.ts`. Контракт:
`{view: MonoProductView; assetId: string; selectedHoldingId: string|null; onSelectHolding(holdingId:string):void; onBack():void; onPlacementAction(holdingId:string, action:"send"|"receive"):void; onExpandActivity(id:string|null):void; onRetryActivities?:()=>void}`. Пользоваться только текущими полями view; новые controller-команды не импортировать.

- Полноценный subview, не новая тяжёлая шторка: компактное «Назад», знак/name/ticker, крупное количество конкретной валюты, вторичная оценка. Не карточка внутри карточки внутри карточки; типографика и воздух, прозрачность/кромки в существующем языке. Не менять одобренное стекло и батарейку.
- Точное суммирование decimal strings (BigInt/scale), неизвестное значение не считать нулём. Общая quantity допустима как владение одной валютой, но не «доступно отправить». Не придумывать график/курс/24h.
- Размещения берутся из `view.holdings` в текущей области счетов. Один selectable список: счёт, сеть, количество. Несколько размещений — выбор пользователем; selectedHoldingId=null означает нет источника, не подставлять первый.
- Выбранное размещение показывает «Доступно» только из availableQuantity, корректные Send/Receive по точным resolveActionRoutes. Нет capability/неактивный счёт/receiveMode unavailable — честное объяснение, не фиктивная кнопка. Никаких реальных операций.
- Суммы и количества, включая историю, obey `view.balanceHidden`.
- История этой валюты: exact assetId + current scoped accounts; selected placement дополнительно exact accountId/networkId. ProductActivity приобретает optional assetId/networkId параллельно; legacy без identity не угадывать по symbol. Переиспользовать ProductHistory для данных/раскрытия либо его компактную согласованную композицию без дублирования бизнес-правил. Учитывать loading/error/empty, retry только callback.
- По возможности дать явное объяснение счёт/сеть без лишних учебников; unknown battery не выдумывать. Батарейку здесь не размножать без необходимости.
- ProductHoldings получает optional `onOpenAsset(assetId)`. При наличии primary нажатие на валюту открывает subview. Существующее inline раскрытие/быстрые действия сохранить отдельной компактной кнопкой с ясным aria-label и 44px hit area; не nesting button/button. Без callback прежнее поведение совместимо.
- Лёгкий вход/выбор на существующих motion tokens, reduced-motion; никаких новых animation runtimes. При работе с motion прочитать motion-design/animation-basics.
- Адресные TDD тесты: exact mixed-network/legacy activity exclusion; privacy; null selection не даёт wrong-route action; entry callback. Не многократные full tests. Commit только owned files, без next-env.d.ts.

Отчёт `.superpowers/sdd/2026-10-03-asset-workspace/task-2-report.md`: экспорт, commit, проверки, что смотреть владельцу. Ответ только DONE/CONCERNS, commit, summary. Допустим узкий SOL6.1MAX helper если действительно ускорит, без дублирующих reviewers. Не запускать/перезапускать сервер, не deploy.

## Task 3: Контроллер, навигация и единая сборка

Исполнитель: существующий ORACLE, Astra MAX. Канонический checkout `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, branch `codex/product-ux-20261003`, база6209f38. Исторический cwd чата не использовать. Прочитать AGENTS и scoped Next docs. Локальный результат, не VPS. Быстрый цикл, без полных матриц.

Владение: `product-controller.ts`/его тесты, `demo-adapter.ts`/его тесты, `mono-preview/mono-scene.tsx`, `mono-product-scene.tsx` и интеграционные тесты, при необходимости точечный `product-sheet.tsx` focus return. Не трогать asset-workspace, product-holdings, product-home.css, demo-activity.ts: параллельные владельцы.

1. Добавить контролируемый `view.assetWorkspace: {assetId:string; holdingId:string|null}|null`, `commands.openAsset(assetId)`, `selectAssetHolding(holdingId)`, `closeAsset()`. Валидировать по текущим scoped holdings. Единственное размещение можно выбирать автоматически, несколько — null. Изменение контекста закрывает/перевалидирует subview; смена оформления его сохраняет.
2. Интегрировать новый `ProductAssetWorkspace` из `asset-workspace/index.ts`: props `{view,assetId,selectedHoldingId,onSelectHolding,onBack,onPlacementAction,onExpandActivity,onRetryActivities?}`. Главная/Активы передают `onOpenAsset` в ProductHoldings. Новый subview заменяет содержимое секции, не дублирует баланс/действия/активы под ним. Навигация на другой раздел закрывает subview; Назад возвращает исходный раздел/список и разумный фокус.
3. Отправка/получение остаются существующей всплывающей панелью поверх subview. Закрытие возвращает к asset+выбранному размещению. Важная тонкость: openPlacementAction сейчас меняет account context. Не терять экран/выбор из-за этого; можно для workspace не менять global context, потому что explicit placement разрешает route отдельно. Обеспечить точное account/asset/network и сохранить черновики/возврат из «О валюте». Не менять семантику стандартных прежних entrypoints.
4. Add assetId/networkId в recordSendSimulation. `ProductActivity` optional identity добавляет отдельный исполнитель. Adapter переходит на `createSnapshotDemoActivities(snapshot)` из demo-activity.ts вместо неверных USDT/TON примеров для USDC snapshot; совместимость внешних adapter fixtures оставить.
5. Адресные TDD: источник не теряется при open/close flow, explicit selected placement route, account/skin context lifecycle, recorded activity identity. Не запускать повторно все send/receive suites.
6. Commit owned source. Сверить итоговый diff только этой итерации с6209f38, устранить конкретные проблемы связи. Одна общая typecheck/build, source freeze перед build; дождаться Task1/Task2 commits. Текущий production3184 остаётся доступен пока пишется код. Согласовать единственное переключение со мной; не перезапускать сервер заранее и не плодить порты. Проверка preview-info/одного200 достаточно; IAB error-tab restriction не обходить.

Отчёт `.superpowers/sdd/2026-10-03-asset-workspace/task-3-report.md`: commits, итоговая проверка, источник сборки, сценарий визуалки, ограничения. Не писать другим чатам без отдельной просьбы владельца; корень координирует. SOL6.1MAX helper допустим для узкой изолированной задачи, но не новые review-лестницы.
