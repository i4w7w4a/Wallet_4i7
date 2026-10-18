# Gold #67/#68 — публичный CI-выпуск

18 октября 2026. **PUBLIC_READY: server proof и bounded public browser QA — PASS.** ORACLE переключил Gold18.10.2026 в03:52:41МСК; root принял retained server/live/protected proof и просмотрел representative Home390/320 и History390/320-scrolled screenshots. Главная#67/история#68 реализованы, опубликованы и проверены в указанном scope; не назначать этот выпуск заново. Эта запись не является новым execution GO.

Принятые [главная #67](https://github.com/i4w7w4a/Wallet_4i7/issues/67) и [история #68](https://github.com/i4w7w4a/Wallet_4i7/issues/68) включены в неизменённый app SOURCE7d: одна карточка общего баланса, четыре действия, вход «Мои средства», компактная история с датами группами и явными pending/failed. Существующая inline-квитанция сохранена. Профиль, MONO, семь presets, renderer/materials и финансовые команды не переделывались.

## Точный источник и готовый CI artifact

| Срез | Идентификатор |
|---|---|
| Принятый app SOURCE | `7d097c9cc6e1286297315c78520f341a364b35f0` |
| Сохранённая GitHub-ветка приложения | [codex/gold-history-68-20261017](https://github.com/i4w7w4a/Wallet_4i7/tree/codex/gold-history-68-20261017), exact7d |
| GitHub-ветка CI | [codex/gold-ci-release-20261018](https://github.com/i4w7w4a/Wallet_4i7/tree/codex/gold-ci-release-20261018) |
| Frozen CI commit | `495ee795eebfe62099b2b81fbe394b9473a37e2e` |
| Успешный run | [39075514268](https://github.com/i4w7w4a/Wallet_4i7/actions/runs/39075514268), attempt1, event push, workflow `.github/workflows/gold-ci-release.yml` |
| Завершение CI | SUCCESS, 18.10.2026 01:34:29 МСК / 17.10.2026 22:34:29 UTC |
| Immutable artifact | [12116861695](https://github.com/i4w7w4a/Wallet_4i7/actions/runs/39075514268/artifacts/12116861695), `gold-495ee795eebfe62099b2b81fbe394b9473a37e2e-39075514268-1` |
| ZIP / Actions envelope SHA256 | 300875143 bytes / `445a44a0b35f8dbfd3e720f05d2444f6dc739da2eb4be14aaa70f16855977d16` |
| Image | `novex-gold:ci-7d097c9-39075514268-1` |
| CI inspect ID / config digest | `sha256:e436b5537783b68d88a5083fea4d5f4c9234ed82fd38e55cf9df5b897279270c` |
| CI inspect Size | 851466650 bytes; producer-local accounting, не target disk/RAM |
| Target loaded manifest digest | `sha256:2624483d99d6390fe93c581a99c20488b368a87e9b51b42e5ac77b18223112c2` |
| Target containerd Size.Total | 1832805178 bytes = Content880722746 + Unpacked952082432 |
| Linux BUILD_ID | `I1UEI44C23zGWp5CLNBJ4` |
| releaseId | `ci-7d097c9-39075514268-1` |
| Server publishedAt | `2026-10-18T00:52:41.357643Z` / 03:52:41МСК |
| Live container (RO00:57:19UTC) | `df7886b720f4bb5bbe13d3708bdfd44384cc8d2af4eefe4149ad08d4fec0b2fe`, PID3614988, healthy |
| Gold Compose SHA256 после switch | `c04b241facb50335f7725369e415ed8a7d02cedf6a8d3c669d89500537eb3f87` |
| `gold-image.tar` / SHA256 | 880744448 bytes / `76dfc67bfcf355ca8a634b808b88713c9c0d3a52b899ad044684339710fa7a35` |
| `artifact-ready.json` canonical SHA256 | `66a5e7c45c857d3fb7a243893b721be52db27b1ce8f4d357aee7e38b13db0220` |
| Docs HEAD | Docs-only commit этой записи; см. [историю ветки](https://github.com/i4w7w4a/Wallet_4i7/commits/codex/gold-ci-release-20261018/) |

App SOURCE, CI recipe commit и будущий docs-only HEAD — разные идентичности. CI собирает архив exact7d с reviewed packaging; `apps/`, `packages/`, package/lock/workspace-файлы совпадают с7d. Документация после сборки не меняет этот образ/BUILD и не требует новой компиляции. Feature branches сохранены обычным non-force push; PR, default merge и automatic deployment не выполнялись.

Artifact содержит ровно `gold-image.tar`, `artifact-ready.json`, `ci-smoke.json`, `SHA256SUMS`. Envelope digest не является хешем внутреннего tar. ORACLE фактически проверил exact ZIP/tar/config и импортировал образ один раз. На153 Docker29.8.1/containerd raw manifest262→confige436 и все7layers проверены по SHA256, размерам и порядку против принятого tar; raw manifest/config byte-identical. Root принял concrete equivalence: `image-identity-rca-ro.json`, SHA256 `a9f6eabb9621250faeccab7476c6b2ab5f3fe4c1e8cc88a712c36227509af3bc`. Это разные типы digest и модели Size, не подмена image ID в ready: исходный ready/packet неизменён. Повторные download/load/CI build не требуются.

## Проверки и честные границы

- Принятое приложение17.10: полный miniapp run **1704PASS / 31baseline-matchingFAIL**, затем final focused **78PASS**; typecheck/build и bounded local320/390/480 browser QA завершены ранее. Это не полностью зелёный full suite. Для CI-only дельты старый широкий app run и локальная сборка не повторялись.
- Успешный Linux run: dependency-free CI helpers **60PASS / 0FAIL / 0skip**; Docker recipe check, native Linux amd64 build, smoke точного image и artifact verifier — PASS. Образ собран за48s: один прямой Next build/default Turbopack, actual compile6.6s. Builder peak memory не измерялся.
- Actual builder/runtime: **Node v24.22.0**, pnpm10.33.2, Next16.3.5. Smoke проверил HTTP/BUILD/source, CSS+JS MIME/hash/Gold namespace, canonical RSC `/gold?_rsc` с `RSC:1` и запретом неожиданных redirects, lazy runtime и config. Prefix `/gold`, dist `.next-gold-public`; existing Caddy передаёт полный путь без strip/rewrite. Runtime smoke: non-root,1CPU/512MiB, no mounts/host ports/network, OOMfalse.
- Две предыдущие свежие попытки не дали artifact: [39074007713](https://github.com/i4w7w4a/Wallet_4i7/actions/runs/39074007713), CI6ef, — неконтекстный smoke `fetch failed`; [39074881976](https://github.com/i4w7w4a/Wallet_4i7/actions/runs/39074881976), D1e31, — установленный RSC `unexpected redirect`. D1 добавил только диагностику; доказанный canonical-query fix D2 дал успешный495. Всего три отдельно разрешённых fresh push runs, **0reruns / 0extra runs**.
- Nonfatal CI notices: ignored build script `unrs-resolver@1.12.2` и предложения обновить npm/pnpm; версии/lock/policy не менялись. Backend, физический телефон, все семь оформлений, FPS и отсутствующие demo edge cases этим CI не сертифицированы.
- Отдельные private checkpoint checks: launcher/new-GO ledger32PASS, remote bounded-settling27PASS, scoped reviews. Это не дополнительные miniapp tests и не основание скрывать31baselineFAIL.

Сохранённая local3200: app7d, BUILD `QRyLETrp06HQFieBvNd-u`. Её checkout/output не заменялись новым CI checkout и не являются источником Linux BUILD.

## Техническая публикация и сохранность

[Публичный Gold153](https://wallet.153.76.194.160.nip.io/gold) теперь отдаёт app7d/CI495/Linux BUILD `I1UEI44C23zGWp5CLNBJ4`. Один Gold recreate, **0rollbacks / 0extra image loads / 0compiles / 0pulls / 0retags**. Все23assets прошли HTTP200/MIME/hash/namespace; canonical RSC и runtime — PASS в frozen helper. Независимый RO00:57:19UTC подтвердил healthy container/target manifest262 и protected state; browser manifest отдельно показал новый7d.

Важная граница provenance: client launcher завершился `SSHException` с **UNKNOWN exit**, не получив result. Это не exit0 и не утверждение об успешном завершении клиента. Client error00:52:27UTC предшествовал server publishedAt00:52:41UTC; причина transport/timeout **не доказана**, в частности «SSH timeout после выпуска» не установлен. Поздний bounded RO получил привязанный к canonical GO `2ae5b3c4d8bdd64b20e8438284d33916d15dab1386f2a4fa2ac06252bba5427d` retained server PUBLIC_READY, затем fresh live/protected proof. Raw record `reconcile-attempt-ledger-ro.second.remote-result.raw.json`, SHA256 `e6631c49c766dbc9e4f37b3f8f7c99075e362187d48ca27a89186d622bc43d1a`; финальная `reconcile-attempt-ledger-ro.final.json`, SHA256 `3e639173a4ab26126f9530da0057980150ef314ce848596881811317e981416a`, принята root. Два RO sidecar diagnostic-format errors (lost default, затем classifier `source` вместо actual `gitHead`) сохранены отдельно. Независимый browser proof подтверждает `gitHead=7d097c9cc6e1286297315c78520f341a364b35f0`/CI495/BUILD выше. Финальная классификация выполнена локально по сохранённым proof; новых server calls или повторного deploy ради неё не было.

Перед switch guards прошли без изменения floors:00:49:34UTC MemAvailable2491162624bytes/load1=1,8677/free7800721408bytes;00:51:22UTC2499211264bytes/load1=1,9565/free7800680448bytes. MONO,13соседей, Caddy/shared Compose/routes и27files/9dirs семи datasets/history — PASS; ревизии2/5/3/3/2/2/2 сохранены. App/profile/seven-preset source trees byte-identical7d подтверждены ранее. Старый5a1 image/Compose сохранён для exact scoped rollback в remote checkpoint namespace; rollback не выполнялся.95/179 и локальные previews не трогали.

Исторический checkpoint1 остановился до begin/write/switch без structured result. Отдельный RO probe00:03UTC дал fresh RAM/load HOLD; поздние метрики00:07UTC PASS (MemAvailable≈2,47–2,49GB, **load1:0,84→0,60**, free≈7,8GB) не устанавливают незаписанный operand исходной попытки. Эти holds и две ранние неуспешные CI-попытки не переписаны как успех. Для состоявшегося switch выполнены scoped observability fixes/reviews и отдельное точное execution GO; нового import/build или blind retry не было.

## Actual public browser QA и границы результата

Begin/end manifest стабилен: `gitHead=7d097c9cc6e1286297315c78520f341a364b35f0`, CI495, BUILD `I1UEI44C23zGWp5CLNBJ4`, release `ci-7d097c9-39075514268-1`; HTML BUILD в начале и конце тот же. Home и History320/390/480, «Мои средства»→Assets ALL, account pending/history, фильтры/search/empty reset, receipt→Back с исходным контекстом, privacy строк/ARIA/квитанции и восстановление — PASS.

Известная неблокирующая полировка: empty-state global reset очищает фильтры/возвращает строки, но после удаления своей кнопки оставляет focus на BODY. Этот focus detail отложен; обязательные receipt-close и pending-return focus paths прошли отдельно. Приложение ради выпуска не менялось.

Menu→«Мои счета» из точного прокрученного History в контексте «Основной» пройден locator click и Tab→Enter. Прежняя local ambiguity не воспроизведена; **physical/native pointer UNVERIFIED**, не выдан за PASS. Native desktop control не использовался.

Console:0errors/0warnings. Наблюдались28resources:11JS/11CSS/2fonts/4images, без root `/_next` leak. Viewport восстановлен1920×928; собственная public-вкладка оставлена на Home с видимыми суммами. Local3200 и пользовательские вкладки не трогались.

Это bounded desktop-browser proof, не physical-device/touch/FPS/backend certification и не исчерпывающая browser-проверка UTC/commerce edge cases.31baselineFAIL остаются известным test debt; source/test coverage не выдаётся за отсутствующий browser proof. Новые UI/App/CI/deploy работы, merge/PR и повторные широкие проверки этой записью не назначаются. Статусы GitHub issues обновляет координатор отдельно от этой документационной фиксации.

План и границы: [Gold CI release18.10](../product/2026-10-18-gold-ci-release.md). Исторический публичный выпуск до этой волны: [профиль13.10](2026-10-13-profile-client-public.md); его запись не переписана.
