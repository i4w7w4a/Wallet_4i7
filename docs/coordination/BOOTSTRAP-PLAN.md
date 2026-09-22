# Первое подключение координатора: проверенный snapshot и предложенный порядок

Дата повторной проверки: 22 сентября 2026 года. Это snapshot для восстановления контекста, не действующая очередь. Живой индекс находится в [Issue #27](https://github.com/i4w7w4a/Wallet_4i7/issues/27).

## Подтверждено чтением GitHub

- Draft PR #3 — `docs(workflow): утвердить правила работы нескольких агентов`, branch `docs/2-agentic-workflow`, head `dbf5447ab161e53cdcdef709eebe50380c256ebd`. Связан с Issue #2. В нём спецификация, а добавление AGENTS.md/CONTRIBUTING/шаблонов описано как следующий этап после письменной проверки.
- Файл спецификации: `docs/superpowers/specs/2026-09-12-agentic-github-workflow-design.md`. Он уже задаёт Issue → branch → worktree → PR, отдельные области и handoff, но также содержит безусловный старт от main.
- Draft PR #26 открыт и не merged: head `feat/23-react-bits-dashboard` @ `b08cf23e5066b9c870bd89b0cc8048d1f57b82a8`, base `feat/10-miniapp-preview` @ `e13ea705fcc953d7d3c596380c7d47a70a40551c`.
- #26 сообщает, что ветки задач #21 и #22 уже интегрированы в его историю. PR #25 (`feat/21-react-bits-engine`) и #24 (`feat/22-react-bits-icons`) при проверке также открыты как Draft. Открытость не означает отсутствие их кода в #26.
- Handoff #26: `docs/handoffs/2026-09-16-pr-26-agent-handoff.md`. Запрещает force-push, merge и закрытие Issue #23 без решения владельца.
- Отчёты 149/149 и 10/10 — прочитанные утверждения PR/handoff о прежних прогонах. В этой подготовке тесты не запускались.
- На GitHub у PR #3, #24, #25 и #26 нет check runs, commit status contexts, формальных reviews или review decision. Агрегат `pending` при пустом наборе contexts не является выполняющейся проверкой.
- Текущие heads PR #24 и #25 полностью входят в head PR #26; повторно считать их независимыми интеграциями нельзя.

Remote refs нужно повторно прочитать; эти SHA не «вечные базы».

## Уточнение владельца: продуктовая V1 и MONO/V2

Владелец уточнил 22 сентября 2026 года: линия PR #26 — промежуточная product V1, а текущая основная визуальная работа ведётся в MONO/V2 по адресу `https://wallet.135.181.70.158.nip.io/mono`.

Живой preview проверен: `/mono` открывает `MONO LEDGER` с отдельным workbench. Проверенный preview-релиз собран из `45ea860755425cc7ef44f3138d032984f310a42f`; локальная ветка `codex/skin-lab-v2` сейчас чистая на `8163b1b486fc31a6aa376622389c704aa339abc2`, на 17 commits поверх `b08cf23e`. Ветка не опубликована и не имеет upstream.

Техническая оговорка: `/mono` — уже работающий изолированный V2 workbench, но общий `SkinHost` и полная миграция V2 Skin System ещё не завершены. Числа `v1` внутри `mono-ledger-v1`, preset schemas и storage keys являются версиями skin/schema, а не возвратом к промежуточной product V1.

До публикации точного MONO checkpoint нельзя выдавать новые product-задачи от `b08cf23e` по инерции. Сначала нужен handoff/published ref для линии MONO/V2.

## Активное локальное продолжение PR #26

Владелец уточнил: отдельный worktree `codex/novex-design-studio-plan`, созданный от `b08cf23e5066b9c870bd89b0cc8048d1f57b82a8`, продолжает именно Draft PR #26. Это не Issue #29 и не Motion Lab.

Planning pass собран в локальный commit `23d8c7f1a54610dcc3b66d92e23603790d7a5c3d`:

- `docs/superpowers/specs/2026-09-22-novex-design-studio-design.md`;
- `docs/superpowers/plans/2026-09-22-novex-design-studio-implementation.md`.

Следующий локальный commit `bc4407715b51c031ff5d6838794f1f260e8526f4` выполняет первый graph-free этап: удаляет график баланса и периоды, asset sparklines, donut/legend, перестраивает текстовые метрики и порядок `LiquidPromoCard`. Он меняет восемь файлов:

- `apps/miniapp/e2e/dashboard.visual.spec.ts`;
- `packages/ui/src/dashboard/asset-list-card.tsx`;
- `packages/ui/src/dashboard/balance-hero.tsx`;
- `packages/ui/src/dashboard/dashboard-visuals.css`;
- `packages/ui/src/dashboard/dashboard-visuals.test.tsx`;
- `packages/ui/src/dashboard/dashboard.test.tsx`;
- `packages/ui/src/dashboard/dashboard.tsx`;
- `packages/ui/src/dashboard/portfolio-summary-card.tsx`.

После `bc44077` агент начал незакоммиченный appearance/storage этап, включая общий `packages/ui/src/index.ts`, новые preference storage, active appearance и appearance repository. Эти контракты пересекаются с целевой V2 Skin System и не должны развиваться параллельно.

Ветка остаётся без upstream и remote branch; сам PR #26 на GitHub всё ещё указывает на `b08cf23e`. В связи с уточнением MONO/V2 дальнейшую реализацию на этой линии остановить на безопасном checkpoint, ничего не удаляя. Нужен handoff с точным diff, тестами и разделением: что сохранить как продуктовые требования, что переносимо в MONO, а что дублирует V2.

Также найден старый грязный `review/agent-results` с изменённым `pnpm-lock.yaml`. Его владелец неизвестен. Не очищать, не включать в bootstrap и считать зависимости/lockfile замороженными.

## Предлагаемая декомпозиция — ещё не назначения

### W0. Организация работы

Переиспользовать Issue #2 / PR #3 как контекст workflow. Новый координационный PR может быть дополнением, а не дублем: сослаться на старую спецификацию и объяснить изменение базы и роли. Не переписывать её историю. Координатор в bootstrap владеет новыми `docs/coordination/`, своим skill и согласованным AGENTS-addendum.

Контрольная Issue создана: #27. Корневые `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md` и `.github/**` остаются областью Issue #2 / PR #3. Addendum хранится как предложение внутри `docs/coordination/`, пока не будет отдельной передачи общей области.

Не менять CI и rulesets вместе с документацией. Их реальная настройка — отдельный этап после аудита и разрешения.

### W1. Компактная студия и PR #26 — BLOCKED НА СВЕРКЕ БАЗЫ

Исходный `DESIGN_ONLY` результат завершён локальным planning commit `23d8c7f1a54610dcc3b66d92e23603790d7a5c3d`:
- `docs/superpowers/specs/2026-09-22-novex-design-studio-design.md`;
- `docs/superpowers/plans/2026-09-22-novex-design-studio-implementation.md`.

Первый `PRODUCT_IMPLEMENTATION` этап graph-free Dashboard находится в локальном commit `bc4407715b51c031ff5d6838794f1f260e8526f4`. Он выполнен на промежуточной V1-линии. Не cherry-pick-ить его в MONO автоматически: сначала сопоставить композицию и tests с `apps/miniapp/src/mono-preview/**`.

Следующая граница — сохранить текущее состояние и получить handoff: `bc44077`, незакоммиченные appearance/storage файлы, свежие RED/GREEN проверки и остаточные риски. До назначения MONO/V2 base не продолжать appearance envelope и не обновлять remote PR #26.

### W2. Лаборатория анимаций — BLOCKED ДО REVISION 2

Прочитать неизменённый исходный бриф `docs/coordination/briefs/2026-09-22-novex-motion-lab.md` (SHA-256 `21811dec48c599cdb63cb70ade1abae433b182bbe71379d968570584838043fd`), не заменить его пересказом. Изолированный маршрут/компоненты лаборатории, одна pointer-сцена, несколько кандидатов, настройка и preset export/import. Основной Dashboard и пользовательские настройки не менять; не публиковать наружу автоматически.

Предварительно независим от проектирования студии. Однако исходный бриф также разрешает AGENTS.md и focused skill. Поэтому разделить владение явно:
- агент лаборатории готовит `novex-motion-design` и предложения к общим правилам;
- общий AGENTS.md сводит один назначенный координатор после ACK исполнителя;
- manifests/lockfile, global CSS и exports — отдельное согласование. Не считать их свободными только потому, что UI-задачи названы по-разному.

После аудита безопасная начальная область ограничивается новым route/subtree лаборатории и её тестами. Общие exports, providers, Dashboard, global CSS, manifests и lockfile остаются запрещёнными до отдельной revision; необходимость изменить их возвращается координатору.

Старая Issue #29 назначала base PR #26 `b08cf23e5066b9c870bd89b0cc8048d1f57b82a8`. После уточнения product direction этот dispatch остановлен. Revision 2 должна использовать опубликованный MONO/V2 checkpoint и новые точные paths; до этого исполнителя не запускать.

### W3. Продуктовая реализация — BLOCKED ДО MONO/V2 HANDOFF

Graph-free поведение, компактная студия и appearance contracts нужно перенести в основную MONO/V2 линию как новые scoped stages, а не развивать отдельную product V1. Planning docs и наблюдаемые требования можно сохранить; V1 runtime commits являются кандидатами для review, не готовыми интеграционными commits.

Общий `SkinHost`, active appearance, draft/save/cancel и storage уже спроектированы в `docs/skins/architecture.md`; новый envelope в PR #26 нельзя принимать без reconciliation с этой архитектурой.

Выбор эффекта и передача точного preset → отдельная интеграция того же компонента в кошелёк → повторная примерка в контексте.

Выбор эффекта Motion Lab и интеграция утверждённого preset по-прежнему являются отдельным заблокированным продуктовым этапом.

### W4. Логотип Novex — ASSET READY / WAITING_OWNER

Владелец передал `novex.svg` как логотип кошелька. SHA-256: `5f63b04b59a025bed230408ee831f99f59861ecfc72836fff93366ecd9386af9`. SVG не содержит scripts, handlers, внешних ресурсов, fonts или embedded data и безопасен как статический asset.

В исходнике есть непрозрачный белый квадрат `1024×1024`, а знак занимает центральную горизонтальную полосу. Удаление белого фона или tight crop меняют внешний вид и требуют решения владельца. Внедрять логотип следует в MONO/V2 brand slot вместо временного `W`/`WALLET_4I7`, не в промежуточную PR #26 V1.

### W5. Совместная проверка

Когда независимые результаты готовы, читать diff, сверять HEAD и зависимости. Проверочную сборку разрешает владелец отдельно; она не меняет main и существующие PR. Техническая проверка комбинации и художественное утверждение — разные проверки.

## Следующее действие после bootstrap

Остановить расширение V1 worktree без удаления работы и получить его handoff. Затем выбрать и опубликовать точный MONO/V2 checkpoint (`45ea860` как deployed source либо более новый `8163b1b` после проверки), обновить задачи до новых base/path boundaries и только после этого запускать Motion Lab или внедрение логотипа.
