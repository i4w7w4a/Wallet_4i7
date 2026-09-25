# Vault Grid · M4 handoff

Base packet: `e33b3e75d41a30f6c34bd526caf856754afdcae5` (cumulative `72742382d1354fe70dde86d90159a997b672ba9a`). ABI source: ORACLE `93d6bc26e67f009fa38dfaddd600c4f84d65900f` (locally cherry-picked as `bfa04826c5ba41ab919b3b4cf171fac23222140e`). This directory is the entire M4 edit scope. Integration registry, compositor, routes and product defaults belong to ORACLE.

## Source and mechanism

Original Novex shader; no upstream shader, image, logo, copied brand, package or runtime asset. Existing repository OGL/WebGL2 and its tested `silk/allocation.ts` construction rollback helper are reused. The latter is an internal code dependency; if it moves, update the import. `provenance` points to the local shader and declares this origin.

One GLSL300 fullscreen triangle draws an opaque sRGB RGBA8 texture. The host masks a button fill and keeps its DOM label, focus ring and hit target. The shader uses CSS-pixel coordinates, so cells remain square at varying aspect/DPR. It evaluates a height profile and four offset samples for a relief normal, then diffuse/specular light with editable roughness and restrained fixed grain. The three modes have different actual profiles:

- `tile`: separated square plates, beveled shoulder and broad raised face;
- `rib`: raised horizontal/vertical bars at grid lines;
- `engraved`: recessed thin cut with a shallow lip on a broad metal plane.

Presets are full, distinct parameter sets: neutral graphite plates, brushed steel ribs, warm etched alloy. The two colors are editable canonical `#RRGGBB`, not a three-choice palette. No rigid-body simulation is claimed. Geometry never drifts; only light can turn at `−0.05…+0.05 rad/s`, including exact zero. Pause uses the host active `dt`, not a reduced frame rate.

## Typed contract and controls

`vaultGridDefinition` is `MaterialDefinition<"vault-grid", VaultGridParams, null>`, ABI 2, effect version 1. Capabilities: `background` and `button-fill` only. No icon/border or external mask asset. Twelve complete scalar/select/color controls are grouped as surface, light, color and motion. Bounds and defaults are defined once in `schema.ts`; strict parse rejects unknown/missing/accessor fields, invalid/nonfinite numbers, unknown patterns and non-HEX colors. Parse canonicalizes hex case. Existing v1 recipes are untouched.

`plan` charges exactly `geometry.pixelWidth × geometry.pixelHeight × 4` attachment bytes, zero auxiliary texture bytes and one pass. It checks host budget and texture dimension before allocation. `create` checks the supplied plan again and checks the real GPU max texture size. RGBA8 needs no float extension. `update` changes uniforms without allocation or phase reset; `resize` releases the previous FBO before allocating the next; `reset` resets light phase and seeded fixed grain; `dispose` is idempotent and deletes owned FBO, shaders, program and geometry. No canvas, Renderer, RAF, timer, observer, storage or pointer listener is created here.

At 390×844 CSS px and DPR 1.5, target storage is 2,962,440 bytes. A 120×48 CSS px button fill at DPR 1.5 is 51,840 bytes. Driver overhead and shared compositor/Promo buffers are outside these counts and belong to ORACLE's total 32 MiB gate.

## Checks and limits

Focused Vitest covers strict recipe parsing and independent presets, all exposed controls, bounded plan/capabilities, phase continuity including negative wrap, RGB conversion and early adapter rejection before GPU access. `@wallet/ui` typecheck and scoped ESLint pass. No WebGL2 compile, hardware/mobile FPS, visual approval or live button/compositor proof has been claimed: the owner reserved one shared GPU/preview slot for ORACLE after integration. The fallback is an explicit static graphite surface, not a CSS imitation of the running material.
