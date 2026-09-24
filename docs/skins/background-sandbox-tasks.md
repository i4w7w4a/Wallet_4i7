# Background Sandbox — задания и владельцы

Все задачи следуют [решению](background-sandbox.md) и [карте первоисточников](background-sandbox-sources.md). Модель по прямому выбору владельца: `gpt-6-astra`, reasoning `max`. Начальная продуктовая база: `fa7d6c1ff65a6505100f809c894aca9dc9851eb4`; документационный checkpoint сообщается отдельно. Не начинать от V1, PR #26 или старого локального main.

## Порядок и общие границы

1. ORACLE фиксирует общий ABI и skeleton host в отдельном sandbox worktree/commit. Исполнители могут параллельно исследовать и писать свои изолированные модули, но не изобретают дублирующие общие types/registry/renderer.
2. SANDBOX и SILK дают первый законченный самостоятельный путь. FLUID готовится независимо, не блокируя первый показ.
3. ORACLE собирает handoff в один cumulative local preview. После standalone — узкая MONO fitting с общим context/Promo pass.
4. Владелец смотрит и выбирает. Product integration/merge/deploy — новое отдельное поручение.

Владельцы работают только в своих чистых managed worktrees и собственных `codex/` ветках. Перед первым edit проверить HEAD/status; при чужих changes остановить только пересекающийся участок. Не менять 3120 или чужие процессы. Общий локальный порт назначает ORACLE; временные порты согласовать. Product build/E2E не запускать несколькими тяжёлыми процессами одновременно: локальные focused tests параллельны, общий gate последовательно у ORACLE.

Новые зависимости/lockfile, server/cloud API, V1, MONO working-preset codecs и опубликованные ветки не входят в scope. Runtime guards не ослаблять ради красивого демо. Никаких force-push, GitHub merge/закрытия Issues или внешнего deploy. При tool permission denial — остановить соответствующее действие, не обходить его другой утилитой.

## BG-1 / SANDBOX — редактор и библиотека проб

**Результат:** самостоятельная широкая сцена и сохранённые именованные пробы, к которым можно вернуться после переключения и reload; выбранный материал подключается через общий host.

**Exclusive files:** `apps/miniapp/src/design-lab/background-sandbox/**`; `mono-atmosphere-lab.tsx`, `mono-atmosphere-lab.module.css`, их unit tests; новые sandbox-specific E2E. Новая область содержит UI/state/storage/codecs, не GPU engine. Existing route и MonoScene integration host принадлежат ORACLE. Общие MonoLab controls использовать без самовольной правки; нужное изменение запросить.

**Сделать:** широкий stage без обязательной MONO-разметки; компактный inspector; именованные Save/Open/Save-as; dirty guards; три независимых comparison slots; pinned A/B одним renderer; Undo/Redo/coalescing; строгий import preview/export через дополнительные действия; workspace recovery отдельно от named Save; legacy atmosphere-v1 read-only migration. Curated Generate/locks только через effect schema, не случайный bag полей.

**Доказать:** две пробы с разными параметрами сохраняются отдельно, switch/reload не смешивает их; storage failure/conflict не пишет ложный Saved; импорт неизвестной/повреждённой версии атомарно отклонён; MONO/V1/cloud keys не меняются. UI не обещает product Apply. Controls доступны keyboard/touch, canvas не уменьшен scale. Координатор получает снимок широкого stage и компактного inspector, не только тестовый отчёт.

## BG-2 / SILK — материал и управляемый свет

**Результат:** убедительный локальный shader material с реакцией на свет и versioned schema.

**Exclusive files:** `packages/ui/src/background-sandbox/effects/silk/**` (adapter, shader, schema/defaults, tests, pinned provenance/license); только свой краткий handoff. Не менять index.ts, registry, host, shell или общий source-catalog.

**Сделать:** прочитать закреплённый Radiant source/license; перенести shader math, сохранив три слоя, normals и направленный sheen; подключить host-owned gl/time/input; 3–5 meaningful controls и два подготовленных стартовых варианта; baseline исходного механического характера для сравнения. Никакого нового OGL renderer/RAF/listeners внутри adapter. Реализовать update/resize/reset/dispose и честный статический fallback contract.

**Доказать:** эффект параметров визуально наблюдаем; slow/fast/stop/leave/re-entry без скачка; нет FPS-зависимого следа, размонтирования на slider и context leak. Source/version/license notices присутствуют. Не называть материал cloth simulation. После готовности shared ABI согласовать импорт его commit, не копировать свой дубль.

## BG-3 / FLUID — инерционная жидкая среда

**Результат:** вторая механика на том же ABI, настоящий bounded multipass solver, сохраняемые художественные настройки.

**Exclusive files:** `packages/ui/src/background-sandbox/effects/fluid/**` (passes, schema/defaults, tests, provenance/license); только свой handoff. Host/общие types/registry/MonoScene не менять.

**Сделать:** прочитать pinned Pavel solver и MIT; сохранить velocity/dye/advection/pressure/curl; удалить demo GUI, analytics/ads и непроверенные assets; определённый seeded reset, finite normalized input, ограниченная палитра и пять художественных controls. Получать существующий GL context, render target и clock от host. Quality budget/float capability/FBO ownership явны. Не исполнять runtime downloaded code и не добавлять Fluid/npm-wrapper.

**Доказать:** после отпускания поле продолжает двигаться и затухает; резкий re-entry/drag cancel не создаёт неограниченный impulse; touch не блокирует wallet scrolling; resize/context loss/dispose очищают собственные GPU resources; есть измерение кадровой стоимости и memory/FBO бюджета на конкретном viewport. Float-target failure — объяснимый fallback, не другой эффект под названием Fluid. JSON roundtrip сохраняет config, не обещает сохранённое поле. Если бюджет не достигнут, передать честный candidate с ограничениями, не форсировать интеграцию.

## BG-4 / ORACLE — host, faithful fitting и единая сборка

**Результат:** один local origin и одно согласованное состояние, где отдельная песочница не пишет продуктовый preset, а fitting не размножает GPU.

**Exclusive files:** `packages/ui/src/background-sandbox/` вне effect-owned каталогов; shared types/registry/host; `packages/ui/src/index.ts`; `packages/ui/src/mono/mono-optical-glass.tsx` и выделяемый optical kernel; `apps/miniapp/src/mono-preview/mono-scene.tsx`; `mono-atmosphere-lab-scene.tsx` и styles; существующий `app/design-lab/atmosphere/page.tsx`; общие test configs, THIRD_PARTY_NOTICES, source-catalog, точечные current-state поправки docs. Никакой общей миграции SkinHost.

**Этап 0:** зафиксировать actual ABI — effect-owned passes, host-owned context/RAF/input/guards; дать exact commit трём исполнителям. Root coordination worktree не редактировать.

**Этап 1:** включить shell + Silk, сохранить legacy CSS кандидаты, собрать standalone Save/Open/A/B. Дать первый working preview до готовности остальных деталей. Адаптировать источники только через allowlisted local registry; context switch latest-wins и cleanup.

**Этап 2:** интегрировать прошедший собственную проверку Fluid. Общий one-canvas test и platform guards. Переносить целую сданную механику, а не заново рисовать похожее.

**Этап 3:** минимальный compatibility-refactor Promo и lab-scoped compositor. Сохранить neutral relief и утверждённые optical settings, подсветку, clipping, живой DOM и geometry; не подменять Promo CSS-картинкой. Shared active и calm эффекта не смешивать. Если faithful fitting пока не доказана — пометка недоступности, отдельный evidence blocker, самостоятельный Lab остаётся рабочим. Не заявлять refraction нового фона через Promo.

**Итог:** полный SHA и состав; local URL; четыре размера/desktop; focused storage/replay/one-canvas/lifecycle tests и общий typecheck/lint/build; источник ошибок/ограничений отдельно; что требует visual review. Сохранять старый preview, не обновлять screenshots автоматически. На VPS и release-ветке ничего не менять.

## Handoff и реестр

Согласованный следующий integration worktree: `mono-background-sandbox-integration/5-wallet-foundation`, ветка `codex/mono-background-sandbox-integration`. ORACLE проверил, что они свободны. Предложенный общий порт `3142`; перед запуском проверить повторно. Плановый адрес `http://localhost:3142/design-lab/atmosphere` не является работающим preview до фактического handoff. Только ORACLE публикует владельцу единый результат.

GitHub create parent Issue по текущему запросу владельца получил `403 Resource not accessible by integration`. Parent/child Issue пока НЕ созданы. Запись через другой credential/инструмент не повторяется; владелец получил точный запрос исправить доступ GitHub App к Issues. Это не блокирует разрешённые локальные task windows, не оправдывает выдуманные номера Issues и не меняет режим запрета deployment.

Каждый автор отправляет ORACLE и ORCHESTR WALL: task/Issue, branch, base/head, worktree, изменённые файлы, checks+SHA, preview, preserved/lost mechanics, риски и решение владельцу. Нет ручной передачи владельцем между чатами. До появления живого preview URL не выдаётся за готовый.

Task IDs и GitHub Issue URLs добавляет координатор после фактического создания. Если GitHub integration отказывает в записи, canonical packet остаётся локально/в Git commit; Issue ID не выдумывается, отказ сообщается владельцу. Ранее #33/#38 ещё содержат устаревшую отметку о публикации из-за 403; фактически fa7 уже опубликован, не запускать повторный деплой по этой старой фразе.
