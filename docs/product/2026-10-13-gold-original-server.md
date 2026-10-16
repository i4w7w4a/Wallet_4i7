# Gold на исходном сервере и отключение двух копий

Spec: последнее подтверждение владельца 13.10.2026 — исходный сервер **153.76.194.160**, Gold опубликовать там, сделать переход из MONO; две новые копии кошелька больше не нужны. Ссылка boost-preview на153 подтверждена владельцем. Предыдущая краткая гипотеза оставить95 отменена, remote mutations тогда не выполнялись.

## Итог 13.10.2026

Gold опубликован на153, source `b212f2525fbd03a0a992a9e3d2a50ba565b50ad4`, одна Linux-сборка. Menu-переходы Gold↔MONO проверены на настоящем публичном сайте. Семь presets/history/static и13соседей153 сохранены. Копии95/179 отключены recoverably после READY153;7DLC-соседей95 и3VPN179 сохранены. Сами VPS не удалены, аренда продолжается. Source/main merge/push и пересборка локальных3184/3196/3197 не выполнялись.

Точные artifact/backups/rollback/границы проверки: `docs/releases/2026-10-13-gold-original-server.md`. Короткие ссылки для заказчицы: `docs/product/2026-10-13-client-links.md`. Следующие задачи не должны повторять завершённые Task1–4 или воспринимать старый primary95 статус как действующий.

## Global Constraints

- Target153: https://wallet.153.76.194.160.nip.io, Gold `/gold`. Корень и существующие MONO/visitor/concepts/boost маршруты сохраняются. Не делать Gold восьмым mutable preset. Семь snapshots/history/materials и их UID/GID/modes не перезаписывать.
- Исходный полный Gold уже реализован и локально показан: source842c23e, docs-only HEAD057e4c3, checkout `C:/Users/iwwa/.codex/worktrees/novex-gold-wallet/5-wallet-foundation`, branch `codex/gold-full-wallet-20261012`. Это готовая база, не повторная реализация или аудит.
- Один автор source, ORACLE владеет сборкой и release153/withdraw95. Оператор179 владеет только own withdrawal179. Root — решения, ledger, один scoped review и bounded public browser.
- Отключение означает только собственные Wallet routes/services на95.181.213.126 и179.254.92.157 с recoverable backups. Не удалять VPS, данные, образы, volumes, networks, чужие сайты, VPN, firewall, учётные записи, TLS/security policies или общую proxy-конфигурацию. Не выключать новые копии раньше READY153.
- Свежий read-only preflight обязателен. Сравнить опубликованные данные153/95/179 с предыдущим manifest. Если появились новые настройки, сохранить точные отдельные копии; не выбирать/сливать расходящиеся snapshots по догадке.
- Protected credentials/hostkeys/config только через существующий клиент вне Git; секреты не печатать и не вносить в reports/source/memory. Exact targets и rollback должны быть записаны до write. Не расширять SSH grants.
- Быстрый bounded цикл: только новая переходная UI-функция и её проверки, один diff review, один Linux build exactfreeze, публичная smoke-проверка. Не повторять готовые Gold suites/typecheck/localbuild или финансовые демосценарии без реального изменения. No GitHub push/merge.

## Task 1 — аккуратный переход MONO ↔ Gold

Read first: требования здесь, полный предыдущий Gold report не нужно повторять.

- Добавить компактную строку-ссылку в существующее нижнее «Меню»: MONO → «Gold · золотое оформление» (`/gold`), Gold → «MONO · варианты оформления» (`/p/2`, существующий visitor без редактора). Не заменять тему, профиль, финансовые действия или четыре основных nav-входа.
- Настоящая семантическая same-origin ссылка с читаемой подписью и существующим SVG/row styling. Никакой отдельной библиотеки, editor, cookie/theme/preset/storage write, reload callback на change-theme или финансовой команды. Это переход между отдельными viewer routes; после него начинает работу обычный новый viewer, не обещать перенос незавершённой формы.
- Доступен только в обычном меню; не обходить блокировку навигации/оверлеи активной обрабатываемой операции. Иконка декоративная при текстовой подписи, touch/focus/reduced policies прежние. Никаких новых perpetual loops.
- Предпочтительные owned paths: `apps/miniapp/src/mono-product/profile-quick-menu/profile-quick-menu.tsx`, его module CSS и focused test; `apps/miniapp/src/mono-preview/mono-scene.tsx` для host-only presentation choice; при необходимости `mono-scene-menu.integration.test.tsx`/`mono-gold.test.tsx`. Назвать причину дополнительных paths до изменения. Core/controller/API/presets/approved materials не менять.
- Проверить реальные consumer-visible link href/names и контекст обычного/Gold menu. Новый тест перед минимальной реализацией; один RED→GREEN focused run и diffcheck. Не возвращать четыре известные stale assertions в разработку. Новый typecheck не нужен отдельно от следующей Linux Next compile, если не обнаружен реальный type-risk.
- Commit только own paths; generated next-env/output оставить. Не запускать local/public runtime. Отчёт `task-1-report.md`: status, exact sourcefreeze, paths, TDD commands/results, concerns. Root делает независимый scoped review после freeze.

## Task 2 — ORACLE: выпуск на153

- Сначала RO preflight153/95, прошлых release docs/capsule/protected connector. Уточнить actual live manifest, seven store/hash/revisions/permissions, neighbors/config/container identity, доступный build-cache/ресурсы. Условия rollback и безопасный route freeze в отчёт. Пока Task1 не frozen/reviewed и root не дал BUILD/DEPLOY GO — никакой runtime switch.
- Собрать один exact frozen artifact Gold-ветки через прежний контролируемый cached Linux path. Публичный build/compile может включать accepted MONO8a и Gold; не whole-branch merge в main. Не повторять local3197 build и старый typecheck. Source/manifest/image/BUILD_ID identity связать явно.
- Развернуть только существующий Wallet mono на153, не global edge/rebuild neighbors. `/gold`, `/p/2`, `/mono`, сохранённые concepts/boost и manifest обычным verified HTTPS. SSR route Gold без editor, меню переходов работает в обоих оформлениях. Чужой proxy/config не откатывать целиком старым snapshot.
- До/после seven store побайтно, UID/GID/modes/revisions и соседние IDs/health сохранить. Backups вне публичного frontend и Git; нет overwrite финансовых данных/presets новой базой или копией с95.
- Public READY только после exact source/image/build/normalHTTPS/data/neighbor gates. Report `task-2-report.md`, точный rollback, существующие URL, пределы проверок. Вопросы/реальные блокеры — кратко root, не broad diagnostics loop.

## Task 3 — ORACLE: recoverable withdrawal95

- До GO только RO inventory собственных mono/concepts services и собственного wallet virtualhost, свежие configs/datahashes/neighbor baseline. Не править чужие services или запускать прежний rollback script без сопоставления actual contents.
- После READY153 + root WITHDRAW95 GO: сохранить проверенный recoverable текущий capsule/конфиги, убрать только wallet virtualhost из freshest shared proxy config (validate/graceful reload, не proxy restart), остановить только own wallet services. Данные/volumes/images/network не удалять. DLC/другие routes/containers и их identity/health не менять.
- Report `task-3-report.md`: точные отключённые targets, backup/recovery, до/после соседей, inactive URL проверка без попыток оживления. Если безопасное scoped изменение невозможно — остановить до write и назвать причину.

## Task 4 — оператор179: recoverable withdrawal179

- До GO только RO preflight на179 и own backup plan; свежие own wallet compose/edge/datahashes/VPN baseline. Исторический путь и снимки — `docs/releases/2026-10-12-wallet-mirror-179.md`, protected ops оператора. Из этой задачи никаких write/read153/95 и никакой сборки source.
- После READY153 + root WITHDRAW179 GO: проверенный recoverable backup, остановить только собственные Wallet mono/concepts/edge services. Не удалять data/volumes/images/networks, не менять TCP/UDP rules/firewall/VPN. UDP443 Amnezia и3VPNcontainers сохранить.
- Report `task-4-report.md`: exact own targets/backup/recovery и before/after VPN identity/health. Никаких системных обновлений, удаления VPS или общей очистки Docker.

## Завершение

Root показывает короткие ссылки Gold/MONO и объясняет переход через меню. Документация фиксирует текущую цель153, freeze и факт отключения собственных копий95/179, не уничтожения VPS. Если withdrawal остаётся blocked, это прямо сообщается, не выдаётся за выполненное.
