# Изолированный деплой Wallet_4i7 на существующий VPS

Для уже действующего временного `wallet.135.181.70.158.nip.io` использовать
[отдельную процедуру preview-обновления](TEMPORARY-PREVIEW.md). Она не требует
новой правки Caddy/DNS и не включает серверную запись пресетов.

> **Palette Lab V1, 2026-09-17.** Ниже описан прежний release-процесс; архив
> `wallet-mono-source.tar` из него снят до появления библиотеки пресетов и не
> содержит нынешний код/миграцию. Для новой версии нужен свежий полный release
> snapshot и отдельная PostgreSQL БД. Не запускать старые команды с прежним
> архивом, не изменять действующий `dlc-dm`. Новый Compose требует приватный
> `WALLET_POSTGRES_PASSWORD`; без него запуск намеренно останавливается.

## Дополнение: библиотека пресетов

Новый `deploy/compose.yaml` добавляет только `preset-db` во внутреннюю сеть
`preset-data` без `ports:`. Приложение остаётся в прежнем отдельном проекте и
подключается к существующей gateway-сети только для маршрута `wallet.ru.net`.
Секрет БД создаётся заново и хранится в приватном `deploy/.env` конкретного
release (`chmod 600`), не в Git, исходном архиве, командной строке или отчёте.
Шаблон — [`deploy/.env.example`](../../deploy/.env.example). Перед `up` выполнить
`docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet`;
не выводить полный `config` вместе с секретом в журнал.

На **пустом** volume `preset-db-data` образ PostgreSQL выполняет
[`001_skin_presets.sql`](../../deploy/postgres/migrations/001_skin_presets.sql)
через initdb. На существующем volume initdb повторно не выполняется: перед
обновлением снять проверенный backup БД, затем применить новую миграцию отдельно
внутри контейнера и проверить её схему. Не удалять volume ради повторного
запуска миграции. Проверка staging обязательна: owner-cookie, Save/Revision/Fork,
чтение по ссылке, конфликт ревизии, отсутствие host-порта БД, healthcheck и
сохранность данных после перезапуска. Пока staging с реальным PostgreSQL и
ограничение новых анонимных владельцев на gateway не проверены, публичные
серверные записи считать **не готовыми к rollout**. `/mono` с локальными
пресетами продолжает работать без БД; `/api/skin-presets` без конфигурации
закрывается ответом 503, а не временным хранилищем.

Это повторяемая процедура для Ubuntu 24.04, Docker 29.1.3 и действующего Caddy 2.10. Перед каждым запуском сверять фактическое состояние VPS, а не считать описанный baseline вечным. Цель — показать текущие `/` и `/mono` на `wallet.ru.net`, не меняя работающий сайт `dlc.ru.net` и админку (прямой порт `5174`). Маршрут `admin.dlc.ru.net` есть в Caddy, но публичный DNS этого имени сейчас отвечает NXDOMAIN; не считать его доступным HTTPS endpoint. Приложение пока демонстрационное, не банковский production-сервис.

Существующий проект `dlc-dm` остаётся в `/opt/dlc-dm/app/compose.yaml`. Новый проект `wallet-mono` живёт отдельно в `/opt/wallet-mono/releases/<release-id>`. Единственная общая поверхность — уже существующая внешняя Docker-сеть `dlc-dm_default` и **один точный** новый site block в примонтированном Caddyfile `/opt/dlc-dm/app/deploy/Caddyfile`. Ни существующий Compose, ни `PUBLIC_HOST`, ни старые маршруты не переписываются. У нового контейнера **нет опубликованного host-порта**: Caddy обращается к `wallet-mono-app:3000` внутри сети. Старое предположение о `127.0.0.1:<порт>` в [предварительном задании](agent-assignment.md) заменено этой схемой после осмотра реального стека.

## Файлы и условия

- [`deploy/Dockerfile`](../../deploy/Dockerfile): Node 24 (Debian/glibc), pnpm 10.33.2, `pnpm -r build`, затем Next 16 Node runtime под непривилегированным пользователем `node` (`next start -p 3000 -H 0.0.0.0`). Это не статический экспорт.
- [`deploy/Dockerfile.prebuilt`](../../deploy/Dockerfile.prebuilt) и его Dockerfile-specific ignore: лёгкая упаковка **уже собранного в Linux** дерева с `node_modules` и `.next`; не запускает install/build на VPS. На старом Docker builder использовать описанный ниже совместимый путь с временной подменой корневого `.dockerignore`.
- [`deploy/compose.yaml`](../../deploy/compose.yaml): отдельное имя проекта, healthcheck `/mono`, внешняя сеть, без `ports:` и без секретов.
- [`deploy/Caddyfile.wallet.snippet`](../../deploy/Caddyfile.wallet.snippet): только `wallet.ru.net`; сам по себе файл Caddy не меняет.
- [`.dockerignore`](../../.dockerignore): для стандартного Dockerfile локальные зависимости, сборки, `.env` и логи не попадают в build context; prebuilt-Dockerfile использует собственный ignore и сохраняет Linux `node_modules`/`.next`.

Подтверждённый новый apex — `wallet.ru.net`. По состоянию, переданному владельцем для этой редакции, его авторитетные серверы — `ns1.nameself.com` и `ns2.nameself.com`, а apex не имеет ни `A`, ни `AAAA`. Планируемое изменение — создать только `A wallet.ru.net = 135.181.70.158`; `AAAA` не создавать. Это зафиксированный исходный ориентир, а не замена read-only preflight: перед реальным изменением заново проверить авторитетные ответы и остановиться, если они отличаются.

Перед реальным исполнением владелец подтверждает свежий полный release snapshot, способ доставки, доступ к зоне, обслуживаемой указанными NS, и окно изменений. Старый архив/образ не содержит Palette Lab и миграцию БД; использовать его для новой версии нельзя. Ранее раскрытые пароли не помещать в архив, Git, команды или отчёт. Демо-интерфейс работает без секретов, но серверная библиотека требует отдельный `WALLET_POSTGRES_PASSWORD`; до проверки staging и ограничений анонимных владельцев её публичный rollout запрещён.

## 1. Read-only preflight и baseline

На VPS проверить сеть и работающий gateway. Ничего из старого проекта не останавливать:

```sh
docker version
docker compose version
docker network inspect dlc-dm_default --format '{{.Name}}'
docker compose -f /opt/dlc-dm/app/compose.yaml ps
docker inspect dlc-dm-gateway-1 --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
docker inspect dlc-dm-gateway-1 --format '{{json .NetworkSettings.Networks}}'
sha256sum /opt/dlc-dm/app/deploy/Caddyfile
free -h
df -h / /opt
docker system df
```

Убедиться, что `/opt/dlc-dm/app/deploy/Caddyfile` действительно примонтирован в gateway как `/etc/caddy/Caddyfile`, а gateway подключён к `dlc-dm_default`. Если это не так, **остановиться** и адаптировать команды после нового review. Проверить, что в Caddyfile нет уже существующего блока `wallet.ru.net` и что его текущие `{$PUBLIC_HOST}`/админские блоки остаются нетронутыми. Сам Caddyfile и реальные адреса не копировать в репозиторий.

Сохранить коды и TLS-результаты в личном журнале работ, затем сравнивать теми же командами после каждого этапа:

```sh
curl -sS -o /dev/null -w 'site %{http_code} TLS=%{ssl_verify_result}\n' https://dlc.ru.net/
curl -sS -o /dev/null -w 'admin-local %{http_code}\n' http://127.0.0.1:5174/
```

Известный baseline на момент подготовки: оба endpoint отвечали `200`, у сайта TLS verification — `0`. Публичный `admin.dlc.ru.net` — NXDOMAIN; не пытаться «чинить» его DNS в рамках этой работы. При расхождении выяснить причину до изменений. Проверить авторитетные `NS`, `A`, `AAAA`, `MX`, `TXT`, `CAA` нового домена и записать исходные **точные RRset** для отката. Не менять `NS`, `MX`, `TXT` или записи старого домена. Если `CAA` запрещает выпуск сертификата Caddy, остановиться и согласовать точечное изменение отдельно.

```sh
dig +short NS wallet.ru.net
dig +short A wallet.ru.net
dig +short AAAA wallet.ru.net
dig +short MX wallet.ru.net
dig +short TXT wallet.ru.net
dig +short CAA wallet.ru.net
```

## 2. Проверенный release и образ

Использовать **полный проверенный архив** текущего worktree с манифестом и SHA-256: `wallet-mono-source.tar`, `source-manifest.json` (schema 1, `archiveSha256`, `files[]`) и `SHA256SUMS.txt`. В исходный архив входят `/mono` и локальные ассеты, но не входят `.env`, ключи, пароли, `node_modules` и build output. Он был снят **до** добавления этих deployment-шаблонов, поэтому его 191 файл **не включают** `deploy/` и `.dockerignore`. Их нужно доставить отдельно проверенным маленьким архивом; одного source tar для запуска недостаточно. Не пересобирать «примерно ту же» ветку.

На доверенном компьютере подготовить второй архив после финальной проверки этих шаблонов (он не заменяет source manifest):

```sh
tar -cf wallet-mono-deploy.tar .dockerignore deploy/Dockerfile deploy/Dockerfile.prebuilt deploy/Dockerfile.prebuilt.dockerignore deploy/compose.yaml deploy/Caddyfile.wallet.snippet docs/deployment/README.md
sha256sum wallet-mono-deploy.tar > wallet-mono-deploy.tar.sha256
```

Передавать source tar, JSON manifest, `SHA256SUMS.txt`, deploy tar и его checksum вместе, а checksum сверить с доверенным исходным значением. Пример ниже предполагает архивы с путями репозитория в корне:

```sh
set -e
export WALLET_RELEASE_TAG=YYYYMMDDTHHMMSSZ
sha256sum -c SHA256SUMS.txt
sha256sum -c wallet-mono-deploy.tar.sha256
tar -tf wallet-mono-source.tar | less
tar -tf wallet-mono-deploy.tar | less
sudo install -d -m 0755 /opt/wallet-mono/releases/$WALLET_RELEASE_TAG
sudo tar --no-same-owner -xf wallet-mono-source.tar -C /opt/wallet-mono/releases/$WALLET_RELEASE_TAG
sudo tar --no-same-owner -xf wallet-mono-deploy.tar -C /opt/wallet-mono/releases/$WALLET_RELEASE_TAG
```

До извлечения проверить, что оба архива не содержат абсолютных путей и `..`, а JSON manifest и checksum исходного архива совпадают. Release-каталоги не перезаписывать; каждый tag уникален. Сохранить оба архива и checksums вне webroot.

На этом VPS около 1.7 GiB доступной RAM, 2 GiB swap и 28 GiB диска. **Предпочтительный путь — собрать зависимости и Next на отдельном Linux builder той же архитектуры** (например, WSL Ubuntu), а на VPS выполнить только лёгкий Docker `COPY`. В builder после проверки и извлечения тех же source/deploy архивов в чистый каталог:

```sh
export WALLET_RELEASE_TAG=YYYYMMDDTHHMMSSZ
node --version  # >=24
pnpm --version  # 10.33.2
pnpm install --frozen-lockfile
pnpm -r build
test -f apps/miniapp/.next/BUILD_ID
tar -cf wallet-mono-linux-build-$WALLET_RELEASE_TAG.tar node_modules apps/miniapp/node_modules apps/miniapp/.next packages/core/node_modules packages/platform/node_modules packages/ui/node_modules
sha256sum wallet-mono-linux-build-$WALLET_RELEASE_TAG.tar > wallet-mono-linux-build-$WALLET_RELEASE_TAG.tar.sha256
```

`wallet-mono-linux-build-*.tar` содержит только Linux `node_modules`/`.next`; source и deployment-шаблоны остаются под своими отдельными checksums. Передать этот архив и `.sha256` на VPS, сверить и извлечь **поверх уже проверенного source+deploy release**:

```sh
sha256sum -c wallet-mono-linux-build-$WALLET_RELEASE_TAG.tar.sha256
sudo tar --no-same-owner -xf wallet-mono-linux-build-$WALLET_RELEASE_TAG.tar -C /opt/wallet-mono/releases/$WALLET_RELEASE_TAG
sudo test -f /opt/wallet-mono/releases/$WALLET_RELEASE_TAG/apps/miniapp/.next/BUILD_ID
sudo test -f /opt/wallet-mono/releases/$WALLET_RELEASE_TAG/apps/miniapp/node_modules/next/dist/bin/next
```

На современном Buildx/BuildKit, который действительно применяет `deploy/Dockerfile.prebuilt.dockerignore`, runtime-only image строится напрямую:

```sh
docker buildx version
docker build -f /opt/wallet-mono/releases/$WALLET_RELEASE_TAG/deploy/Dockerfile.prebuilt -t wallet-mono:$WALLET_RELEASE_TAG /opt/wallet-mono/releases/$WALLET_RELEASE_TAG
docker image inspect wallet-mono:$WALLET_RELEASE_TAG --format '{{.Id}}'
```

На данном VPS наблюдался старый путь сборки: `docker buildx version` не был подтверждён, а первая попытка отправила контекст только `18.83 MB` и завершилась на проверке `apps/miniapp/.next/BUILD_ID`. При этом файлы уже существовали в release-каталоге. Значит, Docker применил **корневой** `.dockerignore` (`**/node_modules`, `**/.next`), а не Dockerfile-specific ignore. Проверенный совместимый путь — в **новом release-каталоге, не в исходном worktree и не в `dlc-dm`** временно поставить prebuilt-ignore на место корневого, собрать образ и восстановить исходный файл. Следующий блок выполнять целиком в Bash; subshell вызывает `EXIT` trap после сборки даже при вставке в интерактивный сеанс. Backup остаётся вне build context в `/tmp`, а исходный SHA-256 проверяется после восстановления:

```bash
(
  set -Eeuo pipefail
  : "${WALLET_RELEASE_TAG:?Set WALLET_RELEASE_TAG first}"
  WALLET_RELEASE_DIR=/opt/wallet-mono/releases/$WALLET_RELEASE_TAG
  WALLET_ROOT_IGNORE=$WALLET_RELEASE_DIR/.dockerignore
  WALLET_PREBUILT_IGNORE=$WALLET_RELEASE_DIR/deploy/Dockerfile.prebuilt.dockerignore
  WALLET_IGNORE_BACKUP_DIR=$(mktemp -d /tmp/wallet-mono-ignore.XXXXXXXX)
  WALLET_IGNORE_BACKUP=$WALLET_IGNORE_BACKUP_DIR/.dockerignore
  WALLET_IGNORE_SHA=$(sudo sha256sum "$WALLET_ROOT_IGNORE" | cut -d' ' -f1)
  sudo cp -p "$WALLET_ROOT_IGNORE" "$WALLET_IGNORE_BACKUP"
  test "$WALLET_IGNORE_SHA" = "$(sudo sha256sum "$WALLET_IGNORE_BACKUP" | cut -d' ' -f1)"

  wallet_restore_ignore() {
    local build_status=$?
    trap - EXIT
    if ! sudo cp -p "$WALLET_IGNORE_BACKUP" "$WALLET_ROOT_IGNORE"; then
      printf 'CRITICAL: restore .dockerignore manually from %s\n' "$WALLET_IGNORE_BACKUP" >&2
      exit 1
    fi
    if [ "$(sudo sha256sum "$WALLET_ROOT_IGNORE" | cut -d' ' -f1)" != "$WALLET_IGNORE_SHA" ]; then
      printf 'CRITICAL: restored .dockerignore hash differs; backup: %s\n' "$WALLET_IGNORE_BACKUP" >&2
      exit 1
    fi
    printf 'Original .dockerignore restored; SHA-256 verified. Backup: %s\n' "$WALLET_IGNORE_BACKUP"
    exit "$build_status"
  }
  trap wallet_restore_ignore EXIT

  sudo cp -p "$WALLET_PREBUILT_IGNORE" "$WALLET_ROOT_IGNORE"
  docker build -f "$WALLET_RELEASE_DIR/deploy/Dockerfile.prebuilt" -t "wallet-mono:$WALLET_RELEASE_TAG" "$WALLET_RELEASE_DIR"
  docker image inspect "wallet-mono:$WALLET_RELEASE_TAG" --format '{{.Id}}'
)
```

Если оболочка принудительно убита или машина отключилась, `EXIT` trap не выполнится: перед следующим Docker build восстановить `.dockerignore` из указанного backup и сверить исходный digest. Нельзя оставлять prebuilt-ignore корневым надолго: стандартный Dockerfile иначе начнёт отправлять `node_modules` и `.next` в контекст. Dockerfile-specific ignore намеренно не исключает эти каталоги, но запрещает `.env` и типовые ключи. Не собирать Linux-модули на Windows для Linux-контейнера; сборка в WSL/Linux решает эту несовместимость.

Альтернатива, если отдельный Linux builder имеет Docker: там можно собрать полный образ по стандартному Dockerfile и передать image tar с проверенной контрольной суммой; так тяжёлая сборка тоже не отберёт ресурсы у старого сайта:

```sh
# На отдельном Linux builder, внутри проверенного release-каталога:
export WALLET_RELEASE_TAG=YYYYMMDDTHHMMSSZ
docker build -f deploy/Dockerfile -t wallet-mono:$WALLET_RELEASE_TAG .
docker save -o wallet-mono-$WALLET_RELEASE_TAG.tar wallet-mono:$WALLET_RELEASE_TAG
sha256sum wallet-mono-$WALLET_RELEASE_TAG.tar > wallet-mono-$WALLET_RELEASE_TAG.tar.sha256

# На VPS после передачи образа и сверки его SHA-256:
export WALLET_RELEASE_TAG=YYYYMMDDTHHMMSSZ
sha256sum -c wallet-mono-$WALLET_RELEASE_TAG.tar.sha256
docker load -i wallet-mono-$WALLET_RELEASE_TAG.tar
docker image inspect wallet-mono:$WALLET_RELEASE_TAG --format '{{.Id}}'
```

Если отдельного builder нет, полную сборку на VPS проводить только в согласованное окно, после проверки свободных ресурсов. Во время неё следить за `free -h`, `df -h /`, `docker stats --no-stream` и baseline старого сайта/админки через прямой `:5174`. При нехватке памяти, активном swap thrashing, быстром исчерпании диска или деградации старого сайта прервать **только новую** сборку и отложить rollout; не делать `docker system prune` и не перезапускать `dlc-dm`.

## 3. Старт только нового проекта

На VPS из каталога проверенного release:

```sh
export WALLET_RELEASE_TAG=YYYYMMDDTHHMMSSZ
export WALLET_COMPOSE=/opt/wallet-mono/releases/$WALLET_RELEASE_TAG/deploy/compose.yaml
docker compose -f "$WALLET_COMPOSE" config --quiet
docker network inspect dlc-dm_default --format '{{.Name}}'
docker compose -f "$WALLET_COMPOSE" up -d --no-build --wait --wait-timeout 120
docker compose -f "$WALLET_COMPOSE" ps
docker compose -f "$WALLET_COMPOSE" logs --tail=100 app
```

При одобренной сборке прямо на VPS заменить `up ... --no-build` на отдельную команду `docker compose -f "$WALLET_COMPOSE" build app`, дождаться успеха, затем выполнить `up ... --no-build`. Не путать image tag с другим release.

Проверить сам Next и DNS-имя сервиса **из той же Docker-сети**, пока Caddy и DNS ещё не тронуты:

```sh
docker run --rm --network dlc-dm_default --entrypoint node wallet-mono:$WALLET_RELEASE_TAG -e "fetch('http://wallet-mono-app:3000/mono').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
```

Проверить и `/` аналогично. Если контейнер не healthy или маршрут не открывается, остановиться; Caddy/DNS не менять. Снова сверить оба старых baseline endpoint.

## 4. Точный маршрут Caddy

У Caddyfile **одиночный bind mount файла**. `sudoedit`, `sed -i`, `mv` и восстановление через `cp` могут заменить inode: контейнер тогда продолжит читать старый примонтированный файл. Поэтому менять его только **in-place**. Сначала сверить hash с preflight и отдельно проверить, что host-файл и файл внутри gateway идентичны. Если файл успел измениться другим оператором, остановиться и перечитать diff. Сделать отдельную копию на VPS; не переносить её в Git.

```sh
set -e
export WALLET_CADDY=/opt/dlc-dm/app/deploy/Caddyfile
export WALLET_CADDY_BACKUP=/opt/dlc-dm/app/deploy/Caddyfile.wallet-before-$WALLET_RELEASE_TAG
export WALLET_SNIPPET=/opt/wallet-mono/releases/$WALLET_RELEASE_TAG/deploy/Caddyfile.wallet.snippet
WALLET_CADDY_INODE=$(sudo stat -c %i "$WALLET_CADDY")
WALLET_HOST_HASH=$(sudo sha256sum "$WALLET_CADDY" | cut -d' ' -f1)
WALLET_GATEWAY_HASH=$(docker exec dlc-dm-gateway-1 sha256sum /etc/caddy/Caddyfile | cut -d' ' -f1)
test "$WALLET_HOST_HASH" = "$WALLET_GATEWAY_HASH"
test ! -e "$WALLET_CADDY_BACKUP"
sudo cp -a "$WALLET_CADDY" "$WALLET_CADDY_BACKUP"
sudo tee -a "$WALLET_CADDY" < "$WALLET_SNIPPET" > /dev/null
test "$WALLET_CADDY_INODE" = "$(sudo stat -c %i "$WALLET_CADDY")"
sudo diff -u "$WALLET_CADDY_BACKUP" "$WALLET_CADDY" || test "$?" -eq 1
```

`diff` должен показать только append нового точного блока (его код завершения `1` при различии файлов ожидаем). Не заменять файл целиком, не менять `{$PUBLIC_HOST}`, старые host-блоки и существующий Compose. Вновь сравнить digest host/container: если он разный, **не делать reload**. Затем в работающем gateway (при подтверждённом mount target `/etc/caddy/Caddyfile`):

```sh
set -e
WALLET_HOST_HASH=$(sudo sha256sum "$WALLET_CADDY" | cut -d' ' -f1)
WALLET_GATEWAY_HASH=$(docker exec dlc-dm-gateway-1 sha256sum /etc/caddy/Caddyfile | cut -d' ' -f1)
test "$WALLET_HOST_HASH" = "$WALLET_GATEWAY_HASH"
docker exec dlc-dm-gateway-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec dlc-dm-gateway-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Если validation не прошла, **не reload**: вернуть только этот append по процедуре отката ниже и разобраться. После reload повторить baseline `dlc.ru.net` и прямого `:5174`. При отклонении сразу перейти к откату блока Caddy. Никакого wildcard, default host и глобальных security headers. Особенно не вводить строгий CSP без nonce/hash: у `/mono` есть inline prepaint-скрипт.

## 5. DNS и HTTPS

В зоне, обслуживаемой `ns1.nameself.com` / `ns2.nameself.com`, создать **только** apex `A` для `wallet.ru.net` со значением `135.181.70.158`. Подтверждённый исходный ориентир — отсутствие `A` и `AAAA`; если свежий авторитетный preflight покажет иное, остановиться и зафиксировать новый rollback до записи. `AAAA` не создавать: у данного VPS нет рабочего IPv6. `NS`, `MX`, `TXT`, `CAA`, старый домен и его админку не менять. Не добавлять `www` автоматически. После распространения DNS Caddy должен получить отдельный сертификат для точного нового имени.

```sh
dig +short A wallet.ru.net
dig +short AAAA wallet.ru.net
curl -fsS -o /dev/null -w '/ %{http_code} TLS=%{ssl_verify_result}\n' https://wallet.ru.net/
curl -fsS -o /dev/null -w '/mono %{http_code} TLS=%{ssl_verify_result}\n' https://wallet.ru.net/mono
docker logs --tail=100 dlc-dm-gateway-1
```

Если DNS уже указывает на VPS, а сертификат ещё выпускается, ждать и читать только относящиеся к новому host ошибки Caddy; не менять сертификаты старых имён. После HTTPS проверить CSS/JS/локальные шрифты, мобильные размеры, темы, варианты, reduced-motion/WebGL fallback и console errors в браузере. Снова сравнить оба baseline endpoint старого сайта/админки; их код, TLS сайта и маршруты должны остаться прежними.

`www.wallet.ru.net` — отдельное решение владельца. Только после согласования добавить его `A` (и проверить отсутствие нерабочего `AAAA`) и отдельный Caddy-блок:

```caddyfile
www.wallet.ru.net {
    redir https://wallet.ru.net{uri} permanent
}
```

Этот блок **не входит** в основной snippet и не применяется по умолчанию.

## 6. Откат без касания `dlc-dm`

Для неудачного **обновления** вернуть предыдущий сохранённый image tag и Compose из предыдущего release; Caddy и DNS не менять:

```sh
export WALLET_RELEASE_TAG=PREVIOUS_RELEASE_ID
export WALLET_COMPOSE=/opt/wallet-mono/releases/$WALLET_RELEASE_TAG/deploy/compose.yaml
docker image inspect wallet-mono:$WALLET_RELEASE_TAG --format '{{.Id}}'
docker compose -f "$WALLET_COMPOSE" up -d --no-build --wait --wait-timeout 120
```

Для отката **первого запуска** остановить только новый app. Если текущий Caddyfile **байт-в-байт** равен backup плюс наш snippet (без чужих последующих изменений), укоротить его до исходной длины через `truncate`: это сохраняет inode одиночного bind mount. Если сравнение не прошло, остановиться и согласовать точечное in-place удаление только wallet-блока; не перезаписывать Caddyfile копией и не применять `sudoedit`/`sed -i`. Затем сверить hash host/container, проверить `caddy validate`, выполнить `caddy reload` и повторить baseline.

Следующий блок выполнять в Bash (`<(...)` — его синтаксис); любая неуспешная проверка останавливает блок до `truncate`.

```bash
set -e
export WALLET_RELEASE_TAG=FAILED_RELEASE_ID
export WALLET_COMPOSE=/opt/wallet-mono/releases/$WALLET_RELEASE_TAG/deploy/compose.yaml
docker compose -f "$WALLET_COMPOSE" stop app
export WALLET_CADDY=/opt/dlc-dm/app/deploy/Caddyfile
export WALLET_CADDY_BACKUP=/opt/dlc-dm/app/deploy/Caddyfile.wallet-before-$WALLET_RELEASE_TAG
export WALLET_SNIPPET=/opt/wallet-mono/releases/$WALLET_RELEASE_TAG/deploy/Caddyfile.wallet.snippet
cmp -s <(sudo cat "$WALLET_CADDY") <(sudo cat "$WALLET_CADDY_BACKUP"; cat "$WALLET_SNIPPET")
WALLET_CADDY_INODE=$(sudo stat -c %i "$WALLET_CADDY")
sudo truncate -s "$(sudo stat -c %s "$WALLET_CADDY_BACKUP")" "$WALLET_CADDY"
test "$WALLET_CADDY_INODE" = "$(sudo stat -c %i "$WALLET_CADDY")"
test "$(sudo sha256sum "$WALLET_CADDY" | cut -d' ' -f1)" = "$(sudo sha256sum "$WALLET_CADDY_BACKUP" | cut -d' ' -f1)"
test "$(sudo sha256sum "$WALLET_CADDY" | cut -d' ' -f1)" = "$(docker exec dlc-dm-gateway-1 sha256sum /etc/caddy/Caddyfile | cut -d' ' -f1)"
docker exec dlc-dm-gateway-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec dlc-dm-gateway-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Вернуть **ровно прежние** `A`/`AAAA` нового apex в DNS-панели. Для зафиксированного исходного состояния без `A`/`AAAA` это означает удалить только добавленный `A 135.181.70.158` и оставить `AAAA` отсутствующим; если preflight обнаружил другой baseline, восстановить именно его. Старые DNS-записи и сертификаты не трогать. Образ, release и backup пока сохранить для разбора; не выполнять широких удалений. Завершить отчётом без секретов: release/checksum, image ID, новый host, что именно менялось в DNS/Caddy, результаты `/`, `/mono` и baseline, а также выполненный либо доступный откат.
