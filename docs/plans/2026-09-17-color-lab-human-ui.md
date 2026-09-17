# Human Color Lab — implementation plan

Status: approved for implementation by the owner on 2026-09-17.
Authority: `docs/skins/palette-lab-v1.md`, `docs/skins/lab-workflow.md`,
`docs/skins/mono-ledger-v1.md`, and the owner's request to replace the current
technical randomization UI with an immediate, understandable design tool.

## Goal

Make the first layer of MONO Color Lab understandable without exposing engine
terminology. A person should be able to choose a color by eye, choose a coherent
character, protect the parts they like, and ask for another complete variant.
The current semantic-role editor remains available as `Точная настройка`.

## Global constraints

- Keep the phone preview clean and keep all editor controls in the existing
  sibling rails.
- Keep OKLCH/OKLab, gamut mapping, contrast validation, Dark/Light branches,
  three slots, history, Apply, local/server presets, and the existing exact
  role editor. Do not create a parallel HEX palette model.
- The quick `Новый вариант` action randomizes a coherent recipe, not independent
  roles. It is deterministic and uses explicit seed/action counter metadata;
  `Math.random()` and `Date.now()` are forbidden.
- A successful randomize is one Undo transaction. Locked roles keep their exact
  resolved values. Protected system roles and focus never change. A no-op/error
  does not spend the action counter.
- Linked Dark/Light themes receive the same character recipe while preserving
  their independent exposure, contrast, and surface response.
- The primary picker edits `anchorHue` and `anchorChroma`; it does not bypass
  normalization or validation. One pointer drag is one history transaction.
- Quick harmonies are `spectral-graphite`, `mineral`, `analog-mist`, and
  `thermal-duet`. `split-prism` remains available only in exact settings.
- Human-facing labels must not expose camelCase role IDs, `seed`, `linked`,
  `offset`, or `manual` in the default view.
- Quick zones are `Основа`, `Акценты`, and `Стекло`. Their locks live beside
  their swatches and use the existing exact role locks; text/system/focus stay
  protected by the engine and validator.
- Controls remain at least 44 CSS px. Motion is precise/heavy/controlled with
  zero overshoot: hover 90 ms, press 80 ms, settle 190 ms, palette settle
  180–240 ms, easing `cubic-bezier(0.2, 0, 0, 1)`.
- `prefers-reduced-motion` removes spatial motion and makes palette changes
  immediate. No new persistent RAF, timer, canvas, WebGL context, dependency,
  remote asset, or font is permitted.
- Preserve the approved Ledger optical JSON exactly. This work changes only
  Palette Lab UX and palette state.
- Follow strict TDD: every behavior test is written and observed failing before
  production code, then observed passing. Tests assert real behavior.
- Preserve unrelated user changes, especially `apps/miniapp/next-env.d.ts`.
- No deployment, push, merge, or server mutation is part of this plan.

## Task 1: coherent recipe variants and quick-zone locks

Add a deterministic high-level recipe randomizer to `@wallet/ui` and wire it to
the workspace. It samples a complete safe character (`anchorHue`,
`anchorChroma`, one of the four quick harmonies, `temperature`, and
`iridescence`), produces a visibly different valid palette, increments the
counter only on success, preserves exact effective locks, and updates both
themes when `linkedThemes` is enabled. Keep the existing role/group/point
randomizer unchanged for exact settings.

Add workspace quick-zone definitions and atomic helpers for:

- `foundation`: `canvas`, `surfaceBase`, `surfaceRaised`, `surfaceOverlay`,
  `borderSubtle`, `borderStrong`;
- `accents`: `accentPrimary`, `accentSecondary`, `chartLine`, `selection`;
- `glass`: `glassTint`, `edgeCool`, `edgeWarm`, `atmosphereCool`,
  `atmosphereWarm`.

The helper reports `unlocked`, `mixed`, `locked`, or `inherited`. A quick-zone
toggle changes the listed point locks in one workspace history transaction.
An inherited exact group lock is not silently cleared by the quick UI.

Files: `packages/ui/src/mono/mono-palette.ts`, its tests and export surface;
`apps/miniapp/src/mono-preview/mono-palette-workspace.ts` and its tests.

## Task 2: accessible OKLCH color field

Create a focused `MonoColorField` client component with a circular visual field.
Angle maps to hue; distance from center maps through a square curve to chroma so
the quiet center has useful precision. Pointer down/move/up updates live and
calls start/end callbacks exactly once per gesture. Standard visible range
controls for `Тон` and `Интенсивность` provide keyboard and assistive-tech access.
The component exposes pure coordinate/value helpers with boundary tests.

The puck uses transform/position only, begins responding within 50 ms, settles
without overshoot, and disables motion under reduced-motion. The component adds
no animation loop.

Files: new `mono-color-field.tsx`, `mono-color-field.css`, and
`mono-color-field.test.tsx` under `apps/miniapp/src/mono-preview/`.

## Task 3: human-first Color Lab integration

Replace the first-layer recipe form with:

- header and current Dark/Light switch;
- `MonoColorField` labelled `Основной цвет`;
- four visual harmony cards labelled `Графит`, `Один тон`, `Дымка`, `Дуэт`;
- one `Цветовой перелив` control;
- three swatch zone cards with adjacent `Не менять …` lock buttons;
- one dominant `Новый вариант` action using Task 1's recipe randomizer;
- compact Undo/Redo and A/B controls;
- a disclosure labelled `Точная настройка` containing technical recipe axes,
  theme linking (human label), seed, reset/apply, and preset/JSON tools.

Rename the exact inspector's role/group/mode/action labels into human Russian,
while retaining all exact capabilities. Internal IDs remain only in serialized
data, not visible labels. Keep import diff, Apply guards, compare guards, local
presets, and remote preset integration intact.

Tests must cover: default view contains the human controls and hides technical
ones; a color-field gesture is one Undo step; harmony cards edit the recipe;
`Новый вариант` is deterministic and undoable; a quick lock preserves its zone;
exact settings still expose point/group controls; Dark/Light memory remains
independent; reduced-motion remains non-spatial.

Files: `mono-color-lab.tsx`, `mono-color-lab.css`,
`mono-color-lab.test.tsx`, and the small tab label in `mono-preview.tsx` if needed.

## Task 4: browser contract and documentation

Update focused Playwright coverage to use the new accessible names and prove:

- the picker and four character cards are usable;
- one coherent variant keeps a single canvas and valid preview;
- zone locks survive a new variant;
- quick UI fits without horizontal overflow at 320/390/430/480;
- reduced motion creates no palette animation.

Update `docs/skins/README.md`, `docs/skins/lab-workflow.md`, and
`docs/skins/palette-lab-v1.md` to distinguish the new human quick layer from
the unchanged exact engine. Record the labels, quick-zone mappings, recipe
randomizer behavior, motion/accessibility behavior, and verification results.

## Final verification

Run focused tests during each task, then once on the final branch:

- `pnpm --filter @wallet/ui test`
- `pnpm --filter @wallet/miniapp test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- focused MONO Palette Playwright specs at minimum; run the broader relevant
  MONO set when time allows.

Visually inspect Dark and Light at 320, 390, 430, and 480 px, normal and reduced
motion, before presenting the result.
