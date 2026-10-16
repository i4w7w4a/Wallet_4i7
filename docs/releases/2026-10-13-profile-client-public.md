# Профиль Gold — публичный клиентский UX

13 октября 2026, технический PUBLIC READY в09:00:25МСК; затем фактическая browser-проверка PASS. [Открыть Gold](https://wallet.153.76.194.160.nip.io/gold). Задача [#66](https://github.com/i4w7w4a/Wallet_4i7/issues/66).

Профиль встроен поверх принятого Gold845: единые имя и аватар, редактирование личных контактов, вход в риск-тест, четыре экрана безопасности, условия и политика сервиса в Menu. Работают ошибки формы, сохранить/отменить, Back/Escape и возврат фокуса. Контакты и ответы сохраняются только в памяти демонстрационной сессии и сбрасываются при обновлении страницы. Документы, вопросы анкеты и реальные действия безопасности добавляются позже; интерфейс не выдумывает содержание и не меняет статус защиты.

## Опубликованная версия

- SOURCE: `5a1b14a8ffe79089b401c1d124b03d7343a9ee47`.
- Linux BUILD_ID: `Xx9rfwp9P2rZz8ufeDuQP`.
- Image: `novex-gold:20261013T053145Z-5a1b14a`.
- Image ID: `sha256:8429f69faefa40bc35c8c3af568f100f5a8f0ba07cc6c3ec7a689385ccf3999d`.
- [Публичный идентификатор](https://wallet.153.76.194.160.nip.io/gold/source-manifest.json).
- Rollback сохранён: SOURCE `8452fa8e55afd7a26ab894cc201b7df14a030560`, image `novex-gold:20261013T042143Z-8452fa8`.

ORACLE выполнил одну фактическую Linux-сборку: exit0, OOMfalse, peak1,79GiB при cap2GiB/2CPU. Первоначальные capacity holds не запускали builder; согласованное десятиминутное окно дождалось подходящих ресурсов. Обновлён только существующий Gold service. Namespace `/gold/_next`, RSC и lazy assets проверены. MONO, семь наборов данных/история, Caddy и13соседних сервисов сохранены. Runtime Gold сохраняет лимиты1CPU/512MiB. Git push/merge, новые пакеты и изменения95/179 не выполнялись.

## Проверка

Профиль:134/134 focused tests; исправление lifetime A→B→A:38/38 affected tests, независимые reviews SpecPASS/QualityApproved. Интеграция:3expectedRED/1PASS до стыков, затем16/16PASS (4actual-host +12соседних Gold account-deck); новое независимое review без замечаний. Старые suites не повторялись без новой дельты.

Локальная сборка на3198: тот же SOURCE, BUILD `cKkUc2UnETuURgq8O6g2f`, launch `66ffb22a609b46bbb056837feee9e5df`. TypecheckPASS. Первый Turbopack build отклонил borrowed dependency junction; root разрешил private `--webpack` fallback, который прошёл без изменения исходников/config/lock/dependencies. Принятый3197 сохранился. Linux production использует штатный Turbopack с отдельной проверкой namespace.

В настоящем браузере локально пройдены ошибка/отмена/сохранение/сброс контактов, риск-тест, все четыре security details, оба документа и вложенный Escape, возврат к выбранному счёту/активу и аватару. При320/390px нет горизонтального переполнения; поля44,39px и кнопки44px, клавиатурный фокус Save виден выше footer. Reduced-motion и консоль проверены. Browser-путь к offscreen аватару сам прокручивает страницу, поэтому удержание исходного scroll542px отдельно не заявляется; точный host scroll boundary покрыт интеграционным тестом.

После публикации отдельная свежая HTTPS-вкладка подтвердила профиль/портрет, форму и сохранение через Overview, риск-тест, документы/возврат и пустую warn/error консоль. На390px clientWidth=scrollWidth. Тестовое имя сброшено, viewport overrides сняты. Это scoped QA выпуска, не полная сертификация всех устройств/FPS/backend.

## Продолжение работы

Новая рабочая база — combined SOURCE `5a1b14a8ffe79089b401c1d124b03d7343a9ee47`, ветка `codex/profile-client-integration-20261013`, worktree `C:/Users/iwwa/.codex/worktrees/novex-profile-ux/5-wallet-foundation`. Поздние docs-only commits не меняют runtime. Следующие Gold-задачи должны включать этот профиль; начинать их только с845/d245 без переноса профильной дельты нельзя.

Главный координатор остаётся ORCHESTR WALL `01a0c737-c83c-7c02-91a3-3c1d2529d4f2`; ORACLE `01a0cfcc-f35e-7a50-a624-6dda3022b4fb` — единственный оператор. Canonical Gold checkout не переписывался этой задачей; рабочий маршрут передан координатору для последующих срезов.

Клиентская сводка и вопросы: [передача профиля](../product/2026-10-13-profile-client-handoff.md). Evidence в `.superpowers/sdd/2026-10-13-profile-client-ux/`: `task-2-report.md`, `task-2-review.md`, `local-browser-report.md`, `public-browser-report.md`, `profile-public-ready.jpg`. Ledger и rollback evidence сохранены.
