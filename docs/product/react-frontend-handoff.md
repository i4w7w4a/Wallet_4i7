# React frontend handoff — MONO

Срез: 2026-10-05, sealed source/local runtime `0acfde84655850d01c76cbc4d47f34f03c326181`. Accounts workspace, actionable Help, visitor theme hiding и root307→MONO интегрированы поверх прежних пяти commerce/receive/send ports. Source review20e23 PASS, bounded test delta0acfde8 accepted, common typecheck/build и один browser smoke PASS. Public runtime/source — `0acfde8`, image `novex-wallet:20261005T005801Z-0acfde8`; rollback85d33 сохранён, семь snapshots/history после switch совпали побайтно. Owner artistic approval ещё не получено. [Карта состояний](./product-state-map.md), [release05.10](../releases/2026-10-05-mono-product-release.md) и [единый вход](../../README.md); реальные API/платежи — отдельный контракт.

## Вход и разделение данных

Точка сборки — [MonoProductScene](../../apps/miniapp/src/mono-preview/mono-product-scene.tsx).

| Вход | Назначение и владелец |
| --- | --- |
| snapshot: WalletSnapshot | Legacy presentation snapshot: профиль, график, уведомления, начальное privacy. WalletProfile.shortAddress в профиле обозначает demo ID, платёжных реквизитов здесь нет. |
| productAdapter: MonoProductAdapter | Product snapshot счетов/размещений/capabilities, история и её status/retry, явные проценты battery. По умолчанию MONO_PRODUCT_DEMO_ADAPTER; kind сейчас только demo. |
| appearance, material | Оформление и общий optical host. Они не предоставляют права на операции и не хранят пользовательские финансовые данные. |
| session | Host-owned privacy, период графика, опционально раздел и callbacks. При отсутствии controls используются предусмотренные локальные состояния. |

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
| Тема и privacy | По решению владельца 05.10.2026 Profile/quick menu временно не показывают выбор темы или read-only строку. Effective appearance, совместимые props/callbacks и Lab/editor `colorLab.switchTheme` сохранены. Viewer без host session продолжает восстанавливать light/dark из `wallet4i7.mono.viewer-theme.v1`, отдельно от published presets, без очистки/миграции. Privacy остаётся у session/controller. |

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

[ProductAccountsWorkspace / props](../../apps/miniapp/src/mono-product/accounts-workspace/index.ts) принимает current readonly snapshot, selectedAccountId, context, balanceHidden, allowedActions; callbacks onInspectAccount, onBack, onUseAccount, onOpenAction(full ProductActionRoute), onOpenHolding(holdingId). Optional useAccountUnavailableReason добавлен в correction20e23: disabled Use с видимой и accessible причиной для controlled Profile/History без navigation callback. Без этого reason прежний leaf contract совместим; read-only Overview может использовать счёт без перехода раздела.

Controller accountsWorkspace: outer null — закрыт, inner accountId:null — список, ID — detail. Inspect не меняет global context; только explicit Use/action меняет его через current pending/session guard. Commands: openAccountsWorkspace, inspectAccount, backAccountsWorkspace, closeAccountsWorkspace, useAccount, openAccountRoute(full route), openAccountHolding(accountId, holdingId). Начальный single-account список и missing ID сохраняются, другой account не выбирается молча. Host origin/focus отделены от controller; четыре nav tabs и compact quick context chooser сохранены.

AllowedActions intersect с canonical core routes по полному productRouteKey, включая action/account/asset/network/receiveMode; known unsupported entries не предлагаются. Entry — только preparation, existing Flow остаётся владельцем окончательных load/available/quote/fee/funding/submit checks. Capabilities не являются обещанием выполнения; withdraw не добавлен. Holding request resolves exact current unique account/holding IDs atomically, без selectContext→stale openAsset последовательности.

Account-origin intent сохраняет returnToAccountId. Back проверяет текущий parent/session/full route identity, закрывает child и восстанавливает detail/точный route focus; asset child возвращает к точному holding. Обычный overview chooser и placement Back сохраняют свои пути. Старый network callback не закрывает новый flow; adapter replacement закрывает workspace, removed account показывает missing view и запрещает действия. Privacy маскирует quantity/available/estimate и aria, missing/malformed available остаётся неизвестным.

## Профиль

Из [profile/index.ts](../../apps/miniapp/src/mono-product/profile/index.ts) экспортируются ProductProfileAction, ProductProfileActions, ProductProfileDetails, ProductProfileResource, createDemoProfileResource и isProfileLinkAllowed.

Factory каждый раз создаёт новый ready object и новый documents[]. Email/phone/support — null; язык Русский, валюта USD; verification/twoFactor/addressAllowlist — unknown. Контакты заказчика, секреты, адреса поддержки и policies отсутствуют.

URL guard допускает абсолютный HTTPS с явным authority без username/password/userinfo, обратных слешей и raw whitespace/control символов. Это проверка формы URL. Разрешённые domains/документы и доверие к backend остаются у host. Для новых вкладок UI использует текстовые узлы и rel="noopener noreferrer".

В [ProductProfile](../../apps/miniapp/src/mono-product/product-profile.tsx) обязательны profile, balanceHidden, onBalanceHiddenChange. Optional props: resource, actions, onRetry, theme, onThemeChange. Resource: loading; error с retryable; ready с data. Отсутствующий resource даёт demo defaults. При loading/error stale contacts/security скрыты; privacy доступна. Retry требует retryable error и onRetry, а отсутствие callback не создаёт активную фиктивную кнопку.

UI и host wiring реализованы. Четыре раздела раскрываются на месте: личные данные, настройки, безопасность, помощь и документы. Модель не добавляет транспорта или auth. Manage-password только открывает workflow: поля «пароль установлен» в данных нет.

Header использует controlled [AvatarControl](../../apps/miniapp/src/mono-product/avatar-control/index.ts) с явным `avatarSrc`/fictional-demo manifest и ref на native button. Avatar открывает текущий profile; отдельный launcher открывает [ProfileQuickMenu](../../apps/miniapp/src/mono-product/profile-quick-menu/index.ts), без собственного routing/storage/preference owner. DTO не расширен выдуманным `profile.avatarUrl`.

Menu сохраняет совместимые theme/optional onThemeChange props, но с 05.10.2026 выбор темы и read-only placeholder полностью убраны из menu и Profile. Три строки: «Скрывать суммы» меняет общий balanceHidden, «Мои счета» открывает content workspace, «Помощь» закрывает menu и передаёт focus группе профиля. Initial keyboard focus — privacy; пустого ряда/заголовка темы нет. Typed `ProductProfileSection` и optional `openSectionRequest: { section, revision }` экспортируются из product-profile.tsx; новая revision означает одно явное действие, не persistent копию disclosure state.

Host проверяет наличие sheet/commerce pending и действующий context/section guard до открытия/перехода; inactive и смена view снимают menu. Немодальный dialog без Tab trap: initial focus на доступном control, Escape/явное закрытие возвращают trigger, outside/focus-out сохраняют следующую цель. Closing/closed content сразу недоступен и unmount-ится; 0ms exit — source-reviewed tradeoff, не full visual approval.

ProductGlassProvider использует существующий общий host, без нового canvas/context/RAF. Исторический header pass наблюдал menu fallback; живую refraction/измеренную производительность не заявляем. Текущий один local browser smoke0acfde8 на390px подтверждает theme hiding, Accounts exact Back/focus и Help readiness; минимальный public pass — root→MONO и /p/2→Accounts list без editor/theme controls. Source review/common typecheck/local build PASS; после 28 mechanical test-prop removals повторялся только failed miniapp typecheck. Общий lint GREEN и полная device/preset matrix не заявлены; известный прежний asset-scrollport lint debt не пересматривался.

`MonoScene.session.onThemeChange` остаётся совместимым controlled callback; Profile/quick menu сейчас его не вызывают и не показывают даже read-only строку темы. Session без callback по-прежнему не включает visitor fallback. Тема `/mono` принадлежит существующему Lab owner; editor controls работают, не выполняя Profile Save/Apply/publish. В `/p/N` и portable viewer без host session [useViewerTheme](../../apps/miniapp/src/mono-product/profile/use-viewer-theme.ts) продолжает восстанавливать строго `{version:1,theme:'dark'|'light'}` после mount. SSR/первая hydration используют supplied appearance; повреждённая запись игнорируется, отказ storage оставляет effective theme в памяти. Существующий callback сохранён, новых writes/миграций при скрытии UI нет. Presentation clone не меняет исходный envelope. Editor не читает этот viewer key.

[integration-example.tsx](../../apps/miniapp/src/mono-product/profile/integration-example.tsx) — небольшой controlled wrapper с переключением loading/error/ready. Он не монтируется в production route, не делает HTTP и не пишет storage. View передаёт потребитель; импорт ProductProfile внутри example только типовой.

Локальный родитель примера; пути ниже показаны относительно docs/product:

~~~tsx
import { useState } from "react";
import type { WalletProfile } from "@wallet/core";
import { ProductProfile } from "../../apps/miniapp/src/mono-product/product-profile";
import { createDemoProfileResource } from "../../apps/miniapp/src/mono-product/profile";
import { ProfileIntegrationExample } from "../../apps/miniapp/src/mono-product/profile/integration-example";

function LocalProfilePreview({ profile }: { profile: WalletProfile }) {
  const [resource, setResource] = useState(createDemoProfileResource);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [balanceHidden, setBalanceHidden] = useState(false);
  return <ProfileIntegrationExample View={ProductProfile} profile={profile}
    resource={resource} onResourceChange={setResource}
    onRetry={() => setResource(createDemoProfileResource())}
    theme={theme} onThemeChange={setTheme}
    balanceHidden={balanceHidden} onBalanceHiddenChange={setBalanceHidden} />;
}
~~~

Local retry явно возвращает demo defaults. Для backend host сам переводит resource в loading и передаёт актуальный ready/error; транспорта в примере нет. Theme callback в этом локальном wrapper обновляет controlled значение; application host также применяет preference к визуальной сцене.

Actions edit-contacts/manage-verification/manage-2fa/manage-password/manage-addresses открывают реализованный host workflow. Они не переключают security flags и не означают успех. После подтверждённого сервером изменения host обновляет resource. Не передавайте заглушку callback, если открывать нечего. Нового profile control уменьшения анимаций нет; системный reduced-motion остаётся.

## Помощь и вход в действия

[ProductHelp](../../apps/miniapp/src/mono-product/product-help/index.ts) — controlled openTopic/onOpenTopicChange и optional actions. ProductHelpTopicId: receive/send/buy/swap. ProductHelpAction: allowed:true + onOpen либо allowed:false + reason; ProductHelpActions — Partial Record этих четырёх тем. ProductProfile получает optional helpActions и хранит topic state. Отсутствующие actions оставляют объяснения без ложных CTA; supplied support/docs остаются в своей группе.

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

Ответы фиксируются отдельным live/backend-контрактом. Header/avatar/menu, Accounts и Help включены в public0acfde8 и не добавляют финансовых/security разрешений. Аналитический custody-аудит не утверждает правила обеспечения/погашения T-единиц, активации, private readiness или battery applicability; эти customer decisions сохраняются в [#40](https://github.com/i4w7w4a/Wallet_4i7/issues/40) и [#42](https://github.com/i4w7w4a/Wallet_4i7/issues/42). Точный Light5-образец (published slot5rev2 либо local draft) не выбран, полное равенство семи light видов не реализовано ([#59](https://github.com/i4w7w4a/Wallet_4i7/issues/59)).
