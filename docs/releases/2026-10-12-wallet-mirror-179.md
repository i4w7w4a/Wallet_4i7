# Wallet mirror 179 — PUBLIC READY

12.10.2026, **15:28:44 МСК**. Размещён exact MONO `8a9052cb1ecb74d06a41bcd81c0eae36d8d4d88a` по TRANSFER/DEPLOY GO root. Artifact authority — ORACLE; payload не пересобирался. Gold prototype b6 исключён.

- [Основной кошелёк](https://wallet.179.254.92.157.nip.io/mono)
- [Посетительский /p/2](https://wallet.179.254.92.157.nip.io/p/2)
- [Композиции A/B/C](https://wallet.179.254.92.157.nip.io/concepts/)
- [Отдельная boost-примерка](https://wallet.179.254.92.157.nip.io/concepts/boost-preview/)
- [Живой source manifest](https://wallet.179.254.92.157.nip.io/source-manifest.json)

## Exact identity

| Поле | Подтверждено |
|---|---|
| Target / OS | 179.254.92.157; Ubuntu24.04.4 LTS; x86_64; 2vCPU/1970MiB RAM |
| Release / image tag | `20261012T103608Z-8a9052c` / `novex-wallet:20261012T103608Z-8a9052c` |
| Source | `8a9052cb1ecb74d06a41bcd81c0eae36d8d4d88a` |
| Wallet image ID | `sha256:2ad2b7d1209d4a666764fbc0be3e31f60316b9a52b4d2a4345d1ccacc443bea4` |
| Linux BUILD_ID | `VCDzjMI8qR-4kXzQx-kf4` |
| Caddy image ID/digest | `sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d` |
| App container | `f183e06a39ecdea73832effd5d7c6e790431c18a8518a14139aa88513e2819df` / `novex-wallet-179` / healthy |
| Edge container | `e598dd952ce22861724e4c0f1343d51ffe011f571feb3187c745f6665edca818` / `novex-wallet-edge-179` |
| Source archive SHA | `058a2ed34776aeb9b61ed00aef86fdc2a99e921af5d0b8e70754a12529b72ec2` |
| Frozen manifest SHA | `e3dc73681c8bae93c2a879177bdf51f99bb41f57cf2f214f5cf92cfdb9d82f4d` |

Public source manifest совпал со всеми полями capsule, включая image tag, archive SHA и sourceFileCount1019. Running image IDs и BUILD_ID проверены на179. SSH выполнялся configured client, первый ED25519 host key закреплён TOFU; последующие соединения проверяли pin. Host-key/TLS verification не отключались.

## Delivery и точная копия

Frozen image archive:596359093 bytes, SHA `5fd61cb82dfb543a201bb47d8da12a6dd3054a47b03a1631c31564de6420c26d`. Полный SHA проверен при скачивании, перед загрузкой на179 и на179 до docker load. Архив содержит только проверенные wallet/Caddy images. Ни build, ни image pull на179 не выполнялись.

Published archive SHA:`a19b0ae56be9a346e08a4e83089448d2c270f4468152e888cb9819e57d253090`; concepts archive SHA:`9e7b4eb90d38980055b2fa3a8a10d7a884d60f035dce1da94570ac0b7fe4604d`. До извлечения проверены hashes, safe paths, entry sets и tar metadata; после запуска/HTTPS — полный data fingerprint:

- Published:36 entries, **27 files/9 dirs**, семь snapshots и history. Ревизии2/5/3/3/2/2/2, все SHA/UID/GID/mode совпали.
- Concepts:24 entries, **15 files**, все SHA/UID/GID/mode и current symlink совпали. Boost входит в точную копию.
- Initial copy идентична capsule. Будущие edits presets между VPS **не синхронизируются автоматически**.

Медленная передача с153 была остановлена только для own transfer процесса по указаниюroot; причина задержки не установлена. Затем root разрешил95 как RO source. Через прочитанный existing pinned source-client на95 выполнены только два exact binary read: `cat` frozen manifest и image archive, без PTY и source writes. Получение95→ПК:9.08MiB/s; uploadПК→179:8.05MiB/s. Никаких иных команд/чтений на95/DLC, новых SSH grants или source changes не выполнялось. Ранее на153 читались только разрешённые capsule paths.

Verified local cache для ORACLE/backup:
`C:/Users/iwwa/.novex-ops/access/wallet-17925492157-20261012/releases/20261012T103608Z-8a9052c/capsule/runtime-images.tar.gz`.

## Отдельный TCP edge

Own stack:`/opt/novex-wallet-179/stack/compose.yaml`; own Caddyfile в той же папке. Только новая сеть/сервисы `novex-wallet-179`, app upstream `wallet:3000` без host publication. Caddy запускается по immutable image ID; конфигурация прошла actual-image `adapt --validate`, compose прошёл config validation. Образы запущены с `--pull never --no-build`.

Caddy protocols строго `h1/h2`; host bindings строго `80:80/tcp`, `443:443/tcp`. UDP443 не публикуется, HTTP/3 advertisement отсутствует. UDP443 остаётся Amnezia. Public static bind только `/opt/novex-wallet-179/static/novex-concepts/releases/20261004T190816Z`, read-only; archived ops/configs не входят в public-root. Certificates/config data находятся в own private folders. Existing global edge отсутствовал и не переписывался.

## Один bounded proof

Normal external HTTPS проверен с обязательной hostname/CA verification: `/source-manifest.json`, `/mono`200, `/p/2`200, `/concepts/`200, `/concepts/boost-preview/`200. Оба static HTML совпали с frozen SHA. Alt-Svc/HTTP3 advertisement отсутствует. Затем один focused target health/data/neighbor pass подтвердил:

- app healthy, exact image/source/BUILD_ID;
- все27published files и15concept files с первоначальными hashes/permissions;
- исходные container IDs/PIDs/images/mounts/network settings: `incy-xray`35db4fa34ff5, `amnezia-awg2`55e0295302f8, `remnanode`d4827c0fbcfc;
- существующие host interfaces/addresses/routes/listeners и IPv4/IPv6 firewall policies сохранены. TCP8443, TCP2222, SSH22 и AmneziaUDP443 имеют исходных владельцев.

После запуска RAM available1231MiB, swap0; диск свободен54,545,989,632B (около50.8GiB), занято11%. Это operational proof; новый полный UI/backend/device audit не проводился.

### Дополнительный browser proof root

Root подтвердил **PASS** для посетительского [публичного /p/2](https://wallet.179.254.92.157.nip.io/p/2) по normal HTTPS: отрисованы баланс, две группы счетов, plane Send, pending USDC, история, меню, аватар и поддержка; редактора нет. [Снимок](../../.superpowers/sdd/2026-10-12-dual-server-migration/ny-public-p2.png) сохранён root.

Первоначальный screenshot неактивной вкладки не отрисовал hero. DOM/colors/fonts совпали с95; `Page.bringToFront` дал корректный полный render. Это особенность захвата неактивной вкладки, без изменений кода, данных или настроек. Evidence предоставлено root; оператор179 повторный UI-проход, local build или typecheck не выполнял. Это ограниченный visitor proof, без расширения до полного UI/device audit.

## Evidence, границы и откат

Protected local evidence:
`C:/Users/iwwa/.novex-ops/access/wallet-17925492157-20261012/preflight/public-ready-20261012.json`.

Target evidence в `/opt/novex-wallet-179/evidence/`: baseline neighbors, data-staged, validated Caddy JSON, config hashes, runtime-started и focused-health. Credential JSON читается только configured client; credentials/private configs не выводились и не перенесены в repo или общую память.

Docker daemon/config, глобальный edge/firewall, VPN, пользователи/root password/SSH grants и системные пакеты не менялись. 95 использован только для разрешённых RO reads; старый153 оставлен, runtime3184/source/AGENTS/план/клиентский пакет/Git не менялись. Commit/push/merge и full suite не выполнялись.

При отмене этого нового размещения достаточно остановить только own services, сохранив capsule/data и соседей:

```sh
docker compose --project-name novex-wallet-179 --file /opt/novex-wallet-179/stack/compose.yaml stop edge wallet
```

Команда отката не выполнялась. Данные и чужие services не удаляются.
