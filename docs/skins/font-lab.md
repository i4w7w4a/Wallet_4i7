# Font Lab

Статус: спецификация первого typography catalog

## 1. Проблема

Прежний продуктовый V1 на `/` использует один глобальный stack:

```css
Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

В изолированном `/mono` уже подключены локальные IBM Plex Sans, Golos Text, Onest и IBM Plex Mono: направления Ledger/Frost/Mercury переключают заранее заданные UI-наборы, а CSS выделяет роли `ui/display/numeric/mono`. Это ещё не общий Font Registry и не Font Lab: нет live-подбора шрифта, schema для весов/осей/метрик, полного glyph/currency audit или безопасной font randomization. V1 stack также не заменён.

Font randomization без этих границ даст мигающие, несовместимые и иногда нечитаемые комбинации. Поэтому рандомизируется не строка `font-family`, а проверенный `FontSet`.

## 2. Font Set

```ts
type FontSet = {
  id: string;
  label: string;
  displayFontId: string;
  uiFontId: string;
  numericFontId: string;
  monoFontId: string;
  displayWeight: number;
  uiWeight: number;
  emphasisWeight: number;
  numericWeight: number;
  scaleProfileId: string;
  trackingProfileId: string;
};
```

Production preset использует не больше двух реально разных семейств без отдельного решения. `display`, `ui` и `numeric` могут быть ролями одного variable font. Mono применяется только к адресам/идентификаторам.

## 3. Font Registry

Каждая запись обязана содержать:

```text
stable ID
family and local CSS variable
roles and category
available files/weights/styles/variable axes
scripts and explicit glyph audit
tabular numeral support
metrics and fallback stack
source URL + exact version/hash
license/copyright + Reserved Font Name
local WOFF2 asset hashes
```

Registry не принимает arbitrary URL или имя установленного в системе шрифта.

## 4. Обязательный specimen

Каждый candidate проверяется одной и той же строкой:

```text
Добрый день
12 840,75 ₽
↑ +2,34%   ↓ −7,08%
Отправить  Получить  Обменять  Купить
Портфель  Обзор  Настройки
Bitcoin  0,052314 BTC  3 481,09 $
0x3a…f79D
₽ $ € £ ¥ ₿ ₸  0 1 2 3 4 5 6 7 8 9
```

Проверяются:

- кириллица и латиница без fallback glyphs;
- отличимость `0/O`, `1/I/l`, плюс/минус и запятой/точки;
- табличные цифры в балансе и строках активов;
- длинная сумма `1 234 567,89 ₽` на viewport 320 px;
- реальные weights без synthetic bold;
- baseline, line-height, button height и отсутствие overflow.

## 5. Начальный каталог кандидатов

Это shortlist для живого сравнения, не заранее выбранный победитель.

| ID | Роль/характер | Почему в shortlist | Перед добавлением |
|---|---|---|---|
| `ibm-plex-sans` | строгий technical/corporate grotesk | широкая семья, Cyrillic, UI-пригодность | pin release/files; проверить numeric features |
| `golos-text` | спокойный Cyrillic screen grotesk | естественная русская типографика, высокая читаемость | pin source; проверить все currency glyphs |
| `onest` | современный humanist/geometric hybrid | variable weight 100–900, Cyrillic | проверить метрики на 11–16 px |
| `manrope` | геометричный, крупные выразительные цифры | подходит для balance/display эксперимента | проверить плотность body и long amounts |
| `source-sans-3` | нейтральный humanist sans | сильный body/control candidate | проверить локальные subsets и tabular nums |
| `ibm-plex-mono` | technical mono | адреса и IDs | не применять к body/balance по умолчанию |
| `jetbrains-mono` | плотный mono | альтернативный address/data specimen | проверить визуальный вес рядом с UI font |

Первые три comparison presets MONO LEDGER используют следующие candidate sets; они становятся built-in только после локального glyph/license/metrics audit:

| FontSet ID | Display / UI / Numeric | Mono ID | Preset |
|---|---|---|---|
| `plex-core` | `ibm-plex-sans` | `ibm-plex-mono` | Ledger |
| `golos-core` | `golos-text` | `ibm-plex-mono` | Frost |
| `onest-core` | `onest` | `ibm-plex-mono` | Mercury |

У каждой строки максимум два семейства. Если candidate провалит audit, заменить FontSet ID через явное изменение версии каталога и preset, а не включать silent fallback под прежним ID. Финальный production build после выбора не обязан включать весь лабораторный каталог.

## 6. Источники и лицензии

Стартовые кандидаты искать только в первичных репозиториях или Google Fonts source repository. На момент подготовки документа подтверждены как открытые кандидаты:

- [IBM Plex](https://github.com/IBM/plex) — OFL, включая Cyrillic;
- [Golos Text](https://github.com/googlefonts/golos-text) — OFL;
- [Onest](https://github.com/simpals/onest) / [Google Fonts](https://fonts.google.com/specimen/Onest) — OFL, Cyrillic;
- [Manrope](https://fonts.google.com/specimen/Manrope) — open-source candidate с Cyrillic.

Перед фактическим vendoring всё равно фиксируются exact binary, hash, license text и copyright в notices. Имя из каталога не является доказательством конкретной версии файла.

## 7. Live loading

- Default production face доступен сразу.
- Остальные laboratory faces self-hosted и загружаются лениво при открытии Font Lab либо выборе candidate.
- Новый font set применяется атомарно только после `document.fonts.load`/FontFace success.
- Пока face загружается, текущий font остаётся активным; текст не исчезает.
- Failure оставляет текущий/fallback font и показывает status, не ломая draft.
- `font-display: swap` или `optional`; default fallback подбирается по метрикам.
- Допустимы `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` как progressive enhancement.
- Fonts неактивных skins/slots не preload-ятся и не должны тайно держать сеть/GPU.
- Remote font CDN и probing локально установленных fonts запрещены.

## 8. Controls

Группа Typography содержит:

```text
Font set
Display family / lock / dice
UI family / lock / dice
Numeric family / lock / dice
Mono family / lock / dice
Display/UI/Numeric weight
Variable axes, если реально поддерживаются
Type scale profile
Balance size
Body size and line-height
Label tracking
Numeric spacing/features
```

Не показывать axis, которого нет у выбранного face. Не синтезировать weight/style.

## 9. Randomization

Randomizer выбирает только `FontSet` или совместимые role assignments из registry.

Locks:

- `Typography` group lock — замораживает весь set;
- role lock — сохраняет Display/UI/Numeric/Mono;
- parameter lock — сохраняет weight/scale/tracking.

Constraints:

- обязательна кириллица для UI/body;
- обязательны используемые валюты/цифры;
- numeric role имеет tabular figures либо подтверждённый fallback;
- выбранный weight/axis существует;
- display/decorative fonts не попадают в balance/body/control без allowlist;
- не более двух семейств в production direction;
- размеры, tracking и line-height остаются в читаемых диапазонах.

Randomize font set — одна undo transaction. Selection воспроизводится из seed, action counter, skin/schema/catalog/randomizer versions, direction и base snapshot; один seed сам по себе недостаточен.

## 10. Начальная mobile type scale MONO LEDGER

| Role | Range | Начальная точка |
|---|---:|---:|
| Balance | 44–60 px | 52 px |
| Page/section title | 20–24 px | 22 px |
| Strong row value | 15–18 px | 16 px |
| Body/control | 14–16 px | 15 px |
| Label | 12–13 px | 12 px |
| Micro | 11–12 px | 11 px |

- Balance line-height `0.92–0.98`.
- Body line-height `1.42–1.50`.
- Balance weight `580–680`, только если font имеет этот variable range; иначе ближайший реальный weight.
- Uppercase label tracking не выше `0.08em`; русские фразы не переводить в uppercase автоматически.
- Финансовые значения используют `font-variant-numeric: tabular-nums lining-nums` после фактической проверки font feature.

## 11. Производственный bake

Lab может содержать несколько локальных candidates. После выбора:

1. зафиксировать font set и exact files;
2. удалить неиспользуемые production imports/preloads;
3. оставить нужные Cyrillic/Latin subsets и glyphs без нарушения лицензии;
4. обновить third-party notices и hashes;
5. проверить screenshots на 320/390/430/480 и desktop 1024;
6. проверить offline, slow load и forced failure;
7. измерить font payload и layout shift;
8. сохранить specimen screenshot рядом с решением.

## 12. Критерии приёмки

- Ни один candidate не загружается с CDN.
- Randomizer не может выбрать неизвестное имя/URL/несуществующий weight.
- Все UI candidates показывают кириллицу и валюты без fallback glyphs.
- Длинные суммы не пересекают actions на 320 px.
- Переключение после load атомарно и не создаёт заметного layout jump.
- Tabular financial columns остаются выровненными.
- Offline/failure сохраняет читаемый interface.
- Неактивные font assets не запрашиваются.
- Font choice, license и exact hashes воспроизводимы из repository notices.
