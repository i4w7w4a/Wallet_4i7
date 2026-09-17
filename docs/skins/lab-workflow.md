# Skin Lab: UX и контракт эксперимента

Статус: обязательная спецификация поведения

Текущая реализация — Color Lab внутри `/mono`: три цветовых slot, Dark/Light,
ручные роли и замки, deterministic randomize, history, A/B, Apply, локальные и
серверные (при настроенной БД) пресеты. Разделы про шрифты, произвольные skins,
общий `SkinHost`, account binding и lifecycle полного приложения — целевой
контракт, не утверждение об уже готовой функции. Текущий формат и его ограничения
описаны в [palette-lab-v1.md](palette-lab-v1.md).

## 1. Модель лаборатории

Skin Lab — не панель разработчика со случайными sliders. Это редактор воспроизводимого design state.

```text
Built-in skin/preset
        |
        v
   Slot baseline
        |
        v
 Live draft edits <-> Undo / Redo
        |
        +---- Compare A/B
        |
        +---- Save named preset
        |
        +---- Apply as active appearance
```

Приложение, его данные и controller продолжают жить. Lab меняет только appearance выбранного slot.

## 2. Три slot: `1 / 2 / 3`

Каждый slot хранит независимо:

- `skinId`;
- собственный baseline для Discard и текущий draft;
- group/control locks;
- seed, action counter и последнюю replay recipe;
- bounded Undo/Redo history;
- dirty status;
- optional compare baseline.

Переключение slot внутри открытого Lab:

- не remount-ит WalletAppController;
- не меняет financial data, section, period или controlled form drafts; focus возвращает по semantic target ID либо к доступному fallback;
- применяет готовые tokens/uniforms атомарно;
- меняет только preview, не записывает применённый appearance;
- активирует один renderer;
- полностью останавливает heavy resources прежнего slot.

В пределах одного skin/backend смена должна быть мгновенной через tokens/uniforms. Если slot содержит другой backend, допустим короткий статический переход во время `dispose -> mount`; его нельзя маскировать вторым одновременно живущим WebGL context. CPU assets можно подготовить заранее без GPU lease.

Built-in стартовые slot первого skin:

```text
1  Ledger
2  Frost
3  Mercury
```

Slot — рабочее место, не alias встроенного preset. После редактирования он хранит собственный draft.

## 3. Панель управления

### Реализованная оболочка `/mono`

Prototype workbench использует две fixed sibling rails вокруг одной центрированной мобильной сцены:

```text
LEFT / QUICK                 PREVIEW                  RIGHT / FINE
[Variants 1 / 2 / 3]     [clean mono-page]          [Environment]
[320 / 390 / 430 / 480]  [no lab controls]          [Embedded Optics]
```

- левая rail содержит `Варианты` и `Экран`;
- правая rail содержит `Среда` и embedded `Оптика`;
- каждая секция имеет независимый accessible collapse;
- один master switch скрывает/возвращает обе rails, не меняя их expanded state и не сдвигая preview;
- ниже `1200px` rails становятся dismissible drawers: отдельные launchers, scrim, Escape, `inert` для скрытого содержимого и возврат focus к launcher;
- rail visibility/collapse — только chrome state. Эти действия не сбрасывают, не применяют и не перечитывают design draft.

Optical controls исполняются live. Draft хранится отдельно от applied preview candidate для каждого из трёх текущих directions. Collapse секции, master hide и закрытие compact drawer сохраняют draft. `По умолчанию` явно заменяет draft текущего direction утверждённым built-in recipe; только `Применить` нормализует и пишет candidate в `wallet4i7.mono.optical-preview.v1`.

Четыре viewport profile — реальные container widths:

| Кнопка | Resolved inline-size | Назначение |
|---|---:|---|
| Compact | `320px` | нижняя граница композиции |
| Standard | `390px` | основная мобильная проверка |
| Wide | `430px` | широкий телефон |
| Canvas | `480px` | максимум skin scene |

Preview не масштабируется через `transform`: `.mono-preview-frame` получает реальную ширину и становится named inline-size container. Внутренние responsive rules используют container queries/`cqw`, а fixed nav получает ту же resolved width. Если browser viewport уже выбранного profile, применяется clamp до доступной ширины без horizontal overflow. Поэтому кнопки проверяют композицию skin, а не имитируют уменьшенный screenshot.

Эта оболочка — уже рабочий инструмент визуальной настройки, но ещё не общий Skin Lab: Ledger/Frost/Mercury остаются фиксированными directions с отдельными optical drafts, без full slot snapshot, locks, history, deterministic randomize и production Apply.

### Целевая общая лаборатория

Desktop/tablet controls после архитектурной миграции сохраняют тот же принцип внешних rails и дополняются полным session contract:

```text
[1 Ledger] [2 Frost] [3 Mercury]
[Direction] [Seed]
[Randomize v] [Undo] [Redo]
[Compare] [Save] [Apply] [Default]
```

На мобильном full Lab может заменить prototype drawers на accessible Bottom Sheet, но scene остаётся единственной и не сжимается до нечитаемого split view. Выбор shell не меняет session semantics.

Три уровня:

1. **Quick** — slots, direction, seed, global randomize, compare, apply.
2. **Fine** — Typography, Tone, Geometry, Material, Liquid, Motion, Components.
3. **Diagnostics** — contrast, glyph coverage, resolved constraints, fallback, canvas/RAF, DPR и dirty diff.

У каждого параметра есть label, value, control, lock, point-randomize, reset и короткое объяснение влияния.

## 4. Hotkeys

Только при открытом Lab:

- `1`, `2`, `3` — активировать slot;
- `R` — global randomize текущего slot;
- `Ctrl/Cmd+Z` — Undo;
- `Ctrl/Cmd+Shift+Z` — Redo;
- `A`/`B` — compare snapshots, если Compare mode активен.

Hotkeys игнорируются:

- в `input`, `textarea`, `select`, `contenteditable`;
- во время IME composition;
- когда верхний modal/dialog принадлежит другому flow;
- когда Lab закрыт.

Каждая команда имеет явную кнопку и accessible name; keyboard shortcut не является единственным способом.

## 5. Randomize scopes

### Global

Меняет все effectively-unlocked randomizable controls текущего slot.

Цель — действительно новый resolved value для каждого eligible control, а не формальная перетасовка seed. Sampler исключает текущее значение после quantization/normalization и проверяет cross-field constraints. Если у control нет второго допустимого значения при текущих locks/constraints, он остаётся прежним и попадает в явный `skipped` список с причиной. UI показывает `changed / locked / constrained`; он не обещает невозможное «изменено всё», когда часть полей зафиксирована.

### Group

Меняет только выбранную группу, например:

- Typography;
- Tone;
- Geometry;
- Material;
- Liquid;
- Motion;
- Components.

### Point

Меняет один control. Если control locked либо его group locked, команда disabled/no-op и сообщает причину.

Та же гарантия нового допустимого значения действует для Group и Point. Для continuous slider отличие не меньше одного шага schema; для discrete choice — другой ID. Неуспешная операция не расходует action counter и не создаёт Undo запись.

Все scopes используют один schema sampler и один constraint engine. Нельзя писать отдельный «быстрый» randomizer в UI component.

## 6. Замки

```text
effectiveLocked(control) =
  groupLocks.has(control.groupId)
  OR controlLocks.has(control.id)
```

- Group lock замораживает subtree.
- Control lock замораживает конкретное значение.
- Частично заблокированная группа показывает mixed-state.
- Unlock дочернего control внутри locked group не делает его изменяемым.
- Explicit slot load загружает точный snapshot; иначе сравнение `1/2/3` теряет смысл.
- Randomize и direction change не меняют locked/out-of-scope values.
- Если новый candidate несовместим с locked values, sampler resample/отклоняет операцию и объясняет constraint. Он не переписывает lock тайно.

Locks — часть lab workspace. Saved production preset не нуждается в них, но portable Lab export может включать locks для продолжения эксперимента.

## 7. Детерминированная случайность

Нельзя использовать последовательный global PRNG: тогда lock одного поля сдвинет все следующие результаты.

Для каждого control вычисляется независимый поток:

```text
controlSeed = stableHash(
  randomizerVersion,
  catalogVersion,
  skinId,
  configVersion,
  schemaHash,
  userSeed,
  scope,
  groupId,
  controlId,
  actionCounter
)
```

Replay recipe также содержит base config hash либо полный base snapshot. Одинаковый seed без schema/base не является воспроизводимым рецептом.

Direction ID и версия его распределения входят в recipe/catalog version. `actionCounter` увеличивается только после успешной randomize transaction; locked/no-op/error его не расходуют. Смена user seed атомарно сбрасывает counter в `0`, а Undo возвращает оба значения. Это позволяет повторить результат после перезагрузки и объяснить его пользователю.

Randomization проходит четыре стадии:

1. определить scope и effective locks;
2. сэмплировать только allowlisted IDs/ranges;
3. решить cross-field constraints, не меняя locked/out-of-scope values;
4. normalize и validate contrast, glyphs, resources и capability invariants.

Одна команда randomize — одна Undo transaction.

## 8. Directions вместо хаоса

Skin может объявить curated distributions. Для `mono-ledger-v1`:

| Direction | Характер sampling |
|---|---|
| Ledger | меньше radius, motion, blur и optical strength |
| Frost | больше softness/transparency, средний IOR |
| Mercury | сильнее refraction/edge highlight, но меньше focal objects |

Direction не является preset. Это распределение, внутри которого randomizer ищет варианты.

Зависимые значения не выбираются вслепую. Например, сильный IOR требует более мягкого field и ограниченного highlight; display font может быть выбран только вместе с существующим весом и подходящим numeric role.

## 9. Что можно и нельзя рандомизировать

Можно, если schema и validator разрешают:

- neutral lightness profile;
- border contrast;
- typography set, реальные weights/axes, scale и tracking;
- spacing density и radius scale;
- material opacity, shadow и fallback-safe blur;
- curated effect ID;
- безопасные liquid params;
- motion profile/intensity;
- component recipe variants.

Нельзя:

- content, labels, actions и navigation order;
- semantic status и transaction meaning;
- focus order/ring, touch targets и safe-area;
- accessibility/lifecycle/performance guards;
- raw color/CSS/font URLs;
- dependency/package/registry names;
- shader source или arbitrary flow/shape mode;
- pixel ratio и number of contexts/RAF;
- user/account data.

## 10. History

Транзакции:

- slider pointer-down -> updates -> pointer-up = одна запись;
- keyboard repeat одного control = одна запись после idle/keyup;
- randomize/reset/import/direction/preset/seed/lock = по одной записи;
- Compare toggle = без записи;
- Apply/Save не должны дробить предшествующий edit.

После Undo любой новый edit удаляет future. История bounded, стартовый предел — 50 transactions на slot. Snapshot включает draft, skin/config/catalog versions, locks, seed, action counter, direction и replay metadata; хранить только `C[]` недостаточно. Для крупных snapshots допустимо хранить structural patches/inverse ops, но публичная семантика остаётся «точное восстановление».

## 11. Compare

На 320–480 px side-by-side искажает композицию и удваивает GPU cost. Используется A/B toggle:

- `A` — pinned baseline/preset;
- `B` — текущий draft;
- один Dashboard и один renderer;
- overlay кратко показывает `A · Ledger` / `B · Draft`;
- toggle не меняет draft, history или storage;
- animation time для визуального сравнения фиксируется или ставится на паузу.

Сравнение разных backends использует тот же host transition и может иметь короткий static fallback; обещание мгновенного toggle относится только к общему backend. A/B никогда не создаёт вторую сцену рядом с первой.

Для CI screenshots всегда фиксируются skin, preset/resolved config, seed, counters, viewport и animation state.

## 12. Save, Apply, Default и Cancel

- **Save preset** создаёт именованный full normalized snapshot. Built-in preset не перезаписывается.
- **Apply** валидирует и записывает текущий resolved draft как единый active envelope: skin ID + configVersion + config.
- **Default** загружает утверждённый built-in default текущего skin в draft текущего slot и является undoable; это не скрытый Apply.
- **Cancel/Close** прекращает preview и возвращает вид к применённому appearance; черновики трёх slot остаются в workspace для следующего открытия.
- **Discard slot** отдельно возвращает текущий slot к его baseline и является undoable. Это не удаляет saved presets и не меняет применённый appearance.
- **Delete/overwrite user preset** — отдельная явная команда.
- Dirty indicator показывает отличие slot draft от его baseline и отдельно статус «не применено» относительно active envelope.

Lab может autosave workspace для восстановления после reload. Это не означает автоматическое Apply в приложение.

## 13. Export и Import

Различаются два формата:

### Production preset export

```text
schemaVersion
skinId
configVersion
catalogVersion
normalized resolved config
font/asset IDs
provenance metadata
```

### Lab workspace export

Дополнительно может содержать:

```text
three slots
seed/counters
group/control locks
last replay recipe
compare metadata
```

Ни один формат не содержит code, CSS, HTML, shader source, remote URL, secrets или wallet/profile data.

Import:

- ограничен по размеру;
- сначала parse в `unknown`;
- проверяет envelope и field allowlist;
- отклоняет unsupported schema целиком;
- мигрирует только через явный versioned migrator;
- показывает preview/diff до Apply;
- не выполняет dynamic import/eval;
- не применяет половину повреждённого preset.

Export -> Import обязан воспроизводить resolved appearance даже после изменения random catalog. Поэтому export хранит не только seed, но и resolved values/catalog version.

## 14. Resource lifecycle

После цикла `1 -> 2 -> 3 -> 1`:

- в DOM максимум один skin canvas;
- максимум один WebGL context и persistent RAF;
- старые timers, observers, listeners и pointer handlers удалены;
- heavy assets/fonts неактивных skins не продолжают грузиться;
- controller/app state прежний;
- console свободна от shader/hydration errors.

Preset switch внутри одного backend должен обновлять uniforms/tokens без создания renderer. Full skin switch идёт через host lease: `prepare next` без GPU, `dispose old`, `mount next`; устаревший async prepare отбрасывается по generation ID. Ошибка mount показывает static/opaque fallback. Перекрывающий WebGL cross-fade запрещён.

## 15. Validation matrix

### Unit/property

- fixed golden seeds;
- per-control stream независим от locks соседей;
- global/group/point scope;
- group/control lock precedence;
- impossible constraints;
- normalization/migrations;
- Undo/Redo branching;
- export/import round-trip;
- malformed/oversized import.

### Component

- accessible sliders, lock toggles и value labels;
- keyboard steps и hotkey exclusions;
- focus preservation;
- slider history coalescing;
- font loading/failure state;
- dirty/compare semantics.

### E2E

- reload всех slot;
- многократный `1 -> 2 -> 3 -> 1`;
- no leaked canvas/RAF/listeners;
- inactive fonts/assets не запрашиваются;
- offline and WebGL failure;
- no hydration mismatch;
- mobile keyboard и Telegram safe-area.
