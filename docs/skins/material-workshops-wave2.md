# Novex — две мастерские материалов, волна 2

Дата: 2026-09-25. Статус: implementation packet по новому запросу владельца; не visual approval и не release authorization.

## Основание и результат

Владелец считает первый Background Sandbox слишком узким: мало материалов и настроек. Он явно запросил Pavel Fluid с глубокими настройками, объёмные частицы David Li, Paper Liquid Metal / Gem Smoke / Heatmap / Pulsing Border и строгие прямоугольные материальные мотивы. Liquid Metal на кнопках и Pulsing Border в настройках их рамки обязательны. Последнее уточнение владельца: **мастерская кнопок отдельно от мастерской фонов**.

Старт всей волны: `72742382d1354fe70dde86d90159a997b672ba9a`, последняя чистая cumulative sandbox-сборка. Она остаётся точкой сравнения. Публичная продуктовая база `fa7d6c1ff65a6505100f809c894aca9dc9851eb4` не заменяется. Не начинать от V1, PR #26 или старого локального main.

Исполнители и ORACLE: **`gpt-6-sol`, reasoning `max`**, по прямому выбору владельца. Не повышать модель до Astra автоматически. Root планирует/проверяет; ORACLE один редактирует общие runtime-файлы и собирает результат. Источники и фактические ограничения: [паспорта](material-workshops-wave2-sources.md).

Результат — работающие локальные страницы, а не новая коллекция ссылок:

| Мастерская | Содержание | Собственные данные |
| --- | --- | --- |
| `/design-lab/atmosphere` | Фон: Silk, расширенный Pavel Fluid, David Fluid Particles, строгая геометрия, совместимые Paper materials | Background drafts, slots, workspace, named library |
| `/design-lab/buttons` | Четыре реальные быстрые кнопки MONO: поверхность, иконка, рамка; ссылка на прежний Motion Lab для отклика | Button drafts, applied preview, slots, workspace, named library |

Общий **статический каталог определений материалов**, schema/контролы и GPU primitives не означают общую личную библиотеку, общий черновик или автоматически связанные revisions. Не делать один editor с переключателем «Фон / Кнопка».

## Решения и границы

1. Новый запрос расширяет прежний background-only scope: теперь разрешены локальная мастерская кнопок и применение материалов к настоящим кнопкам/иконкам/рамкам в dev-only примерке. Это не разрешение на внешний deployment, изменение опубликованных defaults или подмену всего `/mono`.
2. Прежний потолок в пять controls снят. Каждый осмысленный параметр источника должен быть доступен либо явно объяснён как неприменимый/ограниченный runtime-политикой. Сложность прячется в группы, не удаляется из возможностей.
3. Именованные эффекты переносятся из закреплённого source. CSS glow, iframe, 2D-метаболлы вместо David PIC/FLIP и простой gradient вместо Paper не считаются исполнением.
4. Старые стилистические запреты на непрерывные частицы/световые рамки и цветные декоративные материалы не отменяют нынешний явный запрос. В этих двух dev-only мастерских названные эффекты разрешены на выбранных targets. Финансовые статусы, текст, действия, focus и production defaults по-прежнему защищены.
5. Один WebGL2 context/canvas и один host-owned RAF на активную сцену. Один primary background; тяжёлые Pavel и David — альтернативы, не одновременно два фона. Несколько button passes делят тот же context и суммарный бюджет. Не запускать React ShaderMount Paper или WrappedGL David рядом с OGL.
6. Approved Promo shader, neutral relief и `ior: +1.34`/dispersion 0 не меняются. Existing Material press и Motion Lab не переписываются под видом новых материалов.
7. Контраст светлого Silk в MONO ещё не согласован. Не считать этот запрос ответом на прежний выбор затемнения: сохранить явную маркировку технической примерки. Новые материалы/банковские стартовые варианты можно создавать без переписывания Silk и Promo.
8. Корректные v1 пробы и все продуктовые ключи сохраняются. Новые recipes версионируются; никакого silent rewrite старых библиотек, нормализации их в новые defaults или удаления данных.
9. Никаких новых npm-зависимостей/lockfile, CDN/runtime remote code, новой облачной библиотеки, общих миграций SkinHost, финансовой логики, V1, push/merge/закрытия Issues или VPS/deploy.
10. Владелец остановил серверы ради памяти. Подготовка и pure tests параллельны; браузер/GPU, build и тяжёлые E2E — одна очередь ORACLE. Старые серверы не воскрешать. Один общий preview запускается ORACLE только по готовности; временный probe закрывается сразу после своего слота.

## UX: богатые настройки без перегруженной панели

- Сверху: выбранная именованная проба, dirty/save status, Undo/Redo, Pause/Restart, A/B и Save. JSON/import/export/diagnostics — в дополнительных действиях.
- Inspector показывает только выбранный материал и объект. Группы: «Цвет», «Движение», «Форма / поверхность», «Свет», «Физика», «Точно». Группы открываются независимо; compact icon tabs имеют подписи/tooltip/focus, доступные области не меньше 44px. Не уменьшать весь интерфейс через scale.
- Цвета действительно редактируются: палитра источника не сведена к трём названиям. Нужны bounded color-list, одиночный цвет/alpha и проверенный ввод; одна операция палитры — одна Undo transaction. Отсутствие визуального действия делает control недопустимым.
- Скорость не имитируется снижением FPS. Пауза останавливает время; изменение params на паузе показывает статический результат. Низкая скорость остаётся плавной при работающем render clock. Не обещать FPS-независимость, если решатель её не обеспечивает.
- «Качество» — runtime-профиль с известным бюджетом, отдельно от художественного recipe; опасные pixel ratio/количество context/неограниченные allocations не превращать в художественные sliders.
- Каждый эффект имеет исходный reference-like вариант для сравнения и подготовленные спокойные стартовые варианты. Не выдавать перестановку curated presets за полноценную генерацию случайных параметров. Сначала полноценно настраиваем и сохраняем.

### Фоны

Широкая/квадратная/портретная самостоятельная сцена; MONO fitting остаётся отдельным режимом. Все выбранные материалы доступны по смысловой совместимости. Библиотека/три slot/A-B/reload сохраняются. Фоновый editor не содержит настройку четырёх кнопок.

### Кнопки

Отдельная страница с реальными `MonoQuickActionFeedback` в `MonoScene`, не похожими декоративными карточками. Выбор «Все четыре / Отправить / Получить / Обменять / Купить» и отдельные вкладки «Поверхность / Иконка / Рамка». Редактирование одного layer не уничтожает два остальных; индивидуальные targets не смешиваются. Групповая правка — явная атомарная операция.

Liquid Metal обязателен для поверхности и пригодной icon-mask; Gem Smoke/Heatmap доступны для icon-mask и совместимой поверхности. Pulsing Border — реальная рамка кнопки с толщиной, скруглением и остальными параметрами, включая прямоугольник с radius=0. Сохранить доступный текст и DOM-hit targets, существующий press, keyboard/touch/focus. Shader не растрирует текст. При отказе GPU кнопки остаются читаемыми и работающими.

`Apply` принимает button draft только в локальную dev-примерку; `Cancel` возвращает ранее принятое preview; `Save` создаёт именованный полный snapshot. Reload восстанавливает принятые bindings и отдельный recovery draft без смешивания с background library. Из `MonoShapeTuner` — dev-only вход в **`/design-lab/buttons`**, а не раздел кнопок внутри atmosphere.

Явная команда копирования материала между мастерскими передаёт полный нормализованный snapshot только при совместимости destination target. Получатель показывает пробу/конфликт черновика, не делает скрытый Apply/Save. Копии независимы; изменение исходника не меняет другую мастерскую. Не переносить финансовые данные, raw SVG/CSS/GLSL или произвольные URL.

## Совместимость и общий контракт — M0 / ORACLE

До реализации consumers ORACLE выпускает маленький contract-only commit:

- Закрытые effect IDs и явно объявленные capabilities `background / button-fill / button-icon / button-border`.
- Старый v1 recipe parser сохраняется. Новый Fluid имеет отдельную effectVersion 2; новые материалы — собственные версии. Не расширять неявно старые пять Fluid params.
- Controls: optional group metadata; typed bounded color-list и остальные реальные scalar controls, единые bounds/defaults/parser. Общий UI facade не пропускает arbitrary object/remote URL.
- Full normalized recipes, canvas-independent material definitions, bounded assets/masks и подготовка CPU assets до GPU mount; latest-wins/cancel для дорогой подготовки. Конкретные TS signatures фиксирует ORACLE один и передаёт авторам.
- Для Paper — shared/program pass с target-local UV/phase/geometry и объявленным premultiplied-alpha/color-space contract. Не применять ACES/gamma дважды; не считать прозрачный output непрозрачным Silk.
- Один compositor и DOM target registry для настоящих кнопок/иконок/рамок и существующего Promo. Geometry/scroll/DPR/clip должны совпадать; GPU-fill делает DOM surface прозрачной только после готовности, fallback возвращает обычную поверхность. Focus ring и текст остаются поверх.
- Allowlisted existing icon masks и геометрические маски. Пока без произвольной загрузки SVG, внешних картинок или чужих демонстрационных логотипов. Paper-author владеет алгоритмами предобработки; ORACLE — manifest/target asset resolver и общим lifecycle.
- Budget перед allocation, сумма всех FBO/textures/масок/targets ограничена. Общая отправная граница host 32 MiB attachment storage, резерв Promo 4 MiB; driver overhead отдельно. Если неизменённый source требует больше, снижать явно runtime resolution/profile, не тайно механику. Новая граница выше существующей требует записанного решения root, а не снятия guard.
- Visibility/offscreen/Telegram inactive/reduced/saveData/effects-off/Strict Mode/context loss сохраняются. Неактивная мастерская ничего не крутит; массив previews не монтирует renderer на каждую карточку.

Фоновые новые workspace/library — v2 namespace с явным импортом старых v1 без их перезаписи. Кнопки — `wallet4i7.button-sandbox.*.v1`, не `working-presets.v2`. Прежние лимиты 32 named variants, 50 undo transactions и 64 KiB на единичный импорт остаются отправной точкой; oversized/error/conflict не дают ложный Saved. Снимок хранит параметры, а не GPU-field/history жестов.

## Пакеты и исключительные владельцы

### M1 — расширенный Pavel Fluid / прежний BG-3

**Владелец:** задача `01a0d217-15e5-7700-a163-7123faf7d15f`, новая собственная ветка от packet в проверенном чистом worktree; модель Sol Max.

**Own files:** `packages/ui/src/background-sandbox/effects/fluid/**` и собственный handoff. Shared ABI/host/UI не редактировать.

Сохранить старый runtime/recipe v1. Для v2 дать настройки источника: раздельные dye/velocity dissipation, pressure retention, curl, splat radius/force, shading, свободные цвета/фон/alpha, управляемая смена цветов; Pause/seeded splats/Restart как честные команды. Bloom intensity/threshold и Sunrays weight — реальные bounded passes с toggle/dependencies, не мёртвые поля. Quality/simulation resolution отделить от recipe и ограничить runtime budget. Убрать dat.GUI/analytics/рекламу/непроверенные assets, сохранить MIT и source pin.

Добавить явный режим «Рисование / Живой фон» с ограниченной deterministic подпиткой и time scale, а не делать emitter невидимым побочным эффектом. Технически доказать различие decay цвета/скорости и живого режима после длительного idle. Не рисовать похожий Flowmap вместо текущего решателя. Без catch-up spiral, бесконтрольных splats или полного reset на каждом slider. Список source controls: implemented / runtime-only / deliberately omitted with reason в handoff; не закрывать задачу после добавления только двух sliders.

### M2 — David Fluid Particles / новый исполнитель

**Own files:** `packages/ui/src/background-sandbox/effects/fluid-particles/**`, собственные source notices, tests/probe/handoff.

Перенести настоящий PIC/FLIP и сферический rendering/AO/shadow в существующий context. Отдельный ID, не перезаписывать Pavel. Частицы находятся внутри физического объёма и полностью помещаются в портретную/широкую сцену; учитывать радиус и проекцию, не только clamp world positions. Настройки цвета частиц/фона, очень медленный time scale с полезным диапазоном, размер/начальное заполнение/характер течения и сила pointer, пригодные фиксированные camera presets. Не забирать scroll/drag у страницы неявным orbit controller.

Seeded initialization вместо Math.random. Воспроизводимая стартовая композиция; честный reset после контекстной потери. Сохранить исходную физику, отличать её от добавленных художественных сил. Медленное растекание может естественно успокоиться — не обещать бесконечное движение, если оно не реализовано.

Сначала budget/capability + узкий настоящий solver/render vertical slice; затем цвет/slow/containment. Исходный fullscreen float G-buffer нельзя копировать без cap. Профили particles/grid/internal resolution выбираются ограниченно и явно. При непреодолимом GPU ограничении сдавать конкретный blocker, не заменять эффект 2D шариками. Не задерживать готовую мастерскую кнопок.

### M3 — Paper materials / новый исполнитель

**Own files:** `packages/ui/src/background-sandbox/effects/paper/**`, в том числе локальные upstream shaders/helpers, bounded preprocessors, private mask cache, четыре определения/adapters, notices/probes/tests. Shared registry/exports/host не редактировать.

Порядок: **Liquid Metal + Pulsing Border первыми**, затем Gem Smoke + Heatmap. Все четыре обязательны; первый handoff не означает закрытие остальных. Все документированные художественные params доступны через schema и groups; source range caps изменять только с объяснением. Free color palettes вместо трёх hard-coded names, низкая скорость/статическая фаза, fit/scale/offset и shape/mask где применимы.

Портировать настоящую source математику, не React ShaderMount. Сохранить смысл Poisson mask Metal/Gem и luminance/blurs Heatmap; не кормить Heatmap одной alpha. Кэшировать ограниченные маски по geometry/asset/version, не прогонять CPU solver на каждый кадр/slider цвета. Не использовать штатные SVG4096/Heatmap1750 blindly: ограничить ресурсами целевого элемента и честно проверить качество. Использовать allowlisted реальные иконки + rounded/strict rectangle, прозрачный фон для compositing, source-derived 128² noise с notice. Source baseline сравнивается с адаптацией на согласованном GPU слоте; fixed-quality differences документировать.

### M4 — строгая геометрия / новый исполнитель

**Own files:** `packages/ui/src/background-sandbox/effects/vault-grid/**`, tests/probe/handoff. Это оригинальная реализация, без заимствования нелицензированных картинок.

Один bounded shader family с тремя реально различимыми вариантами: квадратные металлические плитки с фаской; ортогональные рёбра; гравированная сетка/тонкие канавки. Характер precise/heavy/controlled, без отскока и декоративного хаоса. Мотив должен иметь свет/рельеф/шероховатость и ясную геометрию, не просто CSS шахматную подложку.

Параметры: шаг/размер ячейки, зазор/ширина канавки, bevel/depth, шероховатость, направление/сила света, цвета основы/металла, редкий или нулевой дрейф. Background и button-fill пригодность объявлена явно; мелкая иконка не требует того же рисунка. Термин «физический» здесь означает убедительный material shading, не rigid-body simulation. Предпочесть недорогой один проход на существующем backend, нулевой motion допустим и полноценен.

### M5 — мастерская фонов и общие controls / прежний BG-1

**Владелец:** `01a0d216-ff4d-7b90-8bbc-8b63a3c422b9`, Sol Max; новая собственная ветка от packet.

**Own files:** существующие `apps/miniapp/src/design-lab/background-sandbox/**`, `mono-atmosphere-lab.tsx/.module.css/.test.tsx`; новые `apps/miniapp/src/design-lab/material-controls/**`; sandbox-specific тесты вне общих config. Не редактировать Button Workshop, MonoScene, host, маршруты или product codecs.

Обновить фоновой editor: группы/точные настройки, color palettes, больше эффектов из registry, сохранение всех версий и explicit copy handoff. Группы не заставляют листать все настройки разом; UI не урезает schema. Разнести художественные параметры и runtime quality/diagnostics. Named Save/reload/3slots/A-B/ошибки quota/конфликт вкладок не регрессируют.

Первым небольшим commit предоставить переиспользуемый `MaterialControls` для M6 по ABI ORACLE: typed props и grouped fields без владения storage/target state. M6 не пишет дубликат bounds или общий controls module. Пока ABI/компонент готовится, оба UI автора работают над своими pure state/storage tests, а не ждут без дела.

### M6 — отдельная мастерская кнопок / новый исполнитель

**Own files:** `apps/miniapp/src/design-lab/button-workshop/**`, новый `mono-buttons-lab.tsx/.module.css/.test.tsx`, button-workshop-specific E2E; `apps/miniapp/src/mono-preview/mono-shape-tuner.tsx` — только согласованный dev-link prop/UI. Маршрут, scene bridge, mono-preview/MonoScene/MonoQuickActionFeedback и shared controls принадлежат другим владельцам.

Сделать отдельный ButtonLabDocument/session/codec/storage и UI по сценарию выше. Три независимых slot, выбранный target/layer, Save/Open/Save-as/recovery, Apply/Cancel только accepted lab state. All-four operation atomic; individual edits не протекают. Roundtrip сохраняет материал поверхности + иконки + рамки одновременно. Прежний approved press и сам Motion Lab не менять; дать отдельный переход к нему при необходимости.

M6 потребляет настоящий scene renderer/target bindings от ORACLE и MaterialControls от M5. Не создавать fake wallet, свой GPU canvas или отдельную копию финансовых mock-данных. Пока зависимости готовы только типами — state/storage можно доказывать pure tests; финальная приёмка обязана пройти на настоящих четырёх кнопках.

### M0 — ORACLE, общая сборка

**Владелец:** `01a0cfcc-f35e-7a50-a624-6dda3022b4fb`, Sol Max. Отдельная новая integration ветка/worktree от packet, не переписывать сохранённую wave1.

**Exclusive files:** shared `packages/ui/src/background-sandbox/*` вне effect-owned каталогов, assets/registry/host/compositor/contracts; `packages/ui/src/index.ts`; `packages/ui/src/mono/mono-optical-*`; `apps/miniapp/src/mono-preview/{mono-scene,mono-quick-action-feedback,mono-preview}.tsx`; shared lab scene bridges и их scoped CSS; оба dev-only routes, shared test configs, THIRD_PARTY_NOTICES/source-catalog. Root documentation worktree не редактировать.

Bootstrap контракт сначала. Затем последовательно принимать проверенные commits и давать один cumulative preview origin: **buttons Metal+Border + сохранение** первым законченным новым маршрутом, backgrounds/остальные эффекты добавляются к той же сборке. Не форсировать PR/merge/deploy. Сдавать незавершённые участки честно, не называть выполненной всю волну по двум эффектам.

## Проверки, handoff и остановка

Авторы: source pin/license, точные base/head, own file list, работа каждого control, нормализованный roundtrip, lifecycle/resources, сохранённые/изменённые механики и ограничения. Исследовательские screenshots или SwiftShader не являются hardware/mobile/visual approval.

ORACLE один выполняет общий gate: typecheck/lint/build, focused suites и живой сценарий двух мастерских: создать две пробы в каждой, изменить/Save/switch/return/reload; bindings fill/icon/border не теряются; явное копирование не связывает черновики; Apply/Cancel/Undo/A-B не пишут product keys. Реальные buttons/focus/touch/scroll/320/390/430/480/desktop, один context/RAF, rapid switch, loss/restore, guards, budget/failure cleanup. Не повторять полный одинаковый прогон каждого автора без конкретной причины. Visual snapshots не переписывать без владельца.

После общей примерки остановиться на visual review. Выдать две работающие ссылки одного origin, полный cumulative HEAD, включения/исключения и известные ограничения. Основной сайт и GitHub default остаются прежними. До фактического запуска ссылки не обещать как работающие.

GitHub Issues новой волны ещё не созданы: предыдущая запись блокирована 403 GitHub App. Не обходить отказ и не придумывать номера; локальный packet/реестр позволяют работать. Task IDs новых окон, exact ABI и промежуточные handoff добавляются после реального создания, без повторного запуска уже сданных задач.

## Фактический запуск исполнителей

Frozen requirements checkpoint: `e33b3e75d41a30f6c34bd526caf856754afdcae5`. Записи реестра после него не меняют базу задач и не требуют перебазирования каждого автора.

| Пакет | Задача | Реальный task ID | Worktree под `C:/Users/iwwa/.codex/worktrees/` | Ветка |
| --- | --- | --- | --- | --- |
| M1 | Фоны — Fluid: течение и инерция | `01a0d217-15e5-7700-a163-7123faf7d15f` | `0a8a/5-wallet-foundation` | `codex/mono-materials-fluid-v2` |
| M2 | Фоны — объёмные частицы David Li | `01a0d663-c045-7492-aeec-72f38d61ef31` | `aa9e/5-wallet-foundation` | `codex/mono-materials-particles` |
| M3 | Материалы — Liquid Metal, Gem Smoke, Heatmap и рамки | `01a0d663-d8af-7fe1-b07f-ca303353b6d7` | `908b/5-wallet-foundation` | `codex/mono-materials-paper` |
| M4 | Фоны — строгие металлические формы | `01a0d663-dc2f-7fe0-880f-39b08a8c565d` | `32f4/5-wallet-foundation` | `codex/mono-materials-vault` |
| M5 | Фоны — песочница и библиотека проб | `01a0d216-ff4d-7b90-8bbc-8b63a3c422b9` | `a522/5-wallet-foundation` | `codex/mono-materials-background-ui` |
| M6 | Кнопки — отдельная мастерская материалов | `01a0d663-dd5a-7503-adbc-ff7775492254` | `1144/5-wallet-foundation` | `codex/mono-materials-buttons` |
| M0 | ORACLE — единая сборка Novex Wallet | `01a0cfcc-f35e-7a50-a624-6dda3022b4fb` | Новый integration worktree подтверждается bootstrap handoff | Отдельная новая integration-ветка |

Для всех dispatch явно задано `gpt-6-sol` / `max`. Все шесть авторов подтвердили чистый старт на requirements checkpoint и раздельное владение. Общий ABI ещё не получен; до него разрешена независимая pure/source подготовка. Статус запуска не означает завершение реализации или доступный preview. Старые wave1 ветки сохранены.
