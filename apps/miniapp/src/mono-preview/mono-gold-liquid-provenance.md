# Gold liquid — provisional local adaptation

Optical source: [Liquid_Prnc_Glass](https://github.com/i4w7w4a/Liquid_Prnc_Glass/tree/97175e083782eab2d55b85abafc6a426c269e20a), revision `97175e083782eab2d55b85abafc6a426c269e20a`, MIT © 2026 i4w7w4a; complete notice in `mono-gold-liquid-LICENSE.upstream`.

Read from `C:/Users/iwwa/Documents/2_MLBB/Liquid_Prnc_Glass`:

- `src/liquid-glass/WebGLVideoEdgeGlassRenderer.ts`, SHA256 `5c25afc7a6947b0a697ab3e555fdc5a91057658603ebeac568f21edc71cdb28d`.
- `src/liquid-glass/settings.ts`, SHA256 `44e7df26d62aa20bd471a6c22f3f3e22c0f6771a659729aa4d42eba374bd08e7`.
- `docs/shader.md`, `docs/shader-contract.md`, source renderer contract tests and `LICENSE`.

## Adaptation

Retained signed `ior * 0.18032787`, rounded-box SDF/normal, smooth center-to-edge masks and both fade modes, separate `baseColor`/`opticalColor`, source refraction/dispersion, masked absorption/highlights, final `mix(baseColor, opticalColor, masterFade)`. Flow is the lab's analytic shear mode 10 plus its secondary phase layer; no fluid simulation certification is implied.

Three camera/mesh/texture helpers, video, eleven shape options, twelve flow choices, region editor and color grading are omitted. Native WebGL1 draws one fullscreen triangle from a deterministic original RGBA8 folded-water texture, at most 512×512 (256 fallback when the texture limit is below 512). Explicit sRGB decode/encode replace Three-injected transfer functions. No video/image/font/demo/dither asset, dependency or remote fetch is introduced.

Gold replaces cold colored rim/lip/sweep with restrained warm folded light from the moving field. Quiet center/upper band protects financial text. Every optical addition shares the final optical mask and mix. The clean-zero early branch additionally disables all optical additions and interaction at `ior=0` (and field-strength zero in field mode); upstream only zeros displacement. Negative IOR retains the displacement sign. Reversed `smoothstep` sweep is omitted; each retained smoothstep has increasing bounds.

The October 13 smoked-glass follow-up replaces the three high-frequency interference waves with two single gently bent folds. Their source envelopes have widths 0.09/0.11 in source UV, a restrained low-frequency depth gradient and the existing calm middle/upper band. Source preparation retains 2×2 subtexel integration and a separable 13-tap binomial filter in linear RGB (order 12, normalized by 4096; sigma≈1.732 texels). At CSS/raster 480×1244 this gives about 4.2 CSS px of prefilter softness. There are no per-frame CPU source updates, new textures or higher raster limits.

Animated folded light uses each curve's analytic gradient to convert its local distance to raster pixels. The two curves have a nonzero x gradient, avoiding the saddle crossings of the old interference contours. A Gaussian core of sigma 12 CSS px and a diffuse shoulder of sigma 36 CSS px scale from the actual resized raster height. Slow phase drift and the retained signed refraction move the water; no derivative extension or extra GPU pass is needed. Both field/edge masks and flow-zero dependencies remain.

The supplied readability budget is final native-media linear-sRGB Y≤0.030. Both prepared source and active final mix use a hue-preserving luminance shoulder: dark values through Y=0.016 stay unchanged; higher values approach Y=0.028, leaving RGBA8 headroom. The active shoulder runs after refraction, channel dispersion and highlight addition, before sRGB encoding. The clean IOR0/zero-field branch returns the already prepared source directly, without optical absorption/highlight/tone additions. This policy is internal and adds no artist control. Provisional dispersion is 0.012 and highlightStrength is 0.24, shared by normalization, Default and allowlisted export; these are not approved public presets.

Source contrast stays damped before integration: RGB base 15/16/15, depth amplitudes 7/6/5 and broad-fold amplitudes 27/19/9. This keeps the filtered clean-zero source dim and reduces neighboring texel jumps while retaining broad modulation. The final shoulder bounds active folds and tap light independently of source contrast. The accepted Gold optical settings/default/export remain unchanged; this new source geometry and interaction still require their own actual-browser visual evaluation.

Focused checks inspect actual uploaded source bytes for opaque alpha, Y budget, local luminance gradients, retained broad modulation, at most two prominent ridges on sampled rows and allocation/upload limits. Renderer-consumer checks cover derived CSS softness, normalized interaction uniforms, expiration/reset and unchanged optical defaults. Mock GL does not prove shader pixels, animated folds, slight RGB fringe or caption contrast in composition. Those remain root's single active-browser pass after ORACLE's affected build.

## Ephemeral response API

`GoldLiquidRenderer.render(activeSeconds, interaction?)` accepts a runtime-only `GoldLiquidInteraction`: optional `tapUv` (WebGL x-right/y-up UV), `tapAge` seconds, `tapStrength` 0…1 and `scrollShiftCss` −6…6 CSS px. Values are bounded again before upload; missing/non-finite values produce no response. Ordinary draws reset the response uniforms. This input is not serialized, a preset parameter, wallet data or DOM texture.

One passive `pointerdown`/`pointercancel`/`scroll` listener group on the existing scrollport owns bounded refs. A primary tap starts one soft local response, radius 56 CSS px, with 50 ms rise and complete expiration by 720 ms. Cancellation clears it. Disabled/inert controls cannot start the response. Scroll deltas cause at most 6 CSS px of sway and settle by 600 ms after the final event. Neither handler captures pointers, prevents defaults, moves content, changes controls nor adds a timer/RAF loop.

The existing RAF advances active time and consumes response alongside ambient flow. Visible-frame response time is uncapped so an old tap expires after a stalled frame; ambient drift retains its 50 ms delta clamp. With flow stopped, an allowed tap/scroll briefly wakes that same loop, draws a final zero-response frame and stops. Hidden/inactive/offscreen, reduced-motion/saveData, opaque/forced-colors/effects-disabled and clean-zero optics reset/ignore response. Resume cannot replay a paused halo. At rest the center-to-edge fade is unchanged; a tap may temporarily contribute at most 0.12 to the local master fade so central taps can answer. Scroll source displacement is multiplied by the signed continuous response power `ior / (1 + abs(ior))`. The existing clean-zero early return precedes all response, and refraction/light/dispersion still pass through the final masked mix and luminance shoulder.

## Host and candidate

The atmosphere slot preserves live HTML and the existing scrollport. Gold's existing decorative canvas/context/RAF and existing standalone Promo renderer are retained; this follow-up adds zero canvases, contexts or RAF loops, including grouped panels. The fixed viewport, DPR≤1.5, ≤786432 drawing pixels, ≤2048 per axis/hardware cap and ≤30 scheduled draws/s bound the Gold background. No float FBO, solver, bloom, mipmaps, per-frame upload or content-height allocation. Source is at most 1 MiB; output + source accounting ≤4 MiB excludes browser/driver buffers. Once-only CPU preparation owns two RGB Float32 buffers (6 MiB at 512²) and final RGBA8 (1 MiB), total ≤7 MiB within the approved 8 MiB ceiling; working buffers are not retained by the renderer.

Scene activity, document visibility and offscreen pause scheduling. Reduced-motion/saveData give static event-driven rendering. Reduced-transparency/forced-colors/effectsDisabled use the existing solid Gold background without GPU allocation. Context/compile/link/upload failure hides the canvas and releases owned resources; retry requires a native restoration event or remount. Resize, media, visibility, connection, context observers/listeners and RAF are cleaned on unmount/StrictMode.

The technical tuner is outside the product Menu and checks exact loopback hostname plus `goldLiquidTuner=1`; SSR/public host do not show it. Numeric lab ranges include `cornerRadius`; only pixel ratio is deliberately capped. Default restores provisional Gold defaults; sliders/Apply stay in component memory, Copy/Apply issue allowlisted versioned JSON. Clipboard denial leaves selectable JSON. No storage, preset, theme preference, approved material or wallet/controller writes.

The startup JSON remains defined in `mono-gold-liquid-settings.ts`; the accepted soft-water values were not changed by this follow-up. Automated tests validate consumer/lifecycle/resource boundaries; actual shader pixels, visibility and visual approval of the new folds/interaction require the root's single browser pass after the ORACLE build.
