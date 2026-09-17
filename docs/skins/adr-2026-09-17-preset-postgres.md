# ADR: PostgreSQL для библиотеки MONO-пресетов

Статус: принято для Palette Lab V1, 2026-09-17.

## Решение

Серверная библиотека живёт в отдельной БД PostgreSQL. Next Route Handlers вызывают
service/repository слой; UI не знает SQL и не получает secret owner. Используем ровно
одну новую runtime-зависимость: `postgres@3.4.7` (Postgres.js, Unlicense, без
транзитивных runtime dependencies). Источник: <https://github.com/porsager/postgres/tree/v3.4.7>.
Альтернативы: `pg` — зрелый, но тяжелее по графу зависимостей; собственный wire
client — неоправданный риск. Новых ORM и миграционных фреймворков нет.

Пресет — UUID + случайный 192-битный URL-safe slug. Имя может повторяться.
`unlisted` по умолчанию: чтение по ссылке доступно любому, каталог публичных
пресетов не включён без rate limiting и moderation. Ревизия содержит полный
строго проверенный envelope и SHA-256 content hash; БД запрещает UPDATE/DELETE
ревизий. Изменения идут новой ревизией с optimistic concurrency. Удаление
помечает preset, не стирая историю. Fork создаёт новый ID и owner.

Анонимный owner — UUID + 256-битный cookie-secret. На сервере хранится только
salted `scrypt` hash (N=16384, r=8, p=1); сравнение через `timingSafeEqual`.
Cookie `HttpOnly`, `SameSite=Lax`, `Secure` в production, ограничена
`/api/skin-presets`. Потеря cookie не даёт права изменять старый preset; перенос
через JSON export остаётся безопасным fallback до account binding.

Контейнер БД подключён только к `preset-data` (`internal: true`), без `ports`,
с постоянным volume и healthcheck. `POSTGRES_PASSWORD` обязателен через private
deploy `.env`; пустое значение останавливает Compose. Миграция 001 идемпотентна.
Docker initdb запускает её только на пустом volume; для существующего volume
оператор выполняет тот же SQL отдельно после backup. Production deployment этого
ADR сам по себе не производит.

Граница: payload принимает лишь `MonoPalettePresetV1` после size, shape,
normalization и SHA-256 validation. Ни CSS, HTML, JS, URL, font source, shader,
wallet data, ни секреты не хранятся. Клиентский `Save` явный; slider не пишет БД.

API находится только под `/api/skin-presets`: собственный список, создание,
чтение по slug, новая ревизия с expectedRevision, история, fork и soft delete.
Записи требуют JSON, совпадения Origin и ограничены по размеру. На owner действует
лимит 30 новых ревизий за скользящий час (429 + `Retry-After`); список и чтение
не расходуют лимит. Лимит по owner не заменяет gateway/IP-защиту: очистка cookie
создаёт нового owner. Перед широким публичным запуском записи gateway обязан
ограничивать создание новых анонимных owner по доверенному исходному IP, а
каталог `public` остаётся выключенным до отдельной модерации.

Проверки: service tests с memory repository, SQL-port tests для параметров и
транзакций, API contract tests, typecheck/build. Без Docker/PostgreSQL на локальной
Windows-машине настоящую DB-транзакцию и Compose ещё нужно проверить в staging;
это явный deployment gate, а не основание трогать работающий сайт.
