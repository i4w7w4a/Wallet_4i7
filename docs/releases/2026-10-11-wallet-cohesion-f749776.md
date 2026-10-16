# Wallet cohesion — публичный выпуск f749776

**Опубликован и технически подтверждён 11.10.2026 02:55:44 МСК.** Публичный MONO: https://wallet.153.76.194.160.nip.io/mono; проверенный visitor: https://wallet.153.76.194.160.nip.io/p/2. Root отвечает за отдельный bounded public browser review; локальные gates390/320 пройдены до switch. Технические факты ниже не означают проверку всех физических устройств, оформлений или реального backend.

## Exact runtime identity

- Git SHA: **f749776562c1e472781d342f52710906c307a7ec**.
- Image tag: **novex-wallet:20261010T234033Z-f749776**.
- Image ID: **sha256:e2e9e3b4b025b6cf62491ddf5f50cba4d06c6ebee867006f0f0e44a2d9bd8e01**.
- Linux BUILD_ID: **h0OQU8772hs_Tu3HTNw21**.
- Контейнер: **898d84cc138f2db1e5e3ae9e41f7729d02dcc2c9320c6d27b3625b02d357088b**, healthy. UID1000 (`node`) подтверждён offline в exactimage.
- `git archive` frozenSHA: **1018 committed files**, SHA256 **aa172a7b7a6520999c38e5ca356dfc75897a6c869834c07aa1ab3e36bff67028**. Dirty docs WIP/untracked source/foreign raw bytes не включены. Live HTTPS manifest точно совпал с candidate и runningcontainer manifest.
- `/`307→`/mono`; `/mono`, `/p/2`, `/concepts/`200. API slot2 совпал с свежей копией rawSHA и revision5; publicOrigin153 подтверждён. Все7 snapshots/history сохранены файловыми checks, а отдельные публичные API/visual проверки выполнены только в указанном объёме.
- Последующие docs-only commits не являются новым runtime source или новой публикацией.

## Что вошло

- Reviewed cohesion профиля/avatar/header/support: личные/security разделы без дублей; headset+mic открывает компактную отдельную поддержку, Telegram `@re_pick`, неизвестные каналы disabled; повторный avatar возвращает исходный экран/focus.
- Уточнение владельца: logo/support слева, **аватар справа**; Root фактически проверил390/320, без horizontal overflow. Sourcefix — brandflex0→1, frozenf749776; функциональное доказательство375 сохранено.
- Menu владеет0/1/2 homepins и FIFO replacement третьего доступного; total-only скрывает pins с сохранением выбора. Fiat/«Закрытый» только disabled presentation, без новых financial IDs/holdings.
- Label «Общий баланс» сохраняет смысл общей оценки всех средств; остальная ранее принятая локальная работа входит через exactfrozen source.

## Исключения и сохранение

- Runtime resource caps не менялись. В этом выпуске не вводились реальные API/DB/финансовые/security/demo правила, новые assets/account kinds, dependency upgrades или V1 изменения.
- Семь опубликованных оформлений, их snapshots/history не перезаписывались и не мигрировали; повторной публикации пользовательских presets не было. Изменение предоставленного demo-контакта поддержки описано в составе выпуска выше и не является изменением сохранённых оформлений.
- DNS/Caddy/gateway/соседние services/второй target213 не менялись. GitHub push/merge/defaultbranch rewrite не выполнялись.
- Только `services.mono.image` изменился: semantic Compose equality после замены image; owner/mode файла сохранены. Compose beforeSHA **7787f0dda34bc63a4c323d8f870cde36747374bbf2e80f3abbd25276f829940c**, afterSHA **32182d232ba169f349e396cd7a74f1382357d49f65bc0422cc29578d9d3ed3c7**.
- **27files /9dirs**, все bytes/history и UID/GID/mode совпали с independentlyverified freshbaseline. UID/GID1000:1000, dirs0700/files0600; семь ревизий **2/5/3/3/2/2/2**, RWbind прежний.
- CaddySHA **05a007e0bca0cf76e1e647ee3913a9fe75fdc2891a234eb106ed443dcd67f7d6** сохранён, включая разрешённые R2rootredirect/upstream другого проекта. Neighbor containerIDs, concepts pointer/HTML сохранены; DLC200. Никакой исторический Caddy не восстанавливался.

## Проверки и ресурсы

- Один affectedtypecheck375 прошёл; для CSS-onlyf749 повторных typecheck/tests не было. По exactf749 выполнена одна новая Windows build/managed3184 (BUILD_IDTXp_rhIA5FAna525gCyfN, launchc029b25f7024401bab2e72df2ea7875a, PID39136) и одна Linuxcompile.
- Первый375 Linuxbuilder отменён по отзывуGO владельца, exit137/OOMfalse; не опубликован. Новыйf749 build обоснован changedsource.
- Builder временно2CPU/2GiB/mounts[]; freshgate MemAvailable3179765760bytes, load1=0.65 на4vCPU, выше разрешённого2.75GiB headroom. Exit0/OOMfalse; peak **1809514496bytes /1.69GiB**, cgroup total включая cache, captured singlememory.peakFD вEXITtrap без постоянного мониторинга.
- VerifiedLinuxfilesystem упакован без повторной компиляции; offlinefinalizer exit0/OOMfalse, nonrootUID1000/manifest/BUILD_ID gate.
- Foreign next-env rawSHA fdbd4aed25cb869f6dea6a580aae58d5b333805890ce973df3daad9b5c5a9bdc и iconsaudit1425ad615b42a3273d4bd253d39bb72cdd5c9ceae535b6e8ae180d08a08f5b3d сохранены; source не редактировался ORACLE.
- Root localreview375functional + actualf749header390/320 GO; exactsource/public switch permission записаны до switch. Freshfullbackup, независимая локальная проверка и immediatebeforewrite guards пройдены. Послеswitch healthy/image/HTTPSmanifest/data/permissions/neighbors/config guardPASS; rollback не потребовался.

## Rollback

- Git SHA **b6553a8fdb2adcc56968876f4d74e20f47b749d9**.
- Tag **novex-wallet:20261010T013812Z-b6553a8**; ID **sha256:e24daeacfd1da2ed4bc40d82d97a93f1e3e587f14567eebe52011dd42d14185d**, retained on153.
- PriorCompose: **/opt/novex/releases/20261010T234033Z-f749776/compose.before.yaml**.
- Freshfullbackup: **/opt/novex/releases/20261010T234033Z-f749776/mono-published.before.tar.gz**, SHA256 **a19b0ae56be9a346e08a4e83089448d2c270f4468152e888cb9819e57d253090**; independentlyverified local copy **C:\Users\iwwa\.novex-ops\releases\20261010T234033Z-f749776\mono-published.before.tar.gz**.
- Откат только своего image/Compose при неизменной внешней конфигурации сохраняет текущий volume публикаций. Datarestore требует отдельного явного решения; нельзя восстановить старый Caddy/соседние changes автоматически.

Protected evidence: **C:/Users/iwwa/.novex-ops/releases/20261010T234033Z-f749776**; `deployment-handoff.json`, `candidate-image.json`, `builder-launch-gate.json`, `builder-memory.json`, freshbackup/localgate and switchplan. Raw inspect/config/data/logs остаются только в protectedops, не в repo.

## Публичный показ — Root

После выпуска открыта свежая вкладка `/p/2` по обычному HTTPS на390px. Подтверждены отсутствие редактора/header-demo, «Общий баланс», аватар справа (right370,width44,безoverflow), компактная Support с тремя значками и точным `https://t.me/re_pick`, нижнее Menu/На главной с disabledФиатный/Закрытый и Profile без дублей. Повторный аватар возвращает Home. Публичные настройки и данные не менялись; внешняя ссылка не открывалась, сообщения/платежи не отправлялись. Локальная и публичная вкладки оставлены владельцу, viewport восстановлен.

Факты и два PNG: `.superpowers/sdd/2026-10-11-wallet-cohesion-release/public-browser.md`, `public-overview-390.png`, `public-support-390.png`. Это bounded browser PASS для одного опубликованного варианта, не приёмка всех семи оформлений или физического телефона.
