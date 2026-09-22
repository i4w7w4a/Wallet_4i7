# Архитектура V2 Skin System

Статус: целевая общая архитектура ещё не мигрирована; изолированный `/mono` workbench уже работает
Baseline: commit `b08cf23e5066b9c870bd89b0cc8048d1f57b82a8`

## 1. Вердикт по текущему состоянию

Репозиторий уже имеет хорошее разделение `core / platform / ui / app`, versioned normalization, Telegram/browser adapters, runtime capability detection, accessibility fallbacks и сильные тесты. Но системы скинов ещё нет.

Сейчас «тема» — параметры одного `premium liquid-dark / WebThreads` решения:

- `packages/core/src/theme.ts` содержит liquid-specific `glassOpacity`, `glassBlur`, `highlightIntensity`, `refractionIntensity`;
- `packages/core/src/visual-effects.ts` целиком описывает WebThreads;
- `AppProviders` жёстко монтирует `ThemeProvider -> VisualEffectsProvider -> Dashboard`;
- `Dashboard` одновременно controller, router, platform coordinator и точная визуальная композиция V1;
- `ProfileHeader`, Quick Actions, navigation, promo и cards напрямую импортируют конкретные React Bits adapters;
- typography сведена к одному глобальному Inter/system stack;
- Theme Studio вручную дублирует ranges, которые уже существуют в normalizers;
- каждый slider сразу пишет в `localStorage`, поэтому честного draft/cancel/compare нет;
- часть cyan/blue/green/red палитры зашита прямо в TS/CSS;
- OGL и Motion являются зависимостями всего `@wallet/ui`, даже если будущему skin они не нужны;
- assets адресуются скрытыми абсолютными `/media/...` путями.

Расширение текущего `ThemeConfig` породит условный mega-object, где каждый skin тащит чужие поля. Это тупик.

## 2. Что сохраняем

- Domain models, repository и mock data в `packages/core`.
- Browser/Telegram `PlatformBridge` в `packages/platform`.
- Определение activity, visibility, media preferences, saveData, pointer и safe-area.
- Versioned config normalization и безопасное восстановление повреждённого storage.
- Focus trap, Escape/Back hierarchy, keyboard semantics и touch targets.
- Мобильную сцену `min(100vw, 480px)` с нейтральной внешней областью.
- WebThreads lifecycle: один canvas, hot uniform updates, pause/fallback и context cleanup.
- Текущие unit/component/E2E/visual/performance baselines.

## 3. Целевая граница

```text
Wallet repository + Platform bridge
              |
              v
      WalletAppController
  navigation / overlays / period /
  privacy / commands / back order
              |
              v
          WalletViewModel
              |
              v
           SkinHost  <------ Skin Lab session
              |             slots / draft / locks /
              |             history / presets
              v
      allowlisted SkinModule
   codec + schema + recipes + renderer
              |
              v
        one active visual scene
```

Controller и общие интерактивные overlays живут выше skin. Это необходимое условие сохранения пользовательского состояния, но не достаточное само по себе: текущие локальные поля должны быть явно перенесены из V1 при миграции.

Аудит V1 обнаружил `SearchSheet.query` в `Dashboard`, `DemoActionSheet.submittedAction` в локальном `useState` и uncontrolled поля демо-формы. До включения cross-skin switching перенести search query, `ActionFormDraft` и demo submission status в `wallet-app`/общий overlay host. Эти данные не принадлежат Skin Lab storage/export. Focus сохраняется как semantic `FocusTargetId`: перед сменой запомнить цель, после mount восстановить соответствующий focusable элемент; если в новом skin его нет — перевести фокус в предсказуемый heading/trigger и объявить переход. Обещать сохранение той же DOM-ноды при смене skin нельзя.

### Изолированный workbench `/mono`

Текущий `/mono` уже отделяет лабораторную оболочку от оцениваемой сцены, но ещё не реализует общий `SkinHost`:

```text
mono-workbench
  ├─ aside quick rail     variants / viewport
  ├─ mono-preview-frame
  │    └─ main.mono-page  единственная мобильная сцена
  └─ aside fine rail      environment / embedded optics
```

Rails — фиксированные sibling-элементы, не дети `.mono-page`. Поэтому лабораторные controls не загрязняют DOM телефона, не входят в container-query геометрию skin и могут исчезнуть, не сдвигая центральный preview. На desktop обе rails видимы; ниже `1200px` они становятся поочерёдными dismissible drawers со scrim, Escape и возвратом focus к launcher. `aria-hidden` и `inert` исключают скрытую rail из навигации.

Состояние chrome (`panelsVisible`, открытая drawer, expanded sections) отделено от design state. Независимый collapse секции и общий master hide только меняют оболочку: они не вызывают Default, Apply или восстановление storage. Optical draft остаётся в памяти для каждого Ledger/Frost/Mercury direction, live обновляет uniforms и записывается в preview storage только явным `Apply`. Shape Lab следует той же prototype-only дисциплине для радиусов group shells быстрых действий и нижнего меню: draft не autosave-ится, `По умолчанию` меняет только draft активного direction, а `Применить форму` пишет отдельный локальный кандидат `wallet4i7.mono.shape-preview.v1`. Этот ключ не является product active appearance и не расширяет palette/optical schemas.

Preview profiles `320 / 390 / 430 / 480` задают настоящую inline-size `.mono-preview-frame` через allowlisted CSS variable; это не zoom и не `transform: scale`. Frame объявлен named inline-size container, а чувствительные размеры используют container queries и `cqw`. На host уже выбранного profile действует `width: min(100%, profile)`, поэтому сцена clamp-ится без горизонтального overflow. Fixed navigation получает ту же resolved width. Этот механизм остаётся prototype-only до переноса в общий responsive contract skin.

## 4. Целевые пакеты

Предпочтительна плоская структура, совместимая с текущим `packages/*`:

```text
packages/core
  wallet domain, repositories, pure calculations
  neutral PreferenceStorage contract

packages/platform
  Telegram/browser adapters

packages/wallet-app
  WalletViewModel
  WalletCommands / WalletIntent
  navigation, overlays, privacy, period
  pure reducer/controller

packages/ui-contract
  SkinDefinition / SkinManifest
  SkinConfigCodec / SkinParameterSchema
  WalletSkinProps / UiEnvironment
  preset and import/export envelopes

packages/ui-foundation
  headless accessible primitives
  focus/back/safe-area behavior
  no brand CSS, no OGL

packages/skin-lab
  session reducer
  deterministic randomizer
  locks, history, compare, persistence
  generic accessible control renderer

packages/effect-web-threads
  reusable OGL engine and lifecycle
  no wallet data or palette policy

packages/effect-liquid-glass
  real refraction backend and typed settings
  static/opaque fallbacks

packages/skin-liquid-v1
  current V1 composition, CSS, legacy codecs and assets

packages/skin-mono-ledger
  neutral Ledger skin, curated environment variants and its built-in presets

apps/miniapp/src/skins/registry.ts
  static allowlisted registry and lazy module boundaries
```

До физического перемещения файлов допускаются compatibility wrappers. Не смешивать перемещение CSS, изменение DOM и новый дизайн в одном diff.

## 5. Минимальный ABI

Псевдотипы ниже задают границу, а не финальные имена:

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type SkinManifest = {
  id: string;
  label: string;
  contractVersion: 1;
  configVersion: number;
  catalogVersion: number;
  capabilities: SkinCapabilities;
  dependencies: readonly SkinDependency[];
  assets: readonly SkinAsset[];
};

interface SkinDefinition<C extends JsonValue> {
  manifest: SkinManifest;
  codec: SkinConfigCodec<C>;
  schema: SkinParameterSchema<C>;
  presets: readonly SkinPreset<C>[];
  randomizer: SkinRandomizer<C>;
  Render: React.ComponentType<WalletSkinProps<C>>;
}

interface WalletSkinProps<C> {
  view: Readonly<WalletViewModel>;
  commands: WalletCommands;
  environment: Readonly<UiEnvironment>;
  appearance: Readonly<C>;
  openSkinLab(): void;
}
```

`UiEnvironment` поднимает текущий `VisualRuntimeCapabilities` на уровень всего интерфейса:

```text
safeArea
hostActive
documentVisible
reducedMotion
reducedTransparency
highContrast
effectsDisabled
saveData
coarsePointer
webglCapability
devicePerformanceTier
```

Runtime guards изменяют способ исполнения, но не переписывают сохранённый preset.

`SkinDefinition.Render` описывает UI, но не владеет GPU-жизненным циклом. Heavy effect управляется отдельным adapter с `prepare` (metadata/assets без захвата GPU), `mount`, `update` (same-backend uniforms/tokens), `pause`, `dispose` и fallback. `SkinHost` владеет единственной resource lease; skin не создаёт скрытый второй renderer внутри карточки.

При смене skin host выполняет state machine `prepare next without GPU -> pause/dispose current lease -> mount next lease -> restore semantic focus`. Асинхронные переключения имеют generation ID и правило latest-wins; устаревший `prepare` не монтируется. `AnimatePresence` и cross-fade не могут одновременно держать два WebGL дерева. При ошибке mount host показывает статический/opaque fallback, не пытаясь оживить два renderer. Preset того же backend идёт через `update`, без remount/context churn. Эти переходы проверяются под React Strict Mode и быстрым `1 -> 2 -> 3 -> 1`.

## 6. Skin parameter schema — один источник истины

Каждый изменяемый control имеет стабильный ID:

```ts
type SkinControl = {
  id: string;
  groupId: string;
  label: string;
  description: string;
  kind: "range" | "select" | "toggle" | "font" | "compound";
  path: readonly string[];
  min?: number;
  max?: number;
  step?: number;
  choices?: readonly string[];
  randomizable: boolean;
  sampleDistribution?: "uniform" | "weighted" | "centered" | "curated";
  compatibilityTags?: readonly string[];
};
```

Из одной schema выводятся:

- editor controls и accessible labels;
- normalization bounds;
- randomization allowlist и distributions;
- lock addressing;
- diff/reset UI;
- документация и большая часть property tests.

Сложный custom editor допустим, но изменяет config только через тот же codec/schema. Ranges не дублируются вручную в component, normalizer и test fixture.

### MONO Palette Lab V1: чистый цветовой слой

[Решение от 2026-09-17](palette-lab-v1.md) supersedes прежний запрет свободного hue/chroma именно для Palette Lab. `MonoPaletteConfigV1` и `ThemePaletteState` в `packages/ui/src/mono/mono-palette.ts` — единый versioned цветовой контракт MONO: две theme branches, recipe, role modes (`linked/offset/manual`), offsets, manual values, group/role locks и snapshots заблокированных resolved values. `MonoResolvedPalette` отдаёт OKLCH и gamut-mapped sRGB одних и тех же semantic roles; это два представления значения, не две независимые палитры. UI/storage adapters должны использовать этот контракт, не вводить параллельный список HEX.

Recipe содержит anchor hue/chroma, harmony, temperature, iridescence и отдельные для каждой темы exposure/contrast/surface response. `linkedThemes` хранит намерение редактора связывать характер; синхронизация двух ветвей, diff перед повторным связыванием и history принадлежат следующему editor/reducer слою, а не renderer. Чистый engine не читает browser storage, время или entropy и не импортирует optical settings.

`resolveMonoPalette` исправляет contrast только для unlocked linked/offset ролей; manual preview сохраняется и проверяется через `validateMonoPaletteApply`. Контраст считается после CSS source-over compositing в sRGB: непрозрачный canvas ограничивает каталог допустимых фонов, каждая core surface проверяется поверх canvas, glass tint — поверх каждой допустимой surface. Для foreground roles берётся худший фон: textPrimary `7:1`, content/system `4.5:1`, focus/strong border/chart/primary accent `3:1`. Это контракт допустимых сочетаний ролей; renderer должен отдельно валидировать новые комбинации или внешние background assets. Неизвестный фон нельзя считать проверенным. Core/content chroma выше `0.018` и прозрачный canvas блокируют Apply. `borderSubtle` — декоративный divider, не единственная граница интерактивного control.

Замки устанавливаются через `setMonoPaletteLock`, чтобы сохранить точное вычисленное значение. `updateMonoPaletteRecipe` сохраняет эти snapshots и сообщает конфликт контраста с locked role исключением. `randomizeMonoPalette` возвращает атомарные `changed/noop/error`, список changed/skipped и replay metadata с base/schema hash. FNV-1a здесь служит воспроизводимости и обнаружению изменений, не криптографической целостности или авторизации. Independent per-role streams не сдвигаются из-за lock соседа. System roles и focus не участвуют в эстетической randomization. Recovery normalizer удаляет неизвестные поля и отвергает неизвестные версии целиком; строгий import envelope с size/allowlist проверкой реализуется отдельным codec.

Расширение hue/chroma не меняет optical Ledger JSON, IOR/geometry/flow/dispersion, semantic financial status, DOM/focus order или resource budgets. У renderer по-прежнему один WebGL context и один постоянный RAF.

## 7. Preset, draft и session

```ts
type SkinPreset<C> = {
  id: string;
  name: string;
  skinId: string;
  configVersion: number;
  catalogVersion: number;
  config: C;
  provenance: PresetProvenance;
};

type EditorSnapshot = {
  skinId: string;
  configVersion: number;
  catalogVersion: number;
  draft: JsonValue;
  groupLocks: readonly string[];
  controlLocks: readonly string[];
  seed: string;
  actionCounter: number;
  directionId: string;
  lastReplay: RandomizeRecipe | null;
};

type SkinLabSlot = {
  baseline: EditorSnapshot;
  present: EditorSnapshot;
  past: readonly EditorSnapshot[];
  future: readonly EditorSnapshot[];
};

type SkinLabWorkspace = {
  activeSlotId: 1 | 2 | 3;
  slots: readonly [SkinLabSlot, SkinLabSlot, SkinLabSlot];
  compare: CompareState | null;
};
```

Built-in preset неизменяем. User preset хранит полную нормализованную config. Patch к built-in запрещён: обновление базового preset не должно незаметно менять сохранённый результат.

Три slot содержат независимые drafts, locks, seeds и histories. History хранит полный editor state (либо обратимые операции к нему), а не только config: Undo обязан восстановить lock, seed, counter, direction и replay metadata. `baseline` — точка Discard данного slot; `present` — его live draft. Переключение slot меняет только preview в открытом Lab; применённый appearance не записывается. Heavy resources неактивных slot не продолжают жить.

## 8. Persistence envelopes

Минимальное разделение:

```text
wallet4i7.appearance.active.v1
wallet4i7.skinlab.workspace.v1
wallet4i7.skin.<skinId>.presets.v1
```

| Envelope | Содержимое |
|---|---|
| active | единый envelope: skin ID, configVersion и применённая normalized config; без slot ID |
| workspace | activeSlotId, три baseline/present, locks, seed, counters, compare metadata, bounded history |
| presets | named full config snapshots |

Применённый appearance должен запускаться без существования Lab workspace. Удаление/повреждение workspace не меняет выбранный skin/config. Открытие Lab создаёт или восстанавливает workspace отдельно; `1/2/3` выбирают preview, а не делают скрытый Apply. `Apply` валидирует и записывает единый active envelope одной storage-операцией; при неудаче прежний применённый appearance остаётся валидным.

Legacy adapter `liquid-v1` читает `wallet4i7.theme.v1` и `wallet4i7.visual.v1`, нормализует их старыми functions и создаёт новый active envelope. Старые ключи автоматически не удаляются.

## 9. Effect contracts

Effect-specific параметры хранятся в namespaced config выбранного effect:

```text
effects: {
  ambient: {
    id: "web-threads" | "mono-liquid-field" | "none";
    configVersion: number;
    params: { ...effect-specific normalized data };
  };
}
```

Нельзя расширять плоский `VisualEffectsConfig` параметрами Rive, Spline, liquid refraction и будущих effects.

Effect adapter обязан объявлять:

- backend и dependencies;
- lifecycle `prepare/mount/update/pause/dispose`, ownership единственной resource lease и cleanup;
- resource budget;
- supported capability matrix;
- static/reduced/opaque fallback;
- typed codec/schema;
- provenance/license.

Skin ссылается только на внутренний effect registry. Community registry URL не является runtime dependency.

## 10. Настоящий liquid glass

Для `mono-ledger-v1` применяется дисциплина `Liquid_Prnc_Glass`:

```text
source texture
  -> GLSL optical field / SDF
  -> signed refraction
  -> optional dispersion
  -> edge darkening + highlights
  -> mix(baseColor, opticalColor, masterFade)
```

Текст и controls остаются DOM поверх/вокруг visual layer. Primary path не заменяется CSS blur. Для утверждённого Ledger optical preset shader dispersion остаётся нулевой, а highlight — нейтральным. Более позднее решение владельца отдельно разрешает едва заметные холодно-тёплые переливы в background и material edges; это не меняет оптический JSON и не разрешает цветовое раздвоение текста или насыщенный neon.

В проекте уже есть OGL и строгий предел одного WebGL context. Поэтому первый технический spike должен сравнить:

1. перенос shader/settings contract на существующий OGL;
2. отдельный backend только если OGL объективно не покрывает задачу.

Нельзя одновременно держать V1 WebThreads и новый Three.js liquid renderer. Новый skin заменяет ambient backend, а не наслаивает второй.

У присланной светлой полосы справа был установлен CSS-источник: hover окрашивал полную рамку Promo в `#cacaca` поверх второй inset-рамки. Border сохранял толщину, но яркий правый сегмент читался как дефект; теперь граница остаётся прозрачной, а отклик строится неравномерным paint/composite light. Отдельно закрыт потенциальный дефект canvas sizing: optical backend обязан брать raster/layout размер из нетрансформированного layout-box (`clientWidth/clientHeight`, с DOMRect только как fallback). `getBoundingClientRect()` нельзя считать единственным источником: preset choreography временно масштабирует ancestor, и измерение в этот момент способно записать в canvas уменьшенную inline width, открыв справа fallback-край. Этот сценарий не доказан как причина именно присланной полосы. Обе регрессии проверяются после `1 -> 2 -> 3 -> 1`, а не только при первом mount.

## 11. Font Registry

Произвольная CSS font-family строка не является config. Skin хранит allowlisted IDs:

```ts
type FontDefinition = {
  id: string;
  family: string;
  cssVariable: string;
  roles: readonly ("display" | "ui" | "numeric" | "mono")[];
  scripts: readonly ("cyrillic" | "latin")[];
  currencyGlyphs: readonly string[];
  weights: readonly number[] | { min: number; max: number };
  variableAxes: readonly string[];
  tabularNumbers: boolean;
  sources: readonly LocalFontAsset[];
  metrics: FontMetrics;
  license: FontLicense;
  provenance: AssetProvenance;
};
```

Randomizer выбирает только совместимые role/weight/style combinations. Неактивные faces не загружаются. Подробности — в [font-lab.md](font-lab.md).

## 12. Миграция без поломки V1

1. Сохранить baseline tests и screenshots.
2. Ввести `wallet-app`, `ui-contract` и registry, зарегистрировав только `liquid-v1`.
3. Оставить `Dashboard` публичным compatibility wrapper с прежним DOM/CSS output.
4. Вынести controller/reducer, Back/haptic/platform state выше renderer.
5. Перенести `DashboardAction`, `DashboardSection`, overlay state, `SearchSheet.query`, `ActionFormDraft` и demo status из visual components в app contract; ввести semantic focus restoration.
6. Завернуть текущие Theme/Visual providers, WebThreads Lab и CSS внутрь `skin-liquid-v1`.
7. Подключить legacy storage adapter без удаления старых данных.
8. Реализовать Skin Lab сначала на schema V1 и доказать slots/history/randomize/save.
9. Вынести WebThreads в effect adapter, сохранив lifecycle и hot updates.
10. Добавить `mono-ledger-v1` как opt-in с тремя built-in presets.
11. Только после визуального утверждения решать default skin.

## 13. Тестовые слои

### Общий contract suite каждого skin

- обязательные wallet affordances и accessible names;
- intent вызывает правильную command;
- Back/overlay/history не зависят от skin;
- safe-area, scene bounds и отсутствие horizontal overflow;
- touch target не меньше 44 px;
- keyboard/focus, reduced/opaque/high-contrast/saveData modes;
- corrupted config recovery и CSS isolation.

### Skin-specific

- V1: WebThreads, gooey navigation, palette и legacy migration;
- MONO LEDGER: neutral core surfaces, curated low-chroma environment accents, typography roles, one focal glass, shader/fallback, transform-safe canvas sizing и отсутствие right-edge rail после variant switch;
- performance gates зависят от declared capabilities, а не требуют WebGL от любого skin.

### Prototype workbench

- controls отсутствуют внутри `.mono-page` и существуют только в sibling rails;
- preview и fixed nav имеют одинаковую реальную ширину `320/390/430/480`;
- container-query адаптация проверяется независимо от ширины browser viewport;
- collapse/master hide не сдвигают preview и не уничтожают optical draft;
- compact drawers закрываются через scrim/Escape, скрытые rails inert, focus возвращается к launcher.

### Skin Lab/property

- golden vectors `seed + base + schema -> preset`;
- global/group/point scopes;
- parent/control locks и невозможные constraints;
- независимые per-control random streams;
- undo/redo branching и slider coalescing;
- Compare не мутирует state;
- import/export round-trip и malformed/oversized rejection;
- reload каждого slot и `1 -> 2 -> 3 -> 1`;
- отсутствие leaked canvas/RAF/listeners/fonts/assets;
- no hydration mismatch.

## 14. Definition of Done архитектурной миграции

- V1 визуально не изменена и проходит прежний gate.
- App state живёт выше renderer и переживает skin/preset switch.
- Поиск, форма и focus target переживают switch; отсутствие идентичного target имеет явный доступный fallback.
- Новая визуальная система добавляется новым module + manifest/schema, без правки domain/controller.
- Lab генерирует controls из schema и не дублирует bounds.
- Один активный renderer; host lease/state machine освобождает прежний GPU context до следующего mount и отбрасывает устаревший async prepare.
- Presets versioned, normalized, portable и не содержат executable/remote data.
- Randomization воспроизводима, respects locks и покрыта golden tests.
- Fonts и external assets имеют provenance/license и не зависят от CDN.
