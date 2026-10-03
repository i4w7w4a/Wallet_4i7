# MONO — профиль, передача React и единый выпуск

Основание: владелец разрешил следующий этап после Send/history, затем публикацию всего актуального MONO на сайт, GitHub и очень короткое клиентское резюме со ссылками. Уточнение владельца: в профиле нужны светлая/тёмная тема и скрытие сумм; пункт уменьшения анимаций НЕ нужен. Системный reduced-motion сохраняется.

Canonical `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, branch `codex/product-ux-20261003`, base `4aa6fc4`. Runtime3184 source306b530 работает до единой сборки. ORACLE — единственный владелец сборки и публикации.

GitHub: [#54 — профиль](https://github.com/i4w7w4a/Wallet_4i7/issues/54), [#55 — модель и React handoff](https://github.com/i4w7w4a/Wallet_4i7/issues/55), [#56 — единый выпуск](https://github.com/i4w7w4a/Wallet_4i7/issues/56).

## Global Constraints

- Продолжаем собственный React MONO. Эта волна НЕ реализует настоящий backend, KYC, 2FA, пароль, whitelist, платёжные адреса/QR, покупку/обмен/вывод, подписание или реальные переводы. Неизвестные правила и состояния не изображать включёнными/успешными.
- Сохранить семь авторских оформлений, server snapshots `/p/1`…`/p/7`, текущие материалы, фоны, drafts, battery и action routes. Тема зрителя — отдельное предпочтение, не запись в опубликованный preset/рабочий draft. Не расширять Lab или набор эффектов.
- Ровно два implementation-потока в раздельных файлах, существующие чаты Astra MAX; узкий SOL6.1 MAX helper только при независимой необходимости. Пользовательский быстрый параллельный режим заменяет generic skill ladder: один focused RED/GREEN по новому поведению, root один source read, ORACLE общий typecheck/build, root связный browser visual. Не запускать прежние suites/новые review-цепочки.
- Native computer use запрещён; только браузер. Каждый агент использует `apply_patch`, commit только exact owned paths (`--only`), без reset/clean/stash/add-all/branch switch. Dirty `apps/miniapp/next-env.d.ts` сохранить вне commits.
- Исполнители не build/start/push/merge/deploy. Release разрешён владельцем ПОСЛЕ интеграции; ORACLE сначала read-only preflight, затем explicit root handoff. Не трогать DLC, Stitch, V1, DNS, credentials и чужие сервисы. Секреты только через существующую защищённую ops-конфигурацию, не в вывод/репозиторий.
- Иерархия через отступы/типографику и тонкий материал, не коробка вокруг каждой строки. Touch44, focus-visible, safe-area, readable light/dark, reduced/static/opaque поддержка. Никакого нового renderer/animation dependency.

## Контракт между потоками

Task1 первым коротким commit закрепляет types/exports `apps/miniapp/src/mono-product/profile/index.ts`. Task2 строит UI по контракту ниже и не переписывает model. Оба сначала читают актуальные AGENTS/local Next docs.

```ts
type ProductProfileAction = 'edit-contacts' | 'manage-verification' | 'manage-2fa' | 'manage-password' | 'manage-addresses';
type ProductProfileActions = Partial<Record<ProductProfileAction, () => void>>;
type ProductProfileDetails = {
  email: string | null;
  phone: string | null;
  languageLabel: string;
  valuationCurrencyLabel: string;
  verification: 'unknown' | 'not-started' | 'pending' | 'verified' | 'rejected';
  twoFactor: 'unknown' | 'disabled' | 'enabled';
  addressAllowlist: 'unknown' | 'disabled' | 'enabled';
  support: { label: string; href: string } | null;
  documents: readonly { id: string; title: string; href: string }[];
};
type ProductProfileResource =
  | { status: 'loading' }
  | { status: 'error'; retryable: boolean }
  | { status: 'ready'; data: ProductProfileDetails };
```

Exports: эти types; `createDemoProfileResource(): ProductProfileResource`; `isProfileLinkAllowed(href: string): boolean`. Default demo: контакты null, язык Русский, валюта USD, все security unknown, support null/documents[]. HTTPS links only, без javascript/data/credentials-in-URL; не вставлять выдуманную поддержку или политики. По умолчанию callbacks отсутствуют, UI не выполняет имитацию изменения защиты.

ProductProfile сохраняет прежние required props `profile: WalletProfile`, `balanceHidden`, `onBalanceHiddenChange`; additive optional `resource?: ProductProfileResource`, `actions?: ProductProfileActions`, `onRetry?: () => void`, `theme?: 'dark'|'light'`, `onThemeChange?: (theme:'dark'|'light')=>void`. Без resource использует demo factory. Theme selector интерактивен только при callback; ORACLE подключает его в обеих product scenes. Ни React/DOM/storage внутри чистого model.

## Task 1: Модель профиля, карта состояний и руководство внедрения

Исполнитель: существующий Send-чат Astra MAX. Workdir canonical выше, base4aa6fc4. Полные общие ограничения этого brief: local-only, no build/server/push/deploy, exact paths commit, next-env/presets/operations untouched, one focused RED/GREEN, no review helpers. Читать `shared-contract.md` рядом с brief — точные type/interface requirements.

Owned: новая папка `apps/miniapp/src/mono-product/profile/` (model/types/factory/URL guard и узкие tests/index); `docs/product/react-frontend-handoff.md`, `docs/product/product-state-map.md`, новый небольшой `.tsx` example в `apps/miniapp/src/mono-product/profile/integration-example.tsx`. Не UI ProductProfile/scenes/controller/adapter/ports/настройки/старые integration docs.

1. Сначала type-only commit и export signatures по shared contract; сообщить root/UI готовность через report файл. Затем default demo factory с fresh independent object (без shared mutable arrays), безопасный URL guard. Никакого загруженного customer profile/контактов/секретов и persistence.
2. Маленький компилируемый пример wrapper для `ProductProfile` с controllable resource/тема/privacy callbacks, демонстрирует loading/error/ready и retry, но не отправляет HTTP и не монтируется в production route. Type-import component разрешён, Task2 owns actual UI. Не делать новый showcase route или большую лабораторию. Callback для security описывает, куда интегратор подключает свой workflow; не создавать fake success.
3. Карту состояний составить по существующему коду, не как новое обязательное ТЗ: один/несколько account; active/inactive/unavailable; нулевые/неизвестные доступные остатки; action unavailable; loading/error/retry; send quote unknown/expired/pending/result; receive external/internal; profile security unknown; privacy. Для каждой строки: current component/props/port, что показывается, что даёт backend, unresolved rule. Исторические обещания не отмечать сделанными. Идентичность account/asset/network обязательна.
4. Руководство для frontend-разработчика: entry `MonoProductScene`, snapshot/adapter vs renderer, state ownership/drafts, текущие independent Receive/Send/InternalTransfer ports, пример Profile props, ссылки на existing INTEGRATION. Честно отметить нынешние SendPort.mode='demo', demo ReceiveReference и factory wiring: это не готовый production API adapter, переход к live требует нового согласованного контракта. Не расширять live permissions/запускать настоящие операции ради красивого handoff.
5. Backend questions коротким конкретным списком: DTO/auth, точные маршруты, fee/precision/ETA, battery entitlement, activation/KYC/private readiness, contacts/docs/support URLs. Нет юридических трактовок, тарифов или guessed addresses.
6. Focused RED/GREEN: demo unknown defaults/fresh arrays; HTTPS URL guard unsafe/credentials rejects; небольшой example contract/test только при реальной нужде. Не whole repo suite. Полный self-read и exact commit.

Report `.superpowers/sdd/2026-10-03-profile-and-release/task-1-report.md`: status/commits, exports ready early, test command/output, unresolved integration. Без build/start/push/deploy. После передачи не переписывать model интерфейс без сообщения root.

## Task 2: Профиль — цельный компактный интерфейс

Исполнитель: существующий UX-чат Astra MAX. Workdir canonical выше, base4aa6fc4. Общие ограничения: local-only, no build/server/push/deploy; UI owner, не model/host; next-env/presets/финансовые flows preserved; one focused RED/GREEN, no review helpers. Читать `shared-contract.md` рядом с brief — контракт Task1, не изобретать его заново.

Owned: `apps/miniapp/src/mono-product/product-profile.tsx`, новый `product-profile.module.css`, новый `product-profile.test.tsx`, только profile-строки прежнего `product-account-sections.test.tsx` если контракт/labels затронуты. Не менять shared history CSS и другие profile consumers: их соединяет ORACLE.

1. Профиль — компактная идентичность (существующие WalletProfile name/shortAddress; не называть demo ID платёжным адресом), две работающие настройки и четыре ясных раздела: «Личные данные», «Настройки», «Безопасность», «Помощь и документы». Никаких больших карточек на каждую строчку, дублирующихся заголовков, лишнего «Демо» в каждом блоке. Demo-контекст остаётся очевидным.
2. Тема Светлая/Тёмная — controlled через props, доступный небольшой переключатель с плавным общим выделением. Скрытие сумм — существующий callback, сохраняет связь с глазом/остальными экранами. Отдельного пункта «Уменьшить анимации» НЕ делать. Русский и USD остаются read-only фактом, язык/валюту не имитировать рабочими без полноценного подключения.
3. Разделы раскрываются на месте компактно, максимум один активный, мягкий конечный transition (около200ms, `cubic-bezier(.2,0,0,1)`, zero overshoot). Текст не blur/morph, цифры не анимировать. Семантические disclosure кнопки/aria-expanded, 44px target, no hover-only. Без новых bottom sheets/drag handles/маршрутов. Поле/section focus не должен прыгать при state update.
4. Личные данные: email/телефон из resource, пустое значение называется «Не указано»; read-only, без фиктивного сохранения. Если передан action callback — дать понятный выход; если нет — короткое объяснение недоступности вместо пачки неработающих кнопок. Значения не сохранять в browser storage/URL/preset.
5. Безопасность: KYC/2FA/разрешённые адреса из typed state, неизвестное «Данные не подключены», pending отличается от verified, disabled от unknown. Краткие понятные объяснения через раскрытие, не устрашать красными ошибками при неизвестном состоянии. Смена пароля/контактов/2FA только callback hooks при наличии; никаких форм секретов/фальшивого включения.
6. Помощь: 2–3 компактных локальных объяснения существующей демо-семантики (счёт/сеть, battery покрытие конкретного перевода, реальных переводов здесь нет). Реальная ссылка поддержки/документы только через validated provided data. Не писать/подменять юридические политики и не придумывать URL. При отсутствии контакта спокойно сообщить об этом, не показывать пустую ошибку.
7. Resource loading/error/ready-empty — аккуратные состояния. Retry только при retryable + callback. Не отображать старые контакты/security-success на loading/error. Тема/privacy остаются доступными независимо от загрузки серверного профиля.
8. По умолчанию новый UI сразу виден существующим consumer через demo factory, без ожидания большого backend. Focused RED/GREEN: две local callbacks; unknown vs actual security data; disclosure; safe link/unsupported action; loading/error/retry/privacy. Повторять только затронутые profile cases, не history/send suites. Light/dark tokens, density320/390, reduced/static/forced-colors; root увидит в общей сборке.

Report `.superpowers/sdd/2026-10-03-profile-and-release/task-2-report.md`: commits/tests/props/concerns. UI exact commit, runtime untouched. Не делать новую библиотеку icons/эффектов: существующие vector primitives и tokens.

## Task 3: ORACLE — тема, интеграция, общая сборка и выпуск

Read-only preflight уже поручен отдельно в `.superpowers/profile-release-preflight.md`. До explicit handoff обоих исполнителей не менять source/runtime/сервер. После handoff owns только стыки `mono-product-scene.tsx`, `mono-scene.tsx`, маленький `profile/use-viewer-theme.ts`/test (после Task1 handoff), необходимые docs/ops release artifacts. Профиль UI не переписывать самостоятельно.

Уточнение preflight принято root: для editor controlled theme разрешён узкий prop/callback call-site в `mono-preview.tsx` к существующему environment owner, без переписывания Lab. Visitor preference в editor вообще не читается; на чистой ссылке отдельный preference не меняет published envelope. Фактический target подтверждён: `wallet.153.76.194.160.nip.io`, текущий live source800a637; семь ревизий2/4/3/3/2/2/2. Это preflight, не новый deploy.

Тема: actual light/dark переключение на `/mono` и visitor `/p/n`, без Lab chrome в visitor. Предпочтение локальное и отдельное от appearance snapshots; ни Save/Apply/publish пресетов, ни импорт localStorage. Начальное состояние — текущая тема оформления; существующее пользовательское предпочтение можно хранить только в новом маленьком versioned key с allowlist dark/light. Не financial/profile data. Рабочий editor должен сохранять управление своим environment theme: не перекрывать молча Lab последней preference. До кодинга передать root краткое решение стыка editor/visitor. Reload/hydration без corruption и бесконечного setState. Системный reduced-motion не отключать. Без нового visible toggle для него.

После focused integration check — один common typecheck/build/start3184, вернуть exact source/buildId/launch. Root один browser profile/theme/privacy + короткий regression входSend/history. После handoff root по этому срезу владелец разрешил публикацию всей накопленной product branch, а не только последнего профиля.

GitHub: один coherent feature PR с аккуратным summary и связанными issues; push разрешён текущим запросом. PR обязательно attach к задаче. Предпочесть существующую release policy, не force-push и не обходить branch protection. Merge только если в принятом workflow это необходимый шаг выпуска и gates выполнены; иначе release из точного feature SHA через PR без необязательного merge. Непроверенный/чужой dirty next-env исключён.

Deploy только на подтверждённый текущий MONO target из preflight. До записи сохранить recoverable snapshot текущих7 published presets + deployment config/image identity и локальный проверяемый backup/hash. Выпуск не должен сидить новые default presets поверх пользовательских. Backup private вне publicGit. Зафиксировать rollback exact previous image/config, deployment source manifest. Соседние DLC/Stitch/V1 сервисы не перезапускать/не трогать; DNS/TLS setup без отдельной нужды не менять. При конфликте данных/недостаточных правах остановиться с точным blocker.

После deploy одна проверка public source identity, `/mono`, visitor `/p/1` и `/p/2` (read-only), сохранности семи metadata/hash, мобильного отображения профиля. Не выполнять реальные операции/публикацию пресетов. Предоставить actual public links; не выдавать локальныйlocalhost за телефонный публичный просмотр.

Report `.superpowers/sdd/2026-10-03-profile-and-release/task-3-report.md`: integration commits/checks, runtime identity, PR, deploy/rollback/backup paths без secrets, publicsource/links, known limitations. ORACLE не повторяет passed producer suites/обзоры.

## Task 4: Root — клиентское резюме и финальная фиксация

После доказанного deploy создать короткий `docs/releases/2026-10-03-client-update.md`: до120–160слов по-русски, ссылка «Открыть кошелёк» на чистый visitor и «Варианты оформления» на7постоянныхссылок толькоеслионипроверены (можно дать1–2 примера вместо7строк). Не выдумывать завершённые функции.

В общих чертах: обновили главную/счета, компактные получить/отправить, активы, историю/поиск/квитанции, профиль и тему. Одна короткая оговорка: показаны демонстрационные сценарии, реальные операции/безопасность подключаются к backend заказчицы. Технический React handoff отдельной ссылкой для разработчика, не включать в клиентский текст SHA/логи/количество тестов/внутренние пути/личный анализ встречи.

Техническая release-note отдельно фиксирует точный состав/SHA, ограничения и rollback. Issues обновляются по фактам; completed code != customer visual approval. Итог владельцу: публичная ссылка, что посмотреть за2минуты, короткий готовый текст для пересылки. Клиенту самостоятельно не писать.
