# Paper WebGL2 technical proof

Run only in the shared ORACLE GPU slot:

```powershell
node packages\ui\src\background-sandbox\effects\paper\probe\run.mjs
```

The script starts a local HTTP module server on `127.0.0.1:3147`, creates one headless Chromium browser and one WebGL2 canvas, then closes both in `finally`. It uses the committed adapter and schema, not Paper ShaderMount. The five sequential scenes are Liquid Metal on an 88×79 CSS px quick-action fill and a 21×21 icon, Pulsing Border on the 88×79 frame, and Gem Smoke/Heatmap on the fill. Button text/actions remain DOM in the real workshop; this isolated proof checks the material pass only. Slow material motion changes the appearance of the chosen target without changing its financial meaning. `dt=0` is the static reduced-motion path.

The adaptation preserves Paper's moving metal bands and edge contour, Poisson-derived image interior, Border's rounded contour/colored spots/source noise, Gem's inner/outer smoke and Heatmap's luminance with three blur channels. The authored defaults are calmer than Paper's reference presets; the reference-like variants remain in the definitions. The probe verifies GLSL link and RGBA8 FBO completeness through `create`, visible pixels, premultiplied alpha, paused frames, active motion, a changed color or pattern uniform, no allocation on uniform edit, resize down/up, per-pass resource cleanup, context-loss rejection and a new pass after restoration. `report.json` and five PNGs are technical evidence.

Observed renderer: Chromium ANGLE/Vulkan SwiftShader. ReadPixels in this probe synchronizes the GPU; four driver readback-stall warnings were recorded separately from zero shader/runtime errors. These results are not hardware/mobile performance evidence or visual approval. The actual four buttons, focus/text contrast, layout at 320/390/430/480, compositor clipping and cumulative pass budget are ORACLE's integrated preview checks. Gem's image path remains expensive at roughly 90 texture reads per pixel and needs the shared GPU budget review. Metal on the 21px icon is visible but subdued at the calm preset; its artistic fit needs the owner's live review.
