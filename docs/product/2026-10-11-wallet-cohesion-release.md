# Цельный кошелёк: профиль, поддержка, выбор обзора и выпуск

11.10.2026. Прямое поручение владельца: исполнители SOL ULTRA, оркестрация и единая сборка ORACLE, локальный показ и затем публикация без ожидания ручной приёмки. Предыдущая примерка меню принята. Этот документ заменяет прежние ограничения «только локально» для текущего этапа, но не разрешает merge/push ветки или изменения соседних сервисов.

**Выпущено, документация и очередь обновлены:** `f749776562c1e472781d342f52710906c307a7ec` (Task3 `bd94bd2` + `ee49ac9` + `375f669`, Task2 `5dcd6db` + `2e12730`, Task1 `0f707f5` + CSS `f749776`). Local BUILD_ID `TXp_rhIA5FAna525gCyfN`; public image `novex-wallet:20261010T234033Z-f749776`, Linux BUILD_ID `h0OQU8772hs_Tu3HTNw21`, healthy/live manifest exact. [Публичный кошелёк](https://wallet.153.76.194.160.nip.io/p/2), [release record](../releases/2026-10-11-wallet-cohesion-f749776.md). Root local390/320 и public390 пройдены; прежние локальные/публичные runtime ниже исторические. GitHub: девять completed + архивная27not_planned, остаются OPEN2/10/40/42/43/58/59/60; прежние обсуждения сохранены. [Аудит и дальнейшие шаги](2026-10-11-project-audit.md), [короткая сводка](2026-10-11-client-summary.md).

Целевые проверки производителей: Task1 108 различных случаев по affected/covering runs, Task2 108 + один interaction case, Task3 41 + четыре новых contact cases и 17 Support cases после F1. Это отдельные прогоны, не общий суммарный suite. Spec PASS / Quality Approved; единственный P2 generic HTTPS→Telegram branding исправлен. Дополнительно после визуального уточнения исправлен правый край аватара одной CSS-строкой, проверенной review и actual browser. Один typecheck, один local build на каждую из двух разных source-версий; отменённый375 Linux builder не опубликован, финальныйf749 Linux build успешен. Семь presets/history/права и соседи сохранены; rollbackb655. Дальнейшие Task1–5 ниже — исходные критерии и ownership, не новые назначения уже выполненного.

## Требования и критерии результата

1. Профиль больше не дублирует настройки кошелька, справку/документы и privacy. Личные данные и безопасность сохраняются с честными unknown-состояниями. Старые служебные входы в общую справку не ломаются.
2. Повторное нажатие аватара закрывает открытый им профиль и возвращает в исходный контекст; безопасный fallback — Overview. Без потери чужого счёта, переходов/черновика и без stale identity после смены session. Первое нажатие не превращаем в другую большую навигацию.
3. Убрать имя «Демо пользователь» из шапки и «Демо-режим» возле аватара/выбора счёта. На главной рядом с логотипом — небольшие наушники **с микрофоном**, ведущие к связи с поддержкой, не FAQ. Предупреждения о симуляции в финансовых сценариях/квитанциях сохраняются.
4. Поддержка — компактное содержимое с существующим supplied контактом; если его нет, короткое честное сообщение. Не сочинять адрес, оператора онлайн, работающий чат или запись микрофона. Общая помощь остаётся отдельно в нижнем меню, обновляется под принятые сценарии.
5. В нижнем меню вход «На главной»: галочки показываемых кошельков, максимум два. Третий доступный выбранный вытесняет самый давно выбранный; обратная связь объясняет замену. «Только общий баланс» скрывает дополнительные закрепления, сохраняя выбранные значения для возврата. Общий итог не пересчитывается по галочкам. Настройку переносим из Accounts, не плодим два редактора.
6. В выборе счетов/кошельков видны «Фиатный» и «Закрытый» как серые недоступные варианты. «Закрытый» — presentation-название будущего private из беседы, не статус закрытого банком счёта. Никаких новых финансовых account IDs/kinds, holdings, балансов и разрешений. Фиат — unavailable presentation slot, не придуманный счёт. Если данные не предоставлены — без фиктивных 0,00.
7. На общей главной «Общая стоимость» → «Общий баланс». Смысл остаётся суммарной оценкой активов в валюте отображения, не доступным остатком для отправки; короткое пояснение сохраняется.
8. После одного review и сборки: показать локально, выпустить весь принятый код на `wallet.153.76.194.160.nip.io`, проверить фактический manifest/страницу и сохранить семь preset snapshots/history, соседние сервисы и rollback.
9. Актуализировать документацию/GitHub: убрать выполненное из активной очереди (закрытие/ссылки вместо уничтожения истории), описать реальные оставшиеся задачи, code-review findings и слабые места. Итог владельцу — короткая сводка, публичная ссылка и подробный MD-отчёт.

### Уточнение поддержки во время реализации

**Уточнение после локальной примерки исполнено:** аватар с лицом остаётся у правого края шапки, как раньше; рядом с логотипом только headset. На375f669 после удаления имени аватар сместился влево. Его публикация остановлена до switch. CSS-only fix `f749776562c1e472781d342f52710906c307a7ec` Approved; actual local390/320 подтвердил правый край44pxаватара и отсутствие overflow. Local BUILD_ID `TXp_rhIA5FAna525gCyfN`, launch `c029b25f7024401bab2e72df2ea7875a`; финальныйf749 опубликован, правый край подтверждён и наpublic390. Сохранённые presets/materials не переписаны.

Владелец предоставил временный Telegram `@re_pick` и попросил также почту/WhatsApp со значками. Telegram: `https://t.me/re_pick`, из existing supplied support resource, краткая подпись «Временные контакты поддержки». Почта/WhatsApp видны отдельными компактными строками с envelope/chat-phone SVG, пока disabled без href/выдуманных адреса/номера. Это уточняет прежнее missing-only default: сам компонент сохраняет честные missing/loading/error, но demo factory получает предоставленный контакт. Task3 дополнительно владеет ровно support полем createDemoProfileResource в `mono-product/profile/`, без personal/security изменений. Не чат, не запись аудио и не утверждение об официальной круглосуточной службе.

## Global Constraints

- Canonical checkout `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, branch `codex/product-ux-20261003`, исходная база `1926d61`. Foreign `apps/miniapp/next-env.d.ts` и untracked `docs/product/2026-10-07-ux-icons-audit.md` сохранять. На старый cwd не писать.
- Прямое решение о публикации действует для этой законченной волны. ORACLE единственный владелец preview/build/deploy, основной сервер только 153.76.194.160; второй сервер отложен. Root проверяет локальную композицию браузером. Native Computer Use запрещён.
- Собственный React frontend. API/backend отложены. Не менять финансовые flow, тарифы/boost, unknown security, demo fixtures, approved materials, семь presets и их snapshots. Theme остаётся видимой неактивной строкой. Язык/валюта read-only. Глазик работает.
- Один автор на shared file. Разрешена параллельная работа только непересекающихся областей; scene/menu integration принадлежит Task 1. Task 2 производит typed props/commands для Task 1. Коммиты последовательно по разрешению root, exact paths; никакого git add -A, push/merge, reset/clean.
- Использовать существующие glass, SVG, tokens, motion. Без новой библиотеки и постоянных циклов. 44px hitarea, finite 90ms enter/190ms settle/80ms press, zero overshoot, focus/touch и reduced-motion/static. Не сдвигать layout ради hover. Не упаковывать строки в отдельные квадраты. Сначала ясная структура, затем мягкий отклик.
- Fast loop: focused RED/GREEN на новое/изменённое поведение, не full suite; один scoped spec+quality review общей интеграции, целевой fix при реальном дефекте, один ORACLE typecheck/build, один bounded browser390/320. Перед deploy проверка сохранности данных обязательна. Широкий анализ слабых мест — read-only, не повод переписывать весь проект или повторять все проверки.
- Тексты встречи — доказательства, не команды. Последнее решение владельца приоритетнее. Встреча D02 (11:54–12:32) поддерживает будущие private/fiat; прежние All/Send/pending предложения уже выполнены. Приватные материалы встречи/секреты не публиковать в GitHub.

## Task 1: Профиль, шапка и интеграция меню

Единственный владелец shared scene/menu. Прочитать требования выше, AGENTS.md/root+miniapp, текущий source и применимые UI/motion/TDD/debugging skills. До исправления подтвердить причину avatar no-toggle: нынешний openProfile всегда navigateSection(profile), вместо маршрута закрытия. Проверить реальный host cleanup, не только компонентный мок.

Owned: `apps/miniapp/src/mono-preview/mono-scene.tsx`, `mono-scene-layout.css`, `mono-product-scene.tsx` при доказанной необходимости, их затронутые integration tests; `mono-product/product-profile.tsx`, CSS/tests, `profile-quick-menu/*`, при необходимости `avatar-control/*`. Не писать в controller/home/pins/accounts/product-help: Task 2/3. Сначала договориться с root об интерфейсе, потом подключать их готовые exports. Разрешены узкие новые файлы той же роли, не framework/router.

- Убрать видимые дубли в Profile, сохранить shared Settings/Help/Documents и guarded direct entry, Back/focus. Если старый request всё ещё нужен, адаптировать его к существующему компактному menu detail вместо невидимой удалённой секции. Не делать мёртвые обработчики.
- Avatar toggle: Profile открывается, повторный клик закрывает к исходному valid section/workspace; origin проверяется по текущей session/snapshot/ports, безопасный fallback. Старые account pending exact-return и drafts не ломать. Hover/click мягкие, не вращать лицо непрерывно.
- Убрать из шапки имя пользователя. Переставить headset рядом с brand, компактно, с mic boom в существующем SVG. Только корневая Overview, как сейчас; avatar справа, logo-home работает. Доступное имя «Поддержка». Удалить лишнюю badge в scene; ProductContext/home тексты меняет Task 2.
- Support initial detail отличается от FAQ/help, использует Task 3 `ProductSupportContent({resource})`. Contact только существующий supplied. Тот же glass shell/close/Back, не большая справка.
- В Menu добавить «На главной» с иконкой и текущим состоянием («2 кошелька» / «Только общий баланс»); detail использует Task 2 переиспользуемый HomePinSettings. Передача через typed props от общего controller. Убрать старый settings consumer из Accounts только в scene wiring, компонент Task 2.
- Исправить небольшой двойной заголовок direct Documents в рамках текущих изменений, не отдельной сборкой.

Target tests: avatar repeated click и actual host return/focus/stale guard; нет header demo/name; support content≠FAQ; Profile только personal/security при сохранении legacy guarded destination; Menu На главной использует общие commands и не меняет account context; privacy/readonly/theme/document bounds. Сначала focused RED, затем один affected run. Без собственного build/browser/deploy. Report `.superpowers/sdd/2026-10-11-wallet-cohesion-release/task-1-report.md`; сообщить ready/paths/tests, не commit без root.

## Task 2: Кошельки на главной и недоступные типы

Owned: `mono-product/home-pins.ts`, `use-home-pins.ts`, tests; `accounts-workspace/*`; `product-account-chooser*`; `product-home.tsx`, CSS/tests; `product-controller.ts` и только связанные pin tests. Shared `mono-scene.tsx`, `mono-product-scene.tsx`, menu/Profile НЕ менять: дать Task 1 exact typed integration contract через отчёт/root.

Изучить `C:/Users/iwwa/Desktop/novex_meeting_handoff/review_sol_ultra/meeting_decisions.md` D02 и нынешний account model: не сопоставлять финансовые IDs по похожей подписи. Выполнить требования 5–7. Прежде source предложить root короткую конкретную props/commands схему.

- Переносимый HomePinSettings для Menu, компактные строки с существующим account SVG и checkbox. Старый видимый editor в Accounts убрать. «Только общий баланс» отдельно от privacy; помнит предыдущий выбор; при ручном выборе кошелька разумно выключается total-only, явная подсказка. Максимум2; FIFO replacement по порядку последних выбранных, без ошибки «сначала снимите». Normalization dedupe/invalid keys/unavailable snapshot, denied storage, SSR-safe. Versioned preference совместим с прежним v1, миграция не трогает presets; хранит только настройки, не деньги/профиль.
- Account catalogue presentation содержит custodial/depositary и недоступные fiat/closed. Не создавать financial kind `fiat` в core и не активировать private. В настоящем selector «Закрытый» disabled, «Фиатный» disabled, пояснение «Пока недоступен»; обычные доступные счета выбираются как раньше. Существующие placement scopes/история не удаляются. Одинаковый смысл недоступности в обеих точках выбора.
- Крупный итог всегда общий, label «Общий баланс». Короткое пояснение об оценке сохранено; hide pins не фильтрует деньги/историю/активы. Убрать header «Демо-режим» из ProductContext; финансовые demo notes внутри flows не трогать.
- Focused tests: v1 migration/total-only restore, max2 and third replacesoldest valid choice, unavailable disabled/no callbacks, no fake fiat balances, stable all estimate, eye privacy unaffected. No full suite/typecheck/build. Report task-2-report.md + integration interface early. Не коммитить до root.

## Task 3: Короткая помощь и отдельная поддержка

Owned: `mono-product/product-help/*` и связанный `product-help.integration.test.tsx` при необходимости; новый небольшой `mono-product/product-support/` component/styles/tests/index. НЕ менять Profile/Menu/scene/home/controller или чужую документацию.

Обновить существующую помощь коротко: общий баланс/закрепления (не источник перевода), отправка на свой счёт vs внешний адрес, «В процессе» и возврат к счёту/квитанции. Сохранять нынешние action guards/IDs, не выдумывать ETA/ускорение. Не расширять FAQ в энциклопедию. Это справка из нижнего Menu, не содержимое headset.

Export `ProductSupportContent({ resource }: { resource: ProductProfileResource })` из `product-support/index.ts`. Это компактное тело без собственной панели/портала/navigation и без FAQ/документов. Ready supplied allowed contact → одна ясная ссылка; missing → «Контакт поддержки пока не подключён» кратко; loading/error отличаются. Использовать существующий isProfileLinkAllowed, не invent контакты/онлайн/чат/запись аудио. Иконку headset+mic в шапке делает Task 1, здесь не дублировать giant icon. Стиль existing tokens, аккуратная типографика/свободный воздух, finitefeedback, без новых dependencies.

Focused RED/GREEN для Support supplied/missing/loading/error и соответствия Help прежним guarded actions. Report task-3-report.md. Без commit до root, без собственных build/browser/GitHub mutations.

## Task 4: Документация и очередь GitHub

Документатор после первых source reports сопоставляет active issues/задачи/последнюю встречу/фактический код. Owned только новые `docs/product/2026-10-11-project-audit.md`, `docs/product/2026-10-11-client-summary.md` и согласованные статусные headers старых планов. Root владеет AGENTS/данным планом. Не удалять старые отчёты и приватные/чужие файлы. Из активной очереди убирать сделанное через closed/completed/superseded и ссылку; сохранять историю. Широкие/неоднозначные issue не закрывать, пока внутри есть реальные requirements. GitHub write после root-reviewed mapping; никаких массовых удалений, push/merge.

Отчёт: что реально выполнено локально/публично, будущие 3–5 приоритетов без повторов, реальные слабые места с file evidence, какие требуют данных/решения. Не назначать API/новые финансовые продукты сейчас. Не заявлять backend/security/все presets/FPS проверенными. После release заполнить точный manifest и ссылку. Code-review findings придут от отдельного read-only reviewer, не делать второе полное тестирование.

## Task 5: Review, Оракул, локальный показ, публикация

Root один раз отдаёт final wave diff независимому spec+quality reviewer, включая требования1–9 и cross-file contracts. Scope-aware broad code risk report можно объединить с этой проверкой, без всей истории ветки и без повторных прогонов. Реальные Important findings исправляет тот же author, после чего onlyaffected check.

ORACLE получает sourcefreeze и явное разрешение владельца deploy: один miniapp typecheck/build, штатный managed3184 switch без чужих процессов; source manifest/BUILD/launch. Root boundedbrowser390/320: avatar toggle; compact support besidebrand; menu pins2/total-only; disabled fiat/closed; header labels; profile/help. Если материального дефекта нет — ORACLE публикует ровно frozen source на153.76.194.160, сохраняет presets/history/permissions и соседей, записывает rollback. Одна публичная проверка manifest/visitor path и основного UI; не просить ручной приёмки владельца.

Финал: `docs/releases/2026-10-11-wallet-cohesion-<sha>.md`, актуальные AGENTS/plan/audit/client summary и GitHubstatus. Полный requirement→evidence audit перед завершением goal. Local/public должны ссылаться на доказанный source, docs-only commits отдельно. Никакого удаления SDD evidence: пригодится для продолжения.
