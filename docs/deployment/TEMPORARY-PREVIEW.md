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

Для отката проверить наличие предыдущего image и его **фактического** Compose
в сохранённом release (он может отличаться от нынешнего шаблона), затем выполнить
`docker compose -f /opt/wallet-mono/releases/<previous>/deploy/compose.preview.yaml up -d --no-build --wait`
только если это подтверждённый путь, с соответствующим `WALLET_RELEASE_TAG`.
Не делать `docker system prune`, не
удалять чужие тома и не перезагружать `dlc-dm`.

Ни один пароль, ключ, cookie или содержимое Caddyfile не должен попадать в Git,
release-архив либо отчёт. `wallet.ru.net` не является подтверждённым доменом
владельца и не нужен для этого preview.

## Фактический релиз 2026-09-17

- Source commit: `45ea860`; release/image tag: `20260917T200319Z`.
- Source tar SHA-256:
  `304b101f2a3cc48f5cd43d7d2717e669637e0588eb1068f52f80f893accef775`.
- Linux build tar.gz SHA-256:
  `ea54d35dc772192635a0bf8179378b6529c15b07f08172087e38f4024c5ca48f`.
- Image ID:
  `sha256:16ed9f7e30bce0eedc1e8a9fcf5d9a9b8ef31a9a9be70a467fe38c744127204c`.
- Предыдущий рабочий image tag для отката: `20260917T165747Z`. Его
  `/opt/wallet-mono/releases/20260917T165747Z/deploy/compose.preview.yaml`
  существует на VPS и был источником предыдущего контейнера; старый image
  перед переключением проверен через `docker image inspect`.
- Проверено: container healthy, нет host-порта; из Docker gateway-сети `/` и
  `/mono` — `200`; публичные HTTPS `/` и `/mono` — `200` с TLS verify `0`;
  `/api/skin-presets` — ожидаемый `503`. В браузере палитра включается,
  `Дуэт` выбирается, 320/390/430/480 px в Dark/Light не имеют overflow,
  один canvas, ошибок страницы и failed requests нет.
- Старый `https://dlc.ru.net/` и прямая админка `127.0.0.1:5174` остались
  `200`; SHA-256 Caddyfile до/после совпал. DNS и Caddy не менялись.
