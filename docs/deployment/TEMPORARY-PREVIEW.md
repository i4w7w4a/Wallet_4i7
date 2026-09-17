# Обновление временного MONO-адреса

Временный адрес: `https://wallet.135.181.70.158.nip.io/mono`. Это отдельный
preview-релиз `wallet-mono`, не перенаправление чужого сайта. На VPS Caddy уже
имеет точный block для этого host и направляет его на alias
`wallet-mono-app:3000` в сети `dlc-dm_default`. При обычном обновлении **не
менять** Caddyfile, DNS, Compose `dlc-dm`, его тома или сертификаты.

Предназначение: визуально оценивать `/mono` на реальном телефоне. В
[`compose.preview.yaml`](../../deploy/compose.preview.yaml) нет PostgreSQL и
host-порта. Локальные пресеты браузера/JSON работают; серверная запись в
`/api/skin-presets` намеренно отвечает `503`. Это не полноценный rollout базы
пресетов. Для него действует отдельный [runbook](README.md): сначала staging с
реальной БД, проверка миграции/backup/restore и ограничение новых анонимных
владельцев. Не подменять preview-конфиг полным `compose.yaml` вслепую.

## Повторяемый порядок

1. В рабочем дереве завершить тесты, проверку типов, lint и production build;
   зафиксировать commit. Паковать **точный commit**, а не произвольную папку с
   `node_modules`, `.env` и локальными ключами. Состав source-архива и его
   SHA-256 записать рядом; в нём должны быть текущие `deploy/`, миграция
   `001_skin_presets.sql`, `pnpm-lock.yaml` и приложение.
2. В чистом Linux x86_64 builder с Node ≥24 и pnpm 10.33.2 проверить архив,
   выполнить `pnpm install --frozen-lockfile` и `pnpm -r build`. Убедиться в
   `apps/miniapp/.next/BUILD_ID` и Linux `node_modules`. Передать на VPS
   source-архив и Linux build-архив с отдельными SHA-256; после проверки
   извлечь их только в новый `/opt/wallet-mono/releases/<unique-tag>`.
3. Прежде чем менять контейнер, снять свежий baseline:
   `https://dlc.ru.net/`, `http://127.0.0.1:5174/`, точный временный адрес,
   Docker gateway mount/network и текущий wallet image tag. Если состояние
   отличается от ожидаемого, разобраться до переключения.
4. Собрать только runtime image по `deploy/Dockerfile.prebuilt`. На старом
   Docker builder использовать проверенный trap/restore `.dockerignore` из
   [runbook](README.md#2-проверенный-release-и-образ), причём только внутри
   нового release. Проверить image ID. Запустить
   `docker compose -f deploy/compose.preview.yaml up -d --no-build --wait`
   с новым `WALLET_RELEASE_TAG`; project name остаётся `wallet-mono`.
5. Проверить `/` и `/mono` из gateway-сети, затем публичные HTTPS `/mono`,
   CSS/JS, четыре ширины телефона, Dark/Light и ошибку консоли. Сравнить
   старый сайт и порт админки с baseline. Дополнительно убедиться, что у
   preview нет опубликованного host-порта и что Caddyfile не изменился.

Для отката найти сохранённый предыдущий release/image tag и выполнить
`docker compose -f /opt/wallet-mono/releases/<previous>/deploy/compose.preview.yaml up -d --no-build --wait`
с соответствующим `WALLET_RELEASE_TAG`. Не делать `docker system prune`, не
удалять чужие тома и не перезагружать `dlc-dm`.

Ни один пароль, ключ, cookie или содержимое Caddyfile не должен попадать в Git,
release-архив либо отчёт. `wallet.ru.net` не является подтверждённым доменом
владельца и не нужен для этого preview.
