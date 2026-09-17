# MONO Palette Lab и библиотека пресетов — implementation plan

**Goal:** Реализовать дизайнерский linked/manual color engine, независимую память
Dark/Light, Color Lab в боковых rails и серверную библиотеку именованных пресетов.

**Architecture:** Чистый mono-specific palette engine живёт в `@wallet/ui`; isolated
`/mono` хранит versioned workspace/history и отображает controls; semantic CSS vars
связывают resolved palette с DOM и единственным optical renderer. Next Route Handlers
обращаются к repository/service слою, production repository хранит immutable revisions
в PostgreSQL, а тесты используют memory repository.

**Tech Stack:** TypeScript 5.9, React 19, Next 16, Vitest 5, Playwright, CSS,
PostgreSQL, Node crypto, существующий OGL backend.

**Spec:** `docs/skins/palette-lab-v1.md`

## Global Constraints

- Перед работой полностью прочитать `AGENTS.md`, `apps/miniapp/AGENTS.md`, spec и
  релевантные Next 16 guides из `node_modules/next/dist/docs`.
- Строгий TDD: production behavior появляется только после наблюдаемого RED.
- Не менять approved Ledger optical JSON, IOR sign, shader dispersion, geometry/flow.
- Не создавать второй WebGL context/RAF и не remount-ить renderer ради цвета.
- Palette config mono-specific; не расширять legacy `ThemeConfig` и не помещать его
  в `packages/core`.
- Dark и Light имеют независимые states; theme-link связывает только character axes.
- OKLCH/OKLab внутри; sRGB gamut mapping без поканального clipping; WCAG gates после
  alpha compositing.
- Status colors защищены; raw CSS/HTML/code/font URL/shader source не импортируются.
- Randomization deterministic и lock-stable; `Math.random()`/`Date.now()` запрещены.
- Local workspace, active appearance и saved presets разделены и versioned.
- Database port наружу не публикуется; реальные credentials не коммитятся.
- Motion: `90ms enter / 80ms press / 190ms settle`, palette `180..240ms`, gradient
  crossfade `320..420ms`, `cubic-bezier(0.2,0,0,1)`, no overshoot, reduced-motion.
- Центр workbench остаётся только phone preview; controls живут в sibling rails.
- Git-коммиты и новая документация — на русском.

## Task 1: Чистый OKLCH palette engine и schema

**Files:**
- Create: `packages/ui/src/mono/mono-color-space.ts`
- Create: `packages/ui/src/mono/mono-color-space.test.ts`
- Create: `packages/ui/src/mono/mono-palette.ts`
- Create: `packages/ui/src/mono/mono-palette.test.ts`
- Modify: `packages/ui/src/index.ts`
- Modify: `docs/skins/mono-ledger-v1.md`
- Modify: `docs/skins/architecture.md`

**Requirements:**

1. RED tests with hand-checked vectors for sRGB/OKLCH round-trip, gamut mapping,
   alpha-composited WCAG contrast and finite/clamped malformed inputs.
2. Define versioned `MonoPaletteConfigV1`, theme recipe, role modes/offsets/manual
   values, group/role locks and `MonoResolvedPalette` exactly within the spec.
3. Implement five harmony recipes and derive semantic roles. Core/text remain almost
   neutral; secondary hues reach decorative roles only.
4. Implement contrast repair for linked mode, Apply validation for manual mode and
   protected system roles.
5. Implement deterministic scoped randomization with independent streams and exact
   preservation of locked/out-of-scope resolved values.
6. Document the superseding hue decision without weakening optical constraints.
7. Focused tests, then `pnpm --filter @wallet/ui test` and typecheck.

## Task 2: Workspace, history, persistence и portable presets

**Files:**
- Create: `apps/miniapp/src/mono-preview/mono-palette-workspace.ts`
- Create: `apps/miniapp/src/mono-preview/mono-palette-workspace.test.ts`
- Create: `apps/miniapp/src/mono-preview/mono-palette-storage.ts`
- Create: `apps/miniapp/src/mono-preview/mono-palette-storage.test.ts`
- Create: `apps/miniapp/src/mono-preview/mono-preset-codec.ts`
- Create: `apps/miniapp/src/mono-preview/mono-preset-codec.test.ts`

**Requirements:**

1. RED tests for exact Dark/Light restoration, linked/manual freeze without jump,
   link/unlink themes, role/group locks, undo/redo branching and transaction coalescing.
2. Keep workspace, active and local preset library under three separate V1 keys.
3. Recover corrupted/unknown storage safely; never partially apply unknown versions.
4. Export/import full normalized snapshots with resolved values and content hash.
5. Implement allowlisted partial fragments and diff; default merge respects locks.
6. One slider gesture/repeat is one history transaction; compare is history-neutral.
7. Focused tests, miniapp unit suite and typecheck.

## Task 3: Semantic token bridge и Color Lab UX

**Files:**
- Create: `apps/miniapp/src/mono-preview/mono-color-lab.tsx`
- Create: `apps/miniapp/src/mono-preview/mono-color-lab.css`
- Create: `apps/miniapp/src/mono-preview/mono-color-lab.test.tsx`
- Modify: `apps/miniapp/src/mono-preview/mono-preview.tsx`
- Modify: `apps/miniapp/src/mono-preview/mono-preview.css`
- Modify: `apps/miniapp/src/mono-preview/mono-theme.css`
- Modify: `apps/miniapp/src/mono-preview/mono-environment.css`
- Modify: `apps/miniapp/src/mono-preview/mono-workbench.css`
- Modify/Create relevant `/mono` Playwright specs.

**Requirements:**

1. RED component/E2E tests for controls, theme memory, linked/manual, locks,
   deterministic randomize, save/apply separation and accessible keyboard use.
2. Map every app-facing hardcoded palette color touched by Dark/Light/environment to
   semantic CSS variables; preserve a zero-diff baseline before new recipe changes.
3. Left rail contains compact Color Lab and local preset controls; right rail keeps
   optical inspector. Center preview never receives lab controls or width shift.
4. Expose simple mode first; Expert reveals role list, OKLCH/HEX and locks.
5. Apply resolved colors atomically as CSS vars; slider work is rAF-coalesced; gradients
   crossfade; renderer/context is stable.
6. Implement local named save/load/update/delete, A/B before view, Undo/Redo and JSON
   copy/download/import preview.
7. Preserve touch targets, focus-visible, inert drawer behavior and reduced motion.
8. Run focused tests and `/mono` E2E at 320/390/430/480.

## Task 4: Preset service, PostgreSQL repository и Next API

**Files:**
- Create: `apps/miniapp/src/preset-library/preset-types.ts`
- Create: `apps/miniapp/src/preset-library/preset-service.ts`
- Create: `apps/miniapp/src/preset-library/preset-service.test.ts`
- Create: `apps/miniapp/src/preset-library/postgres-preset-repository.ts`
- Create: `apps/miniapp/src/preset-library/postgres-preset-repository.test.ts`
- Create: `apps/miniapp/src/preset-library/preset-owner.ts`
- Create: Next Route Handlers under `apps/miniapp/app/api/skin-presets/`
- Create: `deploy/postgres/migrations/001_skin_presets.sql`
- Create: `deploy/.env.example`
- Modify: `apps/miniapp/package.json`, `pnpm-lock.yaml`, `deploy/compose.yaml`,
  `THIRD_PARTY_NOTICES.md`
- Create: dependency ADR under `docs/skins/`.

**Requirements:**

1. Read Next 16 Route Handler/cookies docs before RED.
2. RED service tests for create/read/list/revise/fork, duplicate names, unauthorized
   revise, immutable history, soft delete, payload/name limits and content hashes.
3. Repository interface + memory test repository; PostgreSQL implementation uses
   parameterized SQL and transactions. Add one pinned minimal PostgreSQL driver only.
4. Anonymous owner uses random secret cookie; DB stores only a slow/constant-time
   comparable hash. Cookie is HttpOnly, Secure in production, SameSite=Lax.
5. Presets use UUID + unguessable slug; default `unlisted`; global duplicate names
   allowed; revisions immutable; fork records source.
6. Validate allowlisted preset envelope before DB. No raw CSS/code/URL.
7. Database is internal-only with persistent volume and healthcheck; no real secret in
   repository. Migration is idempotent and deployment fails closed without password.
8. Focused tests, miniapp suite, typecheck and build.

## Task 5: Серверная библиотека в Lab, partial copy и итоговые gates

**Files:**
- Create: `apps/miniapp/src/mono-preview/mono-preset-library.tsx`
- Create: `apps/miniapp/src/mono-preview/mono-preset-library.css`
- Create: `apps/miniapp/src/mono-preview/mono-preset-library.test.tsx`
- Create: typed client module and tests.
- Modify: `mono-color-lab.tsx`, `mono-preview.tsx`, workbench CSS and E2E specs.
- Modify: `docs/skins/README.md`, `docs/skins/lab-workflow.md`,
  `docs/deployment/README.md`.

**Requirements:**

1. RED tests for remote save, own revise, read-by-link, fork, and partial Dark/Light/
   palette/background/glass copy with preview diff and lock preservation.
2. Preset card shows Dark/Light strips, name, visibility, revision and source.
3. Save offers new vs new revision. Opening чужой preset never grants overwrite;
   editing it requires Fork.
4. Network failure leaves workspace intact and offers local JSON fallback.
5. No save on slider drag. Explicit Save only; successful response reconciles IDs/hash.
6. Add rate-limit-ready error handling and accessible busy/error/success states.
7. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and relevant E2E.
8. Final manual visual audit on Dark/Light, all five harmonies and four viewports; do
   not update screenshots merely to silence differences.

