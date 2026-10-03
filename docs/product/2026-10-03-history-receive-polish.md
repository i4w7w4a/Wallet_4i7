# MONO — живая история и запрос на получение

Владелец: история слишком сухая; нужны более интересные иконки, разные цвета получения/отправки, интерактивность; продолжить продуктовую разработку параллельными агентами. Base12d2353, branch codex/product-ux-20261003. Canonical checkout C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation.

## Результат

1. История как удобная лента: авторские векторные знаки направления, выразительные но спокойные цвета, быстрый фильтр, лучшее раскрытие квитанции. Та же грамматика в последней операции на главной.
2. «Получить» как законченный запрос: необязательная желаемая сумма, preview валюты/сети/демо-реквизитов, отдельные copy-reference/copy-request и share-request. Без backend/payment URI/QR/реальных операций.
3. Общая интеграция: история содержит разные честно обозначенные демонстрационные состояния; запрос помнит сумму в сеансе для конкретного маршрута; переход в историю фокусирует нужную запись.

## Границы

- Семь presets/appearance, glass/background/button materials/иконпаки, balances/battery ledger не меняются. Локальный этап, без VPS/push.
- Цвет направления теперь явно разрешён владельцем: incoming emerald, outgoing blue-violet; failed/pending отдельный status cue, outgoing не красная ошибка. Цвет не единственный сигнал. Light/dark, reduced-motion/static, focus, touch44 обязательны.
- Не путать requested amount с доступным остатком, quote, допустимой network precision или реальным payment request. Денежные строки без float. Не генерировать payable QR, адреса или фальшивые статусы перевода.
- Draft/product state только в памяти выше оформления, не в localStorage/пресетах. Privacy убирает финансовые значения/реквизиты и запрещает copy/share.
- Существующие Astra MAX чаты; SOL6.1MAX помощники только с отдельными областями. Параллельная работа, короткий scoped review, targeted TDD, один общий build/browser pass. Не полный review/test каскад.
- Текущая3184 работает доfreeze; ORACLE единственный владелец запуска. Только браузер, не native computer use. next-env.d.ts чужой generated diff сохранить.

## Task 1: История с характером

Исполнитель UI Astra MAX, canonical checkout C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation, base12d2353/branchcodex/product-ux-20261003. Прочитать AGENTS/scoped Next docs, motion-design/animation-basics, TDD. Новое прямое решение владельца разрешает выразительные semantic direction colours, не ограничиваться прежним монохромным отчётом.

Владение: product-history.tsx, product-recent-activity.tsx, product-account-sections.module.css (history/recent only), operation-receipt-view.tsx и его CSS; новые history-direction-icon.tsx/.module.css, при необходимости history-presentation.ts; их targeted tests. Не менять demo-activity, controller, scene/sheet, receive/**, receipt-normalizer, profile styles.

- Сделай заметный визуальный redesign, а не просто перекрась символ ↑. Custom lightweight SVG: incoming — приём/вход в контур/лоток с осмысленной композицией, outgoing — вылет/направленное движение из контура; две узнаваемые формы, небольшая глубина, мягкий локальный свет. Не emoji и не unicode arrows. Не новые canvas/GPU/растровая библиотека/зависимость.
- Изумрудный incoming, сине-фиолетовый outgoing. Ошибка имеет отдельный тёплый значок/label и никогда не выглядит как зелёный успех; pending отдельно. Никаких неоновых простыней, новых квадратных рамок вокруг каждой строки. Направление видно формой и текстом, числа читаемы; dark/light нейтральный фон сохраняется.
- Короткое осмысленное движение SVG/света при hover/focus/press/раскрытии, zero overshoot, ~90/190/80ms и локальное раскрытие200–260ms. Нет idle loops, нет count-up/blur денежных цифр. static/reduced-motion отключает движение. Используй motion-design, но не добавляй три бесконечных слоя ради формулы навыка.
- Строки: ясный глагол/направление, количество, маленькая networkLabel, компактный статус/дата. Убрать повтор статуса в каждой строке квитанции там, где он только загромождает, сохранить смысл/доступность/демо-пояснение. +/− допустимы лишь как направление у completed, не изображать списание pending/failed; hidden amount без раскрывающих цифр в aria.
- Добавить компактные реальные фильтры «Все / Получения / Отправки» (не новый menu/settings). Корректно сочетать с account scope и asset-filtered activities. Программное открытие expandedActivityId изSend/главной обязано показать запись даже после другого фильтра; скрытая выбранным фильтром запись не остаётся невидимым target. Empty-filter с понятным сбросом. Не добавлять search/sort/экспорт этой итерацией.
- Можно сделать спокойные группы по точным датам входных данных (без Date.now/render для «Сегодня» и без фальшивых live дат). Не ломать стабильные IDs и порядок новых симуляций. Это выбор UI исполнителя, не требование раздувать код.
- Переиспользовать direction icon в ProductRecentActivity, чтобы главная не осталась со старой голой стрелкой. Старый API history/controlled disclosure/receipt/privacy должен сохраниться. Новый data-marker на row button: `data-product-activity-id={activity.id}` — ORACLE использует для semantic focus.
- Протестировать ровно ключевое: фильтр+external expanded id, privacy, direction/status не смешаны, legacy callback. Существующие receipt tests не гонять повторно, если содержимое не менял. Одна scoped серия, без build/серверов.

Commit только своих paths; отчёт .superpowers/sdd/2026-10-03-history-receive-polish/task-1-report.md, краткий DONE/concerns. Можно SOL6.1MAX для отдельного SVG/projection helper, без дополнительных review-лестниц. Если нужна правка чужого файла — сообщить root.

## Task 2: Запрос на получение

Исполнитель прежний Receive Astra MAX, canonical checkout C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation, base 12d2353, branch codex/product-ux-20261003. Прочитать AGENTS/scoped Next docs, TDD, motion-навыки если добавляешь движение. Работать только в receive/**, не изменять общие controller/history/scene.

Сейчас copy уносит только reference, share содержит валюту/сеть/reference. Реализовать полезный следующий шаг без расширения backend:

- В external Receive необязательная «Желаемая сумма» и компактный preview запроса: asset, network, requested amount если задана, DEMO-NON-PAYABLE reference и явное «ДЕМОНСТРАЦИЯ — НЕ ДЛЯ ОПЛАТЫ». Сумма — пожелание, не проверенная backend сумма/quote. Пустая разрешена,0/negative/exponent/invalid rejected; comma/dot ввод, точная decimal string без float/округления. Не придумывать token precision. Ограничить raw input128 символами как UI-size bound, не финансовый лимит.
- Новый pure helper receive-request.ts для normalization+text builder; copy-request и share используют один маркированный текст. Сохранить отдельное копирование raw reference с ясным именем «Скопировать реквизиты» (маленький control у reference), а основной action «Скопировать запрос». Share только по явному клику и navigator.share support; cancel не ошибка. Никаких автоматических отправок/clipboard calls/URLgeneration.
- QR остаётся существующим optional injected renderQr только demo reference; не превращать текст запроса в платежный QR, не рисовать декоративный fakeQR. InternalReceive не менять.
- Privacy: input/value/preview/reference/QR убраны из DOM, copy/share disabled; draft сохраняется выше privacy-key. Не утекать в aria/title/error/status. При route смене не брать сумму другой сети.
- Additive ReceiveFlowProps: `initialRequestAmount?: string; onRequestAmountChange?(amount:string):void;`. Инициализировать draft один раз на keyed route-content; raw input сохранять в памяти владельца через callback при пользовательском изменении, а не эффектом, перезаписывающим восстановленное значение. Host ORACLE хранит этот draft на account/asset/network/receiveMode. Без host props локальная версия совместима. Asset-details roundtrip/visibility remount не теряет ввод; старую privacy cancellation защиту copy/share сохранить.
- Маленькая спокойная композиция внутри уже одобренной glass sheet; не обводить каждую строку новым квадратом и не строить огромную форму. Иконкиcopy/share живые лёгкие CSS/SVG feedback, без новых runtime.
- Focused TDD: exact-string normalization/blank/invalid, copy-reference vs unified request payload, privacy retains but redacts draft, stale route/cancel сохраняют guards. Только адресные проверки, без полного suite, запуска сервера и сборки.

Commit ownedpaths only, report .superpowers/sdd/2026-10-03-history-receive-polish/task-2-report.md, краткийDONE. Обновить INTEGRATION.md коротко для новых props. НетVPS/push/backend/history operations.

## Task 3: Согласование данных, памяти и фокуса

Исполнитель ORACLE Astra MAX. Canonical checkout C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation, branchcodex/product-ux-20261003, base12d2353. Прочитать AGENTS/scoped docs, TDD. Неисполнятьстарые задачи, неVPS/push.

Владение: demo-activity.ts/test, product-controller.ts, product-sheet.tsx, mono-preview/mono-scene.tsx еслинужнофокусирование; scoped integration/session tests. Не history UI/recent/CSS/icon/receipt presentation, не receive/** или send/**.

1. Snapshot fixture сейчас даёт4одинаковых incoming0.1completed. Подготовить небольшой детерминированный набор разных демонстрационных состояний/направлений, exact account/asset/network из snapshot. Сохранить max4,stableuniqueIDs, unknown accounts filter, independence from actual balances. Явные mode example: например incomingcompleted, outgoingcompleted, incomingpending, outgoingfailed. Fixed coherent timestamps (сортировкапо убыванию); не Date.now/random и не имитация новых переводов/ledger. Quantity допустимо разнообразить фиксированными demoстроками для known assets, fallbackнеизвестным; никаких inferred fees, реальныхадресов/txHash/персональныхсведений. СтарыйcreateDemoActivities сохраняется.
2. Receive additive props от Task2: initialRequestAmount?:string,onRequestAmountChange?(amount:string):void. Добавить session-only receiveRequestAmounts keyed account/asset/network/receiveMode и stablecommand saveReceiveRequestAmount(route,rawAmount). Только legitimate externalreceive route, max128chars, emptyclear. Не metadata/requisites и не storage. ProductSheet передаётprops вReceiveFlow; closing/reopening иappearancechange должнысохранитьdraft правильногомаршрута. Internal untouched. Pure requestvalidation внутриReceive, controllerхранит partialrawinput.
3. Исправить ранее записанную minor: после «В истории» фокус попадаетaccountselector изmodalcleanup. UI Task1 добавляет marker data-product-activity-id наhistoryrowbutton. Установить semanticfocus наprogrammaticallyopenedrecord после перехода/закрытияmodal, не перехватывать фокус при обычномrerender/ручномфильтре. СогласоватьсTask1 filterresetпоexpandedid. No timers/RAF утечек. Можно additive focusrequesttoken вview/command, еслиэто самыйузкий корректный способ; нераспухатьcontroller.
4. Адресные проверки: fixturediversity/exactids; receiveamountмаршрутнаяизоляция+close/skin/privacy; historyprogrammaticfocus aftermodal. Не повторять всеистория/Receive/Send suites.
5. По cleancommitsTask1/2 — одинscopedreviewdiffот12d2353, одинminiapp typecheck/build. Current3184 удержатьдоfreeze. Предупредитьroot→verifiedstop/build/start3184→READYexactSHA/buildId. Browserвизуалroot, nativeнеиспользовать.

Report .superpowers/sdd/2026-10-03-history-receive-polish/task-3-report.md. No externaldeployment/push/presetwrites. Собираемцельныйрезультат, нематрицу100проверок.

## Итог локальной итерации

- История/последняя операция: `ad4ec4b`; запрос на получение: `7582288`; память, примеры и фокус: `c90eb96`.
- На визуальном проходе найден перенос суффикса USDC. Исправлен одной CSS-правкой `33a22ef`; потребовалась одна дополнительная сборка, без повторной тестовой матрицы.
- Финальный runtime: `33a22ef2ed657780b66a5090946f6de08fcc9be9`, build `EP3QxNzKXR04p38zCt5sC`, локальный адрес `http://127.0.0.1:3184/mono`.
- Исполнители выполнили адресные проверки: History/Recent/receipt 28; новый Receive 14; ORACLE — data/session, маршрутная память, фокус и одна совместимость asset workspace. Typecheck и production build успешны. Полный набор тестов не запускался.
- Root в браузере 390×844: четыре состояния истории, фильтр исходящих, полная inline-квитанция; запрос 25,50 USDC и сохранение после закрытия/возврата. После CSS-правки повторён только проблемный кейс — USDC в одну строку. Не проверялось на физическом телефоне; отдельного browser-прогона всех тем не было.
- Скриншоты: `C:/Users/iwwa/.novex-ops/product-ux/2026-10-03/history-polish-mobile.jpg`, `C:/Users/iwwa/.novex-ops/product-ux/2026-10-03/receive-request-mobile.jpg`. Viewport восстановлен, тестовая сумма очищена, вкладка оставлена на истории.
- Пресеты, фоны, материалы, стеклянный host и данные реальных операций не изменялись. Только локальная разработка, без push/VPS deployment. GitHub: #50, ожидает визуальной обратной связи владельца.
