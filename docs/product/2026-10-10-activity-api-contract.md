# Чтение операций: предлагаемый контракт для MONO

10 октября 2026. **PROPOSAL / READ ONLY.** Документ для разработчика backend заказчицы: что требуется для списка операций и достоверного pending-входа. Endpoint names, DTO, revisions и transport ниже — предложение для согласования, не существующий API заказчицы и не подключённый backend. Source-наблюдения относятся к базе `dcc06a13f9fc2f92750ffbae4d9cfdf8f3838246`; параллельные presentation/Send изменения не объявляются частью этого контракта.

Область — чтение кошелька/счёта и точной операции. Нет submit/signing, изменения balances/capabilities, новых KYC/custody/battery правил, API клиента, runtime зависимости или auth реализации. Подключение реальных данных потребует отдельного решения о data adapter и честном live/read-only UI.

## 1. Что существует в коде

| Поверхность | Проверенный текущий контракт |
|---|---|
| [MonoProductAdapter](../../apps/miniapp/src/mono-product/demo-adapter.ts) | `kind: "demo"`; snapshot, optional activities, activityStatus: ready/loading/error и retryActivities callback. Это не production API adapter. |
| [ProductActivity](../../apps/miniapp/src/mono-product/demo-activity.ts) | UI-local type, не core DTO: id/accountId/accountLabel, incoming/outgoing/exchange, pending/completed/failed, quantity:string, assetSymbol/networkLabel/occurredAt. assetId/networkId optional для legacy примеров. |
| Origin/mode | Только example/simulation; undefined означает example. В labels internal и commerce явно demo. Live discriminator нет: нельзя выдать HTTP данные за live через undefined, cast или simulation. |
| [Controller](../../apps/miniapp/src/mono-product/product-controller.ts) | Соединяет session-only simulations и adapter.activities. Missing activities→[], missing activityStatus→ready — demo convention, не доказательство полной истории API. Дедупликации произвольных API страниц этот concat не предоставляет. |
| [Scope](../../apps/miniapp/src/mono-product/product-activity-scope.ts) | Internal source/destination сохраняют один event ID; direction/account меняются относительно scope. Commerce scope использует обе crypto legs Swap и crypto credit Buy; fiat funding не притворяется crypto placement. |
| [Pending](../../apps/miniapp/src/mono-product/pending-activity.ts) | Фильтрует supplied pending, считает уникальные IDs; неизвестные identity/status дают unavailable. Duplicate exact ID не разрешает single reveal. Completeness/cursor/freshness metadata отсутствует. |
| [History](../../apps/miniapp/src/mono-product/product-history.tsx) / recent | History уже имеет filters/exact receipt/loading/error/retry, но не серверную пагинацию. Recent выбирает newest по occurredAt независимо от status; updatedAt не является датой «последней операции». |
| [Money presentation](../../apps/miniapp/src/mono-product/history-presentation.ts) | Quantity — строка; [formatQuantity](../../apps/miniapp/src/mono-product/product-format.ts) локализует точку, не валидирует DTO. Snapshot fiatMinor — safe integer USD-оценка, не универсальная сумма операции. Privacy маскирует денежный и assistive текст. |
| [Receipt/commerce](../../apps/miniapp/src/mono-product/operation-receipt.ts) | Optional receipt поддерживает supplied debit/fee/funding. Buy/Swap требуют [CommerceSimulation](../../apps/miniapp/src/mono-product/commerce/types.ts) с demo accepted quote/result; это не read DTO реальной покупки/обмена. |

## 2. Рекомендуемый минимальный путь — полный pending snapshot и страницы истории

Для первого read-only подключения рекомендуем **полный wallet-wide pending feed**, отдельно от chronological cursor history. Он даёт доказуемый count/точные IDs для N1. Account-view — проекция того же события по доступным участникам/legs, а не другой event ID. Закрепления и рабочий счёт не сужают домашний pending scope.

Все пути примерные; их наличие/формат должен подтвердить backend:

| Предлагаемое чтение | Ответ и смысл |
|---|---|
| GET /wallets/{walletId}/activities/pending | Полный набор доступных pending с coverage.pending=complete, wallet scope, snapshotRevision, asOf. Нельзя обрезать top-N или молча применить page limit. |
| GET /wallets/{walletId}/activities?accountId={optional}&cursor={optional}&limit={negotiated} | Chronological page; scope явно wallet/all либо конкретный account. items, nextCursor, snapshotRevision/asOf, historyComplete. Cursor непрозрачный и связан с wallet/scope/filter/sort/revision. |
| GET /wallets/{walletId}/activities/{eventId} | Актуальная разрешённая запись и её revision либо явная недоступность. Нужна при single click/status race и ID вне загруженной history page. |

Auth mechanism, API version/host, лимиты и транспортное обновление не выбираются здесь. Server проверяет права на wallet/account/event при каждом чтении; клиентское наличие ID не является разрешением.

**Страница истории не доказывает отсутствие pending.** historyComplete=false при nextCursor означает только partial history. complete pending snapshot заменяется целиком; следующая пустая полная выборка подтверждает отсутствие pending лишь в своём scope/asOf. Временно исчезнувшая из pending запись не считается completed: status берётся из detail/обновлённой истории.

Pending coverage и успешный mapping — разные условия. Invalid/unsupported record, конфликт duplicate ID, неизвестная account/asset/network identity или неполученная часть feed не должны молча уменьшить count до нуля. До решения — состояние неполноты/ошибки, без ложного «нет операций». Если feed слишком велик, backend обязан явно отказать полноте; альтернатива ниже согласуется отдельно.

История и pending могут пересекаться: объединять по устойчивому event ID и наиболее новой event revision, не создавать второй row. Только pending snapshot является источником *полноты* pending; history page добавляет записи/подтверждённые updates, но не удаляет остальные pending по отсутствию в странице.

Для общего consistent refresh нужны согласованные snapshot/revision semantics между ресурсами. При конфликте или истёкшем cursor snapshot повторить bootstrap, не склеивать несовместимые страницы. Новое authoritative detail/status может потребовать pending refresh. Freshness относится к supplied asOf/revision, не к произвольному клиентскому времени.

**Альтернатива, не одновременно второй обязательный API:** authoritative complete pending count + точный единственный ID при count1 + scoped pending cursor list/detail. Она уменьшает полный feed, но потребует нового summary/resource контракта: нынешний N1 выводит count из activities. Без отдельной адаптации count-only нельзя подставить как activities=[].

## 3. Предлагаемый DTO и инварианты

| Поле | Предлагаемое значение / правило |
|---|---|
| Envelope walletId/scope | Должны совпадать с запросом и разрешённой session. all/account scope явный; фильтр счёта учитывает оба internal participants и обе релевантные commerce legs. |
| snapshotRevision/asOf/coverage | Revision token и UTC instant состояния; pending complete/partial/unknown явно. asOf не обещает мгновенную доставку будущих updates. |
| event id/revision | Stable backend event ID в согласованном namespace. Revision — предложенная монотонная integer-string версия события; сравнение точное, не lexicographic/Number rounding. Backend должен подтвердить такую гарантию либо согласовать snapshot-only reconciliation. |
| kind/status | External transfer, internal transfer, buy, swap различимы. Минимальные UI statuses pending/completed/failed — только после подтверждённого semantic mapping backend statuses. Unknown не превращается в pending/failed/completed или ready0. |
| occurredAt/updatedAt | Валидные ISO instants с Z/явным offset, нормализуемые в UTC. occurredAt — согласованное событие для chronology; updatedAt — изменение версии. Не заменять старый occurredAt текущим временем при смене статуса. Stable tie order задаёт backend. |
| legs[] | Role debit/credit, stable accountId (для owned placement), crypto assetId+networkId либо explicit fiat currency, amount:string, supplied precision и basis. Labels берутся из разрешённого registry, не заменяют IDs. |
| amount/basis | Неотрицательный plain decimal, без экспоненты, знака, разделителей/пробелов; направление задаётся role. principal / total-debit / net-credit различимы. Не вычислять недостающий debit/credit из fees/rate. |
| unit/precision | Crypto identity включает сеть; fiat unit явно отдельный. Scale не превышает supplied precision; supported limits согласуются. Избыток точности отклонять, не округлять молча; Big decimal не проходить через float. |
| fees | null — неизвестно; [] — backend явно подтвердил отсутствие fees; known amount0 — отдельное значение. Каждая fee имеет свою unit. Fiat USD-оценка не подменяет crypto amount/fiat payment. |
| Read identity | UI key стабилен по source/wallet/event, без scope/status в key; одна операция не раздваивается на all/source/destination. Simulation IDs остаются отдельным namespace. |

Это DTO операций, **не ledger баланса и не command quote**. Read completed/failed не вызывает списание, battery update, eligibility или разрешение нового Send. Buy: отдельные fiat debit и crypto credit; Swap: две asset/network legs и собственные количества. Дебет с включённой fee и net credit приходят явно. USD valuation не создаёт fiat account; T-префикс не доказывает соответствие базовой монете.

## 4. Mapping и состояния клиента

| Вход | Projection / обязательная граница |
|---|---|
| Обычный transfer | account/asset/network по явному ID registry; role→incoming/outgoing, amount→quantity, approved status→status, occurredAt→occurredAt. Не выбирать аккаунт/сеть по label/symbol. |
| Internal | Один id + source/destination; account-view source=outgoing, destination=incoming. Scope с обоими участниками даёт один event, не две операции. Текущая internalTransfer форма подходит только после корректного mapping и origin решения. |
| Buy/Swap read legs | Сохранить все units/legs и read status отдельно. В текущий commerce:CommerceSimulation напрямую **не маппить**: потребовались бы выдуманные demo quote/terms/port/idempotency/result. Нужен будущий read-only commerce projection/UI type, отдельный от command simulation. |
| ID вне snapshot/registry | Не подставлять первый счёт/другую сеть. Запросить согласованные historical refs/архивный label или признать mapping неполным. Исторический доступ не определяется текущим active/available или transfer capability. |
| Неизвестная status/kind/дробность | Validation/mapping error или согласованное read-only unknown UI в будущем; нынешние unions такой новый режим не предоставляют. Не скрывать unsupported pending, объявляя complete0. |
| Fee/receipt | feeLabel только presentation, не финансовая авторизация. Current SendQuoteReceipt имеет ограниченные units/funding; отсутствие fee не0, неизвестный funding не battery. Новые стадии/ETA здесь не вводятся. |

Будущий API decoder/resource слой проверяет envelope, IDs, enum, money/time и duplicates **до** UI; TypeScript type/cast не валидирует HTTP. Backend-read origin нельзя обозначить example/simulation ради совместимости. Расширение adapter/UI mode и read-only commerce — отдельные prerequisites, не изменения этого документа.

| Состояние предлагаемого resource | Отображение / обновление |
|---|---|
| Первый запрос | Loading, не готовая пустая история; нынешний activityStatus=loading даёт нейтральный state. |
| Complete pending + valid mapping | Pending count достоверен на supplied asOf/scope. History page всё ещё partial, пока не подтверждён конец. |
| Partial/missing coverage или unsupported item | Не ready0. Отдельная partial/stale semantics требует UI решения; нынешние ready/loading/error и отсутствие cursor не решают её автоматически. |
| Ошибка / retryable | Error; retry только если разрешён/предоставлен. Успешный старый массив не объявлять новым подтверждением. Server retry hints — не operation ETA. |
| Status changed | Та же identity, новая согласованная revision. Click получает текущий terminal receipt, не изображает прежний pending; поздняя старая page не возвращает его в pending. Correction/reorg semantics отдельно подтвердить. |
| Exact ID исчез/доступ запрещён | Недоступность в исходном scope; никакого чужого ID/fake failed. Missing/forbidden/removed различаются только если backend вправе это раскрыть. |
| Logout / другой wallet/provider/session | Abort старых запросов, очистка/изоляция cache; поздний ответ отбрасывается по local request-generation и captured session/scope, даже если abort не остановил ответ. |

Cache keys включают trusted identity/session discriminator, provider, wallet, scope, filters/revision/cursor; токены и деньги не пишутся в URL/log/localStorage/presets. Account browse/read scope не меняет рабочий operation context, drafts или accepted-submit lease. Новые polling/SSE/WebSocket, stale TTL и reconnect политика требуют backend ответа; один pending status не обосновывает таймер.

Для нынешнего controller учесть identity adapter/snapshot/flow-port session guards. Нельзя при каждом poll незаметно пересоздавать весь command adapter либо менять object «на месте» в обход readonly/React: согласовать отдельный read-resource lifecycle. Read updates не должны сбрасывать активный draft или присваивать session simulation другому пользователю.

**До подключения:** отдельно решить live/read-only origin, runtime decoder/resource, complete pending source и pagination/partial UI. Current activityStatus=ready означает готовность переданного массива, не его серверную полноту; history имеет no-results UI без pagination notice. Нельзя выдавать неполную историю за полную. Этот документ N1 runtime не меняет.

## 5. Синтетические примеры

Все IDs, labels, суммы и даты учебные. Для примеров допускается synthetic registry: account-synthetic-A/B, labels «Учебный счёт A/B»; supplied assets usdc/eth и network ethereum с указанной precision. Это не записи заказчицы, не настоящий snapshot и не подтверждение прав. ProductActivity outputs ниже применимы **только как example fixtures**; использовать их для live данных без origin/UI решения нельзя.

### External receive → существующая example projection

Предложенный DTO:

```json
{
  "id": "event-synthetic-001",
  "revision": "7",
  "kind": "external-transfer",
  "status": "pending",
  "occurredAt": "2026-10-10T06:00:00.000Z",
  "updatedAt": "2026-10-10T06:00:10.000Z",
  "legs": [
    {
      "role": "credit",
      "accountId": "account-synthetic-A",
      "unit": {
        "kind": "crypto",
        "assetId": "usdc",
        "networkId": "ethereum",
        "precision": 6
      },
      "amount": "12.345",
      "basis": "principal"
    }
  ],
  "fees": null
}
```

Структурно допустимая учебная ProductActivity projection:

```json
{
  "id": "read-example:wallet-synthetic-01:event-synthetic-001",
  "mode": "example",
  "accountId": "account-synthetic-A",
  "accountLabel": "Учебный счёт A",
  "direction": "incoming",
  "status": "pending",
  "assetId": "usdc",
  "assetSymbol": "USDC",
  "quantity": "12.345",
  "networkId": "ethereum",
  "networkLabel": "Ethereum",
  "occurredAt": "2026-10-10T06:00:00.000Z"
}
```

updatedAt/revision/coverage остаются в будущем read resource; current ProductActivity их не хранит. Один UI id не меняется при обновлении status; amount строка сохраняет точность.

### Internal: обе стороны, одна identity

Предложенный DTO:

```json
{
  "id": "event-synthetic-002",
  "revision": "2",
  "kind": "internal-transfer",
  "status": "completed",
  "occurredAt": "2026-10-10T06:01:00.000Z",
  "updatedAt": "2026-10-10T06:02:00.000Z",
  "legs": [
    {
      "role": "debit",
      "accountId": "account-synthetic-A",
      "unit": {
        "kind": "crypto",
        "assetId": "usdc",
        "networkId": "ethereum",
        "precision": 6
      },
      "amount": "5.00",
      "basis": "principal"
    },
    {
      "role": "credit",
      "accountId": "account-synthetic-B",
      "unit": {
        "kind": "crypto",
        "assetId": "usdc",
        "networkId": "ethereum",
        "precision": 6
      },
      "amount": "5.00",
      "basis": "principal"
    }
  ],
  "fees": null
}
```

Учебная canonical projection для source:

```json
{
  "id": "read-example:wallet-synthetic-01:event-synthetic-002",
  "mode": "example",
  "accountId": "account-synthetic-A",
  "accountLabel": "Учебный счёт A",
  "internalTransfer": {
    "sourceAccountId": "account-synthetic-A",
    "sourceAccountLabel": "Учебный счёт A",
    "destinationAccountId": "account-synthetic-B",
    "destinationAccountLabel": "Учебный счёт B"
  },
  "direction": "outgoing",
  "status": "completed",
  "assetId": "usdc",
  "assetSymbol": "USDC",
  "quantity": "5.00",
  "networkId": "ethereum",
  "networkLabel": "Ethereum",
  "occurredAt": "2026-10-10T06:01:00.000Z"
}
```

Для scope destination [scopeProductActivities](../../apps/miniapp/src/mono-product/product-activity-scope.ts) возвращает тот же id с account-synthetic-B / incoming. Для all или scope обоих участников — один row с canonical исходной ориентацией; не суммировать обе суммы как два новых события.

### Swap read legs: сохраняем смысл, не фабрикуем simulation

```json
{
  "id": "event-synthetic-003",
  "revision": "4",
  "kind": "swap",
  "status": "completed",
  "occurredAt": "2026-10-10T06:03:00.000Z",
  "updatedAt": "2026-10-10T06:04:00.000Z",
  "legs": [
    {
      "role": "debit",
      "accountId": "account-synthetic-A",
      "unit": {
        "kind": "crypto",
        "assetId": "usdc",
        "networkId": "ethereum",
        "precision": 6
      },
      "amount": "101",
      "basis": "total-debit"
    },
    {
      "role": "credit",
      "accountId": "account-synthetic-B",
      "unit": {
        "kind": "crypto",
        "assetId": "eth",
        "networkId": "ethereum",
        "precision": 18
      },
      "amount": "0.04",
      "basis": "net-credit"
    }
  ],
  "fees": [
    {
      "unit": {
        "kind": "crypto",
        "assetId": "usdc",
        "networkId": "ethereum",
        "precision": 6
      },
      "amount": "1"
    }
  ]
}
```

Одна операция, total debit101USDC / net credit0.04ETH / отдельная fee1USDC — исключительно supplied учебные значения. Current commerce projection требует demo accepted quote/result; поэтому этот DTO остаётся в proposed read model до отдельного read-only commerce/UI решения. Для Buy analogous fiat debit имеет unit.kind=fiat/currency/precision без выдуманного crypto network или fiat account; crypto credit сохраняет account/asset/network. Нельзя свернуть пару в одно quantity или генерировать quote/rate/idempotency из прочитанной записи.

## 6. Ответы, необходимые от backend

1. Каковы реальные endpoint/schema версии, trusted identity/auth/access policy и wallet scope? Кто предоставляет canonical account/asset/network registry, включая исторические/недоступные IDs? Здесь auth не проектируется.
2. Event ID глобален или wallet/provider scoped; сохраняется ли при смене статуса/миграции и чтении обоих участников? Есть ли гарантия event revision и как разрешаются correction/reorg?
3. Можно ли получить полный pending snapshot со scope/asOf/coverage без скрытого лимита? Как согласовать его revision с pages/detail; что делать при overflow/cursor expiry?
4. Какие реальные статусы и kinds, их terminal/pending семантика, причины отказа и redaction доступны пользователю? Unknown mapping не утверждён.
5. Каковы amount basis, scale/limits, crypto network identity, fiat units и fee completeness? Какие labels/исторические metadata можно раскрывать? Не выводить новые финансовые правила из UI.
6. Что именно означает occurredAt; как приходят updatedAt/asOf, ordering, freshness и изменения? Polling/stream/reconnect/TTL — supplied решение, не браузерная догадка.
7. Как выражены loading/error/retry/not-found/forbidden/removed/offline и неполнота? Пустая страница/array при отсутствующем status не доказательство отсутствия live pending.
8. Как отделить server operations от session simulations и обеспечить lifecycle read updates рядом с активными command flows? Новые команды/submit backend вне read-only контракта.

## 7. Критерии будущей интеграции

- Поверхностно пустая/последняя history page при старом pending не даёт ready0; полный pending feed включает его независимо от chronology/selected account/pins.
- Один ID одинаков в all/source/destination, duplicates/повторные pages не множат события; conflicting revisions/unknown IDs не скрываются. Mixed units/precision проходят без float/округления/fee double count.
- Internal и commerce scope учитывают правильные участники/legs. Старый read event не меняет balances/capabilities/новые переводы; fiat valuation не становится funding.
- Live labels/adapter mode согласованы явно; никакой fake demo quote или API→simulation cast. Incomplete history показана честно с согласованной pagination/partial semantics.
- Refresh/status race, expired cursor, исчезнувший/запрещённый ID и unknown status дают согласованный state. Exact click не выбирает чужую запись; Back/focus/рабочий scope сохранены.
- Ответ прошлой identity/wallet/session не попадает в текущий UI; cache/log/preset не раскрывает суммы/токены. Privacy включает обе commerce legs/fees и aria.
- Loading/error/retry/freshness не изображаются подтверждённым нулём или успехом. SLA, stage, ETA, KYC/custody/battery не придумываются.
- Примеры/schema/mapping согласованы с backend и проверены на separate read-only adapter до подключения; этот документ не является реализацией или выполнением этих проверок.

Связанный текущий план: [pending/Send wave](./2026-10-10-pending-send-wave.md). Controller/flows/presets/GitHub/публичный runtime этой подготовкой не меняются.
