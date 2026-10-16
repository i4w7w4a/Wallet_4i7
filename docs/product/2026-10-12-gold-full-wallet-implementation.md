# Полный Gold — локальная реализация, 12.10.2026

## Решение владельца

Довести принятый строгий золотой вариант до всех существующих экранов кошелька. Реализация SOL MAX, координация ORCHESTR WALL, локальная сборка ORACLE. Сначала локальная визуальная примерка. Публикация, push и merge не разрешены этой волной.

## Global Constraints

- Новый фиксированный `/gold` использует существующий `MonoProductScene`, его controller, snapshot, commands, capabilities, guards, Back/focus, privacy, drafts, session и home pins. Не копировать финансовую логику или prototype onNotice-host.
- Семь рабочих/опубликованных presets, их материалы, хранилища, schema и историю не менять. `/`, `/mono`, `/p/1…7` сохраняют поведение. Gold — не восьмой mutable slot, не новый редактор.
- Весь gold-CSS изолирован через `data-mono-presentation="gold"` или собственный viewer class. Палитра/типографика через существующие adapters, чтобы inline variables не побеждали оформление случайно.
- Gold фиксированно тёмный, без очистки/перезаписи общей viewer theme preference. Сохранение home pins не выключать fake session. Прочие viewers сохраняют прежние defaults.
- Existing SVG/local fonts; без новых runtime libraries, CDN и случайного смешивания иконок. Custom artwork/material-mask priority и действия остальных viewers не изменять.
- Тёплый чёрный, матовые золотые акценты, светлые суммы без glow; различимые success/pending/error/unknown. Финансовые операции остаются demo. Boost не приписывать старым операциям.
- Мягкие конечные отклики, без overshoot, persistent particle/RAF loops или layout shift; системный reduced-motion и opaque/effects-off fallback, focus-visible и touch targets сохраняются.
- Один автор shared source. Чужой dirty/untracked main не трогать. Текущие 3184 MONO, 3196 prototype и публичные сайты не останавливать/не менять.

## Основа и владение

- Новый изолированный worktree: `C:/Users/iwwa/.codex/worktrees/novex-gold-wallet/5-wallet-foundation`, база `1011bb3` (source 8a9052c + docs).
- Prototype reference read-only: `C:/Users/iwwa/.codex/worktrees/novex-fast-edit-pilot/5-wallet-foundation/prototypes/fast-edit-overview`, b6ffaee. Старую экспериментальную ветку целиком не merge-ить: у неё прежняя продуктовая база.
- Implementer: существующее окно `NOVEX — быстрые правки шаблона: эксперимент`, GPT-6.1 SOL MAX.
- ORACLE: отдельный локальный runtime, свободный порт после проверки, без SSH/deploy.
- Root: план, единственная scoped independent review и итоговая визуальная приёмка.

## Task 1: Full Gold presentation

Прочитай Global Constraints выше вместе с этим заданием. Используй read-only feasibility `C:/Users/iwwa/.codex/worktrees/novex-fast-edit-pilot/5-wallet-foundation/docs/product/2026-10-12-gold-full-wallet-path.md`. Это уже завершённый анализ: сейчас нужен код, не повторный общий аудит.

Создай `/gold` с metadata и тем же snapshot loader, что `/mono/view`; viewer с activity guard монтирует существующий `MonoProductScene`. Новый immutable Gold config построить на существующем Ledger/envelope v4, без gold в MonoShapePreset. Scoped composition/appearance распространяется на Overview, Assets/asset details, History/receipt, Profile/details, Menu/settings/support/service documents, Accounts/details, Send (в том числе own-account), Receive, Buy и Swap. Реальная текущая навигация/панели, а не заглушки прототипа. Недоступные функции остаются честно недоступными.

Начальный allowlist:

1. `apps/miniapp/app/gold/page.tsx` (новый).
2. `apps/miniapp/src/mono-preview/mono-gold-viewer.tsx` (новый).
3. `apps/miniapp/src/mono-preview/mono-gold-appearance.ts` (новый).
4. `apps/miniapp/src/mono-preview/mono-gold.css` (новый).
5. `apps/miniapp/src/mono-preview/mono-product-scene.tsx`: только узкий host option fixed theme.
6. `apps/miniapp/src/mono-preview/mono-scene.tsx`: marker/default Gold glyph selection с прежними handlers/targets.
7. Целевой Gold test file в существующей test структуре; один тест-набор на новый host/config/сохранность defaults и artwork priority, без текста-source-as-tests.

Если реальная форма требует дополнительного конкретного presentation path, сообщи root причину/путь до изменения; controller/core/API/shared shader/preset store запрещены. Новый matte config background:null, buttons frameMode:icons/no bindings допустим только для Gold. Existing ProductGlassSurface lifecycle сохраняется; панели читаемы, без второго GPU renderer. Нельзя глобально скрыть финансовые notices или security-unknown.

Проверки: короткий RED→GREEN для новых host/config guards; один targeted producer run и typecheck по завершённому source. Не повторять full suite/E2E/production build после CSS-save. Браузер окончательно проходит root после ORACLE. Commit точных owned paths разрешён, без add-A. Не редактировать root plan/AGENTS или чужие docs. Source freeze/report и точный SHA отправить root. Детальный отчёт `.superpowers/sdd/2026-10-12-gold-full-wallet-implementation/task-1-report.md`: changed paths, проверки/вывод, screens coverage, оставшиеся ограничения. Саморевью одно. Не создавать собственного ревьюера — root делает один независимый проход.

## Task 2: Local assembly and visual handoff

ORACLE готовит зависимости/изолированный preview заранее, но собирает только после source freeze Task 1. Не менять source за implementer, не повторять producer tests/typecheck без причины. Один build, отдельный свободный local port (кандидат 3197), identity/route health. Main 3184 и prototype 3196 не трогать. Можно сначала dev/HMR для визуальной примерки, затем один frozen production build для итогового handoff; не создавать новый preview/deploy framework.

Root выполняет один ограниченный проход 390/320: главная, asset/History/Profile/Menu/Accounts, реальные Send/Receive и Buy/Swap entrances, receipt→тот же счёт, privacy/keyboard/disabled/pending/error/unknown, reduced/opaque и Gold после существующей светлой preference. Это не backend/FPS/physical-device/all-seven certification. Одно independent diff review в этой волне, без дублирующих последовательных обзоров. Исправления только по конкретному найденному дефекту, затем затронутая проверка.

Итог: рабочая локальная ссылка полного Gold, несколько основных скриншотов, короткие сведения о сохранённом/изменённом и что оценить руками. Публичный Gold, merge/push и основной вход отдельно после визуального решения.
