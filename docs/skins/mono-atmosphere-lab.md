# MONO atmosphere / experiment 01

Local visual candidates, 2026-09-24. Base: `fee1b918ddf1b8a2fb86e105301eebc307488c54`.
Owner review is pending. These recipes do not replace the public MONO background.

## Visual decision

Object: one decorative background behind a 320–480 CSS px mobile scene. Content
remains readable, selectable DOM. The pointer moves light/material planes; it
does not move the logo, financial text, action hit targets, or the Promo lens.

| Candidate | Preserved mechanics | Adaptation / visible loss |
| --- | --- | --- |
| Baseline / Iris | The existing `mono-atmosphere.css` and `mono-environment.css` focus, ribbon, grid and iridescence; 11/7 px travel | Same source CSS/markup, in a bounded surface instead of a fixed viewport. Arrival animation is suppressed for stable A/B. This is only Iris, not a migration of Tide or Strata. |
| Obsidian | Broad directional folds, dark troughs, a narrow material contour, depth from opposing displacement | Original SVG paths and gradients; two finite CSS transforms. No simulated fabric, evolving shader noise, pixel displacement, or true fluid motion. |
| Aperture / Световой разрез | Directional light from above, broad light plane, thin edge, a distinct crossing shadow | Original deterministic vector planes; pointer changes a bounded angle/position. No randomly generated rays, breathing loop, blur animation, or physical volumetric scattering. |

Moderate defaults are around 60% intensity and 50% pointer response. Full
intensity shows the complete material; zero leaves an opaque neutral base.
Light uses a warm ceramic base and graphite text. Color is restrained and has
no financial meaning. This is **SVG/DOM/CSS light**, not shader refraction.
The only real refraction belongs to the existing approved Promo backend.

## Primary source research

These entries were selected from the project's source catalog. Full pinned
source and license files were read before implementation. No upstream code,
shader expressions, textures, assets, layout, or typography were copied.

| Reference | Exact source and license | Runtime observed / decision |
| --- | --- | --- |
| React Bits Silk | [`Silk.tsx`](https://github.com/DavidHDev/react-bits/blob/3a1c7f2f9f94ed833934ab5c2635760b9e644583/src/ts-default/Backgrounds/Silk/Silk.tsx), commit `3a1c7f2f9f94ed833934ab5c2635760b9e644583`; [`LICENSE.md`](https://github.com/DavidHDev/react-bits/blob/3a1c7f2f9f94ed833934ab5c2635760b9e644583/LICENSE.md), copyright 2026 David Haz, MIT + Commons Clause | React, Three.js, `@react-three/fiber`, `Canvas frameloop="always"`, per-frame shader time. Rejected as a runtime beside Promo. Only fold/light direction informs Obsidian. |
| Magic UI Light Rays | [`light-rays.tsx`](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/light-rays.tsx), commit `d7207e5692d14c00dceafa8488d6d01f197fa0e4`; [`LICENSE.md`](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/LICENSE.md), MIT, copyright Magic UI | React, `motion/react`, `cn`, Tailwind; random ray geometry, screen blend, blur and infinite Motion repeats. Replaced by fixed original geometry and finite pointer response. |
| Motion Primitives Spotlight | [`spotlight.tsx`](https://github.com/ibelick/motion-primitives/blob/43a31886f505c0cd0f11887683cfb9ff36431f9c/components/core/spotlight.tsx), commit `43a31886f505c0cd0f11887683cfb9ff36431f9c`; [`LICENCE.md`](https://github.com/ibelick/motion-primitives/blob/43a31886f505c0cd0f11887683cfb9ff36431f9c/LICENCE.md), MIT, copyright 2024 ibelick | React, Motion springs/transforms, `cn`, parent mouse listeners and parent style mutation. Kept only the local bounded pointer relation. No moving halo or parent style mutation is carried into the new recipes. |

React Bits' license does not grant selling/sublicensing/redistributing its
components, including bundles or ports. MIT references require notices when
copying their Software or substantial portions. Here the implementation is
original, so no new vendored-code notice is added. This research is not blanket
permission to resell a framework or a skin pack. Re-evaluate provenance if code
or assets are imported later. Global source catalog/notices are owned by ORACLE.

## Integration contract

`src/mono-preview/mono-background-recipes.ts` is the sole source of defaults,
bounds, normalization and strict import. `MonoBackgroundRecipeConfig` contains:

```ts
{
  version: 1;
  recipe: "baseline" | "obsidian" | "aperture";
  intensity: number;       // 0..1
  speed: number;           // 0..1, finite settling speed; UI label: Отклик
  pointerResponse: number; // 0..1
  character: "fluid" | "precise";
  calm: boolean;
}
```

- `MONO_BACKGROUND_DEFAULTS` is keyed by recipe.
- `normalizeMonoBackgroundRecipe(unknown)` recovers/clamps local draft data.
- `parseMonoBackgroundRecipe(json)` rejects unknown/missing fields, future
  versions, malformed or >4096-character JSON, and out-of-range values atomically.
- `MonoBackgroundRecipes` in `mono-background-recipes-view.tsx` receives
  `config`, `surfaceRef`, `theme`, `active`, `hostActive`, `effectsDisabled`.
  The surface must contain the layer, have a layout box, and establish positioning.
  Render content in a higher sibling layer. Pass real runtime activity from the
  host; runtime gates are not stored in a preset.
- Mount this layer **instead of**, never together with, the legacy atmosphere.
- Shared envelope `appearance.background: MonoBackgroundRecipeConfig | null`:
  `null` means render the unchanged `environment.background=iris|tide|strata`.
  Migration must preserve all three legacy values. Baseline does not map them.
- The dev-only `/design-lab/atmosphere` exports `MonoAtmosphereLab` with an optional
  `renderScene({config, theme, width})` slot for the single shared `MonoScene`.
  There is no duplicate wallet renderer in this experiment.

## Lifecycle and storage

No RAF, interval, timeout, canvas, GPU context, imported animation runtime,
random generation, or added dependency. At most two material planes respond
to a mouse. SVG geometry is fixed and authored locally; all motion uses
finite transform transitions. Pointer samples write decorative CSS variables,
never React state or content layout. No permanent `will-change`.

Reduced motion, coarse pointer, calm, saveData, hidden document, host inactivity,
inactive scene and offscreen state stop tracking and settle immediately to the
static composition. Inactive/calm/effects-off mount acquires no listeners or
observers. Active scene owns one IntersectionObserver and preference/visibility
listeners; cleanup removes them all, including in Strict Mode. Forced colors
hides decoration. Effects-off leaves an opaque base. Capability changes do not
rewrite the stored config.

Lab Save writes only `wallet4i7.mono.atmosphere-lab.v1` on explicit action. It
does not write product appearance, working presets, the legacy environment,
optics, logo or palette. A/B renders one layer and does not save. Import is
validated, described, then opened explicitly as a draft. Local drafts are
independent per recipe. Reset and controls support per-recipe undo/redo.

## Validation commands

```text
pnpm --filter @wallet/miniapp exec vitest run src/mono-preview/mono-background-recipes.test.ts src/mono-preview/mono-background-recipes-runtime.test.ts src/design-lab/mono-atmosphere-lab.test.tsx
pnpm --filter @wallet/miniapp exec playwright test -c mono-atmosphere-lab.playwright.config.ts
pnpm typecheck
pnpm lint
pnpm build
```

The dedicated browser config uses `http://localhost:3136`, the dev server's
canonical hostname. On this Next version `127.0.0.1` may block dev resources
unless separately configured; do not confuse an SSR-only display with a working
interactive Lab. Screenshots are written to ignored test-results; no unrelated
visual baselines are updated.
