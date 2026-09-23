# MONO Font Lab · 2026-09-24

Five deliberate UI directions, six families including the existing address face.
These are lab choices, not a change to the approved wallet appearance.

| Direction | Primary source | Local version | Use and tradeoff |
|---|---|---|---|
| IBM Plex Sans | [IBM](https://github.com/IBM/plex) | 3.000 | Technical grotesk, stable default-width digits; reuse existing binary. |
| Golos Text + Plex Sans | [Golos project](https://github.com/googlefonts/golos-text) | 2.004 + 3.000 | Cyrillic text with Plex financial figures. Golos `.tf` advances fail actual shaping despite the `tnum` tag. |
| Onest | [Simpals](https://github.com/simpals/onest) | 2.001 | Open, softer forms; existing variable file, 100–900. |
| Manrope | [Google Fonts source](https://github.com/google/fonts/tree/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/manrope) | 4.505 | Geometric, broad balance figures; longer sums need responsive fitting. |
| Source Sans 3 + Manrope | [Adobe](https://github.com/adobe-fonts/source-sans) | 3.052 + 4.505 | Humanist text and controls, geometric balance. Two families with complementary symbol coverage. |
| IBM Plex Mono | [IBM](https://github.com/IBM/plex) | 2.005 / 400 | Existing address/ID companion, never the compulsory second family of every direction. |

The design character column is our visual assessment. The upstream projects establish authorship and licensing; shipped binaries establish coverage and numeric behavior. Exact source commits, source/conversion hashes, complete OFL texts, Reserved Font Names, axes, metrics and payloads are in [the asset notice](../../apps/miniapp/public/fonts/mono/README.md) and the generated audit manifest.

All faces cover Latin, Russian and Belarusian including Ўў Іі. Pair coverage includes ₽ $ € £ ¥ ₸ ₿, percent, true minus, arrows and decimal separators. Individual gaps remain visible in the lab's optional details. Native `tnum` presence is not used as a substitute for shaped advance-width tests. All font choices are finite local IDs; no system-font probing, CDN or runtime URLs.

`MonoTypographyConfigV1` has primary/secondary family slots and six roles: body, balance, button, menu, label, mono. Each role selects one slot, an actual supported weight and a bounded size. Numerical rows inherit the balance family with their own smaller role scale. Golos cannot own the numeric role. A companion may be a second sans; the `mono` semantic role denotes addresses/IDs and does not force a third typeface.

The host owns storage, slot history and Apply. `mono-typography.ts` owns defaults, normalization, strict validation and CSS variables. The standalone dev route edits an in-memory draft; copying JSON does not apply or persist an appearance. Existing `/mono` and V1 remain under their respective owners.
