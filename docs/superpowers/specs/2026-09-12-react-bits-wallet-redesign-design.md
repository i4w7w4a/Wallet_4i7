# Wallet_4i7: визуальная система на React Bits

Дата: 2026-09-12

Статус: на ревью пользователя
Область: мобильный Mini App, главная страница кошелька и студия внешнего вида

## 1. Контекст и решение

Текущая главная страница функциональна, но визуально воспринимается как набор стандартных карточек. Она не достигает качества референса: фон не связывает композицию, glass-эффекты выглядят локальными, иерархия баланса слабая, а анимация не является частью общего языка интерфейса.

React Bits становится визуальным фундаментом Wallet_4i7. Мы не копируем весь репозиторий и не подключаем его как runtime-монорепозиторий. Используем официальный registry и переносим в продукт только выбранные TypeScript + CSS компоненты. Каждый компонент адаптируется под наши контракты, доступность, тему, Telegram lifecycle и мобильные ограничения.

Исходная версия React Bits фиксируется на commit:

`3a1c7f2f9f94ed833934ab5c2635760b9e644583`

Официальный источник: <https://github.com/DavidHDev/react-bits>

Registry: <https://reactbits.dev/r/{name}.json>
Лицензия: MIT + Commons Clause License Condition v1.0.

## 2. Цели

- Web Threads формирует живую сцену всей страницы, а не отдельный декоративный баннер.
- Баланс остаётся главным объектом первого экрана и читается поверх анимации при любой палитре.
- Быстрые действия, header controls и нижняя навигация получают цельный React Bits-inspired glass-язык.
- Основные четыре цвета темы сразу управляют фоном, стеклом, подсветкой карточек и акцентами.
- Расширенные параметры Web Threads доступны пользователю в Theme Studio и применяются в реальном времени.
- На мобильном устройстве существует не более одного WebGL-контекста и одного постоянного animation loop.
- Reduced motion, `saveData`, неактивный Telegram, скрытая вкладка и отсутствие WebGL2 дают полноценный статический fallback.
- Все mock-операции и доступность текущего Dashboard сохраняются.

## 3. Не входит в первую итерацию

- Импорт всех 165+ компонентов React Bits.
- Одновременный запуск нескольких WebGL/Three.js-фонов.
- GSAP, Three.js, Rapier, Matter.js и postprocessing без конкретного пользовательского сценария.
- 3D tilt на touch-устройствах.
- Реальные финансовые операции, адреса, подключения кошельков и сетевые запросы.
- Перепродажа или публикация извлечённых React Bits-компонентов как отдельной библиотеки.

## 4. Способ интеграции React Bits

### 4.1. Registry вместо vendoring всего репозитория

В корне проекта создаётся `components.json` с registry:

```json
{
  "registries": {
    "@react-bits": "https://reactbits.dev/r/{name}.json"
  }
}
```

Компоненты импортируются из TS + CSS вариантов в `packages/ui/src/react-bits`. Registry используется только как источник кода во время разработки; production не зависит от доступности reactbits.dev.

### 4.2. Происхождение кода

Создаётся `THIRD_PARTY_NOTICES.md`, где для каждого перенесённого компонента фиксируются:

- имя и путь upstream-файла;
- upstream commit;
- URL репозитория;
- copyright David Haz;
- текст применимой лицензии;
- список наших содержательных изменений.

Исходные файлы получают короткий заголовок provenance. Наша публичная точка экспорта не должна превращать `packages/ui` в переиздание React Bits: наружу экспортируются только Wallet-компоненты и необходимые типы.

## 5. Выбранные компоненты

| React Bits | Роль в Wallet_4i7 | Способ адаптации |
|---|---|---|
| `WebThreads-TS-CSS` | Полноэкранный визуальный двигатель | Один fixed WebGL2 canvas, проп `active`, theme colors, fallback и DPR budget |
| `GlassIcons-TS-CSS` | Четыре quick actions и header controls | Контролируемые callbacks, 44 px targets, touch-state вместо hover-only |
| `SpotlightCard-TS-CSS` | Promo, assets и portfolio surfaces | Цвет подсветки из темы; pointer spotlight только на fine pointer |
| `CountUp-TS-CSS` | Анимация баланса при первом показе | Русское форматирование валюты, мгновенный результат при reduced motion |
| `GradientText-TS-CSS` | Короткие premium-акценты и статусы | Не применять к основному балансу или длинным текстам |
| `ClickSpark-TS-CSS` | Тактильный визуальный отклик quick actions | Запуск только по явному действию; отключение при reduced motion |
| `GooeyNav-TS-CSS` | Активный индикатор нижней навигации | Controlled API без `href`, семантика button/tab, cleanup таймеров |

`AnimatedContent` не переносится в первой итерации: он требует GSAP и ScrollTrigger. Существующий `motion` покрывает entrance transitions без второй animation runtime.

## 6. Новая композиция главной страницы

### 6.1. Фоновая сцена

`WebThreads` закреплён на viewport под всем приложением. Нити сходятся справа в верхней трети экрана, чтобы яркое ядро не проходило под балансом. Поверх canvas располагаются:

1. тёмная левая маска для текста;
2. мягкий нижний gradient scrim для списка активов;
3. тонкий noise-слой без отдельного animation loop;
4. контент Dashboard.

Старое hero-видео удаляется из активной композиции. Poster сохраняется как fallback для WebGL2/reduced-motion/saveData и как резервный asset.

### 6.2. Первый экран

- Header становится компактным: avatar/address слева, search и notifications справа.
- Баланс занимает основную площадь, без прямоугольной карточки вокруг него.
- `CountUp` анимирует только цифры; подписи и изменение за сутки появляются мягким fade.
- График располагается в правой нижней части hero и не пересекает сумму.
- Периоды графика представлены компактным segmented control.
- Quick actions — четыре самостоятельных glass-объекта на одной линии.

### 6.3. Контент ниже сгиба

- Promo становится широкой Spotlight surface с продолжением рисунка Web Threads.
- Активы объединены в одну цельную surface; строки разделены световыми линиями, а не отдельными карточками.
- Portfolio получает компактный donut и легенду внутри одной композиции.
- Glass применяется только к controls и навигации. Контентные surfaces используют полупрозрачный тёмный материал без вложенного `backdrop-filter`.
- Bottom navigation закреплена снизу и использует controlled gooey-indicator без лишнего particle burst при каждом render.

## 7. Цвет и Background Studio

Четыре существующих цвета остаются главным быстрым управлением:

- `background` → базовый цвет страницы и shader background;
- `surface` → material cards и нижние scrims;
- `accent` → `WebThreads.color1`, active controls и positive chart;
- `glassTint` → `WebThreads.color2`, glass edges и secondary glow;
- вычисленный `textPrimary` → `WebThreads.color3` и hot core.

Theme Studio разделяется на два уровня:

### Быстрая палитра

Четыре color input, radius, glass opacity/blur и motion intensity. Изменения немедленно обновляют все Wallet-компоненты и Web Threads.

### Web Threads Lab

Пользователь получает контролы:

- speed;
- thread count;
- frequency;
- spread;
- taper;
- vertical position;
- fan mode;
- glow;
- falloff;
- thickness;
- brightness;
- opacity;
- mirror;
- shimmer;
- grain и grain intensity;
- pointer interaction и strength.

Настройки сохраняются в отдельном versioned storage key `wallet4i7.visual.v1`. Палитра и shader-параметры нормализуются отдельно, чтобы повреждённый visual preset не сбрасывал цвета темы.

## 8. Архитектура и границы

```text
packages/core
  visual-effects.ts       нормализация, defaults и versioned contract

packages/ui/src/react-bits
  web-threads/            адаптированный shader + lifecycle
  glass-actions/          адаптация GlassIcons
  spotlight-surface/      адаптация SpotlightCard
  count-up/               адаптация CountUp
  gradient-text/          акцентный текст
  click-spark/            событийный canvas-effect
  wallet-gooey-nav/       controlled bottom navigation visual

packages/ui/src/appearance
  visual-effects-provider.tsx
  web-threads-lab.tsx
  wallet-visual-layer.tsx

packages/ui/src/dashboard
  композиция Wallet-компонентов, без прямого OGL/Telegram API

apps/miniapp
  platform lifecycle, storage и feature detection
```

`core` не импортирует React, DOM, OGL или Telegram. `react-bits`-слой не знает о wallet data. Dashboard получает готовую visual configuration через provider. App остаётся единственным местом определения runtime capabilities.

## 9. Производительность и lifecycle

- Добавляется только `ogl@^1.0.11`; существующий `motion@13.2.0` переиспользуется.
- Web Threads создаёт один canvas и один WebGL2 context.
- DPR ограничивается `1.5` на мобильных и `2` на больших экранах.
- `threadCount` нормализуется в диапазоне 1–10.
- Loop работает только когда одновременно истинны: app active, document visible, canvas intersecting и motion разрешён.
- На coarse pointer mouse interaction автоматически отключается.
- Spotlight обновляет CSS variables только на fine pointer.
- ClickSpark не содержит постоянный loop без активных sparks.
- GooeyNav очищает все timers и particles при unmount.
- При потере WebGL context автоматически активируется fallback без бесконечных повторных инициализаций.

## 10. Доступность

- Canvas декоративный: `aria-hidden="true"`, `pointer-events: none` вне режима интерактивного фона.
- Интерактивность нити не является единственным способом выполнить действие.
- Все quick actions и nav items остаются настоящими `button` с русскими accessible names.
- `prefers-reduced-motion` отключает CountUp, sparks, gooey particles, shimmer и пространственные transitions.
- `prefers-reduced-transparency` заменяет glass на непрозрачные surfaces.
- Текст сохраняет WCAG AA contrast на всех четырёх контрольных палитрах.
- Focus outline не скрывается glow/spotlight слоями.

## 11. Проверки

### Unit/component

- нормализация visual config и восстановление повреждённого storage;
- WebThreads создаёт/удаляет canvas и теряет WebGL context при cleanup;
- `active=false`, reduced motion, saveData и WebGL error показывают fallback;
- изменение четырёх цветов обновляет shader uniforms без пересоздания context;
- quick actions сохраняют callbacks и keyboard activation;
- controlled GooeyNav синхронизируется с Dashboard и очищает timers;
- demo sheets, Back Button и текущие wallet interactions не регрессируют.

### Visual/E2E

- screenshot widths: 320, 390, 430 и 480 px;
- standard + четыре палитры;
- reduced motion, reduced transparency и WebGL fallback;
- отсутствие horizontal overflow;
- hero balance не пересекается с hot core;
- keyboard/focus/escape/back scenarios;
- browser и mock Telegram lifecycle.

### Производительный критерий

- один WebGL canvas в DOM;
- animation frame не выполняется при hidden/deactivated;
- quick action остаётся отзывчивым во время shader animation;
- отсутствие long task более 100 ms в контрольном mobile trace после прогрева;
- production build не включает GSAP/Three/Rapier.

## 12. Порядок реализации

1. Зафиксировать registry, provenance и лицензионные notices.
2. Добавить visual config contract и storage.
3. Перенести WebThreads, добавить lifecycle/fallback и связать с темой.
4. Пересобрать hero и убрать активное hero-видео.
5. Перенести и адаптировать glass actions, spotlight surfaces, CountUp и GradientText.
6. Перенести ClickSpark и controlled GooeyNav.
7. Расширить Theme Studio до Web Threads Lab.
8. Выполнить visual/E2E/performance проверки и открыть preview для пользовательской оценки.

## 13. Критерии приёмки

- Первый экран визуально воспринимается как единая Web Threads-сцена, а не набор карточек.
- Четыре основных цвета меняют всю сцену в реальном времени.
- Все перечисленные параметры Background Studio доступны и сохраняются.
- Текущие действия Dashboard остаются кликабельными и demo-only.
- На fallback-режимах интерфейс остаётся полноценным и читаемым.
- В production присутствуют только выбранные React Bits-компоненты и необходимые зависимости.
- Происхождение и лицензия каждого перенесённого компонента документированы.
- Полный test/typecheck/lint/build/E2E набор зелёный.
