# Контекстная батарейка и меню внизу

<!-- NOVEX_TASK4_STATUS_20261011_START -->
> **Bottom Menu, удаление домашней батарейки и позднейший account-pending опубликованы в f749776.** Boost marker остаётся отдельным предложением; реальное применение/тарифы не объявлены реализованными.
>
> Текущая волна [11 октября](2026-10-11-wallet-cohesion-release.md) **RELEASED f749776**: [release proof](../releases/2026-10-11-wallet-cohesion-f749776.md). Актуальная очередь — [аудит проекта](2026-10-11-project-audit.md). Прежние source/build/browser evidence ниже — история.
<!-- NOVEX_TASK4_STATUS_20261011_END -->

10.10.2026. Новое прямое решение владельца после визуальной приёмки локальной pending/Send волны. Исходный HEAD d99a526, compiled local41f3c1c, publicb6553a8. Эта работа локальная; публикация отдельно.

## Global Constraints

- Canonical checkout C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation, branch codex/product-ux-20261003. Не использовать прежние cwd окон.
- Семь presets/materials/Lab/storage, финансовые data/ports/routing, security, accepted-submit guards, raw drafts, privacy и точные ID сохраняются. Новых библиотек, тарифов, сетей или реальных переводов не вводить.
- Владелец принял локальную предыдущую волну: metadata N1 + Send own/external готовы. Не назначать их заново. Новое понимание батарейки отменяет её место на главной, но не превращает прежнее fee coverage в доказанный boost.
- Все исполнители SOL6.1 MAX; подходящие видимые чаты переиспользуются. Параллельные непересекающиеся owners. Один shared index; staging/commit только в последовательном слоте root. Чужие next-env.d.ts и icons-audit не трогать.
- Узкий RED→GREEN для изменённого поведения, один scoped review волны без исторического whole-branch review, один affected typecheck/build у ORACLE после source freeze. Не запускать broad suites/lint/rebuild после каждого patch. Один bounded browser pass root; визуальная оценка владельца отдельно.
- Только браузер, не native desktop. Нет SSH/public/preset publication/push/merge/удаления истории. Реестр03.10 — только маршрутный снимок, текущие факты из repo и live chat status. Второй сервер отложен.
- Применять существующие primitives/icons/motion. У исполнителей допустим узкий read-only SOL MAX helper для самостоятельного анализа, но не дублирующий reviewer/второй writer. SDD используется с этими явными пользовательскими fast-loop ограничениями; workspace сохраняется до handoff, не удаляется.

## Task 1: Батарейка — убрать с главной, определить контекст операции

Отдельный владелец: существующий Send чат, SOL MAX. Сначала код и последняя реплика владельца, не старые гипотезы о процентах.

1. Убрать battery trigger/процент из домашнего ProductOverview/compact ProductBalance. Закрыть образовавшийся пустой слот без изменения общей оценки, privacy, двух закреплений или appearance values. Не скрывать через opacity при сохранённом focus target.
2. Не удалять финансовую battery infrastructure, coverage, существующие данные или другие явно контекстные пути автоматически. ProductBatteryLine вне домашнего Overview и прежний demo fee flow не переопределяются этим решением. Если после удаления выявлен действующий вызов без anchor — сообщить конкретный callsite root, не расширять молча.
3. Подготовить docs/product/2026-10-10-battery-boost-placement.md: новая product hypothesis — подписка/разовый boost как источник возможности; маленький знак возле конкретного исходящего платежа, только когда использование подтверждено supplied operation data. Отличить «доступно», «используется», «использовано» от финансового результата pending/completed/failed. Подписка сама по себе не означает boost на каждом платеже.
4. Сопоставить текущие battery coverage/receipt fields и будущий boost marker; нельзя вывести «ускорено» из зелёного процента, pending, включённого toggle или покрытой комиссии. Если точных подтверждённых полей нет — документировать минимальный контракт и пустое/unknown поведение, не рисовать выдуманные badges в существующей истории. Никаких новых runtime DTO/fixtures/API/тарифов в этой задаче.
5. В документе предложить аккуратный existing SVG battery glyph 14–16px рядом с метаданными outgoing row, не на сумме и не вместо статуса. Текст в квитанции/доступное имя, не один цвет. Для active короткий спокойный отклик только при supplied активности; used статичен. Не обещать ускорение/ETA, не менять финальные статусы. Объяснение по нажатию существующей строки/деталей без nested interactive кнопок. Это дизайн-контракт следующего этапа, не утверждённая тарификация.

Owned: product-home.tsx, product-home.css, product-home.test.tsx; при необходимости только battery-related assertion в product-home-overview.integration.test.tsx; новый battery-boost-placement.md. Всё в apps/miniapp/src/mono-product кроме docs. Не mono-scene/controller/history/Send/Receive/fixtures/preset files.

Проверка: домашний Overview без battery button, общий итог/закрепления/privacy доступны; существующий non-home компонент не исчезает случайно. Один целевой набор; тесты не должны утверждать выдуманную boostсемантику. Report task-1-report.md с exactpaths/REDGREEN/что только предложено. Запросить commit slot, не commit заранее. Без typecheck/build/server/GitHub.

## Task 2: Нижний «Меню», профиль через аватар

Владелец: существующее окно Astra: UX (исполнитель SOL MAX). Реализовать локальную примерку переноса нынешнего quick menu, не большой новый каталог функций.

1. В продуктовом MONO нижний ряд: Обзор / Активы / История / Меню. Последний пункт — понятная векторная menu glyph с текстом «Меню», не буква/аватар. Верхний burger убрать; аватар остаётся единственным постоянным launcher профиля, логотип ведёт домой.
2. «Меню» открывает существующий ProfileQuickMenu компактно над нижним правым launcher, внутри wallet bounds и над safe-area/nav. Содержимое сохраняется: privacy, Мои счета, Помощь. Не добавлять пустые подписки/новые capabilities/дублирующий профиль. Пользователь знает, где появится меню; за пределами/повторное нажатие/Escape закрывают его.
3. Menu — overlay action, не fake profile route: aria-haspopup/expanded/controls; раскрытие не меняет section/working account/drafts, не выдаёт себя aria-current=page. Существующий selected screen остаётся правдивым; в профиле не подсвечивать «Меню» как выбранную страницу. При закрытии focus возвращается к нижнему launcher. Действия Accounts/Help используют прежние guarded transitions и возврат.
4. Сохранить accepted-submit/productModal guards и disabled/inert состояния; новый launcher не обходит защиту или открывает меню поверх уже принятой команды. Scene inactive/unmount/section change закрывают корректно по прежним правилам. Нет отдельного menu store/нового router.
5. Использовать существующие material/motion host и спокойное раскрытие, учесть reduced-motion; не менять tokens/presets и не добавлять motion runtime. Подпись читаема, target>=44 CSSpx. 320/390 bounds/верх-низ clipping проверяет root после общей сборки. Non-product/Lab fallback не ломать; при необходимости оставить его прежнюю nav модель за existing branch.

Owned: apps/miniapp/src/mono-preview/mono-scene.tsx и narrowly related scene styles/test; apps/miniapp/src/mono-product/profile-quick-menu/** и необходимые header props/component tests. Перед записью сообщить exactсписок в report. Не product-home.*, controller.ts, финансовые flows/core/fixtures/appearance/storage или docsroot. Новый integration test предпочтительнее массового переписывания старых assertions; конкретные устаревшие ожидания можно мигрировать с явным отчётом.

Проверка REDGREEN: верхнего burger нет/аватар открывает профиль; нижний Menu открывает и закрывает прежниеitems; section/context не меняются при open/close, Escape/Backfocus, Accounts/Help navigation, existing guard блокирует новое открытие. Один scoped набор, без full suites/typecheck/build. Report task-2-report.md и запрос exactcommit slot.

## Task 3: Что осталось из последней встречи

Владелец: существующий SOL анализатор встречи. Read-only код/исходный privatehandoff; новая запись только docs/product/2026-10-10-next-product-decisions.md и task-3-report.md. Не повторять ASR/video extraction, не публиковать rawframes/transcript/личные данные и не выполнять work queue.

Прочитать review_sol_ultra/meeting_decisions.md, current_project_comparison.md, next_steps.md из C:/Users/iwwa/Desktop/novex_meeting_handoff; сверить нынешний HEAD d99a526 и уже принятые account overview/pending/send/API docs. Снять completed All/homepins/N1/ownexternal из новых задач. Последняя прямая реплика владельца по battery/menu приоритетнее старого анализа.

Результат: максимум3 следующих полезных среза, зачем пользователю, что уже есть, точная оставшаяся дельта, какие данные/ответы нужны, подходящий отдельный owner и что пока не делать. Рассмотреть account-specific pending/details, real read-only activity API, brand/account/action/activation matrix, provider Buy/withdrawal и whitelist/security только с доказанными границами. Выбрать одну последовательность, не список всех механик. Разделить подтверждённое клиенткой, новое решение владельца и предложение аналитика. Указать ограничения восстановленной речи. Ничего не обещать как подключённый backend.

Последнее уточнение владельца в ходе работы: API будет делать backend-разработчик, согласование позже; сейчас это не приоритет. Оно заменяет промежуточный ответ «подготовим контракт и вопросы». Task3 предлагает ближайшие FRONTEND-срезы, не расширяет API-документацию/технический опросник. Существующий activity API proposal сохраняется как отложенный материал; frontend не блокируется ожиданием API, но неизвестные бизнес-правила не выдумывает.

## Task 4: Единая локальная сборка

После source1/2 и одного scoped review — ORACLE affectedtypecheck + одна production build3184, exactsource/buildId/proof. Старый runtime работает до freeze. Сохранять foreignfiles; не убийвать unknownPID. Root предупреждает передstop и проходит bounded UI: batterygonehome, Menu bottom/close/focus, avatarprofile, Accounts/Help;320/390. Публикации пока нет.

## Статус

- Task 1 SOURCE_COMMITTED: `e6ce4b352a80ad86701c9af45b6ef33c43feb147`. Батарейка удалена из домашнего compact balance; остальная infrastructure сохранена. RED→GREEN: 7 целевых tests PASS. [Дизайн контекстного boost](2026-10-10-battery-boost-placement.md) подготовлен отдельно: будущая явно demo-примерка может делаться без API; реальные правила расходов согласуются позже. Runtime-маркеров у старых платежей сейчас не добавляли.
- Task 2 SOURCE_COMMITTED: `b3803a1b5d23605be74df098aa61f1193bed9a48`. Нижний Menu открывает существующую панель над nav; верхний burger убран, аватар открывает Profile. 25 уникальных целевых cases PASS, включая разрешённые миграции старых launcher selectors. Изменения файлов и проверок — в task-2-report рабочего SDD-каталога.
- Task 3 DONE: [следующая фронтенд-дельта](2026-10-10-next-product-decisions.md). Предложен один связный путь: конкретный счёт → его pending → квитанция/история → тот же счёт. Это пока очередь, не назначенная source-задача. API расширение отложено согласно последнему прямому решению владельца.
- Task 4 DONE: один combined scoped review `d06efe9..b3803a1` Approved без findings. ORACLE affected miniapp typecheck PASS и одна production build READY, compiled source `be9b334a76595c3f02bc80c2fe7179c238d49dc3`, BUILD_ID `SCc4LKHXprqFTIqe1uehl`. Managed3184 RUNNING, launch `f5ebf9cd04674202b0b3941843e8813a`, exact source proof HTTP200/no-store. До сборки прежний manager уже был STOPPED; ручной stop/kill не потребовался. Foreign next-env/audit сохранились побайтно.
- Root bounded browser390/320 PASS: батарейка отсутствует на главной, панель над нижним Menu, target74×48px на320, Escape/Accounts Back focus, Help/avatar/logo и outside close работают. Существующие presets/materials не менялись; исходные preset1/width480/rails expanded/privacy visible восстановлены. Это не проверка всех семи оформлений, физического touch/FPS или отдельная эмуляция reduced-motion. Evidence — task-4-report.md, browser-report.md, menu-390.png/menu-320.png в текущем SDD-каталоге.
- [Локальная примерка](http://127.0.0.1:3184/mono) готова для владельца; её визуальное решение ещё ожидается. Предыдущая pending/Send волна уже принята («всё ок»). Public остаётся `b6553a8`; разрешений на новую публикацию, push или merge нет. Последующие documentation-only commits не меняют собранный source. Финансовые сценарии и API этой дельтой не переписывались.
