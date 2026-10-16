# Novex Wallet — состояние проекта и очередь

11.10.2026. **RELEASED / GITHUB_SYNCED.** Волна [цельного кошелька](2026-10-11-wallet-cohesion-release.md) опубликована в **02:55:44 МСК**, exact source `f749776562c1e472781d342f52710906c307a7ec`. ORACLE подтвердил healthy/container/live manifest, root — bounded public visitor slot2/390. Source gate **Spec PASS / Quality Approved**. Девять выполненных issues закрыты completed, архивная #27 — not_planned; exact readback оставляет восемь OPEN. [Release proof](../releases/2026-10-11-wallet-cohesion-f749776.md).

Исходная сверка очереди опирается на checkpoint `d9d79bb` / `1926d61`, снимок 18 открытых GitHub issues, актуальные планы, завершённые wallet-чаты и готовый разбор встречи. Документационный checkpoint сохранён root в `af9acdb`. Ниже добавлено уже полученное независимое review/fix evidence на `375f669`; новый общий аудит не проводился. Приватные тексты/кадры встречи не перенесены. Tests/build/browser/server probes документатор не запускал.

## Выполненное исключается из будущей разработки

| Результат | Подтверждённое состояние | Основание |
|---|---|---|
| Общий Overview, оценка всех средств и до двух групповых закреплений | Впервые опубликовано b6553a8; текущий f749776 | [Release 10 октября](../releases/2026-10-10-account-overview-b6553a8.md). Галочки не фильтруют общий итог и не определяют источник перевода. |
| Assets workspace, размещения, точные действия/история, receipts и Receive | Поставлены в прежние публичные выпуски | [Release 3 октября](../releases/2026-10-03-mono-product-release.md), narrow issues #48–50. |
| Домашний «В процессе», metadata и exact receipt/History/Back | PUBLIC f749776; не назначать повторно | `f36658d` + `5542e36`, [pending/Send](2026-10-10-pending-send-wave.md). |
| Send на свой счёт / внешний адрес | PUBLIC f749776; прежний internal transfer переиспользован | `d559f98`, тот же [план](2026-10-10-pending-send-wave.md). Новые финансовые правила не вводились. |
| Pending конкретного счёта и возврат в тот же detail | PUBLIC f749776; actual-host fix принят | `1caa938` + `2f7f58c` + `8185319`, [account pending](2026-10-10-account-pending-return.md). |
| Нижний Menu и удаление домашней батарейки | PUBLIC f749776 | `b3803a1` / `e6ce4b3`, [контекстная волна](2026-10-10-contextual-boost-menu.md). |
| Menu «Строки с деталями», inline Settings/Documents/Help, disabled Theme и глазик | PUBLIC f749776; Menu принят владельцем | `3cb0b18`, [Menu implementation](2026-10-10-menu-support-implementation.md). Отдельная Support также опубликована в текущей волне. |
| Buy/Swap: точные demo contracts, два flows, единые records и общий local gate | Исходная demo/local область DONE; накопленный frontend PUBLIC f749776 | [Commerce preview](../releases/2026-10-05-commerce-local-preview.md), narrow issues #61–64. Это не реальный provider/backend. |

Последний подтверждённый local runtime предыдущей волны: `5228e9e223115c296221a53380885c91c9070156`, BUILD_ID `k5HeRFiQbYNDPE4JAbb6U`, managed3184. Последующие `1926d61` / `d9d79bb` — documentation checkpoints, не новая сборка.

Текущий public runtime — **f749776**: [visitor wallet](https://wallet.153.76.194.160.nip.io/p/2) и [manifest](https://wallet.153.76.194.160.nip.io/source-manifest.json). ORACLE/root evidence прочитано; документатор собственного live/browser probe не выполнял. `b6553a8` теперь rollback, а прежние local checkpoints — история, не активная очередь.

## Результат текущей волны

Reviewed source объединяет Profile без дублей, безопасное повторное нажатие аватара, чистую шапку, headset с микрофоном возле brand, отдельную компактную Support, обновлённую Help, один editor закреплений в Menu, max2/FIFO/«Только общий баланс», disabled «Фиатный»/«Закрытый» и подпись «Общий баланс». Будущие типы — presentation placeholders; новых financial IDs, holdings, прав или фиктивных нулей нет.

Для Support владелец предоставил временный Telegram [@re_pick](https://t.me/re_pick). В reviewed source он передаётся через supplied resource; Почта и WhatsApp видны disabled без адреса/номера. Это контакт для связи, не обещание оператора онлайн или работающего чата. Для иного допустимого HTTPS-контакта сохраняются его ссылка и нейтральное название.

ORACLE собрал и выпустил exact `f749776`; первые functional browser observations на `375f669` сохранены как история, affected header390/320 проверен на новой сборке. Удаление demo labels из шапки не отменяет предупреждения в финансовых flows/receipts.

## Независимый source gate и исправленное F1

Первый integrated review на `0f707f5` дал Spec FAIL / Quality Needs fixes из-за единственного **P2 F1**: любой разрешённый supplied HTTPS-контакт получал название и значок Telegram. Дефект касался presentation канала; URL, деньги и permissions не подменялись.

В `375f669` Telegram определяется по точному hostname `t.me` после existing allowed-link guard. Generic HTTPS-контакт получает нейтральный значок и exact supplied label; пустая подпись — «Связаться с поддержкой». Lookalike host/query не дают Telegram branding. Supplied href, missing/loading/error и disabled Почта/WhatsApp сохранены.

Task3Fix1: behavioral RED **1 failed /16 skipped**, затем один covering Support GREEN — **1 file /17 tests PASS**. Scoped F1 re-review: **F1 ADDRESSED, Spec PASS / Quality Approved** для frozen `375f669`; нового материального дефекта в этой правке не найдено. Исходный integrated report сохраняет историю finding.

Прочитаны имеющиеся `integrated-review.md`, `f1-review.md` и Task3Fix1 текущего SDD. Это evidence автора/reviewer, не новый запуск документатора. Общий immutable review package: 45 files /4167 lines; fix package: 2 files /34 additions /8 deletions.

| Имеющееся producer evidence | Предел утверждения |
|---|---|
| Task 1: 108 различных affected cases с passing evidence по нескольким runs | Не новый единый108/108 на final source; поздние pure-demo/style cleanups отдельно не исполнялись. |
| Task 2: reported 108 affected +1 focused interaction | Overlap с Task 1 не складывается в общий count; четыре label-only compatibility files не повторялись. FIFO третьего kind проверен pure algorithm, в текущем selector только два доступных kinds. |
| Task 3: initial41 + focused channels4 + Fix1 Support17 | Это разные affected runs; Help/model/full suite не повторялись для F1. Source review не подтверждает build/browser/public manifest/preset preservation. |

## Визуальная поправка шапки — опубликованный f749776

После первого локального walkthrough владелец заметил, что после удаления имени аватар сместился влево, и уточнил: справа, как раньше. Root **отозвал release GO для375f669 до public switch**. Публичная версия не менялась.

В `f749776562c1e472781d342f52710906c307a7ec` изменено ровно одно CSS значение: `mono-scene-layout.css:37`, `.mono-header-brand` — `flex: 0 1 auto` → `flex: 1 1 auto`. Brand занимает свободную ширину, avatar остаётся у правого края прежней content area; DOM/44px hitarea/focus/guards/motion/presets не менялись. `header-review.md`: **Approved**, source gate Spec PASS / Quality Approved сохраняется дляf749776. Новый compiled header gate390/320 **PASS**: avatar44px справа, right370 на390 и right308 на320, без horizontal overflow; root восстановил viewport/preferences.

`local-browser.md` сохраняет functional evidence375f669 / BUILD_ID `B10sfywpfubG4r0O3H-b6`: Support≠FAQ, supplied Telegram без перехода по ссылке, disabled каналы, pins/total-only с неизменным общим итогом и восстановлением предпочтений, account→avatar Profile→тот же detail/focus, disabled fiat/closed, logo/privacy, bounded390/320. Первоначальный walkthrough пропустил alignment mismatch; эти прежние наблюдения не подтверждали исправленную геометриюf749. Действующие header GO и публичное подтверждение получены отдельно на exactf749.

Отменённый builder375 завершился exit137 при OOM=false: это отменённый candidate build, не доказательство OOM, неисправности публичного кошелька или нового серверного инцидента. Новая сборка и header visual follow-up выполнены ORACLE/root, а затем состоялся подтверждённый public switch. Документатор их не выполнял.

## Фактическая сверка GitHub

Root-approved mapping выполнен **одним финальным проходом** после release proof: 20 PATCH к существующим issues/comments, без новых карточек/комментариев и удаления истории. Последующий REST readback подтверждает переход **18 OPEN → 8 OPEN**, точные reasons, исходные bodies/evidence и неизменные title/labels/assignees/milestone/comment counts.

| Действие | Issues | Смысл |
|---|---|---|
| CLOSED / completed | #48, #49, #50, #61, #62, #63, #64 | Узкие исходные реализации и их gates завершены. Closure не объявляет live backend, полную device/preset matrix или художественную приёмку. |
| CLOSED / completed после exact public proof | #51, #65 | Own-Send и home/account-pending вошли в f749776; прежний follow-up исключён из активной очереди. |
| CLOSED / not_planned, superseded | #27 | Сентябрьская координационная карточка уже обозначена архивом; актуальный umbrella — #40. |
| OPEN; текущий status/queue обновлён | #40, #42 | Общая product очередь и будущая contextual boost semantics остаются. Домашний battery trigger отменён; готовые All/Send/pending/Menu не повторяются. |
| OPEN; scope/evidence остаются | #43, #2, #10 | Handoff/adapter/motion, workflow reconciliation и Telegram lifecycle/device/E2E имеют незакрытые либо недостаточно доказанные требования. |
| OPEN; awaiting specific input | #58, #59, #60 | Остаточная резкость без точного воспроизведения; полный Light5/reference и policy; окончательный выбор композиции действий. |

Текущая очередь обновлена в существующем [комментарии #40](https://github.com/i4w7w4a/Wallet_4i7/issues/40#issuecomment-6091952803); #42/#65 — в body, #27 — в архивном body. Восьми narrow status comments добавлен final completed block, весь прежний evidence сохранён. Старые #29/#30/#33/#34/#35/#36/#38 не менялись. **Оставшийся exact OPEN set:** #2, #10, #40, #42, #43, #58, #59, #60.

## Exact release и пределы проверки

| Поле | Подтверждённое значение |
|---|---|
| Public source / время | `f749776562c1e472781d342f52710906c307a7ec` /11.10.2026 02:55:44 МСК |
| Image tag / health | `novex-wallet:20261010T234033Z-f749776` /healthy |
| Linux BUILD_ID | `h0OQU8772hs_Tu3HTNw21` |
| Local source / BUILD_ID / launch | f749776 / `TXp_rhIA5FAna525gCyfN` / `c029b25f7024401bab2e72df2ea7875a` |
| Source identity / paths | Live HTTPS manifest = candidate = running container; /→/mono307, /mono и /p/2 200 |
| Published data | 27 files /9 dirs, все семь snapshots/history/UID/GID/mode сохранены относительно fresh verified baseline; ревизии2/5/3/3/2/2/2 |
| Neighbours/config | Только services.mono.image изменился; accepted CaddyR2/config/neighbor container IDs/concepts сохранены; DLC200 |
| Rollback | `b6553a8fdb2adcc56968876f4d74e20f47b749d9`, image `novex-wallet:20261010T013812Z-b6553a8`; текущие данные и соседняя конфигурация не откатываются автоматически |

Root public-browser PASS: свежий visitor /p/2, normal HTTPS,390×844, без editor rails/header demo; avatar справа44px/right370; Support с exact t.me/re_pick и тремя distinct icons; disabled Почта/WhatsApp; Menu home preferences/disabled fiat/closed; Profile Personal/Security и second-click→Home/focus. Ссылка поддержки не открывалась, сообщений/платежей/изменений публичных preferences не было.

Functional local375 walkthrough и affected actual-f749 header390/320 — отдельные evidence. Public screenshot не доказывает storage preservation: её доказал ORACLE. Сохранность всех семи snapshots не означает visual/device проверку всех семи. Physical touch/Safari/Telegram/FPS, real backend/security acceptance не заявляются.

## Ограниченные слабые места и зависимости

| Наблюдение на baseline / из integrated review | Практический предел / следующий шаг |
|---|---|
| Navigation origins/focus живут в `mono-scene.tsx:264–340,598–855`, commit/cleanup — в `mono-product-scene.tsx:35–69` | Будущие переходы требуют согласованной проверки двух сторон. Reviewer предлагает при следующем navigation изменении небольшой pure origin/endpoint predicate и один actual-host regression. Текущую волну ради этого не переписывать. |
| Adapter/snapshot identity входят в guards (`product-controller.ts:219,228,526–527`); invalid minor вызывает RangeError (`wallet-product.ts:213–215`), group estimate допускает null (`home-pins.ts:24–33`) | Это не найденная новая ошибка. При будущей смене источника согласовать immutable session/decoded snapshot и unknown-total state; финансовую валидацию не подавлять. API implementation остаётся отложенным. |
| `profile/model.ts:5–13` содержит неизвестные security, пустые personal/documents и предоставленный Telegram; схема — `profile/types.ts:14–15` | Telegram уже реализован в reviewed source. Для Почты/WhatsApp нужны реквизиты, для документов — материалы владельца. Missing/loading/error остаются честными; отсутствие материалов не source bug и не гарантия реальной безопасности. |
| `demo-adapter.ts:24–28`: только demo, supplied activities + ready/loading/error/retry | Реальные операции/backend не подключены. API proposal сохранён как отложенный материал, без нового API buildout или опросника. |
| `pending-activity.ts:8–29` выводит pending из supplied массива; `demo-activity.ts:18,28` допускает example/simulation и CommerceSimulation | Demo-ready не подтверждает серверную полноту/freshness; будущие live origin/decoder/commerce read model требуют отдельного согласования. Это не новая ближайшая UX-задача. |
| `operation-receipt.ts:19–21` содержит feeFunding и необязательную оценку времени | Они не подтверждают boost/ускорение. [Boost proposal](2026-10-10-battery-boost-placement.md) сохраняет отдельный смысл состояния конкретной операции. |
| [Release f749776](../releases/2026-10-11-wallet-cohesion-f749776.md) и root public/browser reports ограничивают coverage | Physical Telegram/Safari/touch, все семь presets, hardware FPS и полный security/backend gate не заявлены. Это предел evidence, не автоматически найденный дефект. |

Независимый reviewer прочитал текущую интеграцию и узкое исправление F1. Его фактические findings и границы приведены выше; этот документ не выполнял повторное review или новые проверки.

## Пять дальнейших шагов или зависимостей

1. **Получить документы сервиса.** Подключить разрешённые материалы к существующему slot; до этого сохранить empty. Временный Telegram уже предоставлен и реализован в reviewed source. Почта/WhatsApp остаются disabled до supplied данных; документы операций сюда не добавлять.
2. **Уточнить остаточную резкость #58 одним воспроизводимым сценарием.** Нужны точный переход, оформление и устройство/условия. Уже выполненный motion не назначать повторно целиком.
3. **Показать отдельную явно demo boost-примерку active/used.** Переиспользовать готовое предложение; не помечать старые операции, не вводить тарифы или обещание ускорения. Реальная semantics/data остаются зависимостью.
4. **Зафиксировать окончательный выбор композиции действий #60.** A/B/C уже существуют; обсуждение встречи не доказывает выбранный вариант. Новую реализацию назначать по явному решению.
5. **Получить ограниченное evidence на физическом устройстве.** Один связный путь account → pending → receipt → тот же account, Menu/Support/Back/privacy на принятой версии. Это будущий качественный шаг; общие suites, все presets и FPS не повторять автоматически.

Полный Light5 #59 остаётся deferred до точного reference/owner policy; disabled Theme его не выполняет. Второй target отложен владельцем: новых probes, мониторинга и изменения маршрутов в этой очереди нет. API, provider Buy/fiat withdrawal, KYC/2FA и новые финансовые продукты сейчас не назначаются.

## Старые планы и сохранённые доказательства

Семь historical/superseded headers обновлены до RELEASED f749776; исходные bodies/evidence сохранены. Выполненные source-срезы исключены из активной очереди. Корневой README отражает текущие local/public состояния и rollback; deployment README меняет только верхний dated release pointer. Архивные server commands сохранены и не исполнялись. GitHub mapping выполнен/readback PASS.

Последующие documentation-only commits не входят в опубликованный image и не означают новый deploy. Подробные release/backup/resource доказательства находятся в [постоянной записи ORACLE](../releases/2026-10-11-wallet-cohesion-f749776.md); raw protectedops и приватная встреча в этот audit не копируются.
