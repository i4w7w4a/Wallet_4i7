# MONO LEDGER preview fonts

These are self-hosted assets for MONO and the isolated `/design-lab/type` Font Lab. No font is fetched from a CDN at runtime. The finite registry and shaped-glyph audit live in `src/mono-preview/mono-font-registry.ts` and `mono-font-audit.json`.

All three families are licensed under the SIL Open Font License 1.1; the complete license notices are kept beside the binaries. IBM Plex reserves the font name **“Plex”**. Its WOFF2 files below are unmodified binaries from IBM's own repository. Golos Text files are also unmodified upstream WOFF2 binaries. Onest has no Reserved Font Name in its OFL notice; its WOFF2 here was compressed from the Google Fonts source TTF without subsetting or outline changes.

| Local file | Upstream source at pinned commit | Internal version | SHA-256 |
|---|---|---|---|
| `plex-sans-var-roman.woff2` | [IBM/plex `78cd4223`](https://github.com/IBM/plex/blob/78cd4223d8de9fcb78cba84eadecb269c56093c5/packages/plex-sans-variable/fonts/complete/woff2/IBM%20Plex%20Sans%20Var-Roman.woff2) | 3.000; `wght` 100–700, `wdth` 85–100 | `E978248B6B56DA9E372975322A98DD9A51135D1B375E32ED6D5CA69F3AAB792D` |
| `plex-mono-regular.woff2` | [IBM/plex `78cd4223`](https://github.com/IBM/plex/blob/78cd4223d8de9fcb78cba84eadecb269c56093c5/packages/plex-mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2) | 2.005; weight 400 | `BA204497F16B6D334CEE9D1E963A831B73E3A56E1D6300A8489D18DF7214B350` |
| `golos-text-regular.woff2` | [googlefonts/golos-text `cf2e2722`](https://github.com/googlefonts/golos-text/blob/cf2e27222937d97c2d858fff0499bcc667a64e9d/fonts/webfonts/GolosText-Regular.woff2) | 2.004; weight 400 | `F2152554816111E3A9F6D628EA8C04EC621CA01F0A9688D98845FAE75CF5C44A` |
| `golos-text-medium.woff2` | [googlefonts/golos-text `cf2e2722`](https://github.com/googlefonts/golos-text/blob/cf2e27222937d97c2d858fff0499bcc667a64e9d/fonts/webfonts/GolosText-Medium.woff2) | 2.004; weight 500 | `21CD58F9C4A0101753B52FA2E687A39119C9D6A19523A77C26BACF546A2C721C` |
| `golos-text-semibold.woff2` | [googlefonts/golos-text `cf2e2722`](https://github.com/googlefonts/golos-text/blob/cf2e27222937d97c2d858fff0499bcc667a64e9d/fonts/webfonts/GolosText-SemiBold.woff2) | 2.004; weight 600 | `32005098E00D1F0DA853E533B3AC9C3FD775FD734F40951A81C6AB069AC4CAE9` |
| `onest-variable.woff2` | [google/fonts `51f27c6a`](https://github.com/google/fonts/blob/51f27c6a966556a8d106923a692f76f1e0ac4ad4/ofl/onest/Onest%5Bwght%5D.ttf) | 2.001; `wght` 100–900 | `CB4D777C1B146887A2902EF01BA91CB3FB0C85E9804E95794EB289A1966C0782` |

Onest source TTF SHA-256: `966C5C29B4755DA84B6854D5C21DD4EAA2420225D0E9874DE602DE176D4A9F31`. Conversion used FontTools 4.65.0 and Brotli 1.2.0 (`fonttools ttLib.woff2 compress`), with no subset operation. Source license: [Google Fonts OFL](https://github.com/google/fonts/blob/51f27c6a966556a8d106923a692f76f1e0ac4ad4/ofl/onest/OFL.txt). The other license files correspond to [IBM's package license](https://github.com/IBM/plex/blob/78cd4223d8de9fcb78cba84eadecb269c56093c5/packages/plex-sans-variable/LICENSE.txt) and [Golos Text OFL](https://github.com/googlefonts/golos-text/blob/cf2e27222937d97c2d858fff0499bcc667a64e9d/OFL.txt).

## Glyph and numeric audit

Re-audited with FontTools 4.65.0 and HarfBuzz (uharfbuzz 0.52.0) on 2026-09-24: Latin, Russian, Belarusian **Ўў Іі**, arrows, minus, ellipsis and digits are present in every asset. Native currency gaps: Golos, Onest and Source Sans 3 lack `₿`; Manrope lacks `₸`. Plex Sans and Plex Mono cover all `₽ $ € £ ¥ ₸ ₿`. Font Lab pairs only families whose combined coverage is complete; its details identify the companion for missing symbols. No system glyph is silently counted as native coverage.

**Correction to the original audit:** Golos 2.004 exposes `tnum`, but its substituted `.tf` glyphs have unequal advances (regular: 580–620 units). The feature tag alone is not proof of tabular numbers. In Font Lab, Golos is a text-only face paired with Plex Sans for balance/financial rows. All other faces pass shaped equal-advance checks at minimum, midpoint and maximum weight. The existing `/mono` CSS defaults are not rewritten by this isolated lab; the host must adopt the normalized role adapter to receive this correction.

## Added Font Lab assets

| Local file | Exact source | Internal version / axes | SHA-256 |
|---|---|---|---|
| `source-sans-3-variable.woff2` | [Adobe Source Sans commit 87b37a2](https://github.com/adobe-fonts/source-sans/blob/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e/WOFF2/VF/SourceSans3VF-Upright.ttf.woff2) | 3.052, wght 200–900 | `5f16566f7a40d39b339ad26be151fa5a1ab1f0c2574c7a2e619765584a1acbd8` |
| `manrope-variable.woff2` | [Google Fonts commit b5efa9c](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/manrope/Manrope%5Bwght%5D.ttf) | 4.505, wght 200–800 | `ec48a797c0f2b33917ce9b7751021719ea1fbd46fb5c584c59c1ea1064678de7` |

Source Sans 3: Copyright 2010–2024 Adobe, Reserved Font Name **Source**, OFL 1.1. Unmodified upstream WOFF2; [exact license](https://github.com/adobe-fonts/source-sans/blob/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e/LICENSE.md) stored as `OFL-Source-Sans-3.txt`. Manrope: Copyright 2018 The Manrope Project Authors, no Reserved Font Name in the pinned [OFL notice](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/manrope/OFL.txt). Source TTF SHA-256 `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`; compressed with FontTools 4.65.0 / Brotli 1.2.0, no subsetting or outline changes. This is the pinned OFL 4.505, not a claim about another Manrope release's license.

Run `python scripts/mono-font-audit.py` from repository root with the pinned audit tools installed. It verifies required glyphs and shaped numeric advances, and writes hashes, byte counts, real axes and metrics to `mono-font-audit.json`. Audit tooling is not an application dependency.

CSS API: import `apps/miniapp/src/mono-preview/mono-fonts.css`; set `data-mono-preset="ledger|frost|mercury"` on the preview root. The root exposes `--mono-font-ui`, `--mono-font-display`, `--mono-font-numeric`, `--mono-font-mono` and four weight variables. Use `font-variant-numeric: tabular-nums lining-nums` on amounts and account figures. `@font-face` declarations alone do not load inactive preset files; no preload links are added.
