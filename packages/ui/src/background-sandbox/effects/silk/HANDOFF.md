# BG-2 SILK · локальный handoff

Дата: 2026-09-24. Implementation candidate; visual approval / product integration / deploy не выполнялись. GitHub Issue не назначен.

- Branch: `codex/mono-background-sandbox-silk`.
- Worktree: `C:/Users/iwwa/.codex/worktrees/b374/5-wallet-foundation`.
- Product base: `fa7d6c1ff65a6505100f809c894aca9dc9851eb4`.
- Docs/base SHA: `6c9e46d045ea9444e273d5feabf85d5431c632f4`.
- Canonical ABI: `3be0cb7355e8e271f6fd9772eea5ce5f5fc7bae7`, safely cherry-picked as `4b72c4eaeebffcc5768beb7d442646593dd04f6c`; shared files не редактировались SILK.
- Exact tested runtime/QA HEAD: `3a85e9296458840afe2e708cc2bff821e365bfea`. Этот handoff — единственное последующее изменение; final clean HEAD сообщён ORACLE и координатору в задаче.

Effect-only cherry-pick order (ABI повторно не брать):

1. `8e741b2a4ac576fc9d8bbc770f400ee512d0dcda` — strict schema, continuous motion, MIT/provenance.
2. `4a59eff6abf18ada78297c503c355df5689be548` — shader/OGL adapter/definition/tests/probe.
3. `73c6ba7a18a4d08afef28bed0d84b84d87673693` — exact baseline oracle, honest fenced timing, warning classification; champagne sheen aligned to schema step `.9`.
4. `3a85e9296458840afe2e708cc2bff821e365bfea` — inherited-scissor regression/fix.
5. Handoff-only descendant — optional for runtime, exact SHA supplied with final task message.

Export: `silkDefinition` from `effects/silk/definition.ts`; concrete `SilkParams` from `effects/silk/schema.ts`. Five controls, defaults and strict parser share one schema. Three presets: `graphite`, `champagne`, `radiant-baseline`, each seed `0`. Registry / public exports belong to ORACLE.

## Exact owned files

All below `packages/ui/src/background-sandbox/effects/silk/`:

`adapter.ts`, `allocation.ts`, `allocation.test.ts`, `definition.ts`, `motion.ts`,
`motion.test.ts`, `schema.ts`, `schema.test.ts`, `shaders.ts`, `target.ts`,
`target.test.ts`, `LICENSE`, `PROVENANCE.md`, `HANDOFF.md`, `qa/README.md`,
`qa/probe.mjs`, `qa/run-browser-proof.mjs`.

## Checks and evidence

On the tree committed as `3a85e9296458840afe2e708cc2bff821e365bfea`:

- `pnpm --filter @wallet/ui exec vitest run src/background-sandbox/effects/silk` — **16/16**, exit `0`; schema/motion/budget/allocation tests were observed RED before implementation.
- `pnpm --filter @wallet/ui typecheck` — exit `0`.
- `pnpm exec eslint packages/ui/src/background-sandbox/effects/silk --max-warnings 0` — exit `0`.
- `git diff --check` — exit `0` (Git CRLF notices are not lint findings).
- `node packages/ui/src/background-sandbox/effects/silk/qa/run-browser-proof.mjs C:/Users/iwwa/.codex/visualizations/2026/09/24/01a0d217-15d5-7150-a006-bdde054e912e/silk-final` — **exit `0`**, exact clean SHA above recorded in `report.json`, `diff: ""`.

Evidence directory: `C:/Users/iwwa/.codex/visualizations/2026/09/24/01a0d217-15d5-7150-a006-bdde054e912e/silk-final/`.

Files: `report.json`; `radiant-baseline-1280.png`, `graphite-1280.png`, `champagne-1280.png`; `graphite-320.png`, `graphite-390.png`, `graphite-430.png`, `graphite-480.png`. Images visually inspected. No product snapshots changed.

GPU assertions: all five controls alter output; updates retain target/resources; 30/144 fps final light delta `0`; zero-dt re-entry delta `0`; reset(seed) deterministic; resize preserves phase and deletes previous texture; 20 create/render/dispose cycles keep resource and uniform-cache counts stable; six partial native allocation failures clean up and permit repeat create on the same context; host neighbor texture survives. One canvas, no adapter RAF. Context loss yields honest create/render failure.

Pinned baseline comparison: original blob `70741edbdff44f8d9af20a25d82be8fdb53ce2f5`, same WebGL2 context, `time=0`, no pointer, mean byte delta **0**. Not a cross-GPU identity promise.

Scissor RED: incoming host scissor `0×0` caused mean byte delta `108.8925078125` before fix (exit `1`, PID `15976`). GREEN: delta `0` after `renderer.disable(SCISSOR_TEST)`, without raw render-state bypass.

## Warnings, timing, budget

Final `consoleErrors=[]`. Exactly four intentional readback driver warnings are retained verbatim in `report.json`: three times

`[.WebGL-0x79c00b16400]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels`

and once that exact line plus ` (this message will no longer repeat)`. Only this anchored warning shape is classified separately. Other shader/runtime/page errors or warnings still fail the runner. The first probe on `4a59eff` exited `1` solely because it classified the same four readback warnings as runtime errors; its untouched raw report/screenshots remain in `C:/Users/iwwa/AppData/Local/Temp/novex-silk-b374-proof/`.

Renderer: **ANGLE Vulkan SwiftShader (software)**. At `640×400`, material + compositor + 1px readback fence, 4 warmup + 20 samples: median **50.5 ms**, p95 **53.6 ms**. This does not establish a hardware/mobile FPS budget; the earlier `gl.finish`-only `.4ms` submission measurement is superseded.

One RGBA8 target, one material pass, no float extension or texture assets. At physical `1280×720`: **3,686,400 bytes**; at `390×640`: **998,400 bytes**. Diagnostics count effect targets only; QA total counts also include its compositor and host-owned neighbor fixture. Oversize requests fail before allocation, not through silent quality loss. Resize releases before reallocating, avoiding a double-sized peak.

## Preserved / changed / remaining boundary

The three domain-warped fold layers, normals, directional Kajiya–Kay sheen, translucent light, sparkle, grain, ACES/gamma and back-to-front composition are preserved. This is light on procedural fabric, **not cloth simulation**. Full source pin/MIT notice and exact changes are in `PROVENANCE.md` / `LICENSE`.

Changed: OGL/FBO lifecycle under host; integrated flow phase; bounded seeded reset; exponential pointer coordinates/influence in seconds; fold frequency, sheen width and two restrained palettes. Output is opaque and display-ready (gamma already applied), bottom-left UV; borrowed until resize/dispose. No new Renderer/canvas/RAF/listeners/storage in adapter. The separate `qa` host is never imported by runtime.

Common host scheduling/guards, actual pointer event collection/touch-scroll, Strict Mode, context restoration, Save/Open/A-B UI, MONO/Promo fitting and physical mobile/Telegram/Safari are **not certified by this isolated probe**. ORACLE owns those integration checks. Final probe PID `31632`, browser and port `3143` were closed and independently checked absent. No preview server is left running; the common owner-facing URL belongs to ORACLE.
