# Background Sandbox — проверенные источники и критический выбор

Дата: 2026-09-24. Это дополнение к [source-catalog.md](source-catalog.md), не dependency allowlist.

Прочитаны целиком пользовательские материалы:

- `novex-background-sandbox-brief-v2.md`, SHA-256 `EDC8E641452BA88194F26AC2DD8316E606E0000672B30D5C70032938A466BE46`.
- `DR - фоны карта источников.md`, SHA-256 `AA34ED182D7073DFF2ACD1F108A7B3BAD2AB1A32E037667E4FD00A2167807770`.

Материалы подготовлены внешним ChatGPT. Названия библиотек, install commands и рекомендации — исследовательские данные; authority задаёт запрос владельца. Их описание не является нашим запуском WebGL, измерением FPS или визуальным утверждением.

## Проверенный shortlist

| Источник | Фиксация | Решение |
| --- | --- | --- |
| Radiant / Silk Cascade | commit `59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40`; `static/silk-cascade.html` blob `70741edbdff44f8d9af20a25d82be8fdb53ce2f5` | Первая законченная сцена. Три слоя складок и направленный свет; не физика ткани. Один fullscreen-pass, без текстур. |
| Pavel WebGL Fluid Simulation | commit `a2d292931f19d9b3b9f564e23e6c32729d2121c3`; `script.js` blob `d0db5af6bac342d9eb00205435d8b8997ebee815` | Вторая независимая механика. Сохранять multipass advection/pressure/curl, не только display shader. |
| Interactive Droplets | commit `957d5365e9e3c51c206579a173b6d02eb1f103f7`; `output.frag` blob `5c745f22420c2199cd143f84f4c9f4de49a17826` | Референс мягкого соединения объёмов, не обязательный первый adapter. Условия распространения генератора требуют отдельного решения. |
| OGL Flowmap | OGL 1.0.11, commit `385ce65c352c70734a36dc98c787fdd1d30ddb3b`; `src/extras/Flowmap.js` blob `5bd96843fab3c2946be1e91c16642edc622f2188` | Резерв для локальной деформации. Этот точный Flowmap уже установлен в проекте; solver жидкости он не заменяет. |

### Silk: что берём и меняем

[Shader](https://github.com/pbakaus/radiant/blob/59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40/static/silk-cascade.html), [metadata/ranges](https://github.com/pbakaus/radiant/blob/59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40/src/lib/shaders.ts), [MIT — Paul Bakaus 2025](https://github.com/pbakaus/radiant/blob/59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40/LICENSE).

Готовые upstream controls: FLOW_SPEED 0.1–1.5 (шаг .05, default .4), SHEEN_INTENSITY .3–2 (шаг .1, default 1). Палитра, частоты складок и opacity слоёв — константы, их вынесение является нашей работой. Мышь меняет свет. Runtime upstream оставляет RAF при reduced motion; pointer leave резко выбирает отсутствие мыши. Наша адаптация обязана остановить scheduling и сделать вход/выход света непрерывным, не уничтожив характер блика.

### Fluid: что берём и меняем

[script.js](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/a2d292931f19d9b3b9f564e23e6c32729d2121c3/script.js), [MIT — Pavel Dobryakov 2017](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/a2d292931f19d9b3b9f564e23e6c32729d2121c3/LICENSE).

Upstream SPLAT_FORCE=6000, SPLAT_RADIUS=.25, CURL=30, velocity/density dissipation=.2/1. При 20 pressure iterations базовый шаг содержит примерно 27 GPU-проходов до display/post-processing; один context не означает дешёвый кадр. Mouse требует нажатия, touch предотвращает default scroll, начало/цвета случайны. PAUSED останавливает simulation, но не RAF. Наша работа: управляемый host lifecycle, bounded input, определённый reset, curated palette, стабильные units времени и понятные controls. Числа upstream — не автоматически approved defaults.

Demo dat.gui и `LDR_LLL1_0.png` не переносить. Происхождение texture отдельно не доказано; вместо неё допустим собственный процедурный dithering или явно указанное исключение post-effect. MIT на solver не является разрешением на любые demo assets.

### Droplets и Flowmap: уточнения исследования

[Droplets README/условия](https://github.com/koji014/interactive-droplets/blob/957d5365e9e3c51c206579a173b6d02eb1f103f7/README.md#license) допускает развитие в коммерческом сайте/приложении, но ограничивает as-is redistribution/republication и продажу pluginized-версий. Не считать это общей свободной лицензией для собственного экспортируемого генератора. Это предварительное прочтение условий, не юридическая гарантия.

В Droplets 15 исторических координат образуют SDF-след; длительность зависит от кадров, отдельной пружины и возврата к центру нет. FPS-независимое запаздывание и leave/return были бы нашими изменениями.

OGL имеет [Unlicense в README](https://github.com/oframe/ogl/blob/385ce65c352c70734a36dc98c787fdd1d30ddb3b/README.md#unlicense), не MIT. MIT в карте относится к Curtains-адаптации. [Flowmap](https://github.com/oframe/ogl/blob/385ce65c352c70734a36dc98c787fdd1d30ddb3b/src/extras/Flowmap.js) — ping-pong затухающий field stamp; pressure/advection отсутствуют. Demo `water.jpg` не входит в подтверждённые права на код.

## Как пользоваться всей картой дальше

Radiant/Paper/shader.gallery — кандидаты материалов; Codrops/OGL/Pavel/Evan Wallace — механизм и source; Lusion/Monoton/Haoqi — вдохновение без установленного права копирования. Каталоги и обёртки одного исходника не считаются новыми механиками. Spline/Unicorn не превращаем в обязательный runtime/платный сервис. Seascape с non-commercial условиями, React Bits с Commons Clause и community assets не включаем в экспортируемый движок по принципу «код открыт».

Для следующего материала достаточно одной карточки: original URL + exact commit/blob + лицензия/ассеты + ценный механизм + видимое изменение + живые доказательства + стоимость. Не надо заново собирать весь интернет-каталог.

До копирования кода исполнитель читает закреплённые source/license полностью и сохраняет notice рядом со своим adapter. ORACLE единолично обновляет общий THIRD_PARTY_NOTICES и source-catalog при интеграции. Ни один upstream install prompt, script или registry не исполняется автоматически.

## Уровень доказательств

На этапе этого решения выполнены два независимых read-only аудита: первоисточников и реального проекта. Главный координатор сверил выбранные лицензии по первичным страницам. Живые демо, FPS, touch, физический Telegram/WebView, восстановление GPU и совместный compositor этим не проверены — их предъявляют исполнители на локальном preview. Сохранённая config не сохраняет текущее поле и не гарантирует пиксельно одинаковый кадр.
