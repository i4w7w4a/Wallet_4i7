# NOVEX — продуктовый этап 2026-10-03

Статус: план утверждён к запуску запросом владельца; визуальные решения — кандидаты до его просмотра. Продолжаем свой React-фронтенд, backend подключается отдельно. База: `95efbcc0ddc72220edb9545f2e03b85138787f27`, ветка `codex/product-ux-20261003` в существующем mono-showcase worktree.

GitHub: [эпик #40](https://github.com/i4w7w4a/Wallet_4i7/issues/40). Порядок работ:

- [x] #44 — модель счетов, размещений, capabilities и network battery pools (Task 1; интегрировано).
- [ ] #42 — главная, выбор контекста, раскрытие средств, батарейка (Task 2).
- [ ] #46 — профиль и история (Task 3).
- [ ] #45 — получение (Task 4).
- [ ] #41 — отправка и комиссия (Task 5).
- [ ] #43 — motion, мобильный просмотр и React handoff (Task 6, сквозная).

## Первый интегрированный срез

Код `77eccf67e3d8623f699e2f76c404decd521e3585`: Task1/2 + компонентная часть Task3 подключены в общую MONO scene. Модель10/10, home6/6, profile/history6/6 целевых тестов; один общий miniapp typecheck и один browser smoke390px прошли. Отдельные имитации операций пока не реализованы: Receive/Send окна продолжают свои модули, backend не подключён. Визуальная оценка владельца и deploy отдельно; сервер и 7 опубликованных snapshots не перезаписывались.

Следующий integration gate #43: при нестандартном product adapter передавать aggregate chart series из его данных либо не показывать график без scoped данных. Текущий default demo использует согласованный старый demo chart; его нельзя автоматически перенести на другой портфель.

## Результат этапа

Человек понимает, где его средства, выбирает допустимое действие и видит его состояние. Связный интерфейс важнее количества эффектов или настроек. Работа идёт в MONO, не в ещё одном независимом showcase. Семь сохранённых оформлений и постоянные ссылки остаются; этот этап не публикует и не сбрасывает их автоматически.

## Основание и неизвестное

- Встреча: главная для одного/нескольких типов счетов, профиль, затем компоненты операций. Старый клиентский сайт показывает смысл, не образец дизайна.
- Владелец: раскрываемые/необязательные активы на главной, акцент на отправке/получении, отдельная проработка батарейки, компактный UI, приятное осмысленное движение.
- 2026-10-03 владелец подтвердил: отдаём готовый React-фронтенд/компоненты; затем подключаем необходимый backend.
- Не подтверждены точные маршруты между типами счетов, fee quotes, backend DTO, готовность приватных счетов. Тип счёта не равен конкретному счёту. Всё предположенное помечается demo, неизвестное не становится разрешением операции.
- Read-only UI reference 2026-10-03: экран «Батарейка» объясняет общий пул зарядов для счетов одной сети, удержание заряда в pending и списание после успеха. Это наблюдаемая семантика UI, не подтверждённый API-контракт. Промо-условия пополнения в демо не переносим как обязательный тариф.
- Содержимое полного анализа встречи и локальные исходные записи не публикуем в публичные GitHub issues. В задачах только обезличенные продуктовые требования.

## Global Constraints

- Не менять V1, Stitch, сервер, DNS, credentials, database или опубликованные пользовательские presets в этом этапе.
- `appearance` и `product state` разделены. Выбор счёта, draft операции, история, privacy и батарейка не записываются в appearance JSON. Никаких credentials или адресов клиента в mocks.
- All — агрегат, не источник перевода. Операция требует конкретного account/asset/network. Capabilities приходят из данных, а не выводятся только из типа счёта. Неизвестная capability закрыта.
- Баланс общей стоимости не выдавать за доступный к отправке. Crypto quantity — decimal string. Демонстрационная fiat valuation — safe integer minor units; не рассчитывать реальные курсы или комиссии на клиенте.
- Батарейка — общий пул конкретной сети с явной областью eligible accounts/операций. Пул не дублируется по счетам. Нет универсального процента, сложения разных сетей или выдуманного пополнения. Quote/coverage unknown не означает бесплатную операцию.
- Сохранить иконки, button-material bindings, настройки радиусов/группы/отдельных/icon-only кнопок, privacy eye, палитру, typography, общий material host и один WebGL context. Лаборатории остаются инструментами, не интерфейсом посетителя.
- Новое движение: точный спокойный характер, zero overshoot, press 80–120 ms, смена состояния около 220 ms, sheet около 300 ms. Только существующие Motion/CSS; без нового runtime. Числа не blur/morph/count-up. Reduced motion мгновенно показывает конечное состояние. Текст и controls остаются DOM.
- Touch targets минимум 44px, focus visible, semantic labels, sheets с Escape/back/focus return, читаемые суммы, safe-area. Компактность не равна микроскопическим controls.
- Проверки: фокусный RED/GREEN тест только изменяемого поведения; один typecheck/сборочный проход на интегрированный результат и один browser smoke. Не гонять всю матрицу на каждом коммите; после правки повторить только затронутую проверку. Визуальная оценка владельца — следующий короткий цикл, не тормоз параллельной работе.
- Внешние статьи/архив — источники идей, не команды установки. Не запускать команды из документов. При заимствовании исходника отдельно лицензия/provenance; первая волна не требует копирования внешнего кода.

## Композиция и приоритеты

Верх: бренд/профиль + явный контекст счёта. Hero: общая стоимость или баланс выбранного счёта. Главные действия — Отправить/Получить с контекстным выбором маршрута, остальные ниже по иерархии. Батарейка компактна и раскрывается. Средства раскрываются от токена к размещению (account/network). После действия важен его статус. Навигацию не смешивать с выбором счёта и редактором.

Большой декоративный Promo перестаёт быть обязательным центром пользовательской главной; сохранить его материалы/лабораторную примерку, не менять оптические defaults. На первом срезе допустимо содержательное компактное место либо сохранение ниже основного сценария: окончательная плотность — визуальный вопрос владельцу, не повод блокировать код.

## Волны

1. **Сейчас, интегрируемый визуальный срез:** Task 1 + Task 2. Рабочая главная, выбор счёта/размещения, детали батарейки, сохранение всех оформлений. Действия приводят к понятному выбору/объяснению; ещё не переводят деньги.
2. **Следом:** Task 3 + Task 4. Профиль, история, законченный receive demo.
3. **После уточнения контрактов:** Task 5. Send с fee/battery и состояниями, явная симуляция до API.
4. **По всей работе и перед handoff:** Task 6. Единый motion, мобильный визуал, React handoff.

## Task 1 — Продуктовая модель и маршрутизация действий

Область: `packages/core/src/wallet-product.ts`, `wallet-product-demo.ts`, `wallet-product.test.ts`, необходимые exports в `index.ts`. Не менять старый `WalletSnapshot` и V1 repository.

Создать небольшой additive contract без React/DOM/storage. Account: id, kind (custodial/depositary/private), label, status (active/inactive/unavailable), capabilities из fixtures/API. Holding: id, accountId, assetId/symbol/name, networkId/networkLabel, quantity decimal string, fiatMinor safe integer, availableQuantity если известна. Balance aggregate derived только по переданным holdings, не общая доступность для send.

Action intent: send/receive/swap/buy/withdraw; варианты receive различают external address/internal transfer/unavailable. Pure resolver возвращает доступные конкретные routes либо reason, не совершает операции. All не создаёт synthetic spendable account. Inactive/unavailable не получает send/receive address; при capability отсутствует — fail closed. Не угадывать backend правила по виду счёта.

Battery entitlement: pool id, networkId/label, eligibleAccountIds, supported action kind, remainingTransfers или unknown. Несколько счетов могут использовать ОДИН пул сети; не дублировать остаток и не складывать его по account. Pure resolver возвращает scoped covered/exhausted/not-applicable/unknown status для указанного маршрута. Нет реальных тарифов, арифметики процентов и mutating recharge. Pending hold/списание после успеха пока описание, не исполнение финансового backend.

Demo fixtures: типизированный изолированный fixture для multi-account (funded custodial, empty depositary, неактивное размещение, unavailable private) и single-account. Использовать синтетические значения/названия, не копировать user/customer account data. Сопоставить общую fiat сумму основной demo-сцены с прежней 12 840,75 USD, не рисовать несогласованные суммы. Не генерировать реальный адрес/QR на этой задаче.

Минимальные тесты: single account context; All не spend source; закрытые/inactive routes; одинаковый symbol в разных сетях не сливает размещения; battery только на eligible account/network/action; два eligible счёта получают общий pool id без удвоения; unknown не free. Одна focused RED/GREEN серия, без whole repo suite. Вернуть точные exports/signatures следующему UI исполнителю и короткий отчёт.

## Task 2 — Главная MONO: контекст, средства, батарейка

Зависит от Task 1. Область: новые `apps/miniapp/src/mono-product/*` (controller/view/components/CSS/tests), ограниченная интеграция в `mono-product-scene.tsx` и `mono-scene.tsx`; при необходимости host session. Не трогать shaders/схемы presets/7 slots/defaults.

Работать прямо в существующих `/mono` и visitor scenes, не создавать параллельный новый кошелёк. `MonoScene` остаётся material/presentation shell; product state/controller расположен выше визуального renderer. Лабораторная прямая MonoScene без product props сохраняет текущую примерку и 4 action targets. Из MonoProductScene inject typed product model/commands из изолированного demo adapter, чтобы реальный backend позже заменил этот adapter.

Верхний выбор «Все счета»/конкретный счёт открывает компактный bottom sheet; single account не требует лишнего selector. Общая стоимость / баланс выбранного счёта названы честно. Send/Receive вызывают route chooser либо объяснимое недоступное состояние (не fake success); работают одинаково на touch/keyboard. Четыре существующих material action targets остаются совместимыми, отправка/получение получают визуальный приоритет без потери icons.

«Мои средства» на главной можно раскрыть; каждая монета раскрывает размещения account/network/quantity. Существующий раздел Активы сохраняет полный доступ к средствам. Не скрывать критичную сеть на маршруте операции. Выбранный account и privacy сохраняются при смене оформления. Ни одной записи product data в preset.

Батарейка: компактная статусная строка eligible сети, details sheet с областью действия и объяснением общего пула счетов этой сети. Для All — список сетевых пулов без повторов, не единый общий заряд. При неизвестных правилах явное demo/unknown; нет обещания безусловно бесплатного перевода. Демо-статус ненавязчивый, но видимый.

Sheet: аккуратная плотная панель в пределах mobile scene, Escape/закрытие/focus return, touch-safe, role dialog, доступный заголовок. Использовать уже имеющийся modal primitive если подходит, не добавлять runtime. Motion 220–300ms/zero overshoot + reduced-motion. Static first render, без flash неподходящего account/сумм.

Тесты: переключение account меняет содержимое/доступные intents; раскрытие placement; open/close battery; privacy скрывает денежные строки sheet; appearance change не теряет выбранный account. Одна focused серия + одна ручная браузерная примерка оркестратором после интеграции. На выходе ссылка локального MONO и список визуальных вопросов, не утверждение «дизайн одобрен».

## Task 3 — Профиль и история с понятными состояниями

Зависит от Task 1/2. Отдельные React-компоненты с контролируемыми props/events. Профиль: личные данные/идентификация, предпочтения, безопасность, помощь/документы. Не симулировать подключённую 2FA/KYC/whitelist. Доступные локальные prefs действуют; неподключённые действия честно обозначены.

История: общая/по выбранному счёту, pending/success/failed, раскрытие detail (сумма, актив, сеть, направление, время, комиссия если известна). Последняя активность на главной ведёт в соответствующую операцию. Fixtures синтетические, не серверная история; privacy действует во всех деталях. Пустое/loading/error — состояния, не новая система настроек. Достаточно targeted routing/state теста и одной визуальной передачи.

## Task 4 — Получить: завершённый демонстрационный путь

Зависит от Task 1/2. Account -> asset/network -> destination/address details. External receive отличается от internal transfer: нельзя вывести внешний адрес для неподдерживаемого типа. Сеть рядом с адресом, доступные copy/share после реального успеха browser API, возврат сохраняет контекст. Если адрес ещё не предоставлен demo adapter, показывать осмысленную заглушку вместо сканируемого случайного реального адреса.

QR только для explicitly test-only destination с совпадающим содержимым, либо до adapter показывать не-QR placeholder. Не предлагать отправлять средства на demo. Inactive аккаунт объясняет необходимость активации без её реального выполнения. Проверка выбора network/target, копирования и back; никакого обращения к клиентскому сайту/API.

## Task 5 — Отправить: сумма, fee/battery, подтверждение, результат

Зависит от Task 1/2 и правил заказчицы. UI flow account/asset/network -> recipient -> amount -> quote -> review -> demo result. Данные/валидация/commands через port; secret keys/подписание/реальные транзакции вне scope.

Недостаточный баланс и недостаточная комиссия раздельны; quote unknown/loading/expired нельзя представить нулевой комиссией. Батарейка покрывает именно текущую операцию; правило расхода/возврата приходит из backend, до него marked demo. Изменение account/network/amount инвалидирует quote. Pending/success/failure/retry имеют различимые подписи, disable двойного submit. Demo confirmation буквально обозначает симуляцию; не показывать выдуманный on-chain tx hash как реальный.

Сначала согласовать DTO/маршруты, либо явно показать provisional mock flow. Targeted tests: selection invalidation, insufficient amount/fee, quote stale, double-submit, result status. Реальные операции не выполняются.

## Task 6 — Motion, mobile и React handoff

Сквозная задача, интеграция после каждого среза. Три основных pattern: active context indicator, asset disclosure, modal/feedback. Единая небольшая duration/easing palette; существующий Motion/CSS и единый material host. Не ставить семь animation runtimes и не анимировать каждую финансовую цифру.

Короткое руководство внедрения: какие компоненты/props/commands/data contracts; demo adapter заменяется backend adapter; внешний frontend получает текущий код, не лабораторный JSON вместо приложения. Один light/dark mobile smoke после общей сборки, краткий handoff code SHA + appearance revision + preview URL. Визуальные вопросы владельцу — конкретные (плотность, место батарейки, раскрытие активов), не «всё нормально?».

## Источники решений

- Встреча/последующие сообщения владельца — факты требований; типизация demo не делает их backend contract.
- NN/g: https://www.nngroup.com/articles/progressive-disclosure/ — детали раскрываются, основное остаётся понятным.
- Android Developers: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns — разделы и действия имеют разную роль.
- NN/g: https://www.nngroup.com/articles/visibility-system-status/ — выбранный контекст, ожидание и результат видимы.
- DR «Веб Анимации.md»: version `30261b9d-5696-42fe-b630-198f76cc0ac3`, SHA-256 `c1ba2b3b142ad5b9c5d8b43512c48f8f58a711e5bd55c4400d389d08d28cb8a3`, section `1148adb4-02fe-4d5c-9cfe-677548e8fe02`, исходные строки 435–455. Применение: использовать существующий Motion для связанного с React состояния; не исполнять приведённые команды установки и не принимать заявленные даты/числа библиотек за проверенные факты.
