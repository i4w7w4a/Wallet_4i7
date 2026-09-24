# BG-2 · Silk

Material through light on three procedural fabric layers; **not a cloth simulation**.

## Pinned source

- Project: [Radiant / Silk Cascade](https://github.com/pbakaus/radiant).
- Commit: `59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40`.
- Source: [`static/silk-cascade.html`](https://github.com/pbakaus/radiant/blob/59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40/static/silk-cascade.html).
- Git blob: `70741edbdff44f8d9af20a25d82be8fdb53ce2f5` (downloaded bytes checked with `git hash-object`).
- License: MIT, Copyright (c) 2025 Paul Bakaus. Full upstream text is preserved in [LICENSE](./LICENSE).
- Source and license read in full before adaptation. No demo assets or runtime dependencies are copied. No upstream install commands executed.

## Preserved mechanism

Three back-to-front layers with domain-warped sine folds, cheaper two-octave noise
on the deepest layer, fold-derived normals, two directional lights, Kajiya–Kay
anisotropic sheen, translucent highlights, sparse sparkle, layered colour
mixing, vignette, ACES tone mapping, gamma and film grain. No SVG/CSS substitution.

`SILK_BASELINE`, seed `0`, uses the original `.4` flow / `1` sheen, original palette,
fold scale `1` and light width `1`. It is a mechanical comparison preset, not a
promise of identical pixels across GPUs or of upstream wall-clock timing.

## Local changes

- Fragment math is adapted to OGL on the host's existing context and an owned RGBA8
  render target. The compositor alone writes the default framebuffer.
- No demo page/UI, remote textures, Svelte, storage, listeners, observers, context
  creation or scheduling in the adapter. Host activity and accessibility guards
  remain authoritative.
- Flow phase integrates host `dt`, so speed edits preserve the current folds.
  Seeded restart selects a bounded deterministic initial phase; seed zero is the
  original phase. Pause/resume with zero `dt` does not advance it.
- Pointer UV and light influence use exponential response in seconds (position
  `.12s`, entry `.16s`, exit `.32s`). Leaving blends to the autonomous light;
  re-entry retains the current state. This replaces the upstream abrupt sentinel.
- `foldScale` multiplies the fabric coordinate, keeping background/vignette
  geometry fixed. `lightWidth` scales anisotropic shininess, keeping amplitude
  separately controlled by `sheenIntensity`.
- `radiant` preserves the original palette. `graphite` and `champagne` are local
  restrained layer tints. The baseline and two prepared variants remain distinct;
  none is an owner-approved product preset.
- Full recipes use one strict schema. Missing, unknown, nonfinite, out-of-bounds
  fields or unknown palette IDs are rejected atomically; defaults are never used
  to fill an imported partial recipe. Control step does not quantize saved values.

## Scope

Only `packages/ui/src/background-sandbox/effects/silk/**`. Shared ABI, registry,
exports, compositor, UI, general notices and product presets belong to ORACLE.
Live GPU evidence and final resource/lifecycle details are recorded in the handoff
after the agreed host contract is available.
