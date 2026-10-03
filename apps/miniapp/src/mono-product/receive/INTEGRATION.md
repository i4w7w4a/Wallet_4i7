# ReceiveFlow — интеграция #45

Detail-компонент для уже выбранного `ProductActionRoute`. Выбор маршрута и общий popup принадлежат host. До backend все реквизиты и внутренние связи демонстрационные.

## Exports и props

Публичный вход — `./receive/index.ts`: `ReceiveFlow`, `createDemoReceiveDataPort` и все типы из `receive-types.ts`.

| Prop | Контракт |
| --- | --- |
| `route: ProductActionRoute` | Уже выбранные account/asset/network/action. Другие actions закрыты без вызова порта. |
| `dataPort: ReceiveDataPort` | Стабильный read-only объект с `load(request, { signal })`. Новый объект означает новую загрузку. Мемоизировать по неизменяемому snapshot. |
| `privacy: boolean` | `true` удаляет input/сумму/preview/реквизиты/QR из DOM и блокирует copy/share. Названия счёта, актива и сети остаются для ориентации; raw draft сохраняется в памяти. |
| `onBack(route)` | Возврат к существующему chooser; передаёт исходный route без изменения контекста. Host сохраняет account context и возвращает фокус выбранной строке chooser. |
| `onClose()` | Закрытие. Вызывается кнопкой закрытия и `Готово` в просмотре внутреннего маршрута. Не означает операцию. |
| `onAssetDetails?()` | Делает строку актива/сети кнопкой деталей. Callback не меняет route, load или локальный выбор. Без callback прежние статические строки сохраняются. |
| `initialRequestAmount?: string` | Однократный raw seed для выбранного route. Изменение этого prop без смены route не перезаписывает ввод. Default — пустая сумма. |
| `onRequestAmountChange?(amount: string)` | Только пользовательские изменения raw строки, включая невалидный черновик. На mount/restore/privacy/смену route автоматически не вызывается. |
| `internalTransferPort?: InternalTransferPort` | Отдельный demo quote/submit port из `../internal-transfer`. Без него internal остаётся совместимым просмотром маршрута. |
| `initialInternalDraft?: InternalTransferDraft` | Однократный seed `{ sourceAccountId, amount }` для выбранного destination/asset/network/mode. Только raw draft, без quote/result. |
| `onInternalDraftChange?(draft \| null)` | Пользовательская смена source/raw amount. Единственное автоматическое событие — `null` после принятого success; failure сохраняет draft. |
| `onInternalSimulationResult?(event)` | Один `InternalTransferSimulation` на принятый success/failure. Нет событий для quote errors, invalid response, abort или закрытого flow. |
| `onViewInternalHistory?()` | Показывает «В истории» на принятом результате; навигацией владеет host. |
| `showCloseButton?: boolean` | По умолчанию `true`. В существующем `ProductSheet` передать `false`, поскольку sheet уже имеет закрытие. |
| `renderQr?: ReceiveQrRenderer` | Необязательный рендер только test-only реквизитов. Без него показан честный не-QR placeholder. |

Компонент — клиентский content, без portal, собственного modal, router, storage или material host. Родительский sheet продолжает владеть Escape, focus trap, возвратом фокуса, scroll и safe area. Передавать callbacks/port из client boundary.

## Минимальное подключение

В `ProductOverlay` создать порт через `useMemo` **до** conditional returns. Массив ниже — явная синтетическая связь только для существующего `MULTI_ACCOUNT_DEMO`, не backend policy. Счета не выводятся из названий или типа depositary.

```tsx
import { useMemo } from "react";
import { ReceiveFlow, createDemoReceiveDataPort } from "./receive";

const receivePort = useMemo(() => createDemoReceiveDataPort(view.snapshot, [
  {
    destinationAccountId: "demo-depositary",
    sourceAccountId: "demo-custody",
    assetId: "usdc",
    networkId: "ethereum",
  },
]), [view.snapshot]);
```

Заменить только ветку detail, когда `sheet.route?.action === "receive"`, внутри уже существующего `ProductSheet`:

```tsx
<ReceiveFlow
  route={sheet.route}
  dataPort={receivePort}
  privacy={view.balanceHidden}
  onBack={() => commands.openIntent("receive")}
  onClose={commands.closeSheet}
  showCloseButton={false}
/>
```

`openIntent("receive")` уже существует и очищает только выбранный detail, сохраняя account context. Для восстановления фокуса chooser host может использовать переданный в `onBack` route. Новый URL, приложение или wrapper showcase не нужны.

При открытии `ProductAssetDetail` host оставляет `ReceiveFlow` mounted (например, `hidden` + `inert`), сохраняет route/key/dataPort и возвращает focus кнопке актива после Back. Условная замена или remount намеренно сбросят local state. Для обычного Receive `operation` в деталях не передавать: модуль не придумывает ожидающий входящий платёж. Общий header/overlay по-прежнему принадлежит host.

Для восстановления суммы после полного remount ORACLE хранит raw draft в session memory по `accountId/assetId/networkId/receiveMode` и передаёт `initialRequestAmount={savedAmount}` / `onRequestAmountChange={rememberRawAmount}`. В самом flow draft находится выше privacy-key; hidden/show и privacy не теряют ввод. InternalReceive не использует новые props. Storage/URL/backend для draft не нужны.

External Receive теперь имеет один preview и отдельные действия: «Скопировать реквизиты» копирует только raw non-payable reference, «Скопировать запрос» и «Поделиться запросом» используют **один** `buildReceiveRequestText`. В исходящем тексте всегда `ДЕМОНСТРАЦИЯ — НЕ ДЛЯ ОПЛАТЫ`, валюта, сеть, необязательная желаемая сумма и reference. В UI этот же запрос показан компактно, без дублирующего многострочного текста.

`normalizeReceiveRequestAmount` и `buildReceiveRequestText` экспортируются из index. Нормализация только строковая: comma/dot → decimal string, trim/leading zeros/trailing fractional zeros, без float, округления, token precision, баланса или quote. Blank разрешён; zero/sign/exponent/invalid и raw длиннее 128 символов отклоняются. 128 — размер UI-поля, не финансовый лимит. Invalid input сохраняется для исправления и блокирует request actions, но не отдельное копирование реквизитов. QR по-прежнему получает только demo reference, без суммы или request payload.

## Данные и границы

`ReceiveRequest` содержит `accountId`, `assetId`, `networkId`, `receiveMode`. Port разрешает `ready`, `unavailable` с типизированной причиной или `error` с `retryable`; незавершённый Promise даёт `loading`. Reject превращается в восстанавливаемую ошибку. AbortSignal отменяется при смене маршрута/порта, retry и unmount; даже игнорирующий abort порт не может перезаписать новый маршрут поздним ответом.

`ready.data` имеет отдельные формы:

- `ExternalReceiveDestination`: выбранная тройка account/asset/network, `mode: "external-address"`, `safety: "demo-non-payable"`, `reference: DEMO-NON-PAYABLE:...`. Префикс проверяется и runtime. Любое несовпадение target/mode скрывает данные. Это намеренно не адрес/платёжный URI. Реальные адреса потребуют отдельного принятого контракта, а не снятия demo-метки.
- `InternalReceiveDestination`: та же тройка, `mode: "internal-transfer"`, массив `ReceiveSourceAccount`. Каждый источник явно содержит account/asset/network и `status: "available" | "inactive" | "unavailable"`. Самоперевод, дубликаты и источники другой сети/актива отклоняются. Пустой список объясняется. Внутренний сценарий не вызывает clipboard/share/QR.

Demo factory проверяет статус счёта и receive capability через core resolver. Для internal требует явных `DemoInternalReceiveBinding`; дополнительно проверяет активность и send capability источника. Само наличие send capability не создаёт внутреннего маршрута. Без bindings — `sources-not-connected`. Для другой модели snapshot передать соответствующие fixtures явно.

Без `internalTransferPort` сохранён прежний внутренний путь: источник → просмотр маршрута → `Готово`. Комиссия неизвестна, подтверждения перевода нет.

С `internalTransferPort` путь полный: источник → «Сумма пополнения» → «Рассчитать пример» → review с доступным остатком/комиссией из quote → «Подтвердить симуляцию» → pending → результат/«В истории». Единственный eligible source выбирается автоматически без draft callback. Ввод хранится в route-keyed `ReceiveRouteContent` выше приватного представления; полный remount восстанавливается через `initialInternalDraft` от host. Privacy удаляет input/radio/amount/fee/available из DOM и блокирует quote/confirm, сохраняя draft; pending остаётся read-only.

Импортируются реальные `normalizeInternalTransferAmount` и `validateInternalTransferQuote` из `../internal-transfer`, дополнительного финансового API нет. Quote проверяется по текущему request при получении и независимо перед submit. Любая правка source/amount, `Изменить`, смена route/port/данных источников требует нового quote; старые ответы защищены AbortSignal и generation/scope guard. Back/Close самого flow немедленно отменяет работу, host Close — через unmount. Скрытие для asset details не считается закрытием.

Принятый quote копируется до await; port получает другую копию, поэтому не может переписать receipt. Simulation/idempotency ID — `demo-internal:<useId>:<монотонный номер попытки>`, без random на render. Ref-lock закрывает двойной submit до rerender. Только accepted success/failure вызывает result observer один раз; callback получает собственный снимок quote/result. Success очищает draft, failure оставляет для правки. Реальных денег, балансов, батарейки и времени сети этот модуль не меняет: fee0 обозначена комиссией примера, результат прямо говорит «Средства между счетами не перемещены».

Подключение новых props к уже выбранному внутреннему route:

```tsx
<ReceiveFlow {...existingProps}
  internalTransferPort={ports.internalTransfer}
  initialInternalDraft={savedInternalDraft}
  onInternalDraftChange={rememberInternalDraft}
  onInternalSimulationResult={recordInternalSimulation}
  onViewInternalHistory={openInternalHistory}
/>
```

Host хранит raw draft по destination/asset/network/mode и одну запись результата с двумя участниками. Он не восстанавливает quote, pending или result из session memory. Quote/submit порты должны быть стабильными; смена экземпляра инвалидирует авторизацию, сохраняя raw ввод.

Clipboard success появляется только после resolved `navigator.clipboard.writeText`. Отказ оставляет строку для ручного копирования. Share отсутствует или отклонён — copy/back продолжают работать; `AbortError` означает отмену. Повторный click во время browser operation блокируется. Privacy/unmount убирают поздний feedback; уже вызванный системный clipboard/share отменить невозможно.

`renderQr` получает `{ value: reference, testOnly: true, accountId, assetId, networkId }`. Реальный renderer обязан кодировать **ровно** `value`, без другого payload/production URI, сохранять quiet zone/контраст и использовать явно демонстрационный код. Он не вызывается при privacy. Default implementation QR не рисует и новую библиотеку не добавляет.

## Представление и проверка

CSS Module наследует MONO text/surface/rule/font/radius/easing variables. Один короткий переход 220 ms, без overshoot; reduced motion и MONO static выключают переходы, touch-кнопки минимум 44×44, источники имеют полную clickable label высотой 56 px. Реквизиты стоят первыми; без renderer QR обозначен компактной строкой, без пустой QR-плашки. Новых WebGL/RAF/timer/runtime нет; семь presets и общий material host не изменены.

Focused suite: `pnpm --filter @wallet/miniapp exec vitest run src/mono-product/receive/receive-flow.test.tsx`. Покрывает 20 сценариев routing, stale response, unavailable/inactive, clipboard/share success/rejection/cancel, privacy, internal source/back/close и demo bindings. Проведены локальный lint, изолированная проверка типов модуля/теста и один self-read. Общий build и browser smoke после подключения — у оркестратора/ORACLE. Визуальное одобрение ещё не получено.

Для optional internal transfer отдельно: `pnpm --filter @wallet/miniapp exec vitest run src/mono-product/receive/receive-internal-transfer.test.tsx` — 14 focused cases, включая независимую проверку expiry, snapshot mutation, stale/close/abort, duplicate submit, privacy и draft. В этой волне external suite/build/typecheck не повторялись.

Перед backend остаются продуктовые вопросы: точные разрешённые внутренние пары счетов; получение и срок действия внешних реквизитов (включая memo/tag, если нужны); источник комиссии и этап авторизации/подтверждения. Они не блокируют текущий demo.
