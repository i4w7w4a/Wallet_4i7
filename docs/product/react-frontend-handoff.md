# React frontend handoff — MONO

Срез: 2026-10-05, локальный runtime source `c0fbca89835d74480242c71b15d02b145916c866`. Рядом находится [карта состояний](./product-state-map.md). Buy/Swap — подключённые демосценарии с черновиками, accepted lease и двухсторонней историей. Целевые проверки, source review, общий typecheck/build и один связный браузерный проход оркестратора пройдены; визуальная приёмка владельца не подтверждена. [Локальный milestone](../releases/2026-10-05-commerce-local-preview.md) отделён от публичного `85d33d2`; реальные API/платежи остаются отдельным контрактом.

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

[useMonoProductController](../../apps/miniapp/src/mono-product/product-controller.ts) владеет context, overlay/intent, workspace актива, открытой записью истории, raw drafts и журналом симуляций. Смена оформления должна сохранять controller и активную форму mounted.

| Состояние | Ключ и срок жизни |
| --- | --- |
| Send draft | sendDraftKey: account/asset/network → recipient, memo, raw amount. Session memory. |
| External Receive amount | receiveRequestAmountKey: account/asset/network/mode → raw amount. |
| Internal Receive draft | destination/asset/network/mode → sourceAccountId + raw amount; источник проверяется отдельно. |
| Buy draft | buyDrafts: commerceRouteKey по полному buy route → methodId + fiatAmount. Session memory; saveBuyDraft. |
| Swap draft | swapDrafts: commerceRouteKey по полному swap route → pairId + sourceAmount. Session memory; saveSwapDraft. |
| Quote, validation, pending, result | Flow session, не raw draft. До submit route/amount/port change инвалидирует quote. Accepted quote/key/operation ID принадлежит lease; expiry после принятия не запускает новую попытку. |
| История симуляций | Controller revalidates terminal и deduplicates operation IDs. Один ProductActivity.commerce хранит canonical buy/swap и обе legs; успех очищает только соответствующий draft. Fiat debit/crypto credit и fee-inclusive Swap debit/net credit не смешиваются. Балансы/battery не меняются. |
| Тема и privacy | Host preference. Editor передаёт тему существующему `colorLab.switchTheme`. Viewer без host session хранит только light/dark в `wallet4i7.mono.viewer-theme.v1`, отдельно от опубликованных presets. Privacy остаётся у session/controller. |

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

## Профиль

Из [profile/index.ts](../../apps/miniapp/src/mono-product/profile/index.ts) экспортируются ProductProfileAction, ProductProfileActions, ProductProfileDetails, ProductProfileResource, createDemoProfileResource и isProfileLinkAllowed.

Factory каждый раз создаёт новый ready object и новый documents[]. Email/phone/support — null; язык Русский, валюта USD; verification/twoFactor/addressAllowlist — unknown. Контакты заказчика, секреты, адреса поддержки и policies отсутствуют.

URL guard допускает абсолютный HTTPS с явным authority без username/password/userinfo, обратных слешей и raw whitespace/control символов. Это проверка формы URL. Разрешённые domains/документы и доверие к backend остаются у host. Для новых вкладок UI использует текстовые узлы и rel="noopener noreferrer".

В [ProductProfile](../../apps/miniapp/src/mono-product/product-profile.tsx) обязательны profile, balanceHidden, onBalanceHiddenChange. Optional props: resource, actions, onRetry, theme, onThemeChange. Resource: loading; error с retryable; ready с data. Отсутствующий resource даёт demo defaults. При loading/error stale contacts/security скрыты; preferences доступны. Retry требует retryable error и onRetry, а отсутствие callback не создаёт активную фиктивную кнопку.

UI и host wiring реализованы. Четыре раздела раскрываются на месте: личные данные, настройки, безопасность, помощь и документы. Модель не добавляет транспорта или auth. Manage-password только открывает workflow: поля «пароль установлен» в данных нет.

`MonoScene.session.onThemeChange` — controlled callback. Если session передан без callback, тема read-only: visitor fallback не включается. В `/mono` профиль использует существующий Lab owner, не выполняя Save/Apply/publish. В `/p/N` и portable viewer без host session [useViewerTheme](../../apps/miniapp/src/mono-product/profile/use-viewer-theme.ts) восстанавливает строго `{version:1,theme:'dark'|'light'}` после mount. SSR/первая hydration используют supplied appearance; повреждённая запись игнорируется, отказ storage оставляет выбор в памяти. Presentation clone не меняет исходный envelope. Editor не читает этот viewer key.

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

## Вопросы к backend

1. Версии DTO, стабильные user/account/asset/network IDs, auth/session и обработка истёкшей авторизации?
2. Exact capabilities и внутренние пары; значения inactive/unavailable, активация, KYC и готовность private account?
3. Формат recipient, обязательные memo/tag, выдача и обновление external receive destinations?
4. Источники precision/limits/available/debit/fee/funding/quote TTL/ETA и типизированных неизвестных значений/ошибок? Для Buy — отдельно fiat payment и crypto receipt; для Swap — обе legs, разрешённые пары и net credit.
5. Подтверждение/авторизация, idempotency, статус после разрыва связи, серверные journal IDs и reconciliation?
6. Battery entitlement, остаток переводов, процент и quote, подтверждающий оплату конкретной комиссии?
7. Contacts/security DTO, workflows и разрешённые HTTPS URLs поддержки/документов; где сохраняются preferences?

Ответы фиксируются отдельным live/backend-контрактом. Этот handoff и отдельный custody-аудит не утверждают финансовые правила, тарифы, адреса поддержки или проверку личности. Header/avatar/menu следующей волны не входят в описанную commerce-поставку.
