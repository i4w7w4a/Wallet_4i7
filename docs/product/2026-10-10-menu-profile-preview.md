# Меню и профиль — ограниченная примерка

<!-- NOVEX_TASK4_STATUS_20261011_START -->
> **Историческая завершённая примерка.** Выбор состоялся, Menu/Settings/Documents входы опубликованы в f749776. Предложенные ниже source-пилоты повторно не назначать.
>
> Текущая волна [11 октября](2026-10-11-wallet-cohesion-release.md) **RELEASED f749776**: [release proof](../releases/2026-10-11-wallet-cohesion-f749776.md). Актуальная очередь — [аудит проекта](2026-10-11-project-audit.md). Прежние source/build/browser evidence ниже — история.
<!-- NOVEX_TASK4_STATUS_20261011_END -->

10.10.2026. Владелец поручил SOL MAX разобрать состав меню/профиля, показать компактное размещение темы, языка, валюты и документов с красивыми анимированными иконками; оркестратору — сформулировать задачу и подготовить разумное продолжение. Спецификация: прямое поручение + факты `2026-10-10-menu-profile-gpt-handoff.md`. Это новая примерка, не повтор прежнего аудита.

## Global Constraints

- Canonical checkout `C:/Users/iwwa/.codex/worktrees/mono-showcase/5-wallet-foundation`, base `74609ade6f7de3364f4ce26ecaa72f9c3f38039e`. Local compiled `ffaf1b8` уже имеет pending конкретного счёта/Back. Public `b6553a8` прежний. Foreign next-env.d.ts и ux-icons-audit.md не трогать.
- В этой волне не менять production source/runtime3184, финансовые сценарии, unknown security, API, семь presets/materials/storage, зависимости или серверы. Нет deploy/push/merge. Примерка отдельно, тема допускается как кандидат в ней, не как восстановленный переключатель кошелька.
- SOL6.1 MAX в подходящем существующем рабочем чате; аналитический помощник SOL MAX параллельно пишет только свой документ. Один автор примерки, не несколько конкурирующих макетов. Root владеет планом/решениями; ORACLE не нужен для неизменённой сборки кошелька.
- Пользовательский fast-loop: один небольшой визуальный прототип, статическая проверка его JS/разметки, одно предметное review и короткая браузерная примерка. Не запускать pnpm test/typecheck/build/lint/fullbranch review для неизменённого приложения. Это обсуждаемый макет, не новая product feature. Scratch и исходник примерки сохранить.
- Сначала текущая SVG-грамматика, спокойная анимация, ясные подписи. Не добавлять image/video pipeline, runtime icon libraries, новый редактор/дизайн-систему. Не превращать меню в перечень будущих обещаний. Нет invented KYC/2FA/документов/тарифов/локализации/FX.

## Результат — готово к визуальному выбору

- [Предложение](2026-10-10-menu-profile-proposal.md): рекомендуются строки с видимыми значениями, альтернатива — компактные подписанные иконки 2×2. Menu отвечает за кошелёк, Profile через аватар — за человека. Ни один вариант не внедрён в действующий сайт.
- Владелец уточнил: **только документы сервиса**, без выписок/квитанций. Примерка показывает честный empty; реальный список потребует предоставленных материалов, сам вход не заблокирован.
- Интерактивный исходник: `C:/Users/iwwa/.codex/visualizations/2026/09/22/01a0c737-c83c-7c02-91a3-3c1d2529d4f2/menu-profile-options.html`, 34 189 bytes. Автор SOL6.1 MAX; один syntax/localDOM PASS, один независимый scoped review APPROVE, один bounded browser pass390/320. Проверены детали валюты/документов, Profile/security unknown, Back/Escape/focus и обе композиции; proof/report находятся в `.superpowers/sdd/2026-10-10-menu-profile-preview/`. Не full-suite, не проверка физического телефона/FPS и не product acceptance.
- [Продолжение](2026-10-10-menu-profile-next-slices.md) — два предложения после выбора: direct Menu→Язык/Валюта оценки к одному существующему содержимому; точный вход к документам сервиса в единой помощи. Сейчас source-работы им не назначены. Тексты и supplied источники можно готовить параллельно, общий scene/menu wiring — последовательно одним владельцем.
- Тема только в макете; настоящий переключатель остаётся скрытым. Локальный runtime `ffaf1b8`, public `b6553a8`, семь presets и product source не менялись. ORACLE/сборка/сервер/публикация не запускались. Следующий шаг — визуальный выбор владельца, затем отдельный ограниченный implementation pilot.

## Task 1: Состав и две интерактивные композиции

Owner: существующий видимый `Astra: UX`, explicit `gpt-6.1-sol` / `max` (название историческое). Прочитать brief и полный `docs/product/2026-10-10-menu-profile-gpt-handoff.md`; факты уже сверены, не повторять аудит всего проекта/видео/14разделов. Current HEAD unchanged подтверждён root. Для компоновки использовать уже известный интерфейс, не сканировать проект за новым оформлением.

Рекомендуемая композиция, которую надо оценить, а не просто оправдать:

- Menu относится к кошельку: четыре кандидата Тема / Язык / Валюта оценки / Документы, плюс существующие Мои счета / Помощь. Privacy оставить быстрым компактным действием. Заголовок «Меню» уместнее «Быстрые настройки», если в нём есть навигация.
- Profile через верхний аватар: идентичность/контакты и Безопасность/верификация. Unknown остаётся unknown. Не заполнять пустоту новыми пунктами, не дублировать Историю/Активы/Профиль снизу. В будущем можно переместить общие preferences/help из текущих групп, но в настоящем сайте сейчас ничего не переносится.
- Один источник настроек и помощи, разные быстрые входы не должны становиться копиями состояния. «Валюта оценки» — отображение суммы, не обмен; язык — интерфейс, не страна. Документы — supplied материалы, не придуманные юридические тексты или официальная выписка.

Deliverables ровно два:

1. `docs/product/2026-10-10-menu-profile-proposal.md`: до ~900 слов, рекомендованное дерево меню/профиля, таблица оставить/перенести/позже, причина выбора, 2–3 значимых компромисса и один следующий pilot. Последнее поручение разрешило примерку четырёх иконок, но не молчаливую перепись семи тем. Не пересказывать весь handoff. Не задавать длинную анкету.
2. Интерактивная примерка **в разговоре**, literal HTML fragment по visualize skill, путь `C:/Users/iwwa/.codex/visualizations/2026/09/22/01a0c737-c83c-7c02-91a3-3c1d2529d4f2/menu-profile-options.html`. Один named variant carousel, две действительно разные компоновки «Строки с деталями» (рекомендуемая) и «Компактные иконки». В каждой — компактный мобильный shell с нижним Menu, аватаром Profile, одним экземпляром панели/деталей. Без ещё одного сайта/route/editor.

Перед authoring сам полностью прочитай `C:/Users/iwwa/.codex/plugins/cache/openai-bundled/visualize/1.0.49/skills/visualize/SKILL.md` и `tweak.md`, UI/UX/motion применяй с приоритетом принятых repo правил. Parent прочитал их полностью. Readback literal fragment, no escaped markup; <1MB, unique root. Только supplied global lucide/data-lucide placeholders (sun-moon/languages/circle-dollar-sign/file-text), не писать icon path и не грузить библиотеку/CDN. Это тот же знакомый SVG язык, не новая productiondependency. Mockup root-scoped product styles, surrounding preview transparent/dotted, opaque readable product panel with subtle edge light (CSS approximation, не обещать физическую WebGL-refraction). Follow host appearance через product-specific light-dark values. Никакой пересборки кошелька.

Композиция:

- Сначала показать открытое Menu, чтобы четыре иконки сразу видны. «Строки» — icon + label + нынешнее значение/chevron, примерно48px area, без отдельных обведённых квадратов. «Компактные иконки» — открытая компактная группировка четырёх без плиточных коробок, с подписями, не крошечный toolbar. Мои счета/Помощь ниже спокойно, privacy компактно. Не делать sidebar/menu на весь экран.
- Аватар показывает компактный Profile: демо-пользователь, Личные данные и Безопасность с supplied/unknown состояниями; возврат к Menu понятен. Кошелёк на фоне схематичный по текущему контексту, не новый dashboard и не фальшивый скриншот.
- Нажатия четырёх пунктов открывают локальные детали; Back/Escape и закрытиеMenu работают. Варианты не трогают реальный кошелёк. У языка/валюты нынешние Русский/USD и честная граница «Выбор ещё не подключён»; не показывать работающие переводы/FX. Тема — только демонстрационный выбор внешнего вида макета/кандидат; mark«Примерка». Документы — честный пустой результат, без fake файлов/скачиваний. Никаких API/storagewallet/networkcalls.
- Иконки различаются силуэтом и реакцией: свет/тень, перевод букв (не флаг), единица оценки (не swap), лист (не книгаHelp). Минимум44CSSpx hitarea, label+accessible state, visible nativefocus. Motion finite hover/focus/tap, ~90 enter/190 settle/80 press, easing(0.2,0,0,1), zeroovershoot. Не все вместе и не infinite spin/pulse. Reduced-motion static. Корректность не зависит от animationend. Если suppliedlucide не позволяет предложенное движение внутренней части без хрупких селекторов — адаптируй спокойно на контейнер, объясни вreport.
- Не добавлять отдельную панель controls. Tweak максимум2 полезных параметра (плотность/интенсивность отклика), guarded helper; carousel штатный, без своего JSпереключателя. Meaningful mock interaction state локально; использовать only widgetState/setWidgetState для rememberedchoice, без автоматическихfollowup сообщений. Никаких пояснительныхэссе внутри визуала; толькоlabel/currentvalue/честныеUIсостояния.

Проверки автора: readbackHTML, script syntax/no undefined queriedelements, один проход localDOM logic через доступный механизм безprodserver/browser. Browser/screenshot примерки выполнит root через bundledrenderer; не дублировать. Дать report `task-1-report.md` currentSDDworkspace: exactpaths, чтоизменил, выбранныйвариант/компромисс, checks/limitations. Никакого commit без exactrootGO; main source полностьюread-only. Не порождать reviewer/второгоавтора; если полезен helper, только узкий read-only вопрос по отдельномуrootGO, соседнийаналитик уже назначен.

## Task 2: Следующее полезное продолжение

Owner: fresh internal SOL6.1 MAX аналитик. Только `docs/product/2026-10-10-menu-profile-next-slices.md` (до ~650слов) и свой currentSDDreport. Не трогать Task1/plan/source/runtime/GitHub. Прочитать handoff меню/профиля, текущееAGENTS и next-product-decisions/account-pending-return finalstatus. Один раз сверить конкретные currentsettings/help/docs types/UI для техническойдостижимости, не повторятьбольшойаудит/видео.

Результат: 2–3 действительно полезных следующих малых frontend среза с приоритетом, пользовательскойпользой, точными границами/зависимостями/критериемготовности. Отличать «можно подготовить сейчас» от «только после visualвыбора/материалов». Не выполнятьих. Не предлагать заново N1/accountBack/Send/menu migration/homebatteryremoval; неAPIконтракт и неbackendвопросник. Разобрать: единое место preferences бездублей; честный Documents(empty/supplied) и связь Help; макетboostвследующемэтапе лишьеслиочевиднаяпольза, не раздувать очередь ради третьегопункта. Если меньше подтверждённыхполезныхсрезов — оставитьдва.

Показать что параллелится безопасно (например текст/источникидокументов), а что сериализуется из-за sharedscene/menu и решенияowner. Не придумывать рабочуюлокализацию/курсы/настройкиsecurity; отсутствиеAPIнеблокируетпримерку, но успехдемо не объявляетсяподключением. Безnewskills/provision/серверов. Fullreport task-2-report.md, краткийитогroot. Commitне делать.

## Task 3: Оркестратор — выбор и показ

Root читает оба результата, проверяет соответствие текущимфактам и одну scoped artifact review, не historicalwholebranch. Для внеGit HTML review читает literalartifact вместофиктивногоgitdiff; docsотдельноcommitпослеownerGO слота, основнойruntimeнестроить. Bundledvisualizer wrapper и один browseronlypass: дваварианта/Menu→деталь→Back/Profile,320/390, однойконкиконечныйотклик и reducedmotion declaration. Сохранитьскриншотеслипоказываемbrowser; inlinefinalvisualreference обязателен. Зафиксироватьрекомендацию и один следующийпилот, но не начинатьproductionimplementation безвыборавладельца. GitHubsyncтолько boundedexistingqueue, безnewissues/deploy.
