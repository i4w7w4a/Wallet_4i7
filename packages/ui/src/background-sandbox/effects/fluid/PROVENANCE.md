# BG-3 Fluid — source and adaptation

Original: [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/tree/a2d292931f19d9b3b9f564e23e6c32729d2121c3).
`script.js` at commit `a2d292931f19d9b3b9f564e23e6c32729d2121c3`, Git blob
`d0db5af6bac342d9eb00205435d8b8997ebee815` (downloaded bytes verified with `git hash-object`).
The complete source and license were read before adaptation. MIT, Copyright (c)
2017 Pavel Dobryakov; full notice in `LICENSE.upstream` beside the adapter.

Preserved: Eulerian velocity/dye fields, semi-Lagrangian advection, reflective
divergence boundaries, curl/vorticity confinement, pressure decay, twenty Jacobi
pressure iterations, pressure-gradient subtraction, Gaussian splats and inertia.
Twenty-seven solver passes per step, plus display and two passes per splat.

Adapted: host-owned OGL/WebGL2 passes and scheduling; bounded finite drag input;
seeded six-splat reset; curated palettes applied to transported dye channels;
strict five-field parameter schema; bounded allocation independent of persisted
params; explicit disposal. Time is seconds from the host. No downloaded runtime.

Omitted: demo UI, dat.gui, ads, analytics, screenshots, random rainbow, autonomous
RAF/listeners, touch `preventDefault`, bloom and sunrays. Display uses an original
procedural dither, never upstream `LDR_LLL1_0.png` (rights not established).
Without bloom/sunrays, luminous halos and radial scattering differ from the demo.

Reset, resize, opening a recipe and A/B start a new field from the saved seed.
JSON stores parameters, not pixels or gesture history. Reproducible initialization
does not promise identical floating-point pixels across GPUs. No user visual
approval or product integration is implied by this local candidate.
