# Gold — локальная вода, золотой отклик, необязательный график

**LOCAL READY · визуальное/JSON решение владельца ожидается. Публикации не было.**

Примерка: **http://127.0.0.1:3197/gold**. Технические параметры на том же сервере: http://127.0.0.1:3197/gold?goldLiquidTuner=1 — только exact loopback, вне посетительского меню.

## Что изменилось

- График динамики, заголовок и периоды убраны по умолчанию без пустого блока. Включить: **Меню → Язык или Валюта оценки → Настройки → Динамика баланса**. Выбор живёт только в памяти Gold viewer; новое открытие/перезагрузка снова выключает его. Тема остаётся недоступной.
- Настоящий WebGL-фон: тёмная водяная рябь с тонкими движущимися золотыми каустиками и спокойной областью под балансом. Живой HTML и финансовые цифры не захватываются в текстуру.
- Gold-only локальный свет при наведении/фокусе и мягкий нажим. Цвета получения, ожидания и ошибок не заменены золотом; новых рамочных квадратов не добавлено.

Семь MONO presets, материалы, финансовые контроллеры/счета/guards/история и security-unknown не менялись. Gold остаётся отдельным оформлением общей сцены, не восьмым preset. Новых зависимостей, visitor editor, fluid solver/FBOs, API или финансовых возможностей не добавлено.

## Точный runtime

| Поле | Значение |
|---|---|
| Worktree / branch | `C:/Users/iwwa/.codex/worktrees/novex-gold-wallet/5-wallet-foundation` / `codex/gold-full-wallet-20261012` |
| Compile source | `247159313267917df3ea5f5419c7eb41064d88c0` |
| Последняя кодовая поправка воды | `85f8b6512d3572d5246d70238fe9dec36a977b10`; freeze2471593 добавляет только четыре документа |
| BUILD_ID | `quB3tGpEkME4X2G6c7T3_` |
| Launch / sole listener | `c7c238f8e7a8410aaa3585d77d434112` / PID36576 |
| Start | 13.10.2026 03:12:14 Москва |
| Output | `apps/miniapp/.next-gold-water-ripple` |
| Private launcher / metadata | `C:/Users/iwwa/.novex-ops/preview/novex-gold-water-ripple-3197` |

Поздний docs-only HEAD **не новая сборка**. Текущий публичный Gold153 остаётся на source `b212f2525fbd03a0a992a9e3d2a50ba565b50ad4` / Linux BUILD_ID `gHZCx_eKfaMa4cW3LVt-h`. Main3184, prototype3196, исходный153 и отключённые95/179 этим срезом не изменены. No SSH/deploy/push/merge.

## Выбранная оптика и решения

Порт MIT `Liquid_Prnc_Glass` из local revision `97175e083782eab2d55b85abafc6a426c269e20a`: signed IOR, field/SDF-edge masks, чистый IOR0, base→optical mix, original source texture, тёплые каустики. Source/provenance/license hashes проверены до первого запуска. Нативный однопроходный renderer выбран вместо тяжёлой симуляции и новых библиотек.

Candidate16params **не изменились после visual fix2 и не утверждены для production**: [точный JSON](../product/2026-10-13-gold-water-candidate.json). Default возвращает эти provisional значения; Apply/JSON относятся только к примерке, не перезаписывают seven presets/storage.

Все причины и цена выбора — [решения](../product/2026-10-13-gold-water-decisions.md). Главные ограничения: Gold-only; график без persistence; техническая оптика отдельно от посетительского меню; публикация после утверждения; не обещаем полную suite/device/backend/FPS-сертификацию.

## Что проверено, без повторения старых suites

- Task1: meaningful RED→GREEN6/6 целевых случаев графика; scoped независимое review PASS/Approved.
- Task2:34/34 новых module tests и scoped ESLint; scoped review нашёл один important tuner dependency и один minor hover/press precedence. Fix1:7/7 только tuner, одна scoped re-review — оба исправлены, новых findings нет.
- Реальный первый GPU-показ выявил слишком мягкий, облачный фон. **Одна visual fix2** только renderer/test/provenance: RED texture spread13 вместо22 → GREEN8/8 в затронутом renderer file. Root весь трёхфайловый diff/report прочитал; signed/zero/masks/lifecycle/resource policies сохранены. Исходные unit tests не выдавались за GPU pixels.
- Оракул: одна первая production compile d4a и одна **affected** compile247 после этой конкретной визуальной поправки; обе exit0, Next internal type gate. Текущий runtime оставался живым до успешной candidate-сборки. HTML200/source/disk+served BUILD/process/executable/creation-time/sole-listener guards PASS; stderr пустой. Независимый дубль typecheck/install/fullsuite не запускался.
- Root actual browser на d4a: real graph off/on/off +focus return; золотой hover/90ms press/keyboard focus; IOR0 и зависимые controls; мобильная ширина390 без горизонтального скачка; reduced-motion два статичных water-only кадра. Overrides восстановлены, Apply/Copy/clipboard/storage не трогались. Эти неизменённые product gates после renderer-only fix2 не повторялись.
- Root actual247: шейдер работает, canvas ready/visible; рисунок воды отчётливый, баланс читается. **Два кадра active water-only области отличаются**, отдельно от анимации promo, то есть это действительное движение нового фона. Портрет390×844 проверен для нового aspect-dependent water mask; консоль error/warn пустая. График на свежем открытии отсутствует. Временный viewport сброшен, финальная локальная вкладка отмечена deliverable.

Первое сравнение в невыбранной локальной вкладке дало одинаковые кадры и **не считалось доказательством движения**. Документированный fresh own IAB tab позволил активную примерку; никакого нового code/runtime fix по этому ограничению браузера не делалось. Весь UI-проход — только браузер, не native desktop.

Новые GPU-cap bounds: не более30 scheduled draws/s, DPR≤1.5, drawing pixels≤786432, ось≤2048/аппаратный лимит; один texture upload. Это ограничения работы, а не измеренная гарантия FPS/RAM/GPU. Native Windows hard quotas не настроены. Физический телефон, все семь оформлений, реальная сеть/комиссии/backend не тестировались.

## Доказательства и откат

Proof/ledger: `.superpowers/sdd/2026-10-13-gold-water-chart/` — сохраняется, не очищать. Main proof `root-water-final-mobile.jpg`, ранний кадр `root-water-final-mobile-a.jpg`; `root-water-active-edge-{a,b}.jpg` для изменения воды. Root browser details — `root-browser-pass.md`; producer/reviews/Оракул — task reports там же.

Откатные outputs сохранены: d4a `.next-gold-water-chart` / `FY35enRFUhobiihvIl0tX`, и прежний842 `.next-gold-review` / `IbZYv1Bzhd6aaq2gLmvDZ`, с private build metadata/launchers. Откат только по отдельному решению: verified current stop → выбранный retained old launcher start; без Git checkout/новой compile. Generated next-env/outputs не коммитились, не удалялись и не reset.

## Следующий шаг — владелец

Оценить живую воду, её насыщенность и читабельность, затем утвердить этот exact candidate JSON или назвать одну конкретную визуальную поправку. По workflow `liquid-prnc-glass` production bake и публичный выпуск идут **после** этого решения. Пока root source/runtime работа закончена; повторные аудиты, rebuild, публикация и merge автоматически не запускать.
