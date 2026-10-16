# Новый сервер и путь к полноценному Gold

12.10.2026. Владелец принял детали MONO и разрешил публичный выпуск. Затем уточнил новый целевой VPS и прямо поручил «размести на этом».

## Размещение

- Новый target: **95.181.213.126**, Ubuntu24,2vCPU/2GBRAM, SSH root/предполагаемый22. Доступ получен от владельца и хранится только в отдельной защищённой конфигурации клиента вне Git. Не печатать секреты, не копировать их в чаты/документы/память.
- Владелец уточнил, что на95 **уже работают другие сайты**: замена общей конфигурации/edge, занятие80/443 новым proxy, restart чужих apps или массовый upgrade недопустимы. Только isolated wallet upstream и новый virtualhost в существующей схеме, с backup/validate и минимальным graceful reload при необходимости.
- Затем владелец прямо добавил **179.254.92.157** (Ubuntu24,2vCPU/2GBRAM, root/предполагаемый22) для одновременного размещения. Отдельный protectedclient с теми же строгими ACL, без переносов секретов. URL второй копии: `https://wallet.179.254.92.157.nip.io/mono`, visitor `/p/2`. Не считать и этот сервер пустым без preflight.
- URL проверки: `https://wallet.95.181.213.126.nip.io/mono`, visitor `/p/2`. Собственный обычный домен владелец пока не назначил.
- До этой волны фактический main:153.76.194.160, VM-977948.local, Compose project `novex-wallet`/service `mono`, livef749/healthy. ORACLE подтвердил это read-only в текущей переписке. Старый153 не выключаем и не удаляем.213.141.132.29 — не новый target и не участвует.
- Выпускаемый source: **8a9052cb1ecb74d06a41bcd81c0eae36d8d4d88a**; поздний docsHEAD не отдельный runtime. Локальные producer/typecheck/root390/320 уже PASS. Seven presets, snapshot revisions/history, approved materials, demo financial handlers и старые операции не менять.
- На новом2GB не выполняем тяжёлую Next/Linux сборку: прежний безопасный headroom2.75GB здесь недостижим. Готовый контролируемый Linux artifact строится на прежнем допустимом builder и переносится; повторной компиляции на новом VPS нет.
- Первый этап на каждом target — read-only SSH/host/architecture/OS/memory/disk/ports/services preflight и обычный host-key pinning. При наличии чужих сервисов не заменять их configs/containers/edge. Wallet route и его runtime — предел задачи. Пустоту и право на минимальный штатный runtime+HTTPS проверять по actual preflight, не применять эту ветку к заведомо занятому95.
- Backup у VPS отсутствует: до switch сохраняем локальный recoverable migration bundle и source/image/data identity. Старый сервер — резерв. Presets/history и static concepts, включая опубликованный boost, переносятся с проверкой bytes/permissions, без массовой перепубликации семи вариантов. Не копировать env/config с прежними origins вслепую.
- Один Linux artifact build для **обоих** targets. На каждом свой before/after data fingerprint и public health/browser proof. Не повторять localbuild/typecheck/fullsuite. ORACLE — единый release/artifact authority и оператор95; готовую capsule один раз фиксирует по source/hash. Root держит scope/plan/приёмку; оператор179 работает только на своём сервере после передачи этой capsule/GO. Это ограниченное параллельное исполнение не даёт второму оператору authority на source, old153 или95.
- Оператор179 — переиспользованное завершённое окно `NOVEX — зеркало кошелька: сервер 179`, thread `01a12cfd-3392-7a62-8b57-7cd1e5a6e1e8`, SOL MAX. До freeze/GO только read-only preflight/own protected staging draft; no build/runtime3184/source/Git changes. Own release note `docs/releases/2026-10-12-wallet-mirror-179.md`. ORACLE own `docs/releases/2026-10-12-main-home-port-public.md` либо отдельная95 delivery record, root — plan/AGENTS.
- Initial presets/history/static copy и приложение на двух новых URL должны совпадать. Это **не автоматическая синхронизация будущих правок preset** между серверами; механика двусторонней записи/репликации не создаётся молча этой задачей.
- При невалидном HTTPS не обходить предупреждение браузера и не выдавать `-k`/self-signed за публичную готовность. Public ready означает работающий normal HTTPS и совпадающую runtime identity.
- GitHub push/merge, смена root-пароля/новые SSH grants и выключение старого сервера не разрешены этой волной. Gold prototype в accepted MONO source не входит.

## Полноценный Gold

Владелец спросил о полноценном применении золотого варианта. Это возможно как оформление текущего общего продукта, но нынешний3196 — только Overview-пилот, не полный router/финансовые экраны/material host.

SOL MAX в существующем окне `NOVEX — быстрые правки шаблона: эксперимент` завершил ограниченный read-only разбор current canonical8a vs prototypeb6ffaee. Итог: `C:/Users/iwwa/.codex/worktrees/novex-fast-edit-pilot/5-wallet-foundation/docs/product/2026-10-12-gold-full-wallet-path.md`, docs-only commit `87e2a00`. Source/runtime/server не менялись.

Выбран чистый технический путь: отдельный фиксированный `/gold`, использующий существующий `MonoProductScene`, SSR loader и те же controller/snapshot/commands. Это средний presentation-срез примерно в шести frontend-файлах, не оценка календарного срока. Новое оформление фиксировано и не становится mutable восьмым preset: существующие семь slots/materials сохраняются. Palette/type adapters записывают inline tokens, поэтому одной поздней CSS-заплаты недостаточно. Scoped gold appearance и читаемый glass recipe должны распространяться на реальные общие screens/panels, а не только на Overview.

Последовательность будущего implementation: (1) настоящая главная с существующими действиями; (2) общий золотой вид Assets/History/Accounts/Profile/Menu/panels, без дублирования финансовой логики; (3) один затронутый 390/320 smoke реальных форм, квитанции и возврата, privacy/long values/pending/error/unknown/reduced-motion. У текущего3196 действия завершаются notices: его визуальная приёмка не доказывает готовность отправки/получения/квитанций.

Пока разрешён анализ пути, а не молчаливая замена всех семи оформлений. После решения — отдельный согласованный implementation slice с реальными shared screens.

## Статус

- **Оба размещения PUBLIC READY**:95 в15:28:08МСК,179 в15:28:44МСК. Normal HTTPS/identity/data/neighbor pass операторов и отдельный Root browser render обеих `/p/2` завершены. Один source/build/image, семь опубликованных оформлений не перезаписаны.
- Protected clients использованы без печати секретов; root-пароли, SSH grants и системные пакеты не менялись. Полный локальный recoverable capsule verified уORACLE. Старый153 сохраняетсяf749 резервом; future preset changes не auto-sync.
- Gold path analysis завершён, выбран reuse общего продукта; реализация/publicGold не выполнялись этой волной.

Подробные release records: `docs/releases/2026-10-12-main-home-port-public.md` и `docs/releases/2026-10-12-wallet-mirror-179.md`; коротко для заказчицы — `docs/product/2026-10-12-client-links.md`. Следующие строки — история этапов, не текущие blockers.

95 preflight ORACLE: host VM-209002.local, Ubuntu24.04,2vCPU/2GB; уже работает DLC,7containers,80/443 — existingCaddy; available RAM около670MiB. Новую общую edge-систему не создавать. Проверить budget отдельного wallet runtime по фактическому RSS с резервом для DLC; новые own limits не распространять на соседей. Одного neighbor before/after IDs/health/HTTP достаточно для затронутой доставки; не превращать это в общий securityaudit. Linuxbuilder8a запущен на153, live oldMONOf749 не переключён.

179 preflight на13:49МСК: available RAM1359MiB, swap нет, free disk53.6GiB; три VPN-контейнера работают. Amnezia использует UDP443; TCP80/443 свободны, HTTP/HTTPS edge нет. Новый wallet edge — h1/h2 и только80/tcp/443/tcp, безUDP443 и HTTP/3 advertisement. Не менять VPN containers/networks/IDs/routes/ports, Docker daemon и общую firewall policy. Оператор подготовил draft, runtime switch ждёт root TRANSFER GO по immutable capsule.

На13:53МСК единственная Linux-сборка8a у ORACLE завершилась exit0, безOOM, peak около1.89GiB. Финализация прав прошла. Image/capsule identity фиксируется; это пока не означает public readiness новых URL.

## Frozen handoff — перенос, ещё не public readiness

- Release `20261012T103608Z-8a9052c`, source `8a9052cb1ecb74d06a41bcd81c0eae36d8d4d88a`.
- Image `novex-wallet:20261012T103608Z-8a9052c`, ID `sha256:2ad2b7d1209d4a666764fbc0be3e31f60316b9a52b4d2a4345d1ccacc443bea4`, Linux BUILD_ID `VCDzjMI8qR-4kXzQx-kf4`.
- Manifest SHA256 `e3dc73681c8bae93c2a879177bdf51f99bb41f57cf2f214f5cf92cfdb9d82f4d`. Root сверил малый локальный manifest с сообщением release authority; полную проверку archive bytes перед load/extract делает каждый оператор.
- Capsule: runtime images wallet + verified Caddy2.10-alpine, published snapshots/history, concepts/boost. Caddy digest `sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d`.
- Images archive596359093bytes/SHA256 `5fd61cb82dfb543a201bb47d8da12a6dd3054a47b03a1631c31564de6420c26d`; published7889bytes/`a19b0ae56be9a346e08a4e83089448d2c270f4468152e888cb9819e57d253090`; concepts142050bytes/`9e7b4eb90d38980055b2fa3a8a10d7a884d60f035dce1da94570ac0b7fe4604d`.
- Для параллельности root разрешил оператору179 **только read-only получение четырёх frozen capsule files** из `/opt/novex/releases/20261012T103608Z-8a9052c/capsule/` на153 через существующий protected pinned connector. Не новые credentials/grants и не действия на old runtime. Никаких иных чтений/команд/изменений153/95. Собственный staging; не читать Oracle `.part` и не писать в его capsule directory. Все mutations по-прежнему только179.
- Oracle сохраняет artifact authority, собственную recoverable local copy и delivery95. Public153 не переключён. На95 основнойDLC до наших изменений отвечает200; тестовыйhost уже отвечает503 — это исходный симптом, не новый результат wallet deployment.

## Доставка — задержка и ограниченный fallback

Оба больших SFTP transfer замедлились/замирали, несмотря на точный SHA малых файлов. Один диагностический owner179 сравнил first read: безprefetch0.873s, bounded64 —1.161s. Unlimitedprefetch в его основном канале не использовался: предупреждение Paramiko docs остаётся гипотезой, **не установленной причиной** этой задержки. Resume скорость179 около0.08MiB/s; deploy readiness из этого не следует.

Root отменил дублирующее large-download расследование: оператор179 останавливает только свой transfer, готовит owntarget staging/config и ждёт verified cache. ORACLE — единственный owner большого download, сначала проверил binary SSH stream безPTY через existing pinned auth:1MiB за24.6s, неприемлемо медленно для всего payload. Следующий прямой nativeSSH pull95←153 использует existing root authentication толькоRAM/encryptedcontrolstdin и pinnedhostkeys, точный capsule file/offset, bounded memory/timeout/progress и полныйSHA. Он растёт: около16MiB за81s,79,765,504/596,359,093bytes на95 в сообщенииORACLE. Это всё ещё не public readiness.

No publicHTTP capsule exposure, новыеSSHgrants, passwordfiles/logs/env/argv илиhostkey bypass. Source/imagefreeze неизменны; новый build/refreeze/упаковочный эксперимент не назначались. После verified cache95 root передаст оператору179 ровно этот payload/RO retrieval scope, чтобы не повторять медленный153→ПК путь. Recoverablelocalcopy допустимо получить с95 после SHA. Причина ограничения скорости пока неизвестна; не объявлять unlimitedprefetch причиной, не переписывать SFTP library или кошелёк ради этого. Read-only дополнительное advisory завершено безsource/runtime изменений.

Измеренный candidate RSS около134MiB.95 startup требует RAM-gate с резервом256MiB дляDLC; own walletbudget не переносится на соседей. На179 pending image не заменять произвольным образом/tag pull. Образы/startup и normalHTTPS ещё ожидаются.

179 staging завершён:27files публикаций/истории и15files concepts/boost сверены поSHA/UID/GID/mode; baseline3VPNcontainers сохранён. Runtime ещё не запущен. После этой доставки выделить отдельный bounded packaging follow-up: уменьшить production artifact без переписывания интерфейса; нынешние600MB — размер пакета, не измерение browser performance илиRAM приложения.

## Итог и следующая очередь

-95 — primary на existing gateway,179 — отдельный h1/h2 mirror. Source8a/image2ad2/BUILD_IDVCDz совпали; snapshot/history/static fingerprints и permissions сохранены на обоих. Первоначальный Caddy guard остановил запись из-за autogenerated `group5→group9`; биективное сравнение символических identifiers подтвердило сохранность остальных settings, TLS/logging/auth/routes не удалялись из сравнения. Existing DLC edge не перезапускался; shared Caddy image tag не изменился. На179 не занятыUDP443 и не измененыVPN/firewall.
- Source153→95 был медленным, но весь image archive принят только по полномуSHA.95→ПК дал9.08MiB/s, ПК→1798.05MiB/s; verified cache использован и какrecoverablelocalbackup. Не заявлять установленную причину исходного throttling или исправление SFTP library.
- Root browser proof обеих visitor pages: balance, две группы справа, plane Send, pending USDC, история, аватар/поддержка/Меню, безlab/editor. На179 off-front capture сначала пропустил hero; DOM/styles/fonts были одинаковы, обычный вывод вкладки вперёд дал полный вид. Ниcode/preferences/viewport, нифинансовые действия не менялись. Screenshots в `.superpowers/sdd/2026-10-12-dual-server-migration/`.
- Новый общий UI/backend/device audit и visual certification всех7/физического телефона не проводились. Не повторять прошлые producer/typecheck/390/320 gates. GitHub push/merge не выполнялись.
- Следующий дизайн-срез: согласованная реализация fixed `/gold` на общих реальных screens, без второй финансовой модели и перезаписи7presets. Отдельный ops follow-up: облегчить production packaging для последующих быстрых выпусков. Эти задачи не выполнены молча этой доставкой.
