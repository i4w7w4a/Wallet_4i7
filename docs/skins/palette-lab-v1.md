# MONO Palette Lab V1

Статус: утверждено владельцем 2026-09-17. Этот документ заменяет прежний запрет
на свободное управление hue/chroma в лаборатории MONO. Разрешение относится только
к Palette Lab: production `Apply`, semantic states, контраст и resource budgets
остаются защищёнными.

## 1. Цель

Palette Lab управляет цветовым характером MONO через смысловой граф, а не через
набор несвязанных HEX. Изменение мастер-пигмента перестраивает все незаблокированные
роли по выбранной гармонии. Пользователь может отделить любую роль, настроить её
вручную, заблокировать, сохранить обе темы в именованный preset и скопировать из
чужого preset только нужный модуль.

## 2. Непересекающиеся состояния

- **Workspace** — черновики Dark/Light, links, locks, seed, undo/redo и выбранный UI.
- **Active appearance** — применённый нормализованный snapshot; меняется только `Apply`.
- **Saved preset** — именованный immutable revision; меняется только явным `Save`.

Slider, randomize, theme switch и slot switch не сохраняют preset автоматически.

## 3. Цветовой контракт

Вычисления выполняются в OKLCH/OKLab, финальный вывод gamut-map-ится в sRGB без
поканального clipping. HEX — только формат ввода/копирования.

Группы semantic roles:

- `core`: canvas, surfaceBase, surfaceRaised, surfaceOverlay;
- `content`: textPrimary, textSecondary, textMuted, textDisabled;
- `structure`: borderSubtle, borderStrong, focus;
- `decorative`: accentPrimary, accentSecondary, glassTint, edgeCool, edgeWarm,
  atmosphereCool, atmosphereWarm, chartLine, selection;
- `system`: success, warning, danger, info.

`system` не участвует в эстетической randomization. Текст, цифры и иконки не
получают chromatic split. Approved optical Ledger JSON, IOR, geometry, flow и
shader dispersion Palette Lab не меняет.

## 4. Dark и Light

Каждая тема хранит собственный `ThemePaletteState`: mode, recipe, role overrides,
links и locks. Переключение темы обязано восстанавливать её состояние без потерь.

`Связать темы` связывает только характер: anchor hue/chroma, harmony, temperature
и iridescence. Exposure, luminance ramp, contrast и surface response остаются
отдельными. Отключение связи атомарно замораживает обе вычисленные ветви. Повторное
включение сначала показывает diff и не уничтожает manual values молча.

## 5. Режимы и роли

- `linked` — роль выводится из recipe;
- `offset` — роль следует recipe с локальной поправкой L/C/H;
- `manual` — абсолютный OKLCH;
- `locked` — дополнительный флаг; значение не меняют recipe, randomize и partial apply.

Effective lock: `groupLock OR roleLock`. Несовместимая операция возвращает понятный
no-op/error и не нарушает lock.

Art-directed harmonies V1:

- `spectral-graphite` — almost-neutral material с тонкой холодно-тёплой кромкой;
- `mineral` — один hue, различие через lightness/chroma;
- `thermal-duet` — anchor и мягкий counter-hue около `+168deg`;
- `analog-mist` — соседние оттенки;
- `split-prism` — экспертный split только для decorative roles.

Randomization детерминирована: seed, engine/catalog version, scope, parameter id и
action counter. `Math.random()` и `Date.now()` запрещены. Locked/out-of-scope roles
остаются побитно неизменными.

Первый слой использует отдельную команду `Новый вариант`: она подбирает цельный
recipe (оттенок, насыщенность, одну из четырёх основных гармоний, температуру и
перелив), а не независимо переставляет каждую роль. При связанных темах характер
меняется в обеих ветвях, но их собственная экспозиция и контраст сохраняются.
Успешный вариант — одна операция Undo и один шаг action counter; no-op/error
счётчик не расходуют. Замки сравниваются по конечному resolved цвету. Старые
global/group/point randomizers остаются в точной настройке и не подменяют эту
команду.

В историческом V1 цвет `focus` зависел от hue/chroma рецепта. Чтобы новый вариант
не сдвигал защищённый фокус, успешная quick-операция может добавить к теме
`focusAnchor: { version: 1, h, c }` — базовый hue/chroma фокуса до offset,
gamut mapping и contrast repair. Финальный resolved `focus` дополнительно
сравнивается до/после. Снимки без `focusAnchor` вычисляются ровно по V1;
старые schema hash, exact randomizer и экспорт V1 не переписываются.

## 6. Доступность и движение

- обычный текст: WCAG 2.2 contrast не ниже `4.5:1`;
- крупный баланс: цель не ниже `7:1`;
- controls/focus/non-text: не ниже `3:1`;
- прозрачное стекло проверяется после alpha compositing по худшему допустимому фону;
- invalid manual draft можно просматривать, но `Apply` блокируется с объяснением;
- control enter/press/settle: `90/80/190ms`, palette settle `180..240ms`, фоновые
  градиенты crossfade `320..420ms`, easing `cubic-bezier(0.2, 0, 0, 1)`, без overshoot;
- reduced motion получает мгновенное обновление без spatial choreography.

## 7. Persistence и portable fragments

Текущие versioned local keys:

- `wallet4i7.mono.palette-workspace.v2`;
- `wallet4i7.mono.palette-active.v2`;
- `wallet4i7.mono.palette-presets.v2` — offline/local fallback.

Чтение проверяет текущий ключ и, если его ещё нет, принимает прежний `.v1`.
Чтение само не переписывает storage; следующая явная запись использует `.v2`.
Внутренние envelope `workspace.version` и `active.version` остаются `1`:
суффикс ключа отделяет новый формат хранения, а не объявляет новый skin.
Portable preset без защищённого фокуса остаётся `schemaVersion: 1`; preset с
`focusAnchor` получает `schemaVersion: 2` и отдельный schema hash. Импорт и
фрагменты обеих версий строго проверяются, включая content hash.

Preset revision хранит recipe, обе theme branches, resolved values, links, editor
locks, seed/counters, schema/engine/catalog versions и content hash. Runtime Apply
игнорирует editor-only locks, но редактор восстанавливает их при повторном открытии.

Разрешённые partial scopes: entire preset, dark, light, palette, background,
glass-color, typography. Partial apply проходит migration, normalization, diff,
constraint validation и по умолчанию уважает locks. Raw CSS, HTML, JS, shader code,
font URL и произвольные JSON pointers запрещены.

## 8. Серверная библиотека

PostgreSQL хранит anonymous owners, presets и immutable revisions. Человекочитаемое
имя не является ID; глобальные дубликаты разрешены. Preset имеет UUID, unguessable
slug, owner, visibility (`unlisted|public`), source preset для fork и soft delete.

Анонимный владелец подтверждается случайным секретом в HttpOnly SameSite=Lax
cookie (с `Secure` на HTTPS); сервер хранит только salted hash. Потеря cookie
не даёт права перезаписать preset. Экспорт JSON даёт переносимость; recovery
token и привязка к аккаунту ещё не реализованы.

Default visibility — `unlisted`. Любой посетитель может читать preset по ссылке,
создать собственный fork и сохранить его под своим именем. Поле `public`
пока лишь метаданные; публичного каталога нет. Его запуск требует gateway/IP
rate limiting и модерации: лимит только по анонимному cookie обходится его сбросом.

API принимает только allowlisted versioned envelopes, ограничивает имя, описание,
payload size и частоту записи. Никто не может обновить чужой preset.

## 9. UX

Телефон остаётся чистым. Слева по умолчанию — понятный цветовой слой:
`Основной цвет`, `Как звучит цвет`, `Цветовой перелив`, `Что не менять` и
`Новый вариант`. Круговое поле задаёт hue углом (сверху 0°, справа 90°),
насыщенность — расстоянием от центра по квадратной кривой для точности у
нейтрального центра. Видимые `Тон` и `Интенсивность` дают клавиатурный и
assistive-tech путь. Один drag поля — одна операция Undo.

Четыре карточки характера: `Графит` (`spectral-graphite`), `Один тон`
(`mineral`), `Дымка` (`analog-mist`) и `Дуэт` (`thermal-duet`). Экспертный
`split-prism` доступен только через `Точную настройку`. Три быстрых замка
показывают реальные цвета, состояние и действуют на текущую Dark/Light ветвь:

- `Основа` — canvas, surfaceBase, surfaceRaised, surfaceOverlay, borderSubtle,
  borderStrong;
- `Акценты` — accentPrimary, accentSecondary, chartLine, selection;
- `Стекло` — glassTint, edgeCool, edgeWarm, atmosphereCool, atmosphereWarm.

Состояния замка: меняется, частично закреплено, закреплено, закреплено в точной
настройке. Родительский group lock быстрый UI не снимает. `system` и `focus`
не меняются; текст может подстроиться по нейтральной шкале, но обязан пройти
контрастную проверку и не получает chromatic split. В `Точной настройке` сохранены отдельные
semantic роли, поправки, point/group randomization, seed, Apply, JSON и локальная
библиотека; серверная библиотека остаётся отдельной секцией. Dark и Light помнят
свои независимые настройки. Rails сворачиваются независимо и вместе, не меняя
ширину preview. На узком экране это доступные drawers, не элементы телефона.

Поле и карточки имеют keyboard/focus-visible путь и touch targets от 44 CSS px.
Палитра обновляется мягко, без overshoot; `prefers-reduced-motion` убирает
palette crossfade и пространственное движение. Цветовой UI не добавляет второго
canvas, WebGL context, постоянного RAF или таймера.

Preset card показывает Dark/Light palette strips, имя, visibility, ревизию и
происхождение. Загрузка и Copy Dark/Light/Palette/Background/Glass идут через
preview/diff с количеством сохранённых locks и constraint warnings. Общая
команда JSON оставляет переносимый выход даже без сервера. Server Save создаёт
новый preset либо новую ревизию своего; чужой preset можно только Fork.

## 10. Definition of done

- linked edit меняет все и только зависимые unlocked roles;
- linked/manual и link/unlink themes не дают визуального скачка;
- Dark -> Light -> Dark восстанавливает exact state;
- lock сохраняет exact resolved value после randomize и partial apply;
- одинаковый seed/config даёт одинаковый snapshot;
- export/import и database save/load воспроизводят один content hash;
- anonymous visitor не может изменить чужой preset, но может fork/copy;
- visual matrix проходит на 320/390/430/480, Dark/Light и всех harmony recipes;
- один WebGL context/RAF сохраняется, renderer не remount-ится при цветовых правках.

## 11. Проверка реализации на 2026-09-17

Color Lab, локальная и серверная UI-библиотека реализованы в изолированном
`/mono`. Полный unit-прогон: core `13`, platform `17`, UI `153`, miniapp `86` —
все прошли. Typecheck, production build и lint прошли; у lint остался один
ранее существовавший warning в `mono-preview.tsx`. Целевые browser E2E `16/16`
проверили prepaint, оптику, rails, мобильный focus, read-by-link, diff, Fork и
единственный canvas. Автоматическая матрица проверила `4 × 2 × 5 = 40`
сочетаний ширины, темы и гармонии; выборочные кадры осмотрены визуально.

Это не подтверждение работы с реальной PostgreSQL на этом Windows-хосте и не
разрешение выкатывать серверные записи публично. Перед rollout нужны staging
с БД, проверка backup/migration/restore и лимит новых анонимных владельцев на
gateway. Без БД сервер возвращает 503, а локальные черновики/JSON остаются
доступны.

## 12. Проверка нового первого слоя на 2026-09-17

После human-first интеграции: `@wallet/ui` 160/160, miniapp 109/109;
typecheck и production build прошли, lint — 0 ошибок и один существовавший
ранее warning в `mono-preview.tsx`. Все browser E2E MONO — 50/50: круговой
жест и Undo, видимое изменение палитры, четыре карточки, быстрый замок,
единственный canvas, независимые rails, prepaint, импортный diff, 40 комбинаций
ширины/темы/гармонии и reduced motion без palette-анимации. Скриншоты Dark/Light
для 320/390/430/480 px и прокрученной цветовой панели проверены глазами;
переключатель всех панелей больше не накрывает кнопку нового варианта.

Это локальная проверка реализации; развёртывание на сервере и реальная
PostgreSQL фиксируются отдельно. Исторические результаты выше оставлены как baseline
предыдущего этапа, а не суммируются с этим прогоном.
