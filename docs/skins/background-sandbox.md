# Background Sandbox — первая рабочая волна

Статус: согласованное направление владельца; технический packet для изолированной реализации, не визуальное утверждение материалов и не разрешение публикации.
Дата: 2026-09-24. База: `fa7d6c1ff65a6505100f809c894aca9dc9851eb4` (`codex/mono-release` и `codex/mono-deep-iteration`).
Координатор: ORCHESTR WALL. Единственный сборщик и редактор общей графической интеграции: ORACLE.

## 1. Решение

Развиваем существующий dev-only `/design-lab/atmosphere` в самостоятельную мастерскую живых фонов. Не создаём ещё одну MONO, второй редактор, новый репозиторий, админку или универсальный SkinHost.

Путь владельца:

`чистая сцена → настроить материал/движение → сохранить именованную пробу → сравнить A/B → примерить ту же recipe в MONO → вернуться к редактированию → отдельное решение об интеграции`.

Сохранение лабораторной пробы, примерка в окружении кошелька и изменение рабочего пресета — три разные операции. В этой волне третья операция не реализуется. Песочница остаётся самостоятельным инструментом после будущей интеграции.

Первый вертикальный результат — Silk с полноценным Save/Open/A/B. Параллельно готовим Fluid как вторую, действительно другую механику. Не ждём Fluid, чтобы показать первую полезную сцену; не выдаём упрощённую flowmap или движущуюся картинку за fluid solver.

## 2. Что показал аудит реального проекта

| Уже существует | Что развиваем, не дублируя |
| --- | --- |
| `MonoAtmosphereLab`, отдельный маршрут, toggle standalone/MONO, history, JSON preview | Большая чистая сцена вместо обязательной узкой брендированной карточки; именованная библиотека вместо одного raw config; закрепляемый A/B |
| `MonoScene.atmosphere` и `surfaceRef` | Runtime-only подстановка той же recipe в настоящий renderer кошелька; не копия финансового экрана |
| `MonoLabIconButton`, `MonoLabSliderRow`, disclosure/focus discipline | Компактный общий chrome с содержательными параметрами конкретного эффекта |
| SVG/CSS Obsidian/Aperture/Iris | Сохраняем как legacy/контрольные материалы; они не являются физической жидкостью или новым shader material |
| `@wallet/ui` зависит от `ogl@1.0.11` | GPU adapters живут здесь, а не импортируют незаявленный OGL через зависимости приложения |
| `wallet4i7.mono.working-presets.v2`, полный appearance envelope | Не меняем схему и значения рабочего MONO ради лаборатории |
| Один самостоятельный `MonoOpticalGlass` в Promo | Нужен узкий lab-owned compositor для совместной GPU-примерки; `active=false` не освобождает context |

Часть старых `docs/skins` ещё описывает working-presets.v1 и отсутствующий Font Lab. Это исторические описания, не основание вернуться на старую ветку. Общий SkinHost действительно пока не реализован. ORACLE добавляет точечное уточнение актуального состояния, не переписывая все исторические документы.

## 3. Материалы первой волны

Подробные pinned sources и различия лицензий: [background-sandbox-sources.md](background-sandbox-sources.md).

### Silk — материал через свет

Сохранить три слоя процедурных складок и направленный шелковистый блик. Мышь управляет светом, не растягивает физическую ткань. Первый adapter — адаптация Radiant Silk Cascade на существующий OGL/WebGL2, без demo UI, Svelte, внешних текстур и новой зависимости.

В основном inspector 3–5 работающих художественных controls: течение, сила/ширина блика, рельеф или масштаб складок, палитра. Не выводить выдуманный параметр, который лишь меняет общую opacity. Исходный контрольный характер и спокойная Novex-проба доступны отдельно. Выход и повторный вход указателя не дают скачка света; время сглаживания задаётся в секундах, не числом кадров.

### Fluid — память движения среды

Сохранить поля скорости/красителя, перенос, давление и вихри. Движение продолжается после жеста; это не исчезающий след по opacity. Адаптируется собственный solver/pass из Pavel Fluid, без dat.gui, рекламы, чужой dithering-текстуры и случайной радужной палитры.

Основные controls: сила воздействия, радиус, вихревость, затухание движения, палитра. Смысл параметров не унифицируется искусственно с Silk. Начальный режим — понятное рисование/drag; если добавлен hover-режим, он явно назван адаптацией, а input boundary сохраняет клавиатуру и прокрутку. Разрешение, pressure iterations и DPR — ограниченная runtime quality policy, а не случайные художественные значения.

Сначала базовый полноценный solver и хороший свет/цвет. Bloom/sunrays не обязательны для первого результата: отключение отдельно описывается как изменение картинки. Если solver не проходит бюджет, объявить ограничение и оставить первый материал работающим; не заменять solver flowmap молча.

### Что не входит

Droplets остаётся референсом соединения объёмов из-за ограничений будущего распространения генератора. OGL Flowmap — технический резерв локальной деформации, не третья обязательная реализация. Border Lab, упаковка материала в кнопку/меню, layering stack, node editor, публичный SDK, AI-генерация картинок/видео и запись истории жестов — последующие отдельные задачи.

## 4. Рабочее место

- По умолчанию большая самостоятельная поверхность без логотипа, баланса и обязательного sample-текста. Материал не импортирует WalletSnapshot, profile, действия или browser storage.
- Сверху: имя открытой пробы и честный статус `Изменено / Сохранено / Не удалось сохранить`, компактные Undo/Redo, Pause/Restart, A/B и Save. Название новой пробы вводится после Save-as, не постоянной формой.
- Один компактный inspector. У иконок tooltip при hover/focus, accessible name, hit area не меньше 44 px. Числовые поля и клавиатура дополняют slider; gesture — одна undo transaction.
- Библиотека сохранённых проб — один вход. JSON/import/export, provenance, runtime diagnostics — в дополнительных действиях. JSON textarea существует только в выбранном действии.
- `Новый вариант` может выбирать только curated effect-specific значения из schema, с seed/version/counter, locks и Undo. В первой поставке не нужен универсальный случайный shader/code generator. Не обещать кнопку генерации до работающего связного sampler.
- A — закреплённая сохранённая recipe, B — draft. Один renderer, не две одновременно живущие GPU-сцены. В режиме A редактирование B не теряется; возвращение B восстанавливает её draft.
- Переключение материала/пробы с dirty draft даёт Save / Discard / Back; сохранение в недоступный storage не притворяется успешным. При conflict другой вкладки не затирать более новую revision.
- Отдельный viewport chrome: широкая сцена, квадрат, портрет; для MONO fitting — реальные 320/390/430/480 CSS px. Никакого scale. Контур/границы stage — только геометрия примерки, не новая border-effect система и не параметр фонового материала.
- В режиме MONO видна пометка `Примерка · оформление кошелька не изменено`. Нет рабочей кнопки `Применить в продукт`, которая пишет текущий preset.

## 5. Минимальная граница данных

ORACLE фиксирует общий type-only ABI до присоединения adapters. Поля ниже — смысловой контракт, конкретные имена exported types фиксирует один владелец:

```text
BackgroundRecipe
  schemaVersion / implementationId / implementationVersion / provenanceId
  full normalized effect-specific params / allowlisted asset IDs / seed when needed

SavedTrial
  id / name / revision / recipe

SandboxWorkspace
  selectedTrial / material-local drafts / three independent comparison slots
  bounded history / pinned compare reference / generation
```

Три сравниваемых slot — данные, не три renderer и не Ledger/Frost/Mercury. Именованная библиотека может содержать больше трёх проб. Не объединять её с тремя направлениями MONO.

Новые ключи: `wallet4i7.background-sandbox.library.v1` и `wallet4i7.background-sandbox.workspace.v1`. Старый `wallet4i7.mono.atmosphere-lab.v1` сохраняется; явный read-only legacy adapter предлагает восстановить старую SVG/CSS-пробу без переинтерпретации в Silk/Fluid. Старые product/V1/palette keys не удаляются и не переписываются.

Save сохраняет полную normalized recipe и revision, не patch к изменяемому built-in. Workspace recovery/autosave не означает Save именованной пробы или Apply MONO. Сериализация — field allowlist, finite numbers, известные версии/IDs, bounds и size limit до parse/import. Стартовые инженерные ограничения: 64 KiB на импорт одной recipe, 32 именованные пробы, 50 undo transactions на slot; размеры проверяются в байтах. Storage failure сохраняет draft и возможность экспорта. Импорт сначала preview, затем явное открытие новой копии.

JSON содержит данные оформления, не raw GLSL/CSS/HTML, remote URLs, JavaScript, wallet data, tokens или произвольные assets. Effect/config version не маскирует несовместимость: неизвестный adapter остаётся объяснимо недоступным, а не заменяется другим материалом.

Сохранение Fluid/Flowmap сохраняет параметры, не накопленное GPU-поле. Open/A-B reset используют определённый начальный seed/phase. Надпись о перезапуске симуляции честная; обещания одинаковых пикселей на разных GPU или сохранённого жеста нет. Workspace может восстановить draft, но не всю физическую историю.

## 6. Один графический владелец

`packages/ui/src/background-sandbox/` — узкая внутренняя область, не новый package/framework. Host владеет canvas/context, scheduling, DPR, resize, visibility, pointer collection, capability fallback и generation/latest-wins. Effect instance владеет только своими program/texture/FBO, умеет update/resize/render/reset/dispose и получает host-owned context/time/input. Никаких собственных canvas, RAF, listeners, interval, storage или wallet imports внутри effect.

Не использовать shared singleton renderer между worktrees/вкладками. В одной активной сцене максимум один WebGL context, один постоянный RAF и один primary backdrop. Effect switch: подготовка без GPU → dispose старого → mount нового; stale async result не захватывает context. Смена параметра обновляет uniforms, не размонтирует сцену.

### ABI v1, согласован с ORACLE

Источник типов — `packages/ui/src/background-sandbox/contracts.ts`, пишет только ORACLE. Effect ID: `silk` / `fluid`, version 1. Старые CSS recipes не переименовываются в эти ID. Сохраняемый effect config имеет `kind: "novex-background"`, `version: 1`, `effectId`, `effectVersion: 1`, `seed` и typed `params`; metadata происхождения разрешается из статического registry по effect/version. Полная saved recipe содержит этот config и необходимые allowlisted asset IDs, а не указатель на изменяемые defaults.

```ts
interface Effect<P> {
  resize(viewport: Viewport): void;
  update(params: Readonly<P>): void;
  render(frame: Readonly<{
    time: number; dt: number; pointer: PointerFrame;
  }>): FrameTexture;
  reset(seed: number): void;
  dispose(): void;
}
// Definition.create(hostGl, {params, seed, viewport, limits}) -> CreateResult<Effect<P>>
// Definition.schema: defaults + bounds/controls + strict parser, без новой библиотеки.
```

`FrameTexture` — заимствованная OGL Texture с pixel width/height. Её владеющий adapter удаляет target при resize/dispose; host не удаляет чужую texture. Render pass не пишет в default framebuffer: финальный вывод делает compositor. Viewport содержит отдельно CSS size, physical size и host-clamped DPR. OGLRenderingContext/Texture берутся из установленной OGL, не из второго renderer.

PointerFrame — primary UV с началом снизу слева, inside/down и bounded ordered samples с id/phase/UV/delta/time/buttons. Первый sample, resize и re-entry имеют delta=0; leave/cancel сбрасывают down. События controls не становятся splat. Время — секунды активной сцены; dt ограничен, resume начинается с dt=0. Update не сбрасывает поле; reset делает это явно. Resize/reset/context restore могут перезапустить Fluid — это фиксируется в UI и handoff. Dispose идемпотентен; create failure освобождает частично созданные resources, не теряя чужой context.

Предпочтение — OGL passes на host GL. Если Fluid использует raw GL, владелец обязан согласовать полную границу состояния с OGL state cache; иначе это источник ошибок соседнего Promo pass, не оптимизация. Float targets, фильтрация и суммарный FBO allocation входят в CreateResult/capability diagnostics. Конкретные TS exports становятся обязательными после contract commit ORACLE; исполнители не создают свои копии контрактов.

Hidden/offscreen/inactive Telegram, reduced motion, saveData и effects-off останавливают работу; coarse pointer не захватывает scroll. Pause, calm конкретного материала и active всего host — разные состояния. При возвращении не накапливать огромный dt или первый pointer impulse. Context loss/restoration, отсутствие float render targets, Strict Mode и WebGL failure имеют читаемый статический fallback, который не выдаётся за полноценную механику. Runtime guards не переписывают сохранённую recipe.

### MONO fitting — отдельный интеграционный шаг ORACLE

Используется тот же material pass и настоящая MonoScene. Общий lab canvas рисует background pass и управляемый Promo-region/pass; DOM текста/controls остаётся живым и с исходной геометрией. Выделение optical kernel/source из MonoOpticalGlass допускается только минимальным compatibility-refactor: обычный компонент сохраняет default поведение, source, approved settings и единственность своего runtime вне sandbox.

Нельзя просто передать `active=false` в Promo, наложить второй context, скрыть исходный shader или rasterize кошелёк. Проверяются region geometry, clipping, UV, scroll/resize и DPI. Текущий Promo использует `makeNeutralRelief()`, не texture фона: первая совместная примерка сохраняет этот источник. Связанная рефракция нового фона через Promo была бы новым визуальным решением.

До доказательства совместного pass standalone работает отдельно; fitting не рекламируется как готовый. Если faithful coexistence требует крупного общего SkinHost или изменения утверждённого материала, ORACLE останавливает только fitting, приносит узкий доказанный риск и предложение владельцу. Самостоятельный первый результат не блокируется.

## 7. Пропорциональная проверка

Не повторять весь старый тестовый парк ради каждого commit. TDD для новых codecs/storage/state transitions и воспроизведённых дефектов. Effect owner доказывает механизм в живом локальном host и сохранение lifecycle; ORACLE проверяет общую сборку.

Обязательный сквозной путь: открыть чистую сцену → изменить видимый параметр → Undo/Redo → сохранить две именованные пробы → выбрать другую → вернуться → reload → A/B → fitting того же recipe → вернуться без потери. Проверить failure/quota/conflict и строгий импорт, отсутствие любых записей в MONO/V1/cloud.

Живые пробы: медленный жест, резкий разворот, остановка, выход/повторный вход, drag cancel, touch-scroll, resize; hidden/reduced/saveData/host inactive/context loss. Проверить один canvas/RAF и cleanup после многократных переключений. Бюджет/потерю качества измерять и описывать, а не выводить из красивого screenshot. Мобильные 320/390/430/480 и desktop; обычные controls читаемы/доступны. Физический Telegram/Safari не считать проверенным по Chromium emulation.

На общей локальной сборке: релевантные unit/component/E2E, typecheck/lint/build, отдельная короткая проверка неизменённого MONO и Promo compatibility-refactor. Visual snapshots не обновляются без решения владельца.

## 8. Выход и полномочия

Каждый исполнитель даёт полный commit SHA, base SHA, точные files, checks и их SHA, источник/изменения механики, ограничения и handoff ORACLE. Нет отдельных «последних версий» для владельца: ORACLE собирает cumulative candidate на одной экспериментальной ветке и одном стабильном local origin.

Разрешены новые изолированные worktrees/ветки, локальные commits/preview, организационные Issues и документация. Нельзя менять чужие worktrees, production presets, V1, опубликованную release-ветку, текущий 3120 или VPS; никаких force-push, merge PR и закрытия Issues. Публикация лаборатории, перенос материала в MONO и выпуск на сервер — отдельные решения, не следствие визуального выбора сцены.

Постановка исполнителям и ownership: [background-sandbox-tasks.md](background-sandbox-tasks.md).
