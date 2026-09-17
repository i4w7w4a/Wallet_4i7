# Task 2 — Workspace, history, persistence, portable presets

## Реализовано

- `apps/miniapp/src/mono-preview/mono-palette-workspace.ts`: три независимых slot, Dark/Light editor snapshots, character-only theme linking с diff/confirm, linked→manual freeze, snapshot-aware role/group locks через engine API, bounded Undo/Redo (50), branching, transaction coalescing, history-neutral Compare, seed/randomize/reset.
- `apps/miniapp/src/mono-preview/mono-palette-storage.ts`: три независимых V1 key, атомарное восстановление повреждённых/неизвестных версий, Apply с contrast validation и runtime snapshot без editor locks, локальная preset library с асинхронной SHA-256 verification.
- `apps/miniapp/src/mono-preview/mono-preset-codec.ts`: full normalized export/import с обеими resolved-ветвями, schema/engine/catalog metadata, Web Crypto SHA-256 (Node-compatible injectable boundary), size limit 128 KiB, строгий allowlist, content-hash verification, allowlisted partial scopes, diff/lock-aware merge и constraint warnings.
- Тесты: `mono-palette-workspace.test.ts`, `mono-palette-storage.test.ts`, `mono-preset-codec.test.ts`.

## TDD RED

Команда каждого focused цикла: `pnpm --filter @wallet/miniapp test -- src/mono-preview/<file>.test.ts`.

| Цикл | Наблюдаемый RED output | Почему ожидался |
|---|---|---|
| Workspace initial | `Failed to resolve import "./mono-palette-workspace"` | Модуль ещё не существовал; tests зафиксировали желаемый API и state transitions. |
| Storage initial | `Failed to resolve import "./mono-palette-storage"` | Три V1 key/recovery ещё не реализованы. |
| Codec initial | `Failed to resolve import "./mono-preset-codec"` | Portable envelope и SHA-256 boundary ещё не реализованы. |
| Relink + seed/reset | `TypeError: previewMonoThemesLink is not a function`; `TypeError: setMonoPaletteSeed is not a function` | Отсутствовали diff/confirm и полные history transitions. |
| Unknown library version | `expected [ { schemaVersion: 1 ... }, { schemaVersion: 2 ... } ] to deeply equal []` | Загрузка ошибочно принимала смешанные revisions. |
| Verified library | `TypeError: loadVerifiedMonoPalettePresets is not a function` | Не было криптографической проверки локальных revisions. |
| Partial lock ownership | `expected true to be false` на `edgeCool.locked` | Partial copy ошибочно переносил замок источника в целевой workspace. |
| Runtime Apply locks | `expected true to be false` на active `edgeCool.locked` | Active appearance ошибочно сохранял editor-only lock. |
| Typography scope | `expected [] to deeply equal ["Typography is not part of MonoPaletteConfigV1"]` | Scope не сообщал, что font fields отсутствуют в цветовой V1 schema. |

Все последующие RED выше — assertion/runtime failures внутри тестов реальных state/storage/codec, без mock-проверок. Начальные RED были ошибкой импорта отсутствующего модуля, а не assertion failure; это процессное ограничение первых трёх циклов зафиксировано явно.

## GREEN

- `pnpm --filter @wallet/miniapp test -- src/mono-preview/mono-palette-workspace.test.ts` → `1 passed`, `8 passed`.
- `pnpm --filter @wallet/miniapp test -- src/mono-preview/mono-palette-storage.test.ts` → `1 passed`, `6 passed`.
- `pnpm --filter @wallet/miniapp test -- src/mono-preview/mono-preset-codec.test.ts` → `1 passed`, `4 passed`.

Финальный gate после последней правки:

- `pnpm --filter @wallet/miniapp test` → `Test Files 5 passed (5)`, `Tests 29 passed (29)`.
- `pnpm --filter @wallet/miniapp typecheck` → `tsc --noEmit`, exit 0.

## Self-review / concerns

- Workspace и codec используют типы, normalizer, resolver, lock/recipe/randomize API Task 1; palette math не дублируется. FNV schema/replay metadata не используется как content hash. SHA-256 строится через Web Crypto; тесты инъецируют настоящий `node:crypto` SHA-256, а не fake digest.
- Partial merge оставляет целевые editor locks на месте и не переносит чужие. Active runtime snapshot разворачивает locked resolved colors в manual values и очищает locks, не мутируя draft.
- `typography` — допустимый scope, но в `MonoPaletteConfigV1` нет font IDs. Сейчас это явный no-op с warning, без ложного копирования content colors. Реальный font fragment должен появиться вместе с типизированным Font Registry; произвольные font URL не допускаются.
- Preview relink diff показывает character recipe axes, не отдельный список каждого косвенно изменившегося resolved role. UI интеграция должна показать итоговые palette strips/constraint warnings до confirm.
- Начальные три RED на отсутствующие модули не были assertion failures; дальнейшие поведенческие RED/GREEN проверяли реальные transitions и исправления.

## Review fix round 1/5 — пять Important замечаний

Изменённые файлы: `mono-preset-codec.ts`, `mono-preset-codec.test.ts`, `mono-palette-storage.ts`, `mono-palette-storage.test.ts`. Каждый новый regression test был запущен и дал assertion RED до production change; старые initial import-failure RED не переписывались.

| Дефект | RED command и существенный failing output | GREEN command и output |
|---|---|---|
| Scoped linked color зависел от target recipe | `pnpm --filter @wallet/miniapp test -- src/mono-preview/mono-preset-codec.test.ts` → `expected 250 to be close to 42` на `edgeCool.h` | Та же команда → `Tests 5 passed (5)`. Fragment теперь несёт выбранные source resolved роли; linked/offset цвета замораживаются локально, вне scope роли сохраняются. |
| `respectLocks:false` импортировал source locks | Та же codec команда → `expected false to be true` на target `groupLocks.decorative` | Та же команда → `Tests 6 passed (6)`. Target lock ownership сохраняется, snapshots после override обновляются через `setMonoPaletteLock`. |
| Entire fragment принимал внутреннюю version 99 | Та же codec команда → `expected [Function] to throw an error` | Та же команда → `Tests 7 passed (7)`. Внутренний config проходит version/skin normalizer до merge. |
| Autosave жеста терял history branch | `pnpm --filter @wallet/miniapp test -- src/mono-preview/mono-palette-storage.test.ts` → `expected [] to have a length of 1 but got +0` | Та же команда → `Tests 7 passed (7)`. Serialized copy завершает изменённую транзакцию и очищает stale future, не мутируя caller workspace. |
| Entire preview скрывал metadata edits | Codec команда → `expected [ 'themes.dark.recipe' ] to deeply equal ArrayContaining [ 'seed', 'actionCounter', 'linkedThemes' ]` | Та же команда → `Tests 8 passed (8)`. Diff включает metadata, result возвращает обе resolved palette strips и warnings. |

Финальный gate после всех пяти исправлений: `pnpm --filter @wallet/miniapp test` → `Test Files 5 passed (5)`, `Tests 34 passed (34)`; `pnpm --filter @wallet/miniapp typecheck` → `tsc --noEmit`, exit 0.

Self-review: fragment остаётся data-only, без arbitrary paths/code; source resolved передаётся только для allowlisted roles. Override не передаёт чужие group/role locks, но сознательно меняет цвет под существующим target lock и делает новый точный snapshot. `typography` по-прежнему явный no-op до типизированного Font Registry.
