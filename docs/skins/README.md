# Wallet_4i7 Skin System

Статус: направление V2 и живой изолированный design workbench; полноценная система скинов ещё не реализована
Дата фиксации: 2026-09-17
Ветка начала направления: `codex/skin-lab-v2`

## Что можно посмотреть сейчас

- Из этой ветки запустить `pnpm dev` и открыть `http://localhost:3000/mono` (лучше начать с мобильной ширины 390 px).
- `/` — прежний V1, без замены новым дизайном.
- `/mono` — отдельная мобильная сцена MONO LEDGER на демоданных кошелька. Кнопки в левой rail и клавиши `1 / 2 / 3` переключают фиксированные визуальные варианты Ledger, Frost и Mercury без перезагрузки страницы.
- Все design controls вынесены из телефона в две sibling rails: слева `Варианты / Экран`, справа `Среда / Оптика`. Центральная `.mono-page` больше не содержит лабораторную шапку или control tree и остаётся чистым объектом визуальной оценки.
- Каждая секция rail сворачивается независимо. Один master-переключатель скрывает или возвращает обе rails, не двигая preview и не меняя состояние секций. Ни сворачивание секции, ни скрытие chrome не сбрасывают optical draft.
- Четыре кнопки `320 / 390 / 430 / 480` меняют реальную inline-size preview-контейнера, а не масштабируют screenshot или DOM через `transform`. Компоненты адаптируются container queries и `cqw`; на узком host выбранная ширина безопасно ограничивается доступным viewport.
- В `/mono` подключены локальные WOFF2-шрифты и один WebGL/OGL optical promo с signed refraction, нейтральными отражениями, каустикой, медленным flow и мягким pointer response; читаемый текст остаётся DOM. При недоступности эффекта используется статический фон.
- Утверждённый владельцем built-in default первого окна `1 · Ledger` использует **положительный** `ior: 1.34`. Знак выбран намеренно: это не опечатка и не значение, которое следует автоматически вернуть к прежней отрицательной ветви.
- Preview-only Material Lab встроен в правую rail: рабочие группы `Линза / Свет / Поле / Течение`, live sliders, `По умолчанию`, копирование JSON и `Применить`. Изменения остаются draft текущего направления при collapse/hide; только `Применить` записывает нормализованный кандидат в `wallet4i7.mono.optical-preview.v1`. V1 и product appearance не меняются.
- Смена Ledger/Frost/Mercury запускает короткую законченную motion-композицию: balance ведёт, chart/actions/promo отвечают каскадом; бесконечным остаётся только оптическое течение активного preset, включая утверждённый Ledger.
- Тема `Тёмная / Светлая` и три фона `Ирис / Волна / Слои` выбираются независимо от Ledger/Frost/Mercury и восстанавливаются как отдельный локальный preview. Тёмная среда получила очень слабый холодно-тёплый перелив; светлая — собственную pearl/ceramic грамматику, а не инверсию.
- Pointer atmosphere реагирует только на `fine pointer`: `Ирис` мягко меняет световое поле, `Волна` постепенно набирает энергию из сглаженной скорости жеста и оставляет редкий конечный след, `Слои` локально отталкивают редкие элементы. Первый sample никогда не создаёт ударную волну; медленный дрейф остаётся ниже порога, а импульсы ограничены временем, расстоянием и максимум шестью DOM-узлами. Отдельного постоянного RAF, canvas или WebGL context нет. На coarse pointer и при `prefers-reduced-motion` композиция статична. Фоновая рябь — не shader-displacement; реальная рефракция остаётся внутри Promo.
- Снимки локализовали повторявшуюся светлую рейку справа у Promo в CSS: старый hover окрашивал всю рамку в `#cacaca` поверх полной inset-рамки. Толщина border не менялась; теперь он остаётся прозрачным, а материальный отклик создают неравномерные световые кромки и тень. Отдельно закрыт риск укороченного WebGL canvas при preset-transform: OGL resize измеряет layout-box через `clientWidth/clientHeight`, не принимая трансформированный DOMRect за основную ширину. Эта resize-уязвимость не установлена как причина полосы на присланном снимке.
- Fine-pointer interaction layer даёт разным объектам разные материальные ответы с ритмом `90 ms enter / 190 ms settle / 80 ms press`; он не двигает layout и не размножает один и тот же scale/glow по всему экрану.
- Это визуальный прототип: действия и нижняя навигация показаны как макет, а переключение вариантов не является переключением полноценного product skin.

Реализация: [маршрут](../../apps/miniapp/app/mono/page.tsx), [сцена](../../apps/miniapp/src/mono-preview/mono-preview.tsx), [workbench chrome](../../apps/miniapp/src/mono-preview/mono-workbench.css), [Material Lab](../../apps/miniapp/src/mono-preview/mono-glass-tuner.tsx), [модель Tide](../../apps/miniapp/src/mono-preview/mono-tide-motion.ts), [motion layer](../../apps/miniapp/src/mono-preview/mono-motion.css), [pointer atmosphere](../../apps/miniapp/src/mono-preview/mono-atmosphere.css), [interaction layer](../../apps/miniapp/src/mono-preview/mono-interactions.css), [оптический эффект](../../packages/ui/src/mono/mono-optical-glass.tsx).

Точный approved JSON первого окна:

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

Это built-in reset/default `1 · Ledger`, а не произвольный сохранённый preview candidate. Валидный кандидат из локального preview storage может быть восстановлен при следующем открытии, но команда `По умолчанию` обязана возвращать именно этот объект.

Preview-only тонкая настройка оптики уже работает, но это ещё не общий Skin Lab. **Не реализованы** три независимых draft-слота, рандомизация и замки, Undo/Redo, именованные production presets, Font Lab и интеграция через общий `SkinHost` с переносом product state. Эти пункты ниже — целевой контракт, а не перечень уже работающих функций.

## Проверка текущего прототипа

На текущей итерации подтверждены: miniapp unit `11/11` в двух файлах, `@wallet/ui` unit `133/133` в пятнадцати файлах, miniapp typecheck, targeted ESLint, production build и полный `/mono` E2E `39/39` (проект `mobile-chromium`). Workbench E2E `6/6` проверяет sibling rails вне preview, четыре реальные ширины вместе с nav и container gutter, сохранение несохранённого optical draft при collapse, master hide без смещения сцены, compact drawers и клавиатурный focus trap. Отдельно проверены отсутствие холодной вспышки rails, мобильные hit areas, реальная WebGL-геометрия и кромка Promo после цикла вариантов. Unit-регрессии фиксируют velocity-driven Tide и измерение optical canvas по нетрансформированному layout-box.

Полный repo E2E содержит прежние, не относящиеся к workbench, visual failures Dashboard; старые V1 screenshot-эталоны ради новой оболочки не переписываются.

Полный старый E2E-набор пока **не зелёный**: V1 screenshot-эталоны расходятся с текущим рендером на этой машине. Мы не переписывали эти эталоны ради прохождения теста и не меняли код сцены V1. Один тест кратковременной анимации V1 не прошёл в общем прогоне, но прошёл при отдельном повторе; его нужно стабилизировать отдельно от утверждения дизайна V2.

## Зачем это существует

Цель V2 — не собрать одну «идеальную тему». Нужна управляемая среда, в которой можно быстро создавать, сравнивать и углублять разные визуальные языки приложения:

- переключать три варианта кнопками и клавишами `1 / 2 / 3`;
- менять параметры в live preview без перезагрузки и потери состояния приложения;
- рандомизировать всё, отдельную группу или один параметр;
- блокировать понравившиеся группы и значения;
- возвращаться через Undo/Redo и честно сравнивать A/B;
- сохранять результат как versioned preset и воспроизводимый JSON;
- превращать удачный эксперимент в поддерживаемый production skin.

Быстрота здесь рождается не из бесконтрольного копирования эффектов. Она рождается из строгого внутреннего контракта: внешние библиотеки поставляют сырьё, а приложение принимает только нормализованные tokens, recipes, assets и adapters.

## Четыре разных уровня

| Уровень | Что это | Пример |
|---|---|---|
| Parameter | Одно значение | radius, font weight, `ior` |
| Preset | Полный snapshot одного skin | `Ledger`, `Frost`, `Mercury` |
| Skin | Цельная визуальная грамматика | `liquid-v1`, `mono-ledger-v1` |
| Product mode | Иные данные или сценарий | другой поток платежа; не skin |

Theme в старом смысле — небольшая настройка внутри skin. Она не должна быть общим API всех будущих дизайнов.

## Канонические документы

- [checkpoint-2026-09-17-workbench.md](checkpoint-2026-09-17-workbench.md) — текущая точка продолжения и оставшиеся проверки; [предыдущий checkpoint](checkpoint-2026-09-16.md) сохранён как история итерации.
- [architecture.md](architecture.md) — аудит V1, границы и целевая архитектура.
- [lab-workflow.md](lab-workflow.md) — UX лаборатории, randomize, locks, history, storage и export.
- [font-lab.md](font-lab.md) — система шрифтов, live switching и безопасная рандомизация.
- [mono-ledger-v1.md](mono-ledger-v1.md) — первый строгий нейтральный skin со сдержанными цветовыми кромками.
- [source-catalog.md](source-catalog.md) — разобранный research stack и правила заимствования.
- Корневой [AGENTS.md](../../AGENTS.md) — обязательные правила для всех будущих агентов.

## Архитектурные решения для дальнейшей реализации

1. V1 должен остаться визуально и функционально сохранённым при будущей упаковке в compatibility skin `liquid-v1`; сейчас он по-прежнему живёт на `/`.
2. Новый `ThemeConfig` не будет расширяться до универсального mega-config.
3. Skin получает только view model, semantic commands, runtime environment и свою appearance config.
4. Будущий Skin Lab имеет три независимых slot и один активный renderer. Кнопки `1/2/3` в `/mono` пока выбирают фиксированные направления; текущие rails и embedded Material Lab — prototype workbench, но не полноценные slot/history/randomize semantics.
5. Будущая randomization детерминирована, ограничена schema и уважает locks.
6. Первый новый skin — `mono-ledger-v1`: строгий нейтральный базис, дозированные iridescent accents и редкий настоящий WebGL liquid glass. Старое абсолютное правило `R=G=B` для каждого декоративного пикселя superseded пользовательским решением о тонких цветовых переливах.
7. Настоящая рефракция не подменяется CSS blur. DOM-текст остаётся живым.
8. Одновременно работают не более одного WebGL context, одного постоянного RAF и одного ambient effect.
9. Для прототипа шрифты self-hosted; перед production-интеграцией их реестр и проверки glyphs/валют/лицензий должны стать частью общего Font Lab.
10. React Bits, Magic UI, Motion Primitives и остальные каталоги — источники кандидатов, не фундамент всего продукта.

## Что не делаем в этой фазе

- Не переписываем V1 одновременно с созданием контракта.
- Не устанавливаем весь research stack.
- Не запускаем несколько skin renderers ради сравнения.
- Не разрешаем remote skins, raw CSS, arbitrary font URL или shader code в presets.
- Не меняем бизнес-модель кошелька под видом дизайна.
- Не выбираем окончательный шрифт по статичной таблице: сначала проверяем его живьём в Font Lab.

## Следующие этапы реализации

Отдельный `/mono` уже позволяет судить о композиции, шрифтах и оптике глазами. Он не заменяет архитектурную миграцию ниже.

1. Сохранить исходный baseline V1 (149 unit/component tests на момент начала направления и существующие visual snapshots) и добавить отдельные проверки `/mono`.
2. Ввести `ui-contract`, `wallet-app` controller/view model и статический skin registry; поднять поиск, формы и semantic focus выше skin.
3. Завернуть нынешний Dashboard в `liquid-v1` без визуального отклонения; реализовать host resource lease без перекрывающихся GPU contexts.
4. Ввести generic schema, codec и Skin Lab session; active appearance хранить отдельно от трёх preview slots.
5. Реализовать slots `1/2/3`, draft, Apply/Save, Undo/Redo, Compare.
6. Реализовать deterministic randomizer и locks с golden tests.
7. Ввести Font Registry и Font Lab.
8. Перенести утверждённый MONO LEDGER из изолированного `/mono` в `mono-ledger-v1` через общий контракт и три встроенных presets.
9. Вынести уже нормализованный prototype OGL effect и его live controls в общий adapter/schema с production storage, resource lease и полным lifecycle-контрактом.
10. Пройти contract, visual, accessibility, lifecycle и performance gates.
11. Только после живого сравнения решить, станет ли новый skin default.

## Критерий успеха

Новая визуальная идея должна подключаться без копирования продуктовой логики. Пользователь должен менять skin и его параметры, не теряя состояние приложения. Удачный случайный результат должен быть воспроизводим. Неудачный — отменяться одним действием. Ни один эксперимент не получает права ломать читаемость, доступность, lifecycle или ресурсный бюджет.
