# N1: «Незавершённые операции» — контракт следующего задания

<!-- NOVEX_TASK4_STATUS_20261011_START -->
> **Исторический контракт выполненного N1.** Home/account-specific pending и точный возврат опубликованы в f749776. Прежний account follow-up больше не активная очередь; реальные completeness/freshness API отложены.
>
> Текущая волна [11 октября](2026-10-11-wallet-cohesion-release.md) **RELEASED f749776**: [release proof](../releases/2026-10-11-wallet-cohesion-f749776.md). Актуальная очередь — [аудит проекта](2026-10-11-project-audit.md). Прежние source/build/browser evidence ниже — история.
<!-- NOVEX_TASK4_STATUS_20261011_END -->

Дата: 2026-10-10. Статус: **локальная примерка готова**, source `f36658d37059729b23f0f1bfbbb5f7e12abb3f67` (0e9dfc0 + точечный context-focus fix), base80c6b70. Целевые проверки/typecheck пройдены, scoped review Approved после проверки delta. Одна локальная production-сборка ORACLE на3184, BUILD_ID `cwpjafU6FUIP5xnha3Rok`. Root в браузере подтвердил single→exact receipt, Back/focus и privacy;320 без горизонтального overflow, подписи закреплений исправлены. Визуальное решение владельца ещё не получено. Публичная главная остаётся b6553a8; публикация N1 отдельно.
База чтения: `0872b35517680cbec9ab30f07027f872c2f899e2`, canonical checkout `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`.
Основание: N1 в `docs/product/2026-10-10-account-overview-plan.md`. Root/app AGENTS прочитаны. В этой подготовке разрешён только этот MD; код, тесты, presets и публикация не меняются.

## Актуализация к b6553a8 и граница первого выполнения

Владелец утвердил домашнюю строку над «Последняя операция». **Первый N1 ограничен главной:** один pending открывает существующую квитанцию, несколько — pending-выборку существующей истории. Новый вход из карточки счёта и специальный history→account Back ниже остаются follow-up, не обязательной частью этой волны.

- `product-controller.ts` уже экспортирует `ALL_WALLET_CONTEXT` и `productViewForScope`. Переиспользовать их; проекция меняет context/holdings/balance, но сама не фильтрует activities. Не переключать рабочий счёт ради просмотра.
- `mono-scene.tsx` уже имеет all-scope домашний recent, временный `historyInspection` (scope, workingContext, snapshot, ports) и guarded `openActivity(id)` с точным раскрытием/focus. Утверждение исходного анализа, что History всегда наследует рабочий context, для b6553a8 устарело.
- Для many добавить узкий transient filter request с revision: pending, пустой query, all directions, без произвольного expanded ID. Повторный вход применяет запрос; обычный rerender не сбрасывает пользовательский фильтр. Фокус — на семантический элемент истории, не случайную первую запись.
- Домашний entry должен находиться вне ready-only условия recent, иначе loading/error исчезнут. Общая сумма и закрепления не требуют расширения для N1.
- Сохраняются guards, рабочий context, drafts, snapshot/session invalidation и отдельный возврат на главную. Group/account Back не переделывать. Текущий direct `openActivity` — основа single, не замена корректному many entry.
- Проверки первой волны: один узкий набор 0/1/many/loading/error; повторное применение history request при сохранении ручных фильтров между входами; global scope при другом рабочем счёте, exact reveal, guard/focus/Back и один privacy path. Не повторять полный исторический suite.

Дополнительная локальная визуальная полировка, выявленная при Task 1: на 320 px длинные названия правых закреплений переносятся внутри последнего слога. Overflow/перекрытия не обнаружены. Исправлять только подачу подписей с сохранением полного доступного имени, точных денежных сумм и областей нажатия, не меняя presets.

## Проверенные факты исходной базы 0872b35

- `ProductRecentActivity` сортирует scoped-копию по `occurredAt` и показывает newest запись независимо от результата. Это корректная «Последняя операция», не баг. Invalid date отправляется в конец. В snapshot fixtures pending от 26 сентября старше completed от 27 сентября; история запись сохраняет.
- `ProductActivity.status` имеет только `pending | completed | failed`. Для примеров pending называется «В обработке», для симуляции в компактной строке — «В процессе»; существующие доступные/квитанционные подписи различают пример и симуляцию. `mode` отсутствует = example. Стадий сети, подтверждений, причины pending и времени обновления статуса нет.
- `MonoProductAdapter` / `MonoProductView` отдельно имеют `activityStatus: ready | loading | error` и необязательный `retryActivities`. Нет supplied offline/unknown state или признака полноты истории. Controller по умолчанию превращает отсутствующие `activities` в `[]`, отсутствующий status — в `ready`; это demo convention, не доказательство полной истории реального API.
- Controller объединяет adapter examples и session-only simulations. Send/internal/commerce simulations записываются как completed/failed после результата. `commerceBusy` и accepted-submit guard не являются pending-записью; N1 не создаёт из них искусственные операции.
- `scopeProductActivities` уже учитывает обе стороны internal transfer и crypto legs commerce, выдавая одну проекцию события для scope. Не заменять его фильтром только по `activity.accountId`.
- `ProductHistory` уже имеет pending-фильтр, `expandedActivityId` и встроенную `OperationReceiptView`. Filters сейчас локальные; нового внешнего запроса scope/filter нет. `openActivity(id)` в `mono-scene.tsx` делает guards → выход из Accounts → expand → History → focus по ID, но History наследует `view.context`. В account detail сейчас нет activity props/входа в историю; `leaveAccountsWorkspace` очищает origin. Готовый exact Back для нового входа нельзя объявлять существующим.

## Два UX-варианта

1. **Рекомендуемый:** одна прозрачная строка «В процессе · N» над «Последняя операция», с текстовым статусом/существующим status icon и удобной областью нажатия. Без сумм, агрегированного денежного итога и отдельной большой карточки. Один pending открывает его квитанцию; несколько — pending-выборку в нынешней истории. В account detail — такой же вход в scope счёта.
2. Показывать до двух pending-строк и «Все в процессе». Нагляднее при нескольких событиях, но дублирует history rows и занимает больше главной. Для маленького N1 не рекомендуется.

«Последняя операция» остаётся хронологической и самостоятельной. Если одна запись встречается в обоих блоках, это допустимо: блоки отвечают на разные вопросы. Сохранить ясный видимый контекст «Примеры и симуляции»; не придавать синтетическим pending срочность или вид реального подключения сети.

## UI/data contract

- Источник один: `view.activities`. Сначала полный scope, затем `status === pending`; не брать latest/top-N перед pending-фильтром. Общая главная охватывает все записи независимо от закреплений, текущего operation context, holdings и active/inactive/unavailable счёта. Конкретный счёт — `scopeProductActivities(activities, [accountId])`. Глобально один ID события считается один раз, даже у межсчётного/двухстороннего события.
- Projection не является ledger: не менять баланс, доступное количество, fees, charge, capabilities или статус события. `failed` — отдельный конечный результат, не включать его в «В процессе». Не добавлять новые union statuses ради этого UI.
- Добавить узкий transient запрос просмотра истории: явный scope all/account, pending filter, optional exact activity ID, origin возврата. Scope просмотра не меняет `useAccount`/`selectContext`, не выбирает источник следующего Send и не сбрасывает drafts. Не нужен новый финансовый route или URL.
- Повторно использовать историю/receipt и существующий guarded navigation/focus путь. Новый явный вход задаёт `query=""`, direction all, status pending; single ID раскрывается и получает focus. Повторный вход тоже применяется, но обычный rerender не сбрасывает ручные фильтры. Back возвращает в Overview или точную карточку счёта и её launcher; удалённая identity получает безопасный существующий fallback.
- Перед переходом проверить актуальные scope и ID. Если clicked single запись уже completed/failed, открыть её актуальную квитанцию в подходящем all-status просмотре; если удалена/неоднозначна — показать недоступность, не раскрывать другую запись. Сохранить active/session/pending guards; отказ не меняет history state, scope или origin.
- Privacy: summary не содержит сумм; счётчик остаётся видимым по нынешней семантике «Скрывать суммы». В истории/receipt использовать `getHistoryPresentation` и текущую маскировку всех money/fee/commerce/charge значений, включая aria labels; не писать raw суммы в новые title/data attributes.
- Не выводить SLA, возраст как признак просрочки, ETA/countdown, confirmations, проценты, стадию, причину pending, адрес или новый финансовый итог. Receipt может сохранить уже supplied и проверенную estimate; без неё существующая подпись «Время уточняется». Новые network/offline facts из браузера не угадывать.

## Состояния

| Входные данные | Поведение |
| --- | --- |
| ready, 0 pending | Строка отсутствует; chronological recent/history остаются. |
| ready, 1 pending | «В процессе · 1» → точная квитанция в явном scope. |
| ready, несколько | Полный count → existing History с pending-фильтром; без произвольного выбора первой. |
| loading | «Проверяем операции…»; без нуля/успеха и финансовых значений. |
| error | «Операции сейчас недоступны» + существующий retry, если supplied; не «Незавершённых нет». |
| Offline / неизвестная полнота | Отдельного supplied state нет. Ready demo не ломать из-за offline браузера; adapter error/loading отображать как выше. Не создавать новый кеш, fake offline badge или трактовать отсутствие данных как подтверждённый ноль реального API. |
| Более поздняя другая completed | Старый pending остаётся в summary/count; recent вправе показывать новую completed. |
| Та же запись стала completed/failed | Уходит из pending только по своему supplied status; остаётся в общей истории с новым результатом. N1 не удаляет события. |

Неизвестный runtime status/identity не приводить к pending/completed или нулю. Полнота, freshness, обновления и reconnect реального API требуют отдельного data-port контракта в N3; это не повод добавлять backend в N1.

## Приёмка будущего выполнения

1. Старый pending + новый completed: pending заметен на главной, chronological recent показывает completed; отсутствие лимита latest/top-N проверяется несколькими более новыми событиями.
2. Global scope включает иной счёт относительно operation context; account scope учитывает internal source/destination и commerce legs. Одно событие не считается дважды; inactive/unavailable не скрывает историю.
3. Состояния 0/1/multiple/loading/error, missing retry и отсутствие supplied ETA дают описанное поведение. Смена своего status/удаление/гонка между отображением и нажатием не раскрывают чужой ID.
4. Single/multiple вход, ранее применённый противоречащий search/status filter, повторный вход, Back и focus работают в правильном scope. Operation context, drafts и guards сохранены; отказ guard не совершает частичный переход.
5. Privacy сохраняется на summary → history → receipt, в доступном тексте и обоих commerce amounts/fees. Нет новых fake финансовых данных или live-семантики.
6. Вход читаем на 320/390/430/480px, доступен клавиатуре и touch ≥44px, имеет focus-visible; цвет не единственный сигнал. Presets/storage/фон/battery semantics не затронуты.

Будущая область: один небольшой pending-selector/entry, узкое расширение History reveal props и сцены навигации, props входа в account detail; связанные целевые проверки. Не переписывать recent, core/fixtures/financial flows или делать новый каталог операций. После завершённого Task 1 сверить его реальные interfaces. Один сосредоточенный RED/GREEN набор поведения и одна необходимая интеграционная проверка; эту подготовку не считать тестированием.

## Принятые решения и оставшиеся границы

- Summary над recent и скрытие строки при demo-ready нуле утверждены владельцем и реализованы локально. Не возвращать их в очередь как непринятые рекомендации.
- Scoped history + точный Back из карточки счёта остаются отдельным follow-up; первый N1 ограничен главной.
- Для реального API позже предоставить полноту/freshness/load/offline semantics и допустимые статусы/estimates. N1 остаётся честной demo-проекцией нынешних данных, без ожидания и имитации этого API.
