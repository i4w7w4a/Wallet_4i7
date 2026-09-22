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

Worktree на этом HEAD чистый. Ветка на два commit впереди remote head PR #26, но остаётся без upstream и remote branch; сам PR #26 на GitHub всё ещё указывает на `b08cf23e`. Свежий handoff, проверки graph-free commit и план публикации ещё не получены. До них эти восемь путей заняты; commit не переносить, не push-ить и не публиковать за исполнителя.

Также найден старый грязный `review/agent-results` с изменённым `pnpm-lock.yaml`. Его владелец неизвестен. Не очищать, не включать в bootstrap и считать зависимости/lockfile замороженными.

## Предлагаемая декомпозиция — ещё не назначения

### W0. Организация работы

Переиспользовать Issue #2 / PR #3 как контекст workflow. Новый координационный PR может быть дополнением, а не дублем: сослаться на старую спецификацию и объяснить изменение базы и роли. Не переписывать её историю. Координатор в bootstrap владеет новыми `docs/coordination/`, своим skill и согласованным AGENTS-addendum.

Контрольная Issue создана: #27. Корневые `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md` и `.github/**` остаются областью Issue #2 / PR #3. Addendum хранится как предложение внутри `docs/coordination/`, пока не будет отдельной передачи общей области.

Не менять CI и rulesets вместе с документацией. Их реальная настройка — отдельный этап после аудита и разрешения.

### W1. Компактная студия и PR #26 — IN_PROGRESS

Исходный `DESIGN_ONLY` результат завершён локальным planning commit `23d8c7f1a54610dcc3b66d92e23603790d7a5c3d`:
- `docs/superpowers/specs/2026-09-22-novex-design-studio-design.md`;
- `docs/superpowers/plans/2026-09-22-novex-design-studio-implementation.md`.

Владелец уточнил, что тот же агент продолжает PR #26. Первый `PRODUCT_IMPLEMENTATION` этап graph-free Dashboard находится в локальном commit `bc4407715b51c031ff5d6838794f1f260e8526f4`. Уточнение относится к этой существующей линии; оно не выдаёт другим агентам право менять Dashboard, общие контракты или существующий PR.

Следующая граница — получить handoff именно для `bc44077`: изменённые файлы, свежие RED/GREEN проверки, оставшиеся риски и способ публикации в PR #26. Остальные этапы студии не считать начатыми автоматически.

### W2. Лаборатория анимаций — LAB_IMPLEMENTATION

Прочитать неизменённый исходный бриф `docs/coordination/briefs/2026-09-22-novex-motion-lab.md` (SHA-256 `21811dec48c599cdb63cb70ade1abae433b182bbe71379d968570584838043fd`), не заменить его пересказом. Изолированный маршрут/компоненты лаборатории, одна pointer-сцена, несколько кандидатов, настройка и preset export/import. Основной Dashboard и пользовательские настройки не менять; не публиковать наружу автоматически.

Предварительно независим от проектирования студии. Однако исходный бриф также разрешает AGENTS.md и focused skill. Поэтому разделить владение явно:
- агент лаборатории готовит `novex-motion-design` и предложения к общим правилам;
- общий AGENTS.md сводит один назначенный координатор после ACK исполнителя;
- manifests/lockfile, global CSS и exports — отдельное согласование. Не считать их свободными только потому, что UI-задачи названы по-разному.

После аудита безопасная начальная область ограничивается новым route/subtree лаборатории и её тестами. Общие exports, providers, Dashboard, global CSS, manifests и lockfile остаются запрещёнными до отдельной revision; необходимость изменить их возвращается координатору.

Motion Lab остаётся на зафиксированном remote checkpoint PR #26 `b08cf23e5066b9c870bd89b0cc8048d1f57b82a8`. Локальный studio commit `bc44077` в его базу не входит и не должен переноситься туда без новой revision.

### W3. Продуктовая реализация — частично IN_PROGRESS

Graph-free Dashboard уже выполняется существующим агентом как продолжение PR #26. Его техническая готовность не подтверждена до свежих тестов и handoff.

Общий appearance-envelope, draft/save/cancel и реализация четырёх разделов студии остаются следующими этапами того же плана; не запускать их параллельно другим агентом и не считать разрешёнными одним фактом graph-free commit.

Выбор эффекта и передача точного preset → отдельная интеграция того же компонента в кошелёк → повторная примерка в контексте.

Выбор эффекта Motion Lab и интеграция утверждённого preset по-прежнему являются отдельным заблокированным продуктовым этапом.

### W4. Совместная проверка

Когда независимые результаты готовы, читать diff, сверять HEAD и зависимости. Проверочную сборку разрешает владелец отдельно; она не меняет main и существующие PR. Техническая проверка комбинации и художественное утверждение — разные проверки.

## Следующее действие после bootstrap

Получить handoff агента PR #26 на `bc4407715b51c031ff5d6838794f1f260e8526f4`, особенно свежие RED/GREEN проверки и план публикации. Issue #29 Motion Lab подготовлена как единственный второй независимый пишущий поток; она не использует `bc44077` и не меняет занятые Dashboard paths.
