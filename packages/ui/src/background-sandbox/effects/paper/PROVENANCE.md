# Paper material port

Source: `paper-design/shaders`, commit `43cd68db79fa0b1759f72ffc941b3238e2a3954c`, package `@paper-design/shaders` 0.0.81. Copyright 2026 Paper. Apache-2.0. Full upstream license and notice are preserved in `LICENSE.upstream` and `NOTICE.upstream`.

| Upstream file | SHA-256 |
| --- | --- |
| `packages/shaders/src/shaders/liquid-metal.ts` | `626419E92474CACBFB4F77BC8BE6A80414BD2A10BF3E4DA4F05AB8D591E64E4D` |
| `packages/shaders/src/shaders/pulsing-border.ts` | `D48ABC1994322112CA5D5622D0C80E9C37BDC137293C1739145469ED71388AC6` |
| `packages/shaders/src/shaders/gem-smoke.ts` | `4FFC07610D55AF889EBCC7B93832FE975681084ADF083623152166FC3A3E7DFC` |
| `packages/shaders/src/shaders/heatmap.ts` | `3B25944245A506B750335B4007BC66AF49C51CEE55E767757AEA2B4EE7E1E55F` |
| `packages/shaders/src/vertex-shader.ts` | `B2F8121916F21674CCB53174EFA88F19E53287893035333BC65F6228A4BFD136` |
| `packages/shaders/src/shader-utils.ts` | `5805B80C74323B0A8FCE8C8C3628B17372014F7417D0C7DE3346FA532C6C903A` |
| `packages/shaders/src/get-shader-noise-texture.ts` | `C5D36911326153219BD450DEF1E5E84250A37968D79B29D4D7B11EFF7BF5ECF9` |

`extract-upstream.py` regenerates `shaders.ts` and `noise-source.ts` from the pinned source checkout. It expands Paper's GLSL helpers and numeric array limits. Shader RGB is clamped into `[0, alpha]` at output because the Novex compositor consumes premultiplied display-sRGB. No Paper ShaderMount, React wrapper, browser listener, canvas, WebGL context or RAF is imported. The host owns the one WebGL2 context and RAF. The local pass renders to one RGBA8 target.

The Poisson mask implementation keeps Paper's nonzero-alpha shape classification, eight-neighbor boundary, 40 red/black SOR iterations at `omega=1.9`, three smoothing passes and `R=interior gradient/G=source alpha/A=255` texture encoding. Empty and one-pixel shapes receive finite fallback data. Work is divided into two-iteration async chunks with AbortSignal checks. Heatmap composes the black silhouette on white before computing the contour, wide and inner grayscale blur channels; alpha alone is never used as heat intensity. Color sliders and runtime frames never run CPU preprocessing. Local cache keys include effect, allowlisted asset or geometry, dimensions, radius and version and exclude artistic color.

Fixed quality differences requiring visual comparison: target masks are bounded to 256 pixels on the longest side instead of Paper's 512-pixel Poisson working solve, SVG 4096-pixel upscale and Heatmap 1750-pixel canvas. The Heatmap blur radii scale with the bounded target. Prepared assets use at most 2 MiB retained cache and a caller-supplied peak CPU budget. Economy/detail adjust mask sampling only, not artistic recipe values. Paper's 128² noise PNG is preserved as a local data URI and decoded during `prepare`. Actual phone/browser rendering, WebGL compilation, FPS and source-side visual comparison remain for ORACLE's shared GPU slot.

Only Novex's four existing quick-action icon paths and local strict/rounded rectangles are rasterized. No Paper demo logos/images or arbitrary SVG/URL are admitted. `clearPaperPreparedAssets()` releases the private cache when the host scene ends.
