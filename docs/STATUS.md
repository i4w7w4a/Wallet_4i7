# Текущее состояние Novex

20.10.2026 — **LOCAL READY**, [примерка структуры на MONO preset2](http://127.0.0.1:3201/mono/pilot/2). CompiledSOURCE `0ea5225822bde8630018ae04d34c6bf9f6577386`, BUILD `y5Ua9obKNjjSDW6gqFPDU`; App297978e +fix9b18319. Scoped review/fix1re-review, один ORACLEtypecheck/build и rootboundedbrowser390/320/spot480 завершены. Final focused42PASS, observed affected127PASS/1FAIL отдельно, не полностью зелёный suite. [Record/проверки/ограничения](releases/2026-10-20-compact-preset2-local.md), [план](product/2026-10-20-compact-structure-pilot.md). Public Gold18.10, обычный MONO, профиль и все7appearance snapshots не обновлялись. Это read-only примерка архива preset2rev5, не автоматическая замена всех шаблонов или редактора. Вкладка оставлена на Home; ждём визуальную оценку владельца. Позднийdocscommit не меняетcompiledSOURCE/BUILD. Generated next-env imports сохранены uncommitted.

Обновлено18.10.2026: **PUBLIC_READY**, server/live/protected proof и bounded public browser QA — PASS.

## Gold #67/#68 — опубликован и bounded-browser-tested

- Главная [#67](https://github.com/i4w7w4a/Wallet_4i7/issues/67) и компактная история [#68](https://github.com/i4w7w4a/Wallet_4i7/issues/68) реализованы и приняты в app SOURCE `7d097c9cc6e1286297315c78520f341a364b35f0`; GitHub-ветка `codex/gold-history-68-20261017` сохранена.
- CI-ветка `codex/gold-ci-release-20261018`, frozen commit `495ee795eebfe62099b2b81fbe394b9473a37e2e`: [run39075514268](https://github.com/i4w7w4a/Wallet_4i7/actions/runs/39075514268) attempt1 SUCCESS, artifact12116861695, Linux BUILD `I1UEI44C23zGWp5CLNBJ4`; actual runtime Node24.22.0. App source, CI commit и будущий docs HEAD различаются.
- Прежний app full1704PASS/31baselineFAIL и final78focusedPASS не скрыты и не повторялись. Новый Linux helper suite60PASS, image build/smoke/verifier PASS; две ранние CI-попытки завершились без artifacts. [Точные identities и ограничения](releases/2026-10-18-gold-ci-public.md).
- Exact artifact принят и один раз импортирован. Concrete OCI proof связывает target manifest2624483… с исходным confige436b553…; raw config/manifest и все7layers SHA256/size/order совпали с tar. Producer ID/Size не переписывались; typed identities и proof SHA — в release record.
- ORACLE опубликовал exact app7d/CI495/BUILD выше в03:52:41МСК18.10 (`00:52:41.357643Z`):1Gold recreate,0rollback/extra loads/compiles/pulls/retags.23assets/канонический RSC/runtime и fresh live/protected proof PASS; MONO/13соседей/Caddy/shared Compose/27files9dirs/ревизии2/5/3/3/2/2/2 сохранены, rollback5a1 retained.
- Client launcher закончил `SSHException`/UNKNOWN exit, **не exit0**; причина timeout не доказана. Server PUBLIC_READY установлен поздним bound retained result/финальной RO reconciliation и independent live proof, не успешным возвратом клиента; [точная provenance и прежние holds](releases/2026-10-18-gold-ci-public.md) сохранены.
- Actual public Home/History320/390/480, Funds→Assets ALL, account pending/history/receipt Back context, filters/search/empty reset, privacy/ARIA/restore — PASS. Menu→«Мои счета» в scrolled History: locator и Tab→Enter PASS, physical/native pointer UNVERIFIED; старая local ambiguity не воспроизведена. Console0errors/0warnings,28resources без root `/_next` leak, begin/end manifest/HTML BUILD стабильны. Root просмотрел representative Home390/320 и History390/320-scrolled. Это bounded QA, не device/backend/FPS/UTC-commerce certification. #67/#68 заново не назначать; default merge/PR не выполнялись.
- Известная неблокирующая полировка — focus на BODY после empty-state reset; отложена, не смешивать с прошедшими receipt/pending return focus checks.
- Local3200/app7d/BUILD `QRyLETrp06HQFieBvNd-u` сохранён. Приложение, MONO, профиль, семь presets и финансовые команды этой CI/docs-дельтой не менялись.

Сведения о публичной версии13.10 и синхронизации17.10 ниже сохраняют датированный исторический срез. Docs-only commit этой записи не меняет app SOURCE/CI commit/manifest/BUILD; точный docs SHA виден в истории ветки.

## Публичные точки

| Назначение | Адрес |
|---|---|
| Gold — клиентский показ | https://wallet.153.76.194.160.nip.io/gold |
| MONO — основная сцена/лаборатория | https://wallet.153.76.194.160.nip.io/mono |
| Visitor-пример | https://wallet.153.76.194.160.nip.io/p/2 |
| Boost — отдельная демонстрация | https://wallet.153.76.194.160.nip.io/concepts/boost-preview/ |

Текущий согласованный сервер — 153.76.194.160. Старые записи о других VPS остаются историей и не задают новый маршрут публикации.

## Исторический публичный Gold13.10 — до выпуска #67/#68

- Выпуск: 13.10.2026, 09:00:25 МСК.
- SOURCE: `5a1b14a8ffe79089b401c1d124b03d7343a9ee47`.
- Linux BUILD_ID: `Xx9rfwp9P2rZz8ufeDuQP`.
- [Публичный manifest](https://wallet.153.76.194.160.nip.io/gold/source-manifest.json) повторно сверён 16.10.2026.
- Последний известный docs HEAD рабочей интеграции: `81a9d1b`, ветка `codex/profile-client-integration-20261013`. Поздняя документация не меняет compiled SOURCE.

Профиль #66 опубликован поверх полного Gold: общие имя/аватар, формы контактов с Save/Cancel, риск-тест, четыре экрана безопасности и документы сервиса. Контакты/ответы только в памяти демосессии; reload очищает изменения. Документы, вопросы и реальные security actions ожидают материалов/подключения.

Счета, активы, demo Receive/Send/перевод на свой счёт/Buy/Swap, история/квитанции, pending/возвраты, Menu/Support уже существуют. Тема неактивна. Общий баланс — оценка активов, не единый доступный остаток отправки. Реальный backend не подключён.

Проверки прежних выпусков были ограничены их изменениями. Полная приёмка всех физических устройств, всех семи оформлений, FPS и backend не заявляется.

## Исходники GitHub — синхронизация 17.10.2026

Код полного Gold с профилем перенесён из принятой рабочей версии `81a9d1b` поверх GitHub `2d1078b` в `codex/source-sync-20261017`. Исполняемые файлы `apps`, `packages`, scripts и зависимости совпадают с опубликованным SOURCE `5a1b14a`. Документация, текущий план и архив оформлений обновлены отдельно. [Состав и проверка](releases/2026-10-17-github-source-sync.md).

Использован один снимок отслеживаемых файлов, без переноса всей цепочки локальных рабочих коммитов. Сохранены документационные изменения уборки16.10. Локальная история принятой версии остаётся в прежней ветке. Новый commit синхронизации имеет собственный SHA и не подменяет manifest работающего сайта.

[Задача #43](https://github.com/i4w7w4a/Wallet_4i7/issues/43) включает актуальную [передачу React](product/react-frontend-handoff.md) и [карту состояний](product/product-state-map.md). Исторический PR #57 (`dfe8c51`) заменён новым полным срезом; ветка сохраняется. Публичные Gold/MONO и серверные данные не изменяются этой синхронизацией.

Семь текущих публичных appearance snapshots сохранены в [архиве17.10](../checkpoints/mono-published/2026-10-17/README.md). Архив02.10 также сохранён. Это снимки оформления, а не выгрузка кошельков или резервная копия серверной истории; автоматического восстановления поверх живых ревизий нет.

## Что изменено при уборке GitHub

- #40 — единый актуальный индекс, прежние описания сохранены свёрнутыми.
- #67/#68 — выбранные направления главной и истории, пока без реализации.
- #69 — ожидаемые поля квитанций и материалы сервиса.
- #42/#58 — реальные оставшиеся вопросы по boost и резкости.
- #59/#10/#2 — отложенные задачи, без ложной отметки completed.
- #60 — закрытое сравнение старых A/B/C; заменено #67.
- PR #24/#25/#26 закрыты без merge: их heads уже входят в исходную default-линию.
- PR #28 закрыт как заменённая координация #27; его уникальные docs-коммиты сохранены в head-ветке.
- PR #3 сохранён Draft: два уникальных docs-коммита и остаток #2 ещё не интегрированы.
- PR #57 был сохранён Draft до source catch-up; заменён синхронизацией17.10.

Ветки, обсуждения и исходные доказательства сохранены. GitHub Discussions у репозитория отключены; отдельных Discussions для чистки нет.

## Источники статуса

[Профиль #66](https://github.com/i4w7w4a/Wallet_4i7/issues/66), [план #40](https://github.com/i4w7w4a/Wallet_4i7/issues/40), публичный manifest и датированные release/handoff-записи текущей рабочей интеграции. Приватные исходные разговоры, записи встречи и скриншоты в репозиторий не переносились.
