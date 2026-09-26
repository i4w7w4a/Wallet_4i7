# Skin 01 — MONO LEDGER

Статус: визуальная спецификация и живой изолированный прототип `/mono`; production skin ещё не интегрирован
ID: `mono-ledger-v1`

## Что уже работает в `/mono`

- Маршрут `/mono` показывает отдельную мобильную сцену на существующих демоданных; прежний V1 остаётся на `/`.
- Кнопки в левой rail и клавиши `1 / 2 / 3` переключают Ledger, Frost и Mercury в одной сцене без перезагрузки. Это три фиксированных design-варианта, **не** три независимых draft-слота Skin Lab.
- IBM Plex Sans, Golos Text, Onest и IBM Plex Mono подключены локальными WOFF2-файлами. Каждый вариант использует свой UI font set; общий Font Registry и Font Lab ещё не сделаны.
- Promo содержит один OGL/WebGL canvas с нейтральным procedural relief, signed refraction, edge darkening, reflection, caustic, flow, мягким pointer response и статическим fallback. Текст поверх него остаётся DOM.
- Built-in default первого окна `1 · Ledger` уже заменён утверждённым владельцем optical JSON; его `ior: 1.34` положителен намеренно.
- Локальный Material Lab встроен в правую rail и даёт live controls, нормализацию диапазонов, Default, Apply/Cancel. Collapse/hide сохраняет пробу; Apply обновляет оптику активного локального рабочего пресета. Это не production Skin Lab.
- Смена трёх направлений запускает отдельные короткие motion-композиции без overshoot; `prefers-reduced-motion` отключает spatial choreography и WebGL flow.
- Fine-pointer atmosphere использует CSS variables, конечные DOM-волны и смещение редких узлов без собственного постоянного RAF/timer; coarse pointer и reduced-motion получают статическую сцену.
- Тема `dark/light` и фон `iris/tide/strata` выбираются независимо от оптического direction и сохраняются в выбранном локальном рабочем пресете. Светлая тема — тёплый pearl/ceramic материал с графитовым текстом и тёмной оптической Promo.
- `tide` мягко набирает энергию по сглаженной скорости жеста и оставляет до шести конечных DOM/CSS-импульсов, `strata` локально отталкивает редкие элементы, `iris` даёт тонкий холодно-тёплый перелив. Это background motion, не настоящая рефракция пикселей: shader glass остаётся только на Promo.
- Все design controls находятся в двух fixed sibling rails вне телефона. Секции сворачиваются независимо, master control скрывает весь chrome без смещения preview, а compact layout показывает rails как dismissible drawers.
- Кнопки `320 / 390 / 430 / 480` задают реальную ширину container, а не визуальный scale. Внутренняя композиция реагирует через container queries/`cqw`, fixed nav следует той же ширине, а узкий host clamp-ит profile без overflow.
- Секция `Форма` live-редактирует радиус общей оболочки быстрых действий и верхних углов нижнего меню. При выбранном в мастерской режиме отдельных кнопок или иконок с подписями радиус общей оболочки отключён; радиусы отдельных кнопок задаются их материалами. Пробы независимы для Ledger/Frost/Mercury; Reset возвращает обе группы активного направления, Apply обновляет выбранный рабочий пресет, Cancel возвращает принятую форму. Product appearance не меняется.
- Повторявшаяся правая полоса Promo на снимке была светлой CSS-рамкой `#cacaca` поверх inset-рамки; hover теперь оставляет border прозрачным. Отдельно WebGL resize берёт `clientWidth/clientHeight` вместо временно масштабированного DOMRect, чтобы предотвратить возможный укороченный canvas.
- Fine-pointer controls имеют раздельные monochrome hover/press responses без layout shift: `90 ms enter / 190 ms settle / 80 ms press`.
- Переключатель видимости баланса работает локально в прототипе. Нижняя навигация открывает Обзор, Активы, Историю и Профиль; раздел и приватность хранятся в host-сессии вне appearance. История честно сообщает, что источник операций не подключён. Быстрые действия остаются демо и не совершают операции.

Реализация: [сцена](../../apps/miniapp/src/mono-preview/mono-preview.tsx), [workbench chrome](../../apps/miniapp/src/mono-preview/mono-workbench.css), [Shape Lab](../../apps/miniapp/src/mono-preview/mono-shape-tuner.tsx), [shape candidate](../../apps/miniapp/src/mono-preview/mono-shape-preview.ts), [Material Lab](../../apps/miniapp/src/mono-preview/mono-glass-tuner.tsx), [Tide motion model](../../apps/miniapp/src/mono-preview/mono-tide-motion.ts), [motion layer](../../apps/miniapp/src/mono-preview/mono-motion.css), [pointer atmosphere](../../apps/miniapp/src/mono-preview/mono-atmosphere.css), [interaction layer](../../apps/miniapp/src/mono-preview/mono-interactions.css), [шрифты](../../apps/miniapp/src/mono-preview/mono-fonts.css), [оптический эффект](../../packages/ui/src/mono/mono-optical-glass.tsx).

Разделы ниже фиксируют целевой дизайн и контракт полноценного skin. Оптические controls уже исполняются в runtime, но рандомизация, замки, история, именованные production presets и перенос product state между skin пока не реализованы.

### Геометрия workbench

`mono-workbench` владеет лабораторным chrome, а `.mono-preview-frame > .mono-page` — только мобильной сценой. Rails являются sibling-элементами preview, поэтому их ширина, scroll и collapse не участвуют в расчёте композиции телефона. На desktop центр preview остаётся привязан к центру viewport даже при global hide; ниже `1200px` одновременно открывается одна rail-drawer поверх сцены.

Выбранный viewport хранится как allowlisted union `320 | 390 | 430 | 480` и передаётся только в CSS custom property `--mono-preview-width`. Frame применяет `width: min(100%, var(--mono-preview-width))` и `container: mono-preview / inline-size`. Значимые responsive изменения задаются container queries; например, сумма использует `cqw`, а узкий 320-profile уменьшает gutters и Promo независимо от физической ширины browser window. Fake device frame и transform-scale запрещены.

Workbench state и appearance state разделены. `panelsVisible`, active drawer и expanded sections не вызывают Apply. Непринятые optical/shape sliders переживают collapse/hide и управляют live preview, но не входят в сохранённый рабочий пресет до Apply. Approved Ledger JSON остаётся встроенным Default. Shape Lab показывает group-shell radius `quick-actions / bottom-navigation` и нормализует его в `0…24px`; принятая форма и оптика сохраняются в `working-presets.v1`, не в product active appearance, Palette Lab hashes или server presets. `shape-preview.v1` и `optical-preview.v1` только читаются при миграции старого локального состояния.

## 1. Идея

MONO LEDGER должен ощущаться как банковский сейф и точный измерительный прибор, закрытые копчёным оптическим стеклом.

Характер:

- строгий;
- тяжёлый;
- преимущественно нейтральный, с очень тихими холодно-тёплыми переливами в фоне и на кромке;
- тихий;
- дорогой за счёт материала, типографики и пропорций, а не неона.

Это не «убрать цвет из V1». У skin другая грамматика: меньше округлых sci-fi tiles, glow и декоративных частиц; больше ясной иерархии, воздуха, точных линий и спокойных surfaces.

Основной принцип:

> Матовый графит несёт содержание. Liquid glass появляется редко и показывает оптику.

Если стекло используется везде, оно перестаёт быть материалом и становится шумом.

## 2. Три стартовых presets

### `1 · Ledger`

Основной строгий вариант.

- Почти матовые surfaces.
- Radius scale 10–14 px.
- Более высокая информационная плотность.
- Выраженная положительная signed refraction с утверждённым `ior: 1.34`; знак не исправлять на отрицательный.
- Контролируемый flow и pointer response без второго ambient loop.
- Целевой active navigation: светлая плоскость с почти чёрным текстом; в текущем `/mono` это ещё не реализовано, активность отмечена светлым текстом на тёмной rail.
- Настоящее стекло только на Promo как одном focal object. Navigation rail — статический smoked material без отдельного WebGL.

#### Approved optical default окна 1

Владелец визуально утвердил следующий точный объект. Это built-in default/reset `1 · Ledger` и исходная точка первого окна:

```json
{
  "version": 1,
  "preset": "ledger",
  "settings": {
    "ior": 1.34,
    "edgeThickness": 0.165,
    "edgeDarkening": 0.5,
    "highlightStrength": 0.54,
    "reflectionStrength": 0.59,
    "causticStrength": 0.63,
    "fieldEnabled": true,
    "fieldFadeMode": 1,
    "fieldStart": 0.34,
    "fieldSoftness": 0.99,
    "fieldCurve": 2.69,
    "fieldStrength": 1.92,
    "flowEnabled": true,
    "flowMode": 5,
    "flowSpeed": 0.29,
    "flowStrength": 0.44,
    "flowScale": 4.47,
    "pointerStrength": 0.23
  }
}
```

`ior: 1.34` — намеренная положительная ветвь signed refraction. Нормализатор, миграция или будущий randomizer не должны молча менять знак. Валидный объект из `wallet4i7.mono.optical-preview.v1` может временно восстановить пользовательский preview, но `По умолчанию` всегда возвращает JSON выше.

### `2 · Frost`

Более воздушный вариант.

- Графитовые полупрозрачные surfaces.
- Radius scale 16–20 px.
- Мягкий silver highlight.
- Шире optical field и мягче fade.
- Больше blur только во fallback/material слое, без молочного тумана.
- Медленное течение, заметное лишь при внимательном взгляде.

### `3 · Mercury`

Экспериментальный верхний предел.

- Глубокий black canvas.
- Более сильная отрицательная рефракция.
- Узкие яркие кромки.
- Жидкое движение внутри одного focal field.
- Максимальный контраст matte content и зеркального glass.
- Нулевая RGB dispersion и никакого цветного neon.

В прототипе это три фиксированных варианта одной сцены. Переключение не сбрасывает её локальный privacy state; сохранение общего состояния приложения при будущей смене skin ещё предстоит реализовать и проверить.

Первый resolved design profile (не random ranges):

| Config field | `1 Ledger` | `2 Frost` | `3 Mercury` |
|---|---:|---:|---:|
| `fontSetId` | `plex-core` | `golos-core` | `onest-core` |
| `canvas` | `#050505` | `#0A0A0A` | `#000000` |
| `surface.base` | `#0C0C0C` | `#141414` | `#080808` |
| `surface.raised` | `#141414` | `#202020` | `#101010` |
| `surface.overlay` | `#1C1C1C` | `#282828` | `#181818` |
| `text.primary` | `#F4F4F4` | `#F6F6F6` | `#FFFFFF` |
| `text.secondary` | `#BDBDBD` | `#C9C9C9` | `#C2C2C2` |
| `radiusScalePx` | `12` | `18` | `14` |
| `density` | `0.94` | `1.04` | `0.98` |
| `surfaceOpacity` | `1.00` | `0.92` | `0.98` |
| `navOpacity` | `1.00` | `0.96` | `1.00` |
| `grain` | `0.02` | `0.03` | `0.04` |
| `motionProfileId` | `precise-low` | `precise-soft` | `precise-fluid` |
| `promoRecipeId` | `optical-quiet` | `optical-frost` | `optical-mercury` |
| `sourceTextureId` | `mono-silver-relief-01` | `mono-silver-relief-01` | `mono-silver-relief-01` |

Эта таблица задаёт целевые значения design fields; она не является сериализованным config текущего `/mono`. Локальные WOFF2 для трёх UI-наборов уже лежат в прототипе, а provenance — в [реестре файлов](../../apps/miniapp/public/fonts/mono/README.md). Built-in presets не выходят в production, пока Font Lab не подтвердит glyphs, валюты, версии и лицензии каждого набора. При добавлении нового поля schema обязан дать явный versioned default/migrator, а не молча наследовать случайное значение.

## 3. Neutral core и ограниченный перелив

Решение владельца от 2026-09-17 в [Palette Lab V1](palette-lab-v1.md) заменяет прежний запрет на свободный hue/chroma slider и randomizer именно в Palette Lab. Цветовой контракт — OKLCH/OKLab semantic roles с gamut mapping в sRGB через уменьшение chroma при постоянных L/H. HEX остаётся форматом ввода/копирования. Пять гармоний (`spectral-graphite`, `mineral`, `thermal-duet`, `analog-mist`, `split-prism`) управляют материалом; secondary hues выводятся только в decorative roles. Связанные core/content сохраняют chroma не выше `0.018`. Ручной черновик с нарушением нейтральности или контраста доступен для preview, но не для Apply.

Чистый engine и schema находятся в `packages/ui/src/mono/mono-palette.ts`, цветовая математика — в `mono-color-space.ts`. Это фундамент Palette Lab, ещё не замена локальных CSS tokens живого `/mono`. У каждой темы собственные recipe, overrides и lock snapshots; `system` защищён от эстетических overrides/randomization, focus не рандомизируется. Scope global/group/point не меняет resolved values за своими границами; независимые streams имеют seed, mode, parameter ID, counter и schema/engine/catalog metadata. Counter увеличивается только после успешной операции. Recipe edit и randomize не нарушают locks; невозможный контраст выдаёт объяснимую ошибку.

Расширение палитры не изменяет approved optical JSON Ledger, положительный `ior: 1.34`, geometry, flow, shader dispersion `0` или лимит одного WebGL context/RAF. RGB glitch, chromatic split текста/цифр/иконок и использование декоративного цвета как финансового статуса по-прежнему запрещены.

Стартовая ramp:

| Semantic role | Value |
|---|---:|
| `canvas` | `#050505` |
| `surface.base` | `#0C0C0C` |
| `surface.raised` | `#141414` |
| `surface.overlay` | `#1C1C1C` |
| `border.subtle` | `#303030` |
| `border.strong` | `#727272` |
| `text.primary` | `#F4F4F4` |
| `text.secondary` | `#BDBDBD` |
| `text.muted` | `#909090` |
| `text.disabled` | `#707070` |
| `surface.inverted` | `#ECECEC` |
| `text.inverted` | `#0A0A0A` |
| `focus` | `#FFFFFF` |

Критические semantic states не участвуют в эстетической randomization. Рост/падение всегда различаются знаком, стрелкой, подписью и формой, а не только цветом:

```text
↑ +2,34%
↓ −2,34%
```

Если transactional safety требует отдельного warning/error color, это зарезервированный system token вне decorative palette. Декоративный перелив не передаёт финансовый смысл и не уменьшает контраст текста.

### Две темы и три фона

Тема и фон являются независимыми осями локального `/mono` preview, а не новыми product skins и не заменой встроенных Ledger/Frost/Mercury. Выбор сохраняется отдельно от optical candidate и V1.

| Ось | Вариант | Материал / реакция |
|---|---|---|
| тема | `dark` | тёплый графит, осветлённые матовые surfaces, редкие холодно-тёплые блики |
| тема | `light` | pearl/ceramic canvas, графитовый текст, мягкие минеральные границы; Promo остаётся тёмным optical focal |
| фон | `iris` | спокойные переливы и лёгкая противоположная указателю параллакс-реакция |
| фон | `tide` | направленный конечный wake по скорости жеста, максимум шесть импульсов одновременно |
| фон | `strata` | направленные слои и локальное отталкивание редких отметок |

`tide` и `strata` не являются настоящим pixel displacement: DOM/CSS отклик расходится/отступает, но не преломляет содержимое страницы. Tide использует finite event-driven model: первый sample только инициализирует поверхность, скорость имеет память и плавный response, медленный drift не проходит energy threshold, после паузы энергия рассеивается, а pulse требует одновременно минимального времени и расстояния. Для полноценной физической водной поверхности потребуется отдельный этап: единый OGL compositor, в котором фон и Promo разделят один WebGL context и один RAF. Не подключать отдельные full-screen fluid renderers рядом с нынешней Promo.

Цели контраста:

- главная сумма: не ниже `7:1`;
- обычный текст: не ниже `4.5:1`;
- controls/focus/boundaries: не ниже `3:1`.

## 4. Token families

```text
color       neutral ramp + protected semantic roles
type        font sets, roles, scale, weight, tracking, numeric features
space       gutters, gaps, density, component padding
shape       radius scale, border width, icon geometry
material    matte/glass recipes, opacity, shadow, fallback blur
optics      IOR, edge, field, flow, regions, tonal grade
motion      duration, easing, amplitude, ambient speed
dataViz     chart stroke/dash/fill/pattern
component   Hero, Actions, Nav, Sheet, Asset Rows, Promo
capability  runtime fallback policy; never randomized or persisted as design
```

Components используют semantic tokens. В их CSS/TS не появляются собственные cyan/blue/green constants.

## 5. Typography direction

Inter не является частью identity по умолчанию. Первый live shortlist:

- IBM Plex Sans — строгий technical/corporate;
- Golos Text — спокойная Cyrillic screen typography;
- Manrope — более геометричный balance/display;
- Onest — современная humanist/geometric альтернатива;
- IBM Plex Mono — только address/ID.

Окончательный набор выбирается глазами в Font Lab, не по названию.

Стартовая scale:

| Role | Default |
|---|---:|
| balance | 52 px / 0.95 / weight 600 |
| section title | 22 px / 1.15 / weight 600 |
| row value | 16 px / 1.25 / weight 550–600 |
| body/control | 15 px / 1.46 / weight 400–500 |
| label | 12 px / 1.3 / weight 500 |
| micro | 11 px / 1.3 / weight 500 |

Balance, assets и transaction values используют проверенные tabular lining figures. На 320 px обязательна проверка `1 234 567,89 ₽`.

## 6. Материалы

### Matte Graphite

Основной материал содержимого:

- opaque либо почти opaque;
- без `backdrop-filter`;
- 1 px neutral border;
- верхний inner highlight 4–7%;
- глубокая короткая shadow;
- asset rows разделяются линиями, а не отдельными glass cards.

### Smoked Optical Glass

В `/mono` используется только на Promo как одном focal object: это реальный OGL/WebGL effect, а не CSS blur. Bottom navigation остаётся статической графитовой поверхностью без второго canvas/context. Если позднее понадобится рефракция на нескольких элементах, это отдельное решение о едином compositor с доказанным one-context budget, а не скрытый второй renderer.

Resolved optical recipes ниже разделяют рабочие runtime controls и будущие поля production schema. В `/mono` уже действуют `ior`, edge/light controls, `reflectionStrength`, `causticStrength`, field controls, flow controls и `pointerStrength`; их bounds задаёт один normalizer в `@wallet/ui`. Embedded Material Lab редактирует draft активного direction напрямую и не размонтируется при collapse секции, поэтому chrome state не уничтожает значения. `flowMode = 0` означает выключенный поток, поэтому включение flow выбирает рабочий curated mode. `shapeType`, regions и tonal grade остаются целевыми полями, а не controls прототипа.

| Parameter | Ledger | Frost | Mercury |
|---|---:|---:|---:|
| `ior` | `1.34` | `-0.62` | `-0.83` |
| `edgeThickness` | `0.165` | `0.12` | `0.16` |
| `cornerRadius` | `0.10` | `0.11` | `0.12` |
| `dispersion` | `0` | `0` | `0` |
| `edgeDarkening` | `0.50` | `0.32` | `0.36` |
| `highlightStrength` | `0.54` | `0.44` | `0.53` |
| `reflectionStrength` | `0.59` | `0.55` | `0.85` |
| `causticStrength` | `0.63` | `0.50` | `0.82` |
| `fieldEnabled` | `true` | `true` | `true` |
| `fieldFadeMode` | `1` | `0` | `0` |
| `fieldStart` | `0.34` | `0.52` | `0.47` |
| `fieldSoftness` | `0.99` | `0.66` | `0.68` |
| `fieldCurve` | `2.69` | `1.55` | `1.45` |
| `fieldStrength` | `1.92` | `1.40` | `2.10` |
| `shapeType` | `0` | `0` | `0` |
| `shapeWarp` | `0` | `0` | `0` |
| `flowEnabled` | `true` | `true` | `true` |
| `flowMode` | `5` | `9` | `5` |
| `flowSpeed` | `0.29` | `0.14` | `0.28` |
| `flowStrength` | `0.44` | `0.22` | `0.36` |
| `flowScale` | `4.47` | `2.80` | `3.00` |
| `pointerStrength` | `0.23` | `0.13` | `0.18` |
| `flowTurbulence` | `0.20` | `0.22` | `0.30` |
| `flowBoundaryDamping` | `0.80` | `0.80` | `0.75` |
| `flowLayerMix` | `0.45` | `0.45` | `0.50` |
| `regionTop/Right/Bottom/Left` | `true` | `true` | `true` |
| `regionWidth` | `1.00` | `1.00` | `1.00` |
| `regionSoftness` | `0.12` | `0.12` | `0.12` |
| `exposure` | `0` | `0` | `0` |
| `brightness` | `-0.02` | `-0.02` | `-0.02` |
| `contrast` | `1.04` | `1.06` | `1.10` |
| `saturation` | `0` | `0` | `0` |
| `temperature/tint` | `0` | `0` | `0` |
| `gamma` | `1` | `1` | `1` |

`pixelRatio` не входит в preset: renderer прототипа ограничивает mobile DPR до `1.5`. Текущий источник Promo — процедурно созданный neutral luminance relief с контурными нитями, по изгибу которых глаз видит рефракцию; текст и данные кошелька в source не запекаются. Material Lab обновляет uniforms без замены renderer, `Default` возвращает built-in recipe, а `Apply` сохраняет принятую оптику в локальном рабочем пресете. Это ещё не общий effect adapter и не production appearance envelope.

Optical pipeline:

```text
grayscale source texture
  -> center-to-edge field / SDF
  -> signed refraction
  -> neutral edge darkening + white highlight
  -> masterFade
  -> mix(baseColor, opticalColor, masterFade)
```

`ior = 0` показывает чистый source. Signed IOR допускает обе ветви: negative разворачивает refraction, а утверждённый Ledger намеренно использует positive `1.34`. Центр остаётся почти чистым, эффект плавно растёт к active regions. Text/controls остаются DOM.

### Инвариант правого края Promo

У полосы на присланном снимке установлен один непосредственный источник: material hover окрашивал всю неизменную по толщине border-кромку optical frame в `#cacaca`; в сочетании с полной inset-рамкой это особенно заметно читалось справа. Теперь border остаётся прозрачным, а реакция живёт в неравномерном inset shadow/composite paint.

Отдельная уязвимость могла создать похожий, но иной дефект: preset reveal временно применяет `scale(.985)` к ancestor. `getBoundingClientRect()` в этот момент возвращает уменьшенный transform-box; если OGL запишет такую ширину inline на canvas, ResizeObserver не обязан повторно сработать после settle и справа может открыться fallback-слой. Resize теперь использует стабильные `clientWidth/clientHeight`, прибегая к DOMRect только как к fallback. Утверждать, что именно это произошло на присланном снимке, нельзя.

Регрессия проверяется после полного цикла `Ledger -> Frost -> Mercury -> Ledger`: CSS canvas size должна совпадать с optical host по обеим осям, а frame сохраняет прозрачную правую границу. Отдельный pixel test по-прежнему подтверждает вариативность правого столбца shader texture.

Чтобы black glass было видно, под ним существует слабый luminance relief: широкая silver band, monochrome procedural field либо мягкий static noise. Чёрное стекло над абсолютно чёрным источником ничего не преломляет.

### Mercury Accent

Preset 3 использует третью колонку optical recipe. Только один Mercury object в viewport; его host lease заменяет, а не дополняет WebThreads V1.

## 7. Safe random ranges

Это safe ranges для будущего randomizer. В текущем `/mono` большая часть оптических диапазонов уже используется live controls, но сама рандомизация ещё не реализована.

| Control | Allowed random range |
|---|---:|
| radius scale | 8–24 px |
| density | 0.92–1.06 |
| `ior` | Ledger пока зафиксирован на approved `+1.34` до отдельной проверки positive random range; Frost `-0.75…-0.45`; Mercury `-1.00…-0.70`; manual `0` remains clean point |
| `edgeThickness` | 0.08–0.18 |
| `edgeDarkening` | 0.18–0.42 |
| `highlightStrength` | 0.18–0.55 |
| `fieldStart` | 0.42–0.68 |
| `fieldSoftness` | 0.45–0.82 |
| `fieldCurve` | 1.20–2.80 |
| `fieldStrength` | 0.30–2.50 |
| `flowSpeed` | 0.06–0.35 только при `flowEnabled`; иначе `0` |
| `flowStrength` | 0.04–0.28 только при `flowEnabled`; иначе `0` |
| `flowScale` | 1.60–3.80 |
| `flowTurbulence` | 0.10–0.45 |
| grain | 0.01–0.06 |

Safe random ranges — это диапазоны генерации вариантов, а не clamp для утверждённых built-in presets. Approved Ledger JSON выше может лежать за более узким random range; нормализовать его нужно по runtime bounds, а не притягивать к таблице randomization.

Не randomizable:

- hue/chroma вне versioned Palette Lab semantic contract; свободный Palette Lab hue/chroma разрешён решением от 2026-09-17 при сохранении neutral core, contrast guard и protected system roles;
- `dispersion` — всегда `0`;
- optical temperature/tint (Palette Lab temperature относится только к цветовой recipe);
- arbitrary exposure/gamma;
- pixel ratio;
- focus ring и contrast guard;
- target sizes/safe-area;
- context/RAF count;
- shader source, arbitrary shape/flow mode;
- capability fallbacks.

Cross-field rules важнее независимых sliders. Чем сильнее IOR, тем мягче field и осторожнее highlight. Mercury direction одновременно уменьшает количество effect-bearing components.

`fieldEnabled` фиксирован `true` для optical Promo. В approved Ledger recipe `flowEnabled = true`, `flowMode = 5`; Frost использует mode `9`, Mercury — mode `5`. Ручной toggle в Fine controls допустим, но при `false` speed/strength становятся disabled. `flowMode = 9` означает мягкий органический cross-flow, `5` — вращательный field. `fieldFadeMode`, `flowMode`, `shapeType`, regions и source texture в первой версии не рандомизируются. Выключенный effect не должен сохранять «живые» бегунки, которые ничего не меняют.

## 8. Dashboard composition

В `/mono` уже показаны header, hero/график, quick actions, Promo, assets и работающая нижняя навигация по четырём разделам. Portfolio, Bottom Sheet и настоящие product intents ниже — целевая интеграция, не часть текущего прототипа.

- **ProfileHeader** — компактная спокойная control group вместо трёх светящихся шаров.
- **BalanceHero** — открытая matte zone; сумма главный объект без glow.
- **Chart** — тонкая white/gray line; направление подтверждено знаком и подписью.
- **Period selector** — минимальный segmented control; active инвертирован.
- **Quick Actions** — по умолчанию единая четырёхколоночная rail; мастерская кнопок может явно выбрать четыре отдельные поверхности либо только иконки с живыми DOM-подписями и без рамок. В режиме иконок сохранённые fill/border bindings остаются в пресете, но не исполняются. Встроенный образец `Первый · перелив` содержит четыре точные привязки Pulsing Border из утверждённого владельцем V1 JSON и открывается без замены сохранённых пользовательских пресетов.
- **Promo** — единственный крупный liquid focal object.
- **Assets** — одна continuous surface с divider lines.
- **Portfolio** — grayscale segments различаются luminance/pattern/label, не hue.
- **Bottom navigation** — smoked graphite rail без рефракции с реальными кнопками разделов и видимым активным состоянием. Инвертированная active-плоскость и border sweep при смене остаются целевым рецептом, не готовой функцией.
- **Bottom Sheet** — плотный graphite material. Forms не лежат под живой рефракцией.

## 9. Motion personality

```text
precise / heavy / controlled
```

### Pointer atmosphere

Фоновая atmosphere — единая композиция из focus field, ribbon, редкой grid и очень слабых иридесцентных тонов. Обработчик `pointermove` записывает координаты и малые смещения в CSS variables; для `tide` пропускает samples через чистую velocity/energy model и лишь затем создаёт конечный направленный wake, для `strata` локально отталкивает редкие отметки. Амплитуда, размер и длительность Tide зависят от энергии жеста; резкий первый удар запрещён. Отдельный persistent RAF, interval или timer для atmosphere запрещён. Единственный постоянный RAF остаётся собственностью активного WebGL renderer.

Реактивный режим включается только при `(hover: hover) and (pointer: fine)`. На touch/coarse pointer и при `prefers-reduced-motion` слои остаются в заранее определённой статической позиции: без pointer tracking, tilt и бесконечной CSS-анимации. Atmosphere не меняет геометрию контента, не участвует в hit testing и не создаёт второй canvas.

### Interaction discipline

| Interaction token | Value |
|---|---:|
| hover enter | `90 ms` |
| release / settle | `190 ms` |
| press | `80 ms` |
| easing | `cubic-bezier(0.2, 0, 0, 1)` |

Ответы различаются по материалу и роли: selector получает inset edge, quick action отвечает иконкой и плоскостью, period — локальной инверсией, asset row — боковой кромкой, navigation — весом линии, Promo — серебряной границей, header identity — коротким металлическим акцентом. Нельзя механически применять один и тот же `scale`, glow или halo ко всем объектам: это превращает строгий банк в набор одинаковых демо-эффектов.

Hover/press меняют только paint/composite свойства и дочерние transforms; размеры, gap, padding и положение layout не меняются. Основные controls нейтральны, декоративные кромки могут иметь едва заметный curated оттенок. Fine-pointer hover не является единственным сигналом: реальные controls сохраняют `focus-visible`, а coarse pointer получает статичный либо короткий non-spatial tap feedback.

| Token | Value |
|---|---:|
| quick | 120 ms |
| standard | 220 ms |
| context/sheet | 320 ms |
| easing | cubic-bezier(0.2, 0, 0, 1) |
| bounce/overshoot | 0 |
| ambient loop | 12–20 s, seamless |

Resolved profiles:

| Profile | Quick | Standard | Sheet/context | Optical flow cycle |
|---|---:|---:|---:|---:|
| `precise-low` | 110 ms | 200 ms | 300 ms | off |
| `precise-soft` | 120 ms | 220 ms | 320 ms | 18 s |
| `precise-fluid` | 120 ms | 220 ms | 320 ms | 12 s |

Все используют `cubic-bezier(0.2, 0, 0, 1)` и нулевой overshoot. `prefers-reduced-motion` принудительно останавливает optical flow независимо от сохранённого profile.

В живом `/mono` смена direction проигрывает один законченный каскад: eyebrow → balance → change/chart → actions → optical object → assets. Линия chart рисуется через stroke reveal, optical object получает единичный silver edge glint, а дальнейшая ambient-жизнь принадлежит только шейдеру активного preset, включая утверждённый Ledger. CSS не запускает второй бесконечный декоративный loop.

- Press: `translateY(1px) scale(.985)`.
- Active indicator: 220 ms.
- Sheet enter: 320 ms; exit немного быстрее.
- Preset material transition: 120–180 ms.
- Typography не blur/morph.
- Ambient flow не реагирует на каждый scroll.
- Coarse pointer не получает spotlight/magnetic behavior.

Randomizer выбирает coherent motion profile/intensity, а не десятки независимых duration/easing.

## 10. Fallbacks

- `prefers-reduced-motion`: flow, shimmer, sweep, CountUp и spatial transitions выключены.
- Opaque/effects-off: solid graphite surfaces с той же иерархией.
- `prefers-contrast: more`: `#000/#FFF`, усиленные borders, двойной focus ring.
- saveData/hidden/inactive: RAF остановлен, heavy renderer не запускается.
- WebGL failure/context loss: monochrome static poster/procedural fallback.
- Coarse pointer: tap feedback без pointer-following effects.
- Text никогда не rasterized shader.
- Telegram safe-area применяется к header, nav и sheets.
- Virtual keyboard не ломает sheet и не оставляет nav поверх поля.

## 11. Запрещено

- насыщенный cyan/purple/green neon;
- RGB glitch/раздвоение букв и сильная chromatic aberration; тонкая цветная кромка в фоне и материале разрешена;
- glow на каждом control;
- glass на каждой card и nested glass;
- CSS blur как основной liquid effect;
- несколько независимых WebGL scenes;
- постоянные particles/sparks/gooey/border beams;
- random font без Cyrillic/currency audit;
- pills для каждого элемента;
- низкоконтрастный gray text ради атмосферы;
- randomize без seed/schema/constraints;
- изменение данных/логики Dashboard при смене skin;
- fake device frame вокруг 480 px scene.

## 12. Acceptance criteria

Это критерии готовности полноценного skin и Skin Lab, а не список уже закрытых проверок `/mono`.

1. Текст и core controls читаемы; curated background/material оттенки остаются тонкими, shader Promo сохраняет утверждённые optical values и не получает случайной RGB dispersion.
2. Dashboard воспринимается как строгий банк, а не neon crypto demo.
3. В viewport не более одного сильного liquid focal object.
4. `1/2/3` переключаются без потери app state и без второго WebGL context.
5. Fixed seed и catalog/schema воспроизводят тот же resolved result.
6. Global/group/point randomize соблюдают locks.
7. Slider drag отменяется одним Undo.
8. A/B Compare использует один renderer и не меняет history.
9. Saved preset проходит normalized JSON round-trip/migration.
10. Font sets показывают кириллицу/валюты без fallback glyphs.
11. Проверены 320/390/430/480, desktop 1024, Telegram safe-area и virtual keyboard.
12. Нет overflow; длинная сумма не пересекает controls.
13. Contrast goals соблюдены.
14. Reduced, opaque, high-contrast, saveData и no-WebGL modes полноценны.
15. Один canvas; hidden/inactive RAF отсутствует.
16. После warmup нет long task >100 ms; actions остаются отзывчивыми.
17. Visual snapshots существуют для трёх presets и fallback modes.
18. Built-in preset нельзя перезаписать; Apply выдаёт нормализованный versioned config.
