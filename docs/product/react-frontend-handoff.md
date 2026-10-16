# React frontend handoff — MONO и Gold

Актуализировано 17.10.2026 по combined Gold + profile source `5a1b14a8ffe79089b401c1d124b03d7343a9ee47`, опубликованному 13.10.2026. Точный runtime/build и scoped QA: [выпуск профиля](../releases/2026-10-13-profile-client-public.md). Tracked snapshot `81a9d1b` сохраняет эту runtime-базу. Синхронизация GitHub по [#43](https://github.com/i4w7w4a/Wallet_4i7/issues/43) переносит исходники новым commit: это совпадение source blobs, а не тот же Git SHA или повторный deploy. [Карта состояний](./product-state-map.md) · [единый вход](../../README.md). Записи 5 октября описывают унаследованный этап, не текущий Gold.

## Вход и разделение данных

Точка сборки — [MonoProductScene](../../apps/miniapp/src/mono-preview/mono-product-scene.tsx).

| Вход | Назначение и владелец |
| --- | --- |
| snapshot: WalletSnapshot | Raw supplied presentation snapshot: профиль, legacy chart, уведомления, начальное privacy. WalletProfile.shortAddress — demo ID, не платёжные реквизиты. Исходный профиль передаётся в host-owned useProfileDemoSession; resolved presentation используется в header/Profile. |
| productAdapter: MonoProductAdapter | Product snapshot счетов/размещений/capabilities, история и её status/retry, явные проценты battery. По умолчанию MONO_PRODUCT_DEMO_ADAPTER; kind сейчас только demo. |
| appearance, material | Оформление и общий optical host. Они не предоставляют права на операции и не хранят пользовательские финансовые данные. |
| session | Host-owned privacy, период графика, опционально раздел и callbacks. Отдельный ProfileDemoSession живёт выше условного Profile и хранит только demo contacts/risk answers в памяти. При отсутствии controls используются предусмотренные локальные состояния. |

[ProductSnapshot и selectors](../../packages/core/src/wallet-product.ts) задают accounts, holdings, batteryPools. Quantities — decimal strings, USD-оценка — fiatMinor. Quantity, availableQuantity и USD имеют разный смысл: оценка не разрешает списание, неизвестный доступный остаток не равен нулю.

Идентичность маршрута: **action + accountId + assetId + networkId**, для Receive ещё receiveMode. All агрегирует обзор; операция получает конкретный account. Core resolveActionRoutes проверяет status/capabilities, а commands.selectRoute повторно сверяет маршрут с текущим intent. Kind счёта сам по себе не даёт permissions.

~~~tsx
<MonoProductScene snapshot={walletSnapshot} productAdapter={productAdapter}
  appearance={appearance} material={material} session={session} />
~~~

У adapter пока нет общего resource wrapper для асинхронного account snapshot. Loading/error/auth до появления валидного snapshot принадлежат внешнему host. Отдельные состояния истории, Receive, Send и профиля описаны в карте.

## Состояние и навигация

[useMonoProductController](../../apps/miniapp/src/mono-product/product-controller.ts) владеет context, overlay/intent, workspace актива, accountsWorkspace, открытой записью истории, raw drafts и журналом симуляций. Смена оформления должна сохранять controller и активную форму mounted.

| Состояние | Ключ и срок жизни |
| --- | --- |
| Send draft | sendDraftKey: account/asset/network → recipient, memo, raw amount. Session memory. |
| External Receive amount | receiveRequestAmountKey: account/asset/network/mode → raw amount. |
| Internal Receive draft | destination/asset/network/mode → sourceAccountId + raw amount; источник проверяется отдельно. |
| Buy draft | buyDrafts: commerceRouteKey по полному buy route → methodId + fiatAmount. Session memory; saveBuyDraft. |
| Swap draft | swapDrafts: commerceRouteKey по полному swap route → pairId + sourceAmount. Session memory; saveSwapDraft. |
| Quote, validation, pending, result | Flow session, не raw draft. До submit route/amount/port change инвалидирует quote. Accepted quote/key/operation ID принадлежит lease; expiry после принятия не запускает новую попытку. |
| История симуляций | Controller revalidates terminal и deduplicates operation IDs. Один ProductActivity.commerce хранит canonical buy/swap и обе legs; успех очищает только соответствующий draft. Fiat debit/crypto credit и fee-inclusive Swap debit/net credit не смешиваются. Балансы/battery не меняются. |
| Тема и privacy | Menu показывает disabled «Тема — Пока недоступно». Callback/storage write не выполняется. MONO effective appearance, совместимые props и Lab/editor owner сохранены; standalone viewer использует `wallet4i7.mono.viewer-theme.v1` отдельно от presets. Gold использует fixed presentation без viewer theme preference. Privacy принадлежит session/controller, меняется существующим глазиком. |

[ProductOverlay / RouteDetail](../../apps/miniapp/src/mono-product/product-sheet.tsx) оставляет форму mounted под hidden/inert во время asset detail. Это сохраняет recipient/amount. Main Send/Receive сначала открывают compact menu, затем форму; Back восстанавливает точный route focus. Вход из placement сохраняет прямой путь и возврат к его launcher.

Пять demo ports создаёт controller через `useMemo(() => createMonoDemoFlowPorts(snapshot), [adapter, snapshot])` и передаёт как `view.flowPorts` в ProductSheet. Ordinary render, appearance/privacy и pending не создают новый factory. Замена adapter, даже с тем же snapshot, или snapshot identity — граница новой port session; не создавайте factory внутри overlay/render.

Для Buy/Swap controller держит lease активного маршрута и ports. `setCommerceSubmitState` синхронно принимает cloned quote/key/operation ID; close/context guard действует до matching release. `recordCommerceSimulation` сверяет terminal с accepted quote, затем дедуплицирует ID и пишет историю. Старые draft/terminal/release callbacks после route removal, adapter replacement или повторного открытия той же формы отклоняются. Child key связывает полный route с issuing port; UI доставляет terminal до busy=false. При unmount/замене ports async отменяется, поздний ответ не восстанавливает quote/result. Quote и accepted pending не восстанавливаются из raw draft после reload.

## Пять демонстрационных портов

[createMonoDemoFlowPorts](../../apps/miniapp/src/mono-product/demo-adapter.ts) возвращает receive, internalTransfer, send, buy и swap. Owner фабрики — controller; ProductSheet потребляет готовые стабильные ports и подключает реальные BuyFlow/SwapFlow. Adapter.kind и финансовые ports остаются demo: подмена snapshot не подключает backend. Готового production command adapter prop в MonoProductScene нет.

| Port | Текущий контракт | Что требуется для live |
| --- | --- | --- |
| [SendPort](../../apps/miniapp/src/mono-product/send/send-port.ts) | mode='demo'; loadRoute, validateRecipient, quote, send; AbortSignal/idempotency key. Quote содержит terms, debit, fee/funding, expiry и optional ETA. | Новый согласованный контракт авторизации, результатов, ошибок и восстановления. Flow проверяет demo mode; снятие guard или cast типа не создаёт production adapter. |
| [ReceiveDataPort](../../apps/miniapp/src/mono-product/receive/receive-types.ts) | Read-only load. External: DEMO-NON-PAYABLE reference с safety='demo-non-payable'. Internal: явные sources. | Отдельная схема реальных address/URI, memo/tag, lifetime и QR. Demo reference не является адресом. |
| [InternalTransferPort](../../apps/miniapp/src/mono-product/internal-transfer/types.ts) | mode='demo'; quote/submit. Exact binding, разные active accounts, общий asset/network, known source available. | Backend определяет пары, tariff, авторизацию, серверную idempotency и конечный результат. Нынешние fee0, TTL60s и memory cache — fixtures. |
| [BuyPort](../../apps/miniapp/src/mono-product/commerce/types.ts) | mode='demo'; loadRoute/quote/submit, AbortSignal/idempotency. Отдельные fiat payment/funding и crypto destination, bound quote/expiry и accepted result. | Согласовать реальные методы/партнёров, тарифы, fiat funding, авторизацию и lifecycle. Нынешняя «Демо-оплата» не подключённый банк. |
| [SwapPort](../../apps/miniapp/src/mono-product/commerce/types.ts) | mode='demo'; loadRoute/quote/submit. Две полные crypto legs, pair allowlist, known available, total debit с fee и net credit. | Live разрешённые пары, курс/fee/precision/funding и обе стороны операции. Demo pair не разрешает bridge или reverse. |

Сейчас internal factory и controller используют явный binding custody → depositary USDC/Ethereum. При live-подключении источник permissions необходимо согласовать отдельно. Send capability не разрешает внутреннюю пару автоматически. Battery в internal demo не участвует.

Формат внешнего получателя оставлен за backend решением владельца. Поле SendRecipient.address и пример demo:recipient не утверждают выбор между внешним адресом и внутренним ID. Сетевые memo/tag и валидацию задаёт согласованный provider.

Подробные guides: [Send](../../apps/miniapp/src/mono-product/send/INTEGRATION.md), [Receive](../../apps/miniapp/src/mono-product/receive/INTEGRATION.md), [BuyFlow](../../apps/miniapp/src/mono-product/buy/index.ts), [Swap](../../apps/miniapp/src/mono-product/swap/INTEGRATION.md), [Asset detail](../../apps/miniapp/src/mono-product/asset-detail/INTEGRATION.md). Они описывают отдельные этапы; актуальный host находится в ProductSheet/controller, shared commerce exports — в [commerce/index.ts](../../apps/miniapp/src/mono-product/commerce/index.ts). Это не подтверждение готовности live API.

Buy и Swap получают общие Flow props из commerce: route, stable port, privacy, initialDraft, draft/result/busy callbacks и Back/Close/history. UI сам не пишет journal. Review явно показывает симуляцию; подтверждение — «Подтвердить симуляцию». Примеры: Buy 100 USD input → 101 USD debit → 100 USDC credit; Swap 100 USDC input → 101 USDC debit → 0.04 ETH net credit. History/recent/receipt скрывают обе legs, fee/rate и assistive amount text при privacy. Swap фильтруется по любой crypto leg в её собственных account/asset/network IDs, а All сохраняет одну запись.

В демофабрике memory bounded: до 64 issued quotes и accepted attempts на lifetime порта; принятые idempotency keys не вытесняются. После capacity новые попытки отклоняются до acceptance и требуют новой port session. Это ограничение локального демо, не live retention policy. Балансы и battery не списываются, тарифы/TTL/курс — подписанные fixtures.

## Мои счета

[ProductAccountsWorkspace / props](../../apps/miniapp/src/mono-product/accounts-workspace/index.ts) принимает current readonly snapshot, selectedAccountId, context, balanceHidden, allowedActions; callbacks onInspectAccount, onBack, onUseAccount, onOpenHolding(holdingId). `onOpenAction(route, origin?)` получает полный ProductActionRoute и optional AccountsActionOrigin, возвращает boolean|void: false показывает недоступность без ложного перехода. Optional expandedHoldingId/onExpandedHoldingChange управляют раскрытым placement и точным возвратом. useAccountUnavailableReason сохраняет disabled Use с видимой/accessibility причиной для controlled Profile/History без navigation callback; read-only Overview не требует перехода раздела.

Controller accountsWorkspace: outer null — закрыт, inner accountId:null — список, ID — detail. Inspect не меняет global context; только explicit Use/action меняет его через current pending/session guard. Commands: openAccountsWorkspace, inspectAccount, backAccountsWorkspace, closeAccountsWorkspace, useAccount, openAccountRoute(full route), openAccountHolding(accountId, holdingId). Начальный single-account список и missing ID сохраняются, другой account не выбирается молча. Host origin/focus отделены от controller; четыре nav tabs и compact quick context chooser сохранены.

AllowedActions intersect с canonical core routes по полному productRouteKey, включая action/account/asset/network/receiveMode; known unsupported entries не предлагаются. Entry — только preparation, existing Flow остаётся владельцем окончательных load/available/quote/fee/funding/submit checks. Capabilities не являются обещанием выполнения; withdraw не добавлен. Holding request resolves exact current unique account/holding IDs atomically, без selectContext→stale openAsset последовательности.

Account-origin intent сохраняет returnToAccountId. Presentation origin различает holding-action (holdingId/action/routeKey) и account-action (entry receive|other/action/routeKey). Back проверяет current parent/session/full route identity, восстанавливает account detail, нужное раскрытие и точную цель; asset child возвращает к holding. Origin не является разрешением операции. Обычный overview chooser и placement Back сохраняют свои пути. Старый network callback не закрывает новый flow; adapter replacement закрывает workspace, removed account показывает missing view и запрещает действия. Privacy маскирует quantity/available/estimate и aria, missing/malformed available остаётся неизвестным.

Pending конкретного счёта открывает scoped историю/receipt и возвращает в тот же account workspace с прежним working context и focus. Host хранит origin вместе с snapshot/ports/workspace identity; nav-away или замена источника снимает старый inspection. Не заменять этот путь глобальным переходом в History или выбором другого счёта. Это просмотр существующей операции, не новая отправка и не серверное восстановление pending.

## Принятый UX и область CSS

Compact Accounts holding trigger теперь раскрывает action/sведения, а отдельный «Подробнее» открывает asset child. [selectAccountPlacementActions / AccountsActionOrigin](../../apps/miniapp/src/mono-product/accounts-workspace/account-placement-actions.ts) распределяет уже разрешённые routes по exact account/asset/network; full productRouteKey дедуплицирует варианты и сохраняет receiveMode. Send/Receive располагаются у placement, Buy/Swap под «Ещё». Отдельный receive entry включает разрешённые маршруты без существующего holding; zero holding не означает запрет receive. Core/port validation, raw drafts и accepted pending lease прежние.

Inherited d73: logo/«На главную» ведёт в Overview, Funds имеют functional disclosure и motion indicator, top account trigger использует anchored popover; host controls/navigation/pending guards не подменяются UI. [CurrencyLogo](../../apps/miniapp/src/mono-product/currency-logo.tsx) принимает assetId/className, использует pinned local BTC/ETH/USDC SVG и нейтральный fallback для неизвестного ID. Artwork декоративное aria-hidden; название/сеть/деньги остаются DOM-текстом. Один visual primitive используется в Funds/Accounts/Asset/Send, без API запроса или новой финансовой модели. Send reading surface — визуальная правка, ports/validation не изменены.

Унаследованная правка9d70abe в [mono-viewer.css](../../apps/miniapp/src/mono-preview/mono-viewer.css) и [mono-workbench.css](../../apps/miniapp/src/mono-preview/mono-workbench.css) скрывает native bar у dedicated wallet .mono-preview-frame[data-material-scrollport] через scrollbar-width:none и scoped WebKit selector. Overflow-y:auto остаётся; editor rails/остальные app scrollports не затронуты. Evidence 5 октября относится к тому выпуску.

## Gold и график

[MonoGoldViewer](../../apps/miniapp/src/mono-preview/mono-gold-viewer.tsx) использует ту же MonoProductScene/controller и fixed dark [Gold envelope](../../apps/miniapp/src/mono-preview/mono-gold-appearance.ts). Это отдельное оформление `/gold`, не восьмой preset. Семь MONO presets, их published snapshots/history и сохранённые настройки не переписываются. Gold account deck и дымчатые поверхности меняют композицию; финансовые ports/guards остаются общими.

Единственный ambient liquid background владеет одним WebGL context/loop; живой DOM не растеризуется. Material background Gold выключен, поэтому второй ambient renderer не создаётся. Inactive/reduced/effects-off используют предусмотренные ограничения/fallback. Настройки tuner — отдельная локальная примерка, не автоматическая публикация или изменение семи presets.

«Динамика баланса» в Gold по умолчанию выключена; существующий Settings detail получает host-owned display control. Это presentation toggle, не scoped-series API. Chart пока читает legacy `snapshot.chart[period]`; product controller разрешает его только для default demo adapter (`usesDefaultDemoChart`), а Gold дополнительно требует All context. Для нового adapter график скрыт. Подключение scoped series с явной account/context scope либо сохранение hide — будущий отдельный gate; новых DTO эта кнопка не вводит.

## Профиль

Канонический путь: raw supplied `snapshot.profile` + `profileResource` → host-owned [useProfileDemoSession](../../apps/miniapp/src/mono-product/profile/use-profile-demo-session.ts) → resolved profile/resource/avatar → header и [ProductProfile](../../apps/miniapp/src/mono-product/product-profile.tsx). Menu получает current supplied resource; его settings/support/documents не заменяются локальными контактами. Hook смонтирован в MonoScene выше условного Profile. Не подавайте resolved выходы обратно как source: локально изменённое имя не является identity key. ProductProfile без supplied session имеет локальный fallback, но он не заменяет host lifetime при навигации.

Source key сравнивает stable identity/исходные значения профиля, status resource и исходные контакты, а не identity каждого нового объекта. Обычный rerender сохраняет правки. Действительная смена source сбрасывает contacts/risk answers и увеличивает generation: A→B→A создаёт новую lifetime, старый Save callback уже не действует. Reload/remount очищает demo memory. Security, support и documents остаются supplied authoritative данными.

Личные данные раскрывают контакты, «Изменить» открывает [ProfileContactEditor](../../apps/miniapp/src/mono-product/profile/contact-editor.tsx): имя, email, телефон, Telegram, дополнительный email. Все поля необязательны; проверяются форма/длина, ошибки получают focus. Save сохраняет нормализованный ввод только в demo session, обновляет единое имя и возвращает к launcher; Cancel/Back не применяет draft. Смена source инвалидирует открытый editor и его callback. Это не подтверждение контактов, регистрация или auth; storage/HTTP/upload не добавлены.

Профиль содержит «Личные данные», «Безопасность» и самостоятельный вход «Тест о рисках». [ProductRiskTest](../../apps/miniapp/src/mono-product/profile/risk-test.tsx) без полноценного supplied question set показывает ожидание материалов. Валидные supplied questions включают intro → шаги с одним ответом → review → сохранение в demo memory → возврат. Back позволяет исправить ответы; пропуск блокирует следующий шаг. Баллы, риск-категория, допуск к операции и финансовая рекомендация не формируются. В actual host вопросы пока не переданы.

Четыре [security detail](../../apps/miniapp/src/mono-product/profile/security-detail.tsx): verification, 2FA, password и address allowlist. Unknown отображается как отсутствие подключённых сведений, не как disabled/not-started. Optional `password: unknown|set|not-set` при отсутствии читается как unknown. Без supplied action открывается объясняющий detail с disabled management; секреты/документы не собираются и защита не меняется. Supplied `ProductProfileActions` могут открыть workflow потребителя; authoritative resource обновляет host после его результата. Live auth/recovery/KYC/2FA/пароль/allowlist ещё не подключены.

Resource остаётся `loading | error {retryable} | ready {data}`. Loading/error скрывают stale контакты/security; retry возможен только с retryable и onRetry. [createDemoProfileResource](../../apps/miniapp/src/mono-product/profile/model.ts) создаёт свежий ready object: null email/phone, Русский/USD, три security unknown, password не задан в fixture, documents[]. Временная поддержка — `@re_pick` / `https://t.me/re_pick`, она отделена от личного Telegram. Supplied avatar используется едино в header/Profile; в demo host есть fictional portrait fallback, при недоступном изображении — честный initial/icon. Новый identity DTO не требуется.

Avatar работает как guarded inspection: повторное нажатие возвращает в исходный раздел/Accounts/Asset, восстанавливает scroll/focus только при совпадении owner/context/snapshot/ports/workspace. При утрате origin используется безопасный Overview. Sheet, accepted pending и inactive scene не обходятся.

## Menu, настройки и документы

[ProfileQuickMenu](../../apps/miniapp/src/mono-product/profile-quick-menu/index.ts) содержит disabled «Тема», Язык, Валюту оценки, Документы сервиса, supplied «На главной»/«Мои счета», Помощь и viewer-ссылку MONO↔Gold. Privacy в Menu отсутствует; общий глазик сохранён. Язык/валюта открывают одно read-only Settings content: Русский/USD, без локализации или обмена. Theme props совместимы, но UI не вызывает callback. Первичный focus — доступная строка языка. Menu — немодальный dialog; Escape/Back восстанавливают правильный trigger/row, outside/focus-out сохраняют следующую цель; закрытое содержимое сразу unmount-ится. Host origin guards удерживают Accounts/Asset и снимают stale panel.

Help и headset-вход переиспользуют compact content. Временная поддержка открывает Telegram; почта/WhatsApp недоступны. Документы — только сервиса, отдельно от operation receipts. Для supplied разрешённых HTTPS links показываются настоящие названия/ссылки; иначе «Условия использования» и «Политика конфиденциальности» открывают detail ожидания материалов с Back/Escape/focus. Юридический текст и принятие условий не выдуманы. [isProfileLinkAllowed](../../apps/miniapp/src/mono-product/profile/model.ts) проверяет абсолютный HTTPS/authority без userinfo, backslash и raw whitespace/control; доверие к доменам и актуальность версий принадлежат host. Внешние ссылки используют `noopener noreferrer`.

MONO standalone [useViewerTheme](../../apps/miniapp/src/mono-product/profile/use-viewer-theme.ts) сохраняет существующий versioned preference отдельно от presets; supplied host session не включает visitor fallback. Gold задаёт `themePreference="fixed"` и не читает/не пишет viewer theme preference. Profile Save не вызывает Lab Apply/Save/publish. Отдельного profile control reduced-motion нет; системный режим сохраняется.

## Помощь и вход в действия

[ProductHelp](../../apps/miniapp/src/mono-product/product-help/index.ts) — controlled openTopic/onOpenTopicChange и optional actions. ProductHelpTopicId: receive/send/buy/swap. ProductHelpAction: allowed:true + onOpen либо allowed:false + reason; ProductHelpActions — Partial Record этих четырёх тем. Compact Menu/Help переиспользует эти actions/content. Отсутствующие actions оставляют объяснения без ложных CTA; support/docs остаются отдельными данными.

Scene callbacks разрешают current-context entry при существующей route/navigation. HelpEntryRequest фиксирует action/context/snapshot/flow-port session, honour requestContextChange и просит Overview. Layout handshake ждёт committed actual anchor и только existing finite Animation.finished, затем повторно проверяет context/route/session/section/active/sheet/pending, consumes request и вызывает guarded openIntent один раз с focus на существующий control. Нет DOM.click, RAF/polling, нового router/render engine или port/quote preload.

Externally controlled section без onSectionChange сохраняет отсутствие executable navigation: wrapper не создаёт ложный callback. Nav/context/adapter/inactive и возврат из уже committed Overview отменяют очередь; поздняя animation completion не открывает flow после следующего посещения. Static/reduced path проходит после layout без ожидания. Операция/quote/submit автоматически не выполняются; accepted lease, raw drafts и privacy сохраняются.

## Вопросы к backend

1. Версии DTO, стабильные user/account/asset/network IDs, auth/session и обработка истёкшей авторизации?
2. Exact capabilities и внутренние пары; значения inactive/unavailable, активация, KYC и готовность private account?
3. Формат recipient, обязательные memo/tag, выдача и обновление external receive destinations?
4. Источники precision/limits/available/debit/fee/funding/quote TTL/ETA и типизированных неизвестных значений/ошибок? Для Buy — отдельно fiat payment и crypto receipt; для Swap — обе legs, разрешённые пары и net credit.
5. Подтверждение/авторизация, idempotency, статус после разрыва связи, серверные journal IDs и reconciliation?
6. Battery entitlement, остаток переводов, процент и quote, подтверждающий оплату конкретной комиссии?
7. Contacts/security DTO, workflows и разрешённые HTTPS URLs поддержки/документов; где сохраняются preferences?

API proposal [10 октября](./2026-10-10-activity-api-contract.md) отложен: backend-разработчик подключает API позже. Эти вопросы — границы будущего подключения, не новое поручение расширять DTO или блокировать frontend. Принятый UX не добавляет финансовых/security разрешений. Customer decisions по T-единицам, активации, private readiness и battery applicability остаются в [#40](https://github.com/i4w7w4a/Wallet_4i7/issues/40) и [#42](https://github.com/i4w7w4a/Wallet_4i7/issues/42). Light5/equality семи light видов не реализованы ([#59](https://github.com/i4w7w4a/Wallet_4i7/issues/59)).

Новая главная ([#67](https://github.com/i4w7w4a/Wallet_4i7/issues/67)) и новая история ([#68](https://github.com/i4w7w4a/Wallet_4i7/issues/68)) — выбранное направление следующей работы, не состав текущего source. Материалы профиля/документов/риск-теста собираются отдельно в [#69](https://github.com/i4w7w4a/Wallet_4i7/issues/69). Эта docs/source sync не запускает их реализацию или новую публикацию.
