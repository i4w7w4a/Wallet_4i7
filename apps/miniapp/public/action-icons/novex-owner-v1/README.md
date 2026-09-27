# Owner action artwork v1

The owner supplied eight 1254×1254 RGBA PNG files in `Desktop/Пак Ико` on 2026-09-27. Files here are byte-identical copies. The baked violet halo, transparency, and source artwork were not altered. `quick.buy` is decorative icon artwork and does not change currency or transaction logic.

Stable IDs and served paths are defined in `src/mono-preview/action-artwork/catalog.ts`. Presets store only `original`, `volume-v1`, or `contour-v1`, never source paths or arbitrary URLs.

| Stable ID suffix | Source under `Пак Ико/` | SHA-256 |
| --- | --- | --- |
| `volume-v1.quick.send` | `1/file_0000000099cc81f491e4c04af3cae62f.png` | `a8ebafe29858feb36a838d7e12c0ef917a4181a5cee6fe82249498381b50ca80` |
| `volume-v1.quick.receive` | `1/file_00000000394082469591242862beea23.png` | `f99e0d93298da016f79bed615744ef940b6c007f8c9de6f8d91a3d447f9a166e` |
| `volume-v1.quick.swap` | `1/file_00000000146c8210b9238052704daa0b.png` | `afe2cb9dc074cc7cc4b0cdd563d8c73e64ce209759a48d8dd108bc988aab23fa` |
| `volume-v1.quick.buy` | `1/file_00000000cab88246ac002a33c7916564.png` | `916541ccdd8d5d2a65ee2e3dacbf8268fbd72b3ecc9daad7ea110adc9387d5dc` |
| `contour-v1.quick.send` | `2/file_000000002df081f495da1fe469f8f0f6.png` | `f3f1e61234c896f3b28a4ebea628251dd65ecff16ddbf34607da3218d47be31e` |
| `contour-v1.quick.receive` | `2/file_0000000019748210a37e3be8e1a4d3f6.png` | `21c8d63d28f1a83c988fca96a90f6a4255a8bded10a3a3a887771aca7ffb0e2b` |
| `contour-v1.quick.swap` | `2/file_00000000d6e4821093a354ef6403a1ab.png` | `05c161aec97bd2178342d4a4272ef014eb585bcb975eeab4cff16f06eede28ad` |
| `contour-v1.quick.buy` | `2/file_00000000ff388210a63379d0b6314d4a.png` | `754ef228be07b593ca548b1a8c6241f462167014a1acaf3f1d5b08c694ac2107` |

The outer alpha bounds (threshold 4/255) leave large margins. The runtime scales each intact square image to a 66–76 CSS px raster centered in the selected pack's icon anchor, yielding roughly 32–44 px of visible silhouette without stretching the source aspect or cropping the halo.
