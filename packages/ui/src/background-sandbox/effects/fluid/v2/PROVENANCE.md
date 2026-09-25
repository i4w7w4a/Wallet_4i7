# Pavel Fluid v2 — local material adaptation

Source: Pavel Dobryakov, [WebGL Fluid Simulation `script.js`](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/a2d292931f19d9b3b9f564e23e6c32729d2121c3/script.js), commit `a2d292931f19d9b3b9f564e23e6c32729d2121c3`, verified Git blob `d0db5af6bac342d9eb00205435d8b8997ebee815`. MIT, Copyright (c) 2017 Pavel Dobryakov; complete source notice is `../LICENSE.upstream`. The source and license were read in full. No demo image, GUI, ads or analytics are imported.

The existing `../` effect is the untouched v1 adapter and old five-field recipe. V2 is a separate `novex-material` recipe with `effectVersion: 2`; reading v1 never silently normalizes it to v2. The new pass imports the v1 shader strings for velocity splat, curl, vorticity, divergence, pressure decay, 20 Jacobi iterations (12 only in explicit economy runtime quality), pressure-gradient subtraction and clear. The same semi-Lagrangian advection formula transports velocity and two dye banks. Six RGBA16F pigment channels replace three curated dye weights so every user swatch edits the existing field immediately.

## Source control accounting

| Source control or behavior | V2 treatment |
| --- | --- |
| Velocity/density dissipation 0–4 | Independent `velocityDissipation` and `dyeDissipation`; source rational decay `1/(1 + rate·dt)`. |
| Pressure 0–1, curl 0–50, radius .01–1, splat force | Separate `pressureRetention`, `curl`, `radius`, `force`, with source ranges and explicit saved values. |
| Shading | Toggle retains source gradient-based light response, now from six-channel pigment mass. |
| Colorful/color update speed | Editable list of 1–6 `#RRGGBB` swatches and `colorCycleRate` 0–10/s. A zero rate holds palette; positive rate interpolates on simulation time. New `colorAlpha` and `backgroundAlpha` produce premultiplied transparent output. |
| Background color/transparency | Editable `backgroundColor` and `backgroundAlpha`, not an external asset. |
| Bloom/intensity/threshold | Optional six-level RGBA16F prefilter/downsample plus live `bloomIntensity`/`bloomThreshold`; source soft knee .7. Unlike source's additive upsample, levels are weighted in display so `EXT_float_blend` is not required. This changes halo breadth and is stated openly. |
| Sunrays/weight | Optional R16F mask, 16-sample radial shader and two blur passes. `sunraysWeight` is active only when enabled. |
| Pause | Host stops active clock/render scheduling; `timeScale=0` separately freezes solver while parameter edits can still redraw the current field. |
| Random splats command | `seeded-splats` transient action adds 1–6 counter-addressed impulses to the existing field. Queue ≤12, work ≤4 splats/frame including drag. It is not Reset and is not serialized. |
| Autonomous start and live mode | Six deterministic startup splats on Restart. New explicit `draw/ambient` mode: only ambient adds at `ambientRate` .05–2/s, with bounded deterministic positions and forces. |
| Sim/dye/capture resolution, pressure iterations, bloom/sunrays resolution/iterations | Runtime economy/balanced/detail policy only. 20 targets and their attachment bytes are planned before GPU allocation; max 28 MiB local cap within the host's 32 MiB envelope and Promo reserve. Capture belongs to host/export, not recipe. |
| Dat.GUI, screenshot button, ads/analytics, `LDR_LLL1_0.png` | Omitted. Demo texture rights are unestablished; original static procedural dither is used. |
| Mouse/touch listener and `preventDefault` | Omitted. Host collects bounded pointer samples; coarse touch keeps scroll. |

Fluid v2 owns no renderer, canvas, RAF, listener, timer, storage or wallet data. It uses the single host OGL/WebGL2 context and borrowed premultiplied `display-srgb` RGBA8 output. Native GL is used only for capability/FBO/link checks and deletion of the pass's own resources; OGL owns draw state. Background/Promo coexistence, shader compilation, real GPU cost, physical Telegram/Safari and visual approval require the shared preview. A SwiftShader screenshot alone cannot prove hardware performance.

The saved recipe contains the full artistic params and seed, never GPU pixels or gesture history. Restart, context restoration and a host-authorized resize may start a new field. Update of a slider only changes values/uniforms. `frame.dt` is capped at 1/30s before `timeScale`; there is no catch-up spiral, so under 30fps simulated time advances slower than wall/host time. With positive dt the solver still costs its passes after dye becomes visually faint; this is not an automatic idle-stop mode.
