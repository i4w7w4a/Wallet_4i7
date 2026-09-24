# BG-2 shader proof

This is a test host, not a runtime export or a second editor. It creates the one
context borrowed by the actual `silkDefinition`, steps frames manually and uses
a separate host compositor. No Next app route, build, persistence or RAF.

Coordinate the GPU/browser slot and port **3143** with ORACLE before running.
The runner binds only `127.0.0.1`, refuses an occupied port and closes its Chromium
and HTTP server in `finally`. It uses existing root TypeScript and miniapp
Playwright dev dependencies; no package/lockfile changes or installation.

1. Save the [pinned upstream HTML](https://raw.githubusercontent.com/pbakaus/radiant/59e9f48c0ad9a3db2fbeb8898b4390d5a1eabb40/static/silk-cascade.html) outside the repo. Set `SILK_UPSTREAM_FILE` to that path. The default is `%TEMP%/novex-silk-b374/silk-cascade.html`.
2. From the repository root, run `node packages/ui/src/background-sandbox/effects/silk/qa/run-browser-proof.mjs <new-evidence-directory>`.
3. Inspect the report and three wide / four portrait images. Do not overwrite existing evidence or product visual snapshots.

The runner verifies the exact Git blob `70741edbdff44f8d9af20a25d82be8fdb53ce2f5`
before extracting the GLSL test oracle. It never executes the upstream HTML/JS.
Baseline comparison is on the same browser/context at time zero with no pointer,
with only GLSL 300 syntax adapted for WebGL2. It does not claim portability of
pixel identity to other GPUs.

Assertions cover visible control effects, stable borrowed texture on updates,
frame-rate-independent light at 30/144 fps, zero-dt re-entry, deterministic
restart, unchanged phase across resize, all four mobile widths and desktop,
20 dispose/recreate cycles, six native allocation failures plus recovery on the
same GL, owned uniform-cache cleanup, preservation of a host neighbor texture,
and honest failure on context loss.

Readback intentionally causes Chromium's exact `GPU stall due to ReadPixels`
driver warning. The complete messages are kept in `driverWarnings`; only that
specific warning shape is separated. Any other warning, shader message or page
error fails the run and remains in `consoleErrors`. The first run failed because
it treated these expected readback warnings as runtime errors; see handoff.

Timing uses 4 warmup + 20 frames with a 1-pixel readback fence. It includes the
material, compositor, browser/driver synchronization and readback. SwiftShader
results are **software-path measurements**, not physical device FPS or GPU time.
No physical Telegram/Safari/touch-scroll or common host activity guards are
claimed here; those belong to ORACLE's host and integration proof.
