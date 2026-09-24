# Background Sandbox — cumulative local handoff

Дата: 2026-09-24. ORACLE task: `01a0cfcc-f35e-7a50-a624-6dda3022b4fb`.

**Самостоятельная песочница технически готова к просмотру. MONO fitting остаётся технической примеркой с нерешённым контрастом. Визуального утверждения и публикации нет.**

## Кандидат и полномочия

- Runtime checkpoint: `4bc0446119bc00ca6314b22392661a50ed67f199`.
- Branch: `codex/mono-background-sandbox-integration`.
- Worktree: `C:/Users/iwwa/.codex/worktrees/mono-background-sandbox-integration/5-wallet-foundation`.
- Product base: `fa7d6c1ff65a6505100f809c894aca9dc9851eb4`.
- Plan/docs base: `6c9e46d045ea9444e273d5feabf85d5431c632f4`.
- ABI: `3be0cb7355e8e271f6fd9772eea5ce5f5fc7bae7`.
- Первый законченный Silk + shell: `2f4bb8aa031994bf05891999cf21409c53d970c2`.
- Рабочий local preview: [Background Sandbox](http://localhost:3142/design-lab/atmosphere). HTTP 200 повторно проверен после build. Это dev-only маршрут, не опубликованный сайт.
- Реализация выполнялась по отдельному implementation packet. Heartbeat сам по себе не давал прав на code/build/deploy.
- GitHub Issues текущей волны не созданы: ранее получен 403 integration. Другие credentials не использовались.

Документационный commit после runtime checkpoint не меняет проверенную реализацию. Полный текущий HEAD передаётся в task handoff отдельно.

## Что объединено

| Область | Сданный source head | Вошло |
| --- | --- | --- |
| BG-1, `01a0d216-ff4d-7b90-8bbc-8b63a3c422b9` | `55296721d7c1eeda05d852be6b9efaaa2e2a2417` | Все шесть shell commits: именованные пробы, три slots, Undo/Redo, import preview, recovery, pinned A/B, focus, conflict/quota guards |
| BG-2, `01a0d217-15d5-7150-a006-bdde054e912e` | `7dbf046bf5e3bcb1e51511ccd48ff2f04bd3a9ba` | Весь Silk adapter и QA; scissor fix включён |
| BG-3, `01a0d217-15e5-7700-a163-7123faf7d15f` | `756db41e8e9b824ad785ffd3490ce60f20dce70d` | Runtime `3213a7f68be1a5d692a76258e25141f408c2d6e4`, evidence и честные transient-drawing labels; локальные commits `3a90240`, `0d1e2a4`, `80abdd5` |
| BG-4, ORACLE | `4bc0446119bc00ca6314b22392661a50ed67f199` | Typed registry реальных adapters, один context/canvas/RAF, lifecycle/capability guards, optical composition и cumulative QA |

Общие files изменялись только ORACLE. Дубли ABI из веток исполнителей не cherry-pick-нуты. Product presets/codecs, V1, новые dependencies/lockfile, release/default branch, VPS и preview 3120 не изменялись. Никаких push, merge, issue close или deploy.

## Механики и границы

### Shell

Новые library/workspace keys изолированы. Named Save отделён от workspace recovery; полный config переживает switch/reload/A-B. Simulation pixels/history не сохраняются. Неизвестное восстановление не подменяется стартовым эффектом. Quota/conflict не показывают ложный Saved. Web Locks необходимы для именованной записи; без них остаётся честный read-only/export.

Legacy CSS recipes сохранены; старый atmosphere-v1 только читается. Curated presets не названы генератором случайных параметров.

### Silk и Fluid

Silk сохраняет три слоя, normals и направленный sheen. Output уже содержит ACES/gamma; compositor не применяет их повторно. Это shader material, не cloth simulation.

Fluid сохраняет velocity/dye/advection/curl/divergence/20 pressure iterations/gradient subtraction. Это рисование жидкостью: шесть seeded всплесков при reset, затем новые dye/impulses только от drag. Без жестов цвет почти исчезает примерно за 10 интегрированных секунд при 60 fps. Dye decay фиксирован; «Затухание течения» меняет velocity. Нет непрерывного emitter.

Fluid интегрирует dt с cap 1/30 s без catch-up; на низком FPS симуляция идёт медленнее host clock. После исчезновения цвета положительный dt всё ещё стоит 28 solver/display passes; compositor добавляет один проход. Это известное ограничение кандидата, не исправленная оптимизация.

GPU failure не подменяет Fluid похожим эффектом. Требуются WebGL2 и float render targets; unsupported capability даёт явный статический fallback. Resize/Open/A-B/reset/context restore могут начинать поле заново.

### Host и Promo

Один host управляет временем, bounded pointer samples, resize и active/capability state. Background passes рисуют только свои FBO. Общий compositor выводит результат в единственный canvas. Budget attachments/источника ограничен 32 MiB: 28 для материала, резерв 4 для Promo; Fluid сам ограничен 8 MiB. Default framebuffer и driver overhead в этот budget не входят.

Promo использует тот же neutral relief 512×256, shader и утверждённые settings, включая signed IOR +1.34. Строки vertex/fragment и тело neutral source совпали с исходным компонентом; до refactor файл совпадал с product base fa7. Settings mapping выделен без изменения значений. Обычный MonoOpticalGlass продолжает собственный runtime, если sharedHost не передан.

Shared mode не создаёт canvas/RAF и регистрирует одну DOM region. Размер FBO берётся из layout dimensions, размещение — из DOMRect. Сохранены живой текст/controls, clipping и geometry; это не рефракция нового background через Promo.

Исправлена обнаруженная реальным тестом гонка context loss: adapter может заметить потерю на RAF раньше DOM event. Такой fallback теперь удерживает canvas/listener для preventDefault/restore; обычная GPU failure освобождает весь owned context. Тест восстановления после этого прошёл.

## Проверки

Проверена реализация runtime checkpoint; последующая документация не меняет код.

| Gate | Результат |
| --- | --- |
| UI/core host + Silk/Fluid + MonoOpticalGlass | 73/73, 14 files |
| Shell + MonoScene + activity/SSR | 42/42, 7 files |
| TypeScript всех workspace packages | PASS; единственная ошибка в test probe this annotation устранена, miniapp повторно PASS |
| Общий eslint | PASS; после финальной маркировки fitting/probe focused lint также PASS |
| `pnpm build` | PASS, повторён на финальном runtime; Next 16.3.5, никаких deployment actions |
| Реальный Chromium cumulative E2E | 6/6: named save/switch/return/reload/A-B; защищённые ключи; stale-tab; widths/focus; Fluid/guards; shared Promo; обычный MONO |
| Дополнение fitting | PASS, device DPR 2, четыре ширины и реальный scroll; mobile canvas DPR ограничен 1.5 |
| Static optical identity | vertex/fragment/neutral relief unchanged |
| Diff/ownership | PASS; 82 cumulative files против docs base, до добавления этого handoff |

После шести циклов Silk→Fluid→Silk native GPU resource sets Silk совпадают с исходными: 4 shaders, 2 programs, 2 buffers, 1 FBO, 1 texture, 2 VAO. Все обращения к getContext учитывались по уникальным context objects, не по числу вызовов.

При pause/offscreen/hidden/inactive pending RAF=0 и draw count не растёт. Reduced motion/saveData освобождают canvas. После этих guards и context restore создано 4 последовательных context, жив ровно 1; pending RAF=1, 9 FBO и 9 textures Fluid. Console/page errors=0 в этом lifecycle сценарии. Effects-off отдельно проверен на настоящем surface lifecycle с проверкой освобождения backend и неизменности recipe.

Hardware/mobile/Telegram/Safari visual/performance approval **не получено**. Activity contract проверен через эмуляцию bridge событий, не на физическом Telegram. Это не обещание 60 FPS. Отчёты владельцев adapters используют SwiftShader: Silk median 50.5 ms / p95 53.6 ms включает compositor, fence и readback; Fluid p50 frame interval 66.6/83.3 ms для двух размеров. CPU submit-time не выдаётся за GPU FPS.

## Доказательства

- Общий прогон и desktop/mobile PNG: `C:/Users/iwwa/.codex/visualizations/2026/09/24/01a0cfcc-f35e-7a50-a624-6dda3022b4fb/bg-final-functional`.
- Native ownership/guards JSON: `C:/Users/iwwa/.codex/visualizations/2026/09/24/01a0cfcc-f35e-7a50-a624-6dda3022b4fb/bg-final-functional/background-sandbox-runtime-1694a-orm-guards-on-the-real-host/ownership-and-guards.json`.
- Fluid после drag: `C:/Users/iwwa/.codex/visualizations/2026/09/24/01a0cfcc-f35e-7a50-a624-6dda3022b4fb/bg-final-functional/background-sandbox-runtime-1694a-orm-guards-on-the-real-host/fluid-after-drag.png`.
- Финальная маркировка технической примерки, DPR 2 и scroll: `C:/Users/iwwa/.codex/visualizations/2026/09/24/01a0cfcc-f35e-7a50-a624-6dda3022b4fb/bg-fitting-reviewed`.
- Первый контрастный blocker: `C:/Users/iwwa/.codex/visualizations/2026/09/24/01a0cfcc-f35e-7a50-a624-6dda3022b4fb/bg-fitting-v1/background-sandbox-runtime-c0aac-ful-MONO-fitting-and-return/fitting-390.png`.
- Начальные failures не удалены: `bg-first-silk`, `bg-fitting-red`, `bg-runtime-v1`. Visual snapshots не обновлялись автоматически.
- Silk author handoff: [Handoff](../../packages/ui/src/background-sandbox/effects/silk/HANDOFF.md).
- Fluid author handoff: [Handoff](../../packages/ui/src/background-sandbox/effects/fluid/HANDOFF.md).

## Решение владельцу

На светлых складках исходного Silk подписи тёмного MONO теряют читаемость. Техническая примерка доступна для осмотра и явно помечена несогласованным контрастом. Она не является готовым продуктовым оформлением.

Координатор подтвердил отсутствие ранее утверждённого слоя читаемости и передал владельцу выбор: отдельное регулируемое затемнение только в fitting; отдельный тёмный Silk preset; либо пока standalone. Ни один вариант автоматически не выбран. Silk, Promo и product theme ради контраста не менялись.

Следующий шаг: владелец смотрит самостоятельные материалы и решает судьбу fitting. Новое visual решение реализуется отдельным точным scope; публикация требует отдельного release packet.

## Точный cumulative manifest

Против `6c9e46d045ea9444e273d5feabf85d5431c632f4` на runtime checkpoint:

```text
THIRD_PARTY_NOTICES.md
apps/miniapp/background-sandbox.playwright.config.ts
apps/miniapp/e2e/background-sandbox-probe.ts
apps/miniapp/e2e/background-sandbox-runtime.spec.ts
apps/miniapp/e2e/background-sandbox.spec.ts
apps/miniapp/src/design-lab/background-sandbox/dialog.tsx
apps/miniapp/src/design-lab/background-sandbox/model.test.ts
apps/miniapp/src/design-lab/background-sandbox/model.ts
apps/miniapp/src/design-lab/background-sandbox/parameter-controls.tsx
apps/miniapp/src/design-lab/background-sandbox/recipe-summary.tsx
apps/miniapp/src/design-lab/background-sandbox/recipes.ts
apps/miniapp/src/design-lab/background-sandbox/session.test.ts
apps/miniapp/src/design-lab/background-sandbox/session.ts
apps/miniapp/src/design-lab/background-sandbox/storage.test.ts
apps/miniapp/src/design-lab/background-sandbox/storage.ts
apps/miniapp/src/design-lab/mono-atmosphere-lab-scene.module.css
apps/miniapp/src/design-lab/mono-atmosphere-lab-scene.tsx
apps/miniapp/src/design-lab/mono-atmosphere-lab.module.css
apps/miniapp/src/design-lab/mono-atmosphere-lab.test.tsx
apps/miniapp/src/design-lab/mono-atmosphere-lab.tsx
apps/miniapp/src/mono-preview/mono-scene.tsx
docs/skins/README.md
docs/skins/background-sandbox-tasks.md
docs/skins/source-catalog.md
packages/ui/src/background-sandbox/background-gpu-surface.tsx
packages/ui/src/background-sandbox/contracts.ts
packages/ui/src/background-sandbox/effects/fluid/HANDOFF.md
packages/ui/src/background-sandbox/effects/fluid/LICENSE.upstream
packages/ui/src/background-sandbox/effects/fluid/PROVENANCE.md
packages/ui/src/background-sandbox/effects/fluid/adapter.test.ts
packages/ui/src/background-sandbox/effects/fluid/adapter.ts
packages/ui/src/background-sandbox/effects/fluid/index.ts
packages/ui/src/background-sandbox/effects/fluid/input.test.ts
packages/ui/src/background-sandbox/effects/fluid/input.ts
packages/ui/src/background-sandbox/effects/fluid/probe/evidence/fluid-desktop.png
packages/ui/src/background-sandbox/effects/fluid/probe/evidence/fluid-portrait.png
packages/ui/src/background-sandbox/effects/fluid/probe/evidence/results.json
packages/ui/src/background-sandbox/effects/fluid/probe/fixture.ts
packages/ui/src/background-sandbox/effects/fluid/probe/index.html
packages/ui/src/background-sandbox/effects/fluid/probe/run.mjs
packages/ui/src/background-sandbox/effects/fluid/quality.test.ts
packages/ui/src/background-sandbox/effects/fluid/quality.ts
packages/ui/src/background-sandbox/effects/fluid/schema.test.ts
packages/ui/src/background-sandbox/effects/fluid/schema.ts
packages/ui/src/background-sandbox/effects/fluid/seed.test.ts
packages/ui/src/background-sandbox/effects/fluid/seed.ts
packages/ui/src/background-sandbox/effects/fluid/shaders.ts
packages/ui/src/background-sandbox/effects/silk/HANDOFF.md
packages/ui/src/background-sandbox/effects/silk/LICENSE
packages/ui/src/background-sandbox/effects/silk/PROVENANCE.md
packages/ui/src/background-sandbox/effects/silk/adapter.ts
packages/ui/src/background-sandbox/effects/silk/allocation.test.ts
packages/ui/src/background-sandbox/effects/silk/allocation.ts
packages/ui/src/background-sandbox/effects/silk/definition.ts
packages/ui/src/background-sandbox/effects/silk/motion.test.ts
packages/ui/src/background-sandbox/effects/silk/motion.ts
packages/ui/src/background-sandbox/effects/silk/qa/README.md
packages/ui/src/background-sandbox/effects/silk/qa/probe.mjs
packages/ui/src/background-sandbox/effects/silk/qa/run-browser-proof.mjs
packages/ui/src/background-sandbox/effects/silk/schema.test.ts
packages/ui/src/background-sandbox/effects/silk/schema.ts
packages/ui/src/background-sandbox/effects/silk/shaders.ts
packages/ui/src/background-sandbox/effects/silk/target.test.ts
packages/ui/src/background-sandbox/effects/silk/target.ts
packages/ui/src/background-sandbox/gpu-backend.ts
packages/ui/src/background-sandbox/host-contract.ts
packages/ui/src/background-sandbox/host-input.test.ts
packages/ui/src/background-sandbox/host-input.ts
packages/ui/src/background-sandbox/host-session.test.ts
packages/ui/src/background-sandbox/host-session.ts
packages/ui/src/background-sandbox/material-binding.test.ts
packages/ui/src/background-sandbox/material-binding.ts
packages/ui/src/background-sandbox/overlay.ts
packages/ui/src/background-sandbox/registry.ts
packages/ui/src/background-sandbox/surface-lifecycle.test.ts
packages/ui/src/background-sandbox/surface-lifecycle.ts
packages/ui/src/index.ts
packages/ui/src/mono/mono-optical-glass.test.tsx
packages/ui/src/mono/mono-optical-glass.tsx
packages/ui/src/mono/mono-optical-host.ts
packages/ui/src/mono/mono-optical-kernel.ts
packages/ui/src/mono/mono-optical-overlay.ts
```
