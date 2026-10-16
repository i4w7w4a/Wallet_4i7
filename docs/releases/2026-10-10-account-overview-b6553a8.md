# MONO — общий обзор и закрепления справа, 10.10.2026

**Опубликовано 10.10.2026 в 05:06:01 МСК / 02:06:01 UTC.** Контейнер healthy; публичный и контейнерный manifest совпали с frozen candidate.

[MONO](https://wallet.153.76.194.160.nip.io/mono) · [Кошелёк без редактора](https://wallet.153.76.194.160.nip.io/p/2) · [Live manifest](https://wallet.153.76.194.160.nip.io/source-manifest.json).

## Что вошло

- Главная показывает общий обзор всех счетов: оценку, активы, график и последнюю операцию. Явный рабочий контекст существующих операций сохраняется.
- Крупный общий итог слева и до двух компактных закреплений групп счетов справа, с более плотной композицией ближе к центру.
- В «Моих счетах» можно выбрать 0/1/2 закрепления; третий выбор получает явное ограничение. Группы используют существующие типы счетов и точные расчёты. Отсутствующая или неоднозначная оценка не превращается в ноль.
- Закрепление открывает группу и затем конкретный счёт для просмотра. Оно не переключает скрыто источник операций. Back возвращает к той же строке и закреплению с восстановлением фокуса.
- Выбор закреплений хранится в отдельной версионированной viewer preference `wallet4i7.mono.home-pins.v1`, с allowlist и безопасным чтением при SSR/storage errors. Семь оформлений и их история не служат хранилищем этой настройки.
- Privacy охватывает общий итог, закрепления, график и последнюю операцию. Существующие account/asset/network guards, draft, pending/session и принятая демонстрация Send/receipt сохраняются.

**Не вошло:** следующий этап N1 «В процессе · N», новые финансовые правила/типы продуктов, реальные перевод/signing/backend, DB, зависимости, перепубликация или миграция снимков, V1, concepts, DLC, DNS/Caddy/gateway, GitHub push/merge/default rewrite. Отложенный дубликат на сервере 213 не проверялся и не разворачивался.

## Точная версия

| Поле | Значение |
| --- | --- |
| Runtime Git SHA | `b6553a8fdb2adcc56968876f4d74e20f47b749d9` |
| Предыдущий docs-only BASE | `0872b35517680cbec9ab30f07027f872c2f899e2` |
| Image tag | `novex-wallet:20261010T013812Z-b6553a8` |
| Image ID | `sha256:e24daeacfd1da2ed4bc40d82d97a93f1e3e587f14567eebe52011dd42d14185d` |
| Linux BUILD_ID | `xld_VnUkY30KN22KwzkPy` |
| Windows preview BUILD_ID | `nxof7ckPh8KetWoE7FFJ1` |
| Container ID | `b9961c519c9ed05514eb3c93d0e099893b5b7008333f02f38a67ae5837c2a04a` |
| Source archive | 984 committed files; SHA-256 `d0d014957ecaf4fcd9619144447f3b55fcda49b11956c89e79c8e2debe84b6b5` |
| Health | healthy |

Один Windows build и один Linux build. Linux builder и offline permission finalizer завершились с exit 0 без OOM; оба без mounts. Готовый image проверен offline под UID 1000 (`node`), с точным source manifest, production environment и Linux BUILD_ID. После остановки из-за соседнего Caddy drift сборка и упаковка не повторялись: использован тот же проверенный candidate.

Локальный managed production preview: `http://127.0.0.1:3184/mono`, exact source b6553a8; запуск и отдельный durable status подтверждены. Это локальный preview, а не публичная публикация.

## Проверки и пределы утверждения

- Переиспользованы финальные targeted gates автора на b6553a8: пять файлов / 43 теста PASS и miniapp typecheck PASS. Targeted spec/quality review root принят без Critical/Important. Gates не запускались повторно сборщиком.
- Root дал visual/public GO после bounded локальной проверки 480/390/320: общий итог и правая колонка; Depositary pin → group → Vault/account → Back к той же строке → Back с фокусом на pin; рабочий контекст оставался общим. Privacy охватила новые закрепления и общую главную.
- На 320 px длинное название группы переносится с отдельной последней буквой. Перекрытия и горизонтального overflow нет; root принял выпуск, полировка отложена. Исходники не изменялись после freeze.
- Live manifest HTTP 200 совпал с candidate и контейнером. `/` HTTP 307 → `/mono`; `/mono`, `/p/2`, `/concepts/` HTTP 200. API слота 2 сохранил revision 5 и точный raw SHA-256; public origin не изменился.
- Семантическая Compose-проверка доказала изменение только `services.mono.image`. Mounts совпали с предыдущим контейнером. Данные/история, UID/GID/mode файлов и каталогов, Caddy, identities соседних контейнеров и concepts pointer/HTML сохранились относительно нового preflight. DLC HTTP 200.
- **Публичный bounded browser smoke root — PASS**: свежая фоновая вкладка `https://wallet.153.76.194.160.nip.io/p/2`, чистый visitor без editor rails; новая общая сумма и две группы видны; `main.clientWidth = main.scrollWidth = 480`. Screenshot: `.superpowers/sdd/2026-10-10-account-overview-plan/public-overview-b6553a8.jpg`. Это отдельная публичная проверка после подтверждённого switch.

Полный browser matrix семи пресетов, physical touch и hardware FPS не заявляются. Дополнительные проверки сборщиком ради публичного smoke не запускались.

## Соседний R1 и остановка guard

Первый switch остановился **до изменения Compose/MONO**: между backup и switch Caddy SHA-256 изменился с `5ab8ea22f51239fa5bad27fe4e4faa017a79c4d251bcf86fbd555d5a5051d918` на `c28d5921509e1457013c4452150774bae9d744bdc5ed77946a6590cbb0b0b194`.

Exact diff — добавление 12 строк в существующий site `app.4-i-7.ru`: `/r1` с сохранённым URI проксируется на `172.18.0.1:8794`; прежний root/API proxy `8793` сохранён. Wallet route, Compose и MONO container/image/runtime/mounts не изменились.

Root установил ownership read-only: «4i7 — i» (`01a0ffbe-0c2a-7733-afad-3e1325424798`) поручил gateway владельцу «Подготовить перенос сервера DLC.ru» (`01a0f12f-7082-7250-8dd9-fbef45ad06ec`), turn `01a12360-210a-7503-bd90-e69753870f80`. Владелец подтвердил свой R1 change и reload; root разрешил новый baseline с сохранением соседней работы.

Создан отдельный неизменяемый `preflight-20261010T020244Z`, прежний backup не перезаписан. Guard остался включённым и использовал согласованный новый fingerprint. Итоговый Caddy SHA-256 **`c28d5921509e1457013c4452150774bae9d744bdc5ed77946a6590cbb0b0b194`** сохранился побайтно. ORACLE не редактировал и не перезагружал Caddy/R1.

## Данные и rollback

Новый полный backup снят **10.10.2026 в 05:04:43 МСК / 02:04:43 UTC**, после готовности candidate и подтверждения ownership, до switch. Приватная локальная копия независимо проверена. Все **27 файлов и девять каталогов**, bytes/UID/GID/mode совпали до и после; ревизии **2/5/3/3/2/2/2**. Backup SHA-256 **`a19b0ae56be9a346e08a4e83089448d2c270f4468152e888cb9819e57d253090`**. Совпадение с прежним hash отражает неизменные данные; это новый capture.

Точка отката:

- Git SHA `3ad6c299c94d628a2e4a895d741fe9ed5c533e2f`.
- Image `novex-wallet:20261009T102202Z-3ad6c29`.
- Image ID `sha256:7058ffebd636cb711d120cff66500aaf57180d1b1be48d9a788b89f69f02920d`.
- Сохранённый Compose: `/opt/novex/releases/20261010T013812Z-b6553a8/preflight-20261010T020244Z/compose.before.yaml`.

Image rollback сохраняет текущий том публикаций и соседний R1. Data restore требует отдельного явного решения.

Protected evidence:

- `C:/Users/iwwa/.novex-ops/releases/20261010T013812Z-b6553a8/` и `/opt/novex/releases/20261010T013812Z-b6553a8/`: исходный archive, candidate, build/packaging logs, первый backup и точный drift record.
- Подкаталог `preflight-20261010T020244Z` с обеих сторон: новый packet/baseline, полный backup, локальная verification gate, сохранённый Compose, switch plan и confirmed deployment handoff.
- Локальный backup: `C:/Users/iwwa/.novex-ops/releases/20261010T013812Z-b6553a8/preflight-20261010T020244Z/mono-published.before.tar.gz`.

Секреты и protected конфигурация в Git не включались. Foreign `next-env.d.ts` и UX icons audit сохранили прежние raw SHA-256; правки root в AGENTS/product docs не перезаписывались.

## Runtime и документация

Image собран из frozen **b6553a8** до создания этой записи. Release note и последующий docs-only Git HEAD не входят в image и не означают новый deploy. Root завершил публичный visual smoke и отдельно выполняет документационный commit; N1 начинается после завершения этого handoff как отдельная локальная работа. ORACLE новую source/build волну не запускает.
