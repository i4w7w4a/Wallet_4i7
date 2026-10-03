# MONO — понятный результат операции

Продолжение по запросу «Работаем дальше». База47b8c81, branch codex/product-ux-20261003. Канонический checkout: C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation. Текущую локальную production3184 сохраняем до общего freeze.

## Передано на визуальную оценку — 3 октября 2026

- [Задача49](https://github.com/i4w7w4a/Wallet_4i7/issues/49), продолжение epic40.
- Коммиты: Send/model `32a90ec`, inline UI `9494293`, интеграция/runtime `a95aa1197ae39a66182be534505c66c1c1bc8257`.
- Локально `http://127.0.0.1:3184/mono`, build `jnUNoRfkfBRT4Bvjub-e7`. Один production build, typecheck и адресные проверки прошли. Без публичного deploy/push.
- Root прошёл390×844: Отправить → USDC/Ethereum → неплатёжный demo:recipient →12,5USDC →расчёт →подтверждение симуляции →В истории. Точная запись раскрыта, receipt показывает0,0001ETH и1заряд по расчёту; симуляция явно не списывает деньги/заряд. Pending показал «Время уточняется», без выдуманного countdown.
- Скриншот: `C:/Users/iwwa/.novex-ops/product-ux/2026-10-03/operation-receipt-mobile.jpg`. Viewport сброшен, история оставлена открытой. Физический телефон и визуальный failed-case отдельно не проверялись; failure/retry покрыты целевыми интеграционными тестами.
- Неблокирующая доводка для #43: после перехода из modal в историю keyboard focus попадает в общий account selector, хотя нужная запись раскрыта и видима. Позже направить semantic focus на эту запись; новый круг сборки ради этого не запускался.

## Цель и границы

После успешной или неуспешной симуляции человек открывает соответствующую запись истории и понимает результат, счёт/сеть, расчёт комиссии и использование батарейки. Детали раскрываются в самой истории, без нового слоя окон. История карточки валюты использует то же представление.

- React demo, не реальные переводы. Нет backend/VPS/push/изменения пресетов, фонов, материалов, glass или батарейки.
- Квитанция — снимок подтверждённого расчёта, не доказательство on-chain платежа. Не говорить «комиссия списана»/«заряд потрачен» в симуляции. Не придумывать TxHash, сроки, стадии сети, проценты прогресса.
- Только terminal event: pending journal lifecycle не добавляем, поскольку текущий flow отменяется при закрытии. Pending из внешних fixtures допустим; ETA только provided finite >=0, не countdown и не обещание завершения при0.
- Деньги decimal strings. История memory-only, не appearance/storage; receipt не содержит recipient/memo/request/полный quote/полный pool/ключи.
- Существующие Astra MAX чаты, узкие SOL6.1MAX помощники допустимы; disjoint ownership. Один targeted RED/GREEN набор на связь, одна интеграционная проверка/build и один browser walkthrough. Не повторные широкие review-лестницы.
- Только браузер, не native Computer Use. Сохраняем existing linked worktree и незатронутый next-env.d.ts. Новые зависимости не нужны.

## Контракт

Новый shared файл `apps/miniapp/src/mono-product/operation-receipt.ts`:

```ts
export type SendQuoteReceipt = {
  assetDebit: string;
  networkFee: {status:"unknown"} | {status:"known"; amount:string; symbol:string};
  feeFunding: {kind:"unknown"} | {kind:"balance"} |
    {kind:"battery"; poolId:string; networkLabel:string; charges:number};
  estimatedCompletionSeconds?: number | null;
};
export function normalizeOperationReceipt(value: unknown): SendQuoteReceipt | undefined;
```

Нормализатор возвращает независимую allowlisted копию; invalid money/charge — unknown/отсутствие receipt, не ноль. Никогда не mutate вход. Invalid estimate — null/omit. SendSimulationResult получает optional `receipt?: SendQuoteReceipt`, ProductActivity — такой же receipt и optional `failureReason?: "rejected"|"expired"|"unavailable"`. Старые emitters/fixtures/feeLabel совместимы.

## Task 1: Снимок расчёта и результат Send

Исполнитель: существующий Send чат, Astra MAX. Актуальная рабочая копия C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation, branch codex/product-ux-20261003, база47b8c81. Прочитать AGENTS/scoped Next docs и TDD; владелец требует быстрых адресных проверок. Не сервер/deploy/push.

Владение: `mono-product/send/send-form.ts`, `use-send-flow.ts`, `send-flow.tsx`, targeted send tests; новый shared `mono-product/operation-receipt.ts` и его focused tests. Другие source paths не менять. Контроллер/demo-activity/overlay у ORACLE, история у UI.

1. Экспортировать SendQuoteReceipt и normalizeOperationReceipt из нового shared файла. Точный тип: `{assetDebit:string; networkFee:{status:"unknown"}|{status:"known";amount:string;symbol:string}; feeFunding:{kind:"unknown"}|{kind:"balance"}|{kind:"battery";poolId:string;networkLabel:string;charges:number}; estimatedCompletionSeconds?:number|null}`. Нормализатор unknown input -> независимая allowlisted копия либо undefined; decimal amounts nonnegative plain strings, finite positive safe integer charges; unknown не становится zero/free. Невалидная ETA -> null/omit. Не передавать whole pool, recipient, memo, request, quote id/expiry, available balances.
2. `SendSimulationResult.receipt?: SendQuoteReceipt`. В submit сразу после final validateQuote, ДО await port.send, снять независимый snapshot именно принятого quote. Emit его в существующем current-task terminal callback, и на success и на failure. Старые callbacks и consumers совместимы. Отмена/stale callback ничего не записывает; mutation quote со стороны port не переписывает receipt. Не создавать новый pending-event lifecycle.
3. Кнопку «В истории» показывать для обоих финальных результатов, если onViewHistory задан. Failure сохраняет существующий явный пересчёт/повтор, не autosubmit. Никаких настоящих переводов или изменения ledger/battery.
4. Адресные RED/GREEN: receipt принадлежит принятому quote и не мутирует после await; allowlist/privacy-sensitive fields отсутствуют; failure CTA работает. Не повторять все Send suites; сохранить существующие stale/abort/dedupe guards.
5. Commit owned files only. Отчёт `.superpowers/sdd/2026-10-03-operation-receipts/task-1-report.md`: exports, commit, tests, concerns. Затем короткий DONE. SOL6.1MAX helper допустим узко без review-дублирования. Runtime не перезапускать.

## Task 2: Компактная квитанция в истории

Исполнитель: существующий UI чат «NOVEX — UX-рывок: главная и активы», Astra MAX. Canonical checkout C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation, branch codex/product-ux-20261003, base47b8c81. Прочитать AGENTS/scoped Next docs, TDD; для движения motion-design/animation-basics. Владелец требует один полезный сценарий без review-лестниц.

Владение: `mono-product/product-history.tsx`, новый `mono-product/operation-receipt-view.tsx`, CSS module для receipt, узкие history-only правила `product-account-sections.module.css`, targeted history/receipt tests. Не трогать controller, send, demo-activity, shared operation-receipt.ts, asset-workspace/scene, profile styles.

Shared тип от Send: `SendQuoteReceipt = {assetDebit:string; networkFee:{status:"unknown"}|{status:"known";amount:string;symbol:string}; feeFunding:{kind:"unknown"}|{kind:"balance"}|{kind:"battery";poolId:string;networkLabel:string;charges:number}; estimatedCompletionSeconds?:number|null}` из `operation-receipt.ts`, там же `normalizeOperationReceipt(value:unknown):SendQuoteReceipt|undefined`. ORACLE добавляет optional `ProductActivity.receipt` и `failureReason?:"rejected"|"expired"|"unavailable"`. Не создавать эти поля в чужих файлах.

- Сохранить API ProductHistory/controlled expandedActivityId, row filtering/empty/loading/error. Раскрытая строка теперь показывает аккуратную квитанцию: статус и короткое объяснение, количество, счёт+сеть, время; расчёт комиссии/оплата батарейкой если receipt предоставлен. Не новая modal или огромная квадратная карточка. Разделять информацию отступами/типографикой; существующие native targets>=44 и aria-controls сохранить.
- Вынести shared presentation в OperationReceiptView({activity:ProductActivity,balanceHidden:boolean}). Встроить его в текущие expanded details, не дублировать исходные dl. Это автоматически обновит и историю внутри карточки актива. Сеть должна быть видима уже в строке истории, иначе одинаковые USDC в разных сетях выглядят дублями; добавить компактную networkLabel в row metadata без раздутия высоты.
- Success/failure simulation прямо говорят, что это демонстрация и средства/заряд не списаны. Для example states использовать нейтральную семантику примера, не выдумывать подтверждения сети. Failed reason объяснить по известному коду, без raw provider text. Пропущенные поля честно unknown, legacy feeLabel сохранён как fallback.
- Receipt fee всегда «Расчёт комиссии» (это quote, не подтверждённое списание). Battery funding показывает расчёт: например «Батарейка · Ethereum», число зарядов как расчёт; не free. assetDebit не суммировать с другой валютой, показывать только если отличается от quantity/полезен. Privacy скрывает quantity/debit/fees/charges, не оставляет цифры в aria-label/title/hidden summary.
- Ожидание только при pending и finite provided estimate, с явной подписью «Оценка ожидания». Unknown «Время уточняется»; 0 не означает «завершено». Для completed/failed таймер не показывать. Не писать fake progress steps/TxHash/explorer/copy receipt с чувствительными данными.
- Спокойное локальное раскрытие190–220ms/zero overshoot, static/reduced-motion без пространственного движения; использовать существующую инфраструктуру, не новую библиотеку/RAF.
- Focused TDD: pending ETA unknown/zero/completed guard, privacy всего receipt, success/failure semantic wording, legacy fee and controlled disclosure compatibility. No full suites/build/server.

Commit owned files only, отчёт `.superpowers/sdd/2026-10-03-operation-receipts/task-2-report.md`, затем DONE/concerns. Текущий asset screen/7 presets/materials не менять. SOL6.1MAX helper допустим для узкой задачи, без дублирования review.

## Task 3: Подключить receipt к истории и собрать

Исполнитель ORACLE Astra MAX. Canonical checkout C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation, branch codex/product-ux-20261003, base47b8c81. Прочитать AGENTS/scoped docs; локальный этап, неVPS/push. Только focused проверка, один build после freeze.

Владение: `mono-product/demo-activity.ts` (только типы; существующие factories сохранить), `product-controller.ts`, `product-sheet.tsx`, targeted integration/session tests. Не send/**, receipt model/view, history/CSS, asset workspace, presets/shaders.

Shared SendQuoteReceipt/normalizeOperationReceipt создаёт Task1 в `mono-product/operation-receipt.ts`. Type: `{assetDebit:string; networkFee:{status:"unknown"}|{status:"known";amount:string;symbol:string}; feeFunding:{kind:"unknown"}|{kind:"balance"}|{kind:"battery";poolId:string;networkLabel:string;charges:number}; estimatedCompletionSeconds?:number|null}`. SendSimulationResult имеет additive receipt?:SendQuoteReceipt.

1. ProductActivity дополнить receipt?:SendQuoteReceipt и failureReason?:"rejected"|"expired"|"unavailable". В recordSendSimulation после текущей exact-route validation/дедупа сохранять normalized независимую копию receipt (неevent/quote целиком); failureReason только allowlisted приfailed. Старые события без receipt работают. Не менять snapshot balances/pools, data storage или source slots.
2. ProductSheet сейчас сбрасывает resultActivityId для любого статуса кромеcompleted. Сохранять id приcompleted И failed, обнулять наnull/preparing/pending; Task1 показывает «В истории» для обоих результатов. Убедиться, что новый расчёт/новая попытка не открывает предыдущую запись.
3. По «В истории» открывается точная запись (и failure тоже); сохранены выбранный счёт, privacy, asset context/back поведение прошлой итерации. Подключение inline receipt делает Task2 без нового sheet kind.
4. Минимальные адресные проверки: success/failure сохраняют правильную receipt/identity без duplicate; mutation input не меняет запись; ViewHistory открывает именноfailed event, новая попытка не несёт старыйid. UI styles/normalizer покрывают собственные исполнители, повторно не гонять.
5. Source freeze после Task1/2commits, один scoped review этогоdiff с47b8c81, miniapp typecheck иодна production build. Старый3184 оставляем доfreeze. Единственное переключение verified stop/build/start3184, предупредить root передstop идать READY exactSHA/buildId. Никакихпараллельныхсерверов. Browserwalkthrough делаетroot.

Отчёт `.superpowers/sdd/2026-10-03-operation-receipts/task-3-report.md`, короткий DONE/concerns. Если нужен повторныйнабор послеисправления — только затронутый. Никаких внешних deploy/push.
