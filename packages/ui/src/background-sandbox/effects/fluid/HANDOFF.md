# BG-3 FLUID — local handoff, 2026-09-24

Functional candidate; **hardware performance and product visual approval remain unproven**.
No Issue number exists. Branch `codex/mono-background-sandbox-fluid`.
Worktree `C:/Users/iwwa/.codex/worktrees/0a8a/5-wallet-foundation`.
Docs base `6c9e46d045ea9444e273d5feabf85d5431c632f4`;
exact imported ABI `3be0cb7355e8e271f6fd9772eea5ce5f5fc7bae7`;
runtime implementation/evidence source `3213a7f68be1a5d692a76258e25141f408c2d6e4`.
Evidence checkpoint `c1786cb26e31e3d53e88862876a331166eec3ceb` adds this handoff,
captured evidence and the test runner's touch check/readback-warning classification.
The follow-up on that checkpoint changes only descriptions in `index.ts`,
`schema.ts`, `PROVENANCE.md` and this handoff. Solver, parameter keys, numeric
semantics and saved values are unchanged; no GPU/browser session was started.
The final complete HEAD is sent directly to ORACLE and ORCHESTR WALL.

Import `fluidDefinition` from `effects/fluid/index.ts` into ORACLE's registry.
All adapter imports use the actual `../../contracts`; no shared files were authored here.
Changed files are exclusively below `packages/ui/src/background-sandbox/effects/fluid/`:
`adapter.ts`, `index.ts`, `input.ts`, `quality.ts`, `schema.ts`, `seed.ts`, `shaders.ts`,
their five `*.test.ts` files, `LICENSE.upstream`, `PROVENANCE.md`, this handoff,
and test-only `probe/{index.html,fixture.ts,run.mjs,evidence/*}`.
The probe host must never be imported by the product or runtime registry.

## Preserved mechanics and intentional changes

Pavel's real velocity/dye advection, curl/confinement, divergence, pressure decay,
20 Jacobi iterations and pressure-gradient subtraction remain. The 27-pass solver
continues after release. Gaussian impulses are bounded; no flowmap substitution.
Source/MIT were read fully; `script.js` blob verified as
`d0db5af6bac342d9eb00205435d8b8997ebee815`. Full notice is adjacent.

Five params: force/radius/curl/dissipation/palette. Palette affects transported
pigment channels immediately. Six seeded reset splats replace random startup;
curated palettes replace rainbow. Pressure retention uses seconds. Dye decay is
fixed at 0.7/s in the upstream rational decay form. Shading is retained, palette
mapping/tone compression and procedural dither are adaptations. Bloom/sunrays,
GUI/ads/analytics and the unlicensed dithering image are omitted.

User-facing meaning: «Рисование жидкостью: след движется и постепенно исчезает.
Перезапуск возвращает начальные всплески». There is no continuous dye source:
the six startup splats occur once, then only accepted drag adds color. The
«Затухание течения» control changes velocity decay; color lifetime remains fixed.
For dye, `D_next = advect(D) / (1 + 0.7 * dt)` (`shaders.ts:112`,
`adapter.ts:159`). At a 1/60 s step the decay-only concentration multiplier after
10/30/60 integrated seconds is approximately `9.496e-4 / 8.563e-10 / 7.332e-19`;
these are analytical values, not GPU pixel measurements. Visible color fades to
the dark base; this implementation does not promise a continuous ambient effect.

Integrated time is `sum(clamp(frame.dt, 0, 1/30))`, not `frame.time`
(`adapter.ts:175`); there are no catch-up steps. Below 30 fps it progresses slower
than real active time. At 12–15 fps, ten real seconds integrate only about 4–5
seconds, leaving roughly 6.3–3.1% in the decay-only estimate. No idle stop occurs
when the color becomes invisible: positive dt continues to cost 28 passes/frame.
Pause and host activity guards must stop scheduling; parameter updates do not
replenish color. No emitter, ambient mode or solver change is part of this follow-up.

The adapter owns no Renderer/canvas/RAF/listeners/storage. Native GL calls only
query capability/completeness/link status or delete owned resources. OGL cache
entries for deleted textures/program uniforms are removed; other owners' entries
remain. Output is borrowed RGBA8 texture, owned until resize/dispose. Update does
not draw, allocate or reset. Resize disposes before reallocation and resets the
field. Context restoration requires the host to create a fresh adapter. Host
owns reduced-motion/visibility/offscreen/saveData/active scheduling and touch policy.
Touch probe uses passive listeners and `touch-action:auto`; no hover adaptation.

## Verification and measured limits

Runtime at `3213a7f`: focused Vitest **16/16**, `@wallet/ui typecheck`, focused ESLint
and `git diff --check` pass. The final runner/evidence changes were typechecked
and linted again. No full app build/E2E was run; that gate belongs to ORACLE.
Metadata-only follow-up: existing schema tests **3/3**, focused ESLint on
`index.ts`/`schema.ts` and `git diff --check` pass. No new GPU measurements.

`probe/evidence/results.json` is the measurement record. Bundled Playwright
Chromium selected **ANGLE Vulkan SwiftShader (software)**; timer query unavailable.
Sixty measured frames after ten warmups per viewport, no readPixels inside the
timed rendering loop. CPU values measure command submission, not GPU completion.

| CSS viewport / DPR | Color attachment bytes | CPU p50 / p95 | Frame interval p50 / p95 |
| --- | ---: | ---: | ---: |
| 390×844 / 1.5 | 5,387,272 | 0.3 / 0.5 ms | 66.6 / 66.8 ms |
| 1440×900 / 1 | 6,289,820 | 0.3 / 0.8 ms | 83.3 / 100 ms |

9 targets: velocity RG16F×2, scalar R16F×4, dye RGBA16F×2, display RGBA8.
Maximum color storage 8 MiB, excluding driver overhead; output ≤1,048,576 pixels,
simulation ≤256 long edge, dye ≤512 long edge. Host memory/texture limits can
reduce allocation further; these values are never persisted artistic controls.
28 passes for active simulation without gestures, 30 for one splat, ≤36 for a
gesture frame, 22 for initial seeded dt=0 reset, 0 for unchanged subsequent dt=0.
**Idle dt>0 still costs 28 passes.** Hardware 60fps is not established. Do not
block Silk or advertise Fluid as performance-approved on this evidence.

GPU checks pass: all five controls change pixels; same-seed replay on this GPU;
no allocation during updates; default framebuffer stays unchanged by adapter;
post-release dye centroid moves (0.4321→0.3997 horizontally over 45 steps), not
only brightness; bounded re-entry/cancel; native emulated touch scroll 345px;
320/390/430/480 resizing; injected third-FBO failure cleans partial allocations;
six mount/dispose cycles plus repeated dispose leave zero effect textures/FBOs/
programs/shaders/buffers/VAOs and only the host's uniform cache entry;
WEBGL_lose_context restoration creates a valid seeded effect. GL errors: zero.
Four driver ReadPixels stall warnings come from test capture and are preserved
in the report; shader/runtime console errors: zero.

`fluid-desktop.png` shows the field after 25 steps at 960×640; `fluid-portrait.png`
shows the deterministic restart at 480×844. These are technical probe captures,
not approved visual baselines. Their text panel is the last Open diagnostic;
use `results.json` for current per-viewport measurements, not that stale panel.
Physical Telegram/Safari, hardware GPU timing, shell Save/Open/A-B and shared
Promo coexistence are not claimed by this isolated probe.

Probe used `http://127.0.0.1:3143/`, Vite PID 10736. Browser closed, server stopped,
and a follow-up port check found no listener; GPU/3143 returned to ORACLE/SILK.
No live preview is being promised. Existing snapshots, user storage, 3120,
package manifests/lockfile, app/release/server and other worktrees are unchanged.

To reproduce after a newly agreed GPU slot, from the worktree root run the
installed Vite `node_modules/.pnpm/vite@8.3.0_*/node_modules/vite/bin/vite.js`
with `packages/ui/src/background-sandbox/effects/fluid/probe --host 127.0.0.1
--port 3143 --strictPort`, then `node packages/ui/src/background-sandbox/effects/fluid/probe/run.mjs`.
