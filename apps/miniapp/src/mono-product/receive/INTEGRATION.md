# ReceiveFlow — интеграция #45

Независимый detail-компонент для уже выбранного `ProductActionRoute`. Общая сцена и chooser не изменены; модуль пока не включён в `/mono`. До backend все реквизиты и внутренние связи демонстрационные.

## Exports и props

Публичный вход — `./receive/index.ts`: `ReceiveFlow`, `createDemoReceiveDataPort` и все типы из `receive-types.ts`.

| Prop | Контракт |
| --- | --- |
| `route: ProductActionRoute` | Уже выбранные account/asset/network/action. Другие actions закрыты без вызова порта. |
| `dataPort: ReceiveDataPort` | Стабильный read-only объект с `load(request, { signal })`. Новый объект означает новую загрузку. Мемоизировать по неизменяемому snapshot. |
| `privacy: boolean` | `true` удаляет внешние реквизиты и QR из DOM, блокирует copy/share. Названия счёта, актива и сети остаются для ориентации. Денежных значений модуль не выводит. |
| `onBack(route)` | Возврат к существующему chooser; передаёт исходный route без изменения контекста. Host сохраняет account context и возвращает фокус выбранной строке chooser. |
| `onClose()` | Закрытие. Вызывается кнопкой закрытия и `Готово` в просмотре внутреннего маршрута. Не означает операцию. |
| `onAssetDetails?()` | Делает строку актива/сети кнопкой деталей. Callback не меняет route, load или локальный выбор. Без callback прежние статические строки сохраняются. |
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

## Данные и границы

`ReceiveRequest` содержит `accountId`, `assetId`, `networkId`, `receiveMode`. Port разрешает `ready`, `unavailable` с типизированной причиной или `error` с `retryable`; незавершённый Promise даёт `loading`. Reject превращается в восстанавливаемую ошибку. AbortSignal отменяется при смене маршрута/порта, retry и unmount; даже игнорирующий abort порт не может перезаписать новый маршрут поздним ответом.

`ready.data` имеет отдельные формы:

- `ExternalReceiveDestination`: выбранная тройка account/asset/network, `mode: "external-address"`, `safety: "demo-non-payable"`, `reference: DEMO-NON-PAYABLE:...`. Префикс проверяется и runtime. Любое несовпадение target/mode скрывает данные. Это намеренно не адрес/платёжный URI. Реальные адреса потребуют отдельного принятого контракта, а не снятия demo-метки.
- `InternalReceiveDestination`: та же тройка, `mode: "internal-transfer"`, массив `ReceiveSourceAccount`. Каждый источник явно содержит account/asset/network и `status: "available" | "inactive" | "unavailable"`. Самоперевод, дубликаты и источники другой сети/актива отклоняются. Пустой список объясняется. Внутренний сценарий не вызывает clipboard/share/QR.

Demo factory проверяет статус счёта и receive capability через core resolver. Для internal требует явных `DemoInternalReceiveBinding`; дополнительно проверяет активность и send capability источника. Само наличие send capability не создаёт внутреннего маршрута. Без bindings — `sources-not-connected`. Для другой модели snapshot передать соответствующие fixtures явно.

Внутренний путь: источник → просмотр маршрута → `Готово`. Возврат к источникам сохраняет выбор и восстанавливает фокус. Возврат в общий chooser сбрасывает локальный выбор источника; account/asset/network остаются в callback и контексте host. Комиссия неизвестна; сумма, авторизация и команда перевода отсутствуют. Нулевая комиссия, лицензия и подтверждённая транзакция не обещаются.

Clipboard success появляется только после resolved `navigator.clipboard.writeText`. Отказ оставляет строку для ручного копирования. Share отсутствует или отклонён — copy/back продолжают работать; `AbortError` означает отмену. Повторный click во время browser operation блокируется. Privacy/unmount убирают поздний feedback; уже вызванный системный clipboard/share отменить невозможно.

`renderQr` получает `{ value: reference, testOnly: true, accountId, assetId, networkId }`. Реальный renderer обязан кодировать **ровно** `value`, без другого payload/production URI, сохранять quiet zone/контраст и использовать явно демонстрационный код. Он не вызывается при privacy. Default implementation QR не рисует и новую библиотеку не добавляет.

## Представление и проверка

CSS Module наследует MONO text/surface/rule/font/radius/easing variables. Один короткий переход 220 ms, без overshoot; reduced motion выключает переходы, touch-кнопки минимум 44×44, источники имеют полную clickable label высотой 64 px. Новых WebGL/RAF/timer/runtime нет; семь presets и общий material host не изменены.

Focused suite: `pnpm --filter @wallet/miniapp exec vitest run src/mono-product/receive/receive-flow.test.tsx`. Покрывает 20 сценариев routing, stale response, unavailable/inactive, clipboard/share success/rejection/cancel, privacy, internal source/back/close и demo bindings. Проведены локальный lint, изолированная проверка типов модуля/теста и один self-read. Общий build и browser smoke после подключения — у оркестратора/ORACLE. Визуальное одобрение ещё не получено.

Перед backend остаются продуктовые вопросы: точные разрешённые внутренние пары счетов; получение и срок действия внешних реквизитов (включая memo/tag, если нужны); источник комиссии и этап авторизации/подтверждения. Они не блокируют текущий demo.
