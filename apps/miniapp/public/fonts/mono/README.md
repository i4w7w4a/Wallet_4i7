# MONO LEDGER preview fonts

These are self-hosted assets for the three **visual preview** directions. No font is fetched from a CDN at runtime. This is not yet the full Font Lab registry or atomic font-switch loader.

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

Audited with FontTools 4.65.0 against the specimen in `docs/skins/font-lab.md`: Russian Cyrillic, Latin, arrows, minus, ellipsis, digits and `₽ $ € £ ¥ ₸` are present in all six assets. `₿` is present in IBM Plex Sans and IBM Plex Mono, but **not** Golos Text or Onest. Their CSS stacks deliberately fall back to our local Plex Mono for that one sign; do not claim that Golos/Onest have complete native specimen coverage. Prefer `BTC` in live wallet labels. Golos and Onest expose `tnum`; IBM Plex Sans has equal default digit advance widths, and Plex Mono is fixed width.

CSS API: import `apps/miniapp/src/mono-preview/mono-fonts.css`; set `data-mono-preset="ledger|frost|mercury"` on the preview root. The root exposes `--mono-font-ui`, `--mono-font-display`, `--mono-font-numeric`, `--mono-font-mono` and four weight variables. Use `font-variant-numeric: tabular-nums lining-nums` on amounts and account figures. `@font-face` declarations alone do not load inactive preset files; no preload links are added.
