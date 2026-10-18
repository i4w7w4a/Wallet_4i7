# Ближайший план Novex

Обновлено18.10.2026 после PUBLIC_READY и bounded public browser QA. Единая рабочая карта — [#40](https://github.com/i4w7w4a/Wallet_4i7/issues/40).

## Выполненный выпуск и следующая очередь

| Порядок | Задача | Результат |
|---|---|---|
| Выполнено | [Главная #67](https://github.com/i4w7w4a/Wallet_4i7/issues/67) | Опубликована18.10; actual Home390/320/480 и Funds→Assets ALL PASS |
| Выполнено | [История #68](https://github.com/i4w7w4a/Wallet_4i7/issues/68) | Опубликована в7d; History320/390/480, filters/search/privacy/receipt/returns и scrolled Menu→«Мои счета» locator/keyboard PASS |
| Параллельно | [Материалы #69](https://github.com/i4w7w4a/Wallet_4i7/issues/69) | Поля по видам операций, документы сервиса, риск-тест, постоянные контакты |

Синхронизация исходников и техническая передача #43 выполнены отдельным срезом17.10: полный Gold с профилем, актуальные handoff/state-map и архив семи опубликованных оформлений. [Запись](releases/2026-10-17-github-source-sync.md). Публичная сборка осталась прежней.

Главная и история реализованы, приняты и опубликованы; не назначать их заново. App SOURCE `7d097c9` сохранён в GitHub; CI commit `495ee795` дал [SUCCESS39075514268](https://github.com/i4w7w4a/Wallet_4i7/actions/runs/39075514268) и immutable artifact12116861695. [Release record с exact identities](releases/2026-10-18-gold-ci-public.md). Новая упаковка не меняет приложение или модель счетов.

Exact artifact уже принят и импортирован один раз; actual153 typed OCI proof подтвердил target manifest2624483…→confige436b553… и все7layers SHA256/size/order. Это не новая сборка и не повод переписывать ready IDs/Size или повторять import/RCA.

**PUBLIC_READY:** ORACLE server proof18.10 в03:52:41МСК для app7d/CI495/BUILD `I1UEI44C23zGWp5CLNBJ4` принят root, bounded public QA PASS со стабильными begin/end identities и console0errors/0warnings. Один Gold recreate,0rollback/extra image load/compile/pull/retag; MONO/семь datasets/history/13соседей/proxy сохранены. Client launcher SSHException/UNKNOWN exit не переписан как exit0; прежние holds и пределы — в release record.

Выпуск#67/#68 завершён в указанном scope, не повторять implementation/CI/import/deploy/QA без новой дельты. Physical/native pointer остался UNVERIFIED; locator/keyboard PASS не означает проверку устройства/backend/FPS/UTC-commerce. Docs-only commit не новая сборка; default merge/PR не выполнялись. Принятые local3200/QRy, rollback5a1 и прежние outputs сохраняются. Следующие содержательные задачи — материалы#69 и уже перечисленные needs-info/deferred, не автоматическое новое поручение.

Неблокирующий focus detail после empty-state reset (BODY) сохранён как отложенная полировка; receipt/pending return focus прошёл. Это не новое автоматическое назначение и не повторная реализация#67/#68.

В истории inline-квитанция сохранена. Новый контейнер подробностей и состав полей не входят в этот CI/public выпуск; материалы ожидаются в#69. Baseline31app FAIL, final78focusedPASS и60CI-helperPASS учитываются отдельно, не как один полностью зелёный suite.

## Ожидают информации

| Задача | Чего не хватает |
|---|---|
| [Boost #42](https://github.com/i4w7w4a/Wallet_4i7/issues/42) | Смысл услуги, применимость, стоимость, состояния и подтверждённые данные |
| [Остаточная резкость #58](https://github.com/i4w7w4a/Wallet_4i7/issues/58) | Один конкретный экран/шаг и условия воспроизведения |
| [Материалы #69](https://github.com/i4w7w4a/Wallet_4i7/issues/69) | Содержание, обещанное для наполнения уже готовых экранов |

Отдельная boost-примерка уже опубликована. Это не признак ускорения существующих платежей. Отсутствие содержания документов или анкеты не требует повторно создавать профиль.

## Отложены

- [Полный общий Light5 #59](https://github.com/i4w7w4a/Wallet_4i7/issues/59): нужен точный образец и политика редактора.
- [Telegram на физическом устройстве #10](https://github.com/i4w7w4a/Wallet_4i7/issues/10): ограниченный host/device проход после выбора среза.
- [Workflow docs и шаблоны #2](https://github.com/i4w7w4a/Wallet_4i7/issues/2): полезные остатки Draft PR #3.

## Как читать статусы

- `status:planned` — следующий этап, ещё не запущенная реализация.
- `status:needs-info` — нужны материалы, воспроизведение либо конкретное решение.
- `status:deferred` — сохранено вне ближайшей очереди.
- `status:tracking` — индекс работ, не отдельная функция.

Один небольшой законченный срез → затронутые проверки → локальная визуальная оценка → согласованный выпуск через ORACLE. Семь presets, одобренные материалы, реальные финансовые правила и личные данные сохраняются. API подключает backend-разработчик позднее.

Старые A/B/C сохранены как отдельные примерки; их сравнение #60 закрыто в пользу #67. Закрытие архивного PR не означает его новый merge. [Подробное текущее состояние](STATUS.md).
