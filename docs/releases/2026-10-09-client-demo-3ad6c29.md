# MONO — клиентская демонстрация, 09.10.2026

**Опубликовано 09.10.2026 в 13:52:52 МСК / 10:52:52 UTC.**

[Кошелёк без редактора](https://wallet.153.76.194.160.nip.io/p/2) · [MONO](https://wallet.153.76.194.160.nip.io/mono) · [Live manifest](https://wallet.153.76.194.160.nip.io/source-manifest.json).

## Что вошло

- Фильтр статуса истории и исправления начального фокуса при reduced motion.
- Контурные значки профиля, помощи и quick menu с прежними действиями и privacy.
- Понятное разделение входа в актив и раскрытия размещений; подсказки состояния счёта до выбора.
- Контекстная кнопка Back, значки изменения/повторного ввода, точная принятая сумма симуляции и явные сообщения известных причин отказа.

Операции остаются демонстрационными: реальный перевод, списание, signing и банковский backend не подключались. Семь опубликованных оформлений и вся история не перепубликовывались и не мигрировали. V1, DLC, concepts, Caddy/gateway/DNS, DB и зависимости не менялись; GitHub push/merge не выполнялись.

## Точная версия и проверка

| Поле | Значение |
| --- | --- |
| Runtime Git SHA | `3ad6c299c94d628a2e4a895d741fe9ed5c533e2f` |
| Image tag | `novex-wallet:20261009T102202Z-3ad6c29` |
| Image ID | `sha256:7058ffebd636cb711d120cff66500aaf57180d1b1be48d9a788b89f69f02920d` |
| Linux BUILD_ID | `WCCoER_MMcyi9feRhVjEc` |
| Health | healthy |
| Source archive | 974 committed files; SHA-256 `778c6ae17b9b9683b937593110950840c919e7dfb92de94f11c258d70e14527a` |

Один Linux build и offline permission finalizer завершились с exit 0 без OOM. Root прошёл локальный bounded browser flow на exact candidate: 390/320, reduced motion, USDC/Main/Ethereum, изменение с сохранением draft, mock result, точная квитанция, privacy и focus.

**Публичный browser smoke root — PASS** на свежем `/p/2`: viewer без редактора, четыре значка профиля, раскрытие/закрытие личных данных с честными неизвестными значениями, viewport/document width390 и возврат Home через logo. Public settings/presets/операции не изменялись. Evidence — `.superpowers/sdd/2026-10-09-client-demo/browser-pass.md`, screenshot `evidence/public-profile-390.jpg`. Это bounded smoke; полный Send/receipt flow прошёл локально на том же source, physical-phone/full-seven-preset matrix не заявляется.

Live manifest совпал с image/candidate. `/` HTTP 307 → `/mono`; `/mono`, `/p/2`, `/concepts/` HTTP 200. Семантическая Compose-проверка доказала изменение только `services.mono.image`; mounts/runtime policy и соседние container identities сохранились. Caddy hash, concepts pointer/HTML не изменились; DLC HTTP 200.

## Данные и rollback

Свежий полный backup снимков, истории и конфигурации снят **09.10.2026 в 13:49:13 МСК**, после готовности candidate и до switch. Его приватная локальная копия независимо проверена. Все 27 файлов и девять каталогов, bytes/UID/GID/mode совпали до и после; ревизии **2/5/3/3/2/2/2**. Backup SHA-256 `a19b0ae56be9a346e08a4e83089448d2c270f4468152e888cb9819e57d253090`; совпадение с историческим hash отражает неизменные данные, это новый capture.

Protected evidence: `C:/Users/iwwa/.novex-ops/releases/20261009T102202Z-3ad6c29/` и `/opt/novex/releases/20261009T102202Z-3ad6c29/`: source archive, deployment handoff, fresh backup, сохранённый Compose и build/packaging logs. Секреты в Git не включались.

Точка отката: SHA **`9d70abe9da524becc5e4e01d8968536cdeecf315`**, image **`novex-wallet:20261005T142721Z-9d70abe`**, ID `sha256:453fcf63fbf7d70064b3ff9ffc42da849247e625675d88fac8f99d3dd4d574df`; точный конфиг — `compose.before.yaml` в protected release evidence. Image rollback сохраняет текущий том публикаций; data restore требует отдельного решения.

## Runtime и документация

Image собран из frozen **3ad6c29** до создания этого release note. Эта запись и последующий docs-only Git HEAD не входят в опубликованный image и не означают новый deploy. Документационный commit выполняет root отдельно.
