# Font Lab handoff

Branch `codex/mono-deep-type`, base `fee1b918ddf1b8a2fb86e105301eebc307488c54`.
Local dev preview: `http://127.0.0.1:3124/design-lab/type` (production returns 404).

## Integration contract

- `mono-typography.ts`: finite normalized `MonoTypographyConfigV1`; `validateMonoTypography` is strict. Unknown fields, schema/catalog versions, font IDs, unavailable weights, unsupported currency pairs and non-tabular numeric assignments reject. `normalizeMonoTypography` is a recovery function, not permission to silently repair imported presets.
- `MonoTypographyTuner` from `mono-typography-tuner.tsx`: controlled `value: MonoTypographyConfigV1 | null`, `onChange(config)`, optional `onStart()` / `onCommit()`. Null shows an explicit set picker, emits nothing on mount, and preserves legacy appearance until selection. No storage, Apply or Cancel.
- `loadMonoTypography(input, fonts?)` from `mono-font-loader.ts` resolves a validated config after every required real weight and companion face loads; rejects missing faces, network failure or an 8-second timeout. The host owns the transaction and latest-request arbitration. Load first, commit only the returned config.
- `useMonoTypographyPreview(candidate)` from `mono-typography-preview.ts` supplies `active` (last ready config, or null for legacy) and `status: legacy | loading | ready | error`. It drops stale async results and keeps the last ready sample on failure. This is a preview helper, not persistence or implicit Apply.
- Face declarations: import the existing `mono-fonts.css` and `mono-font-candidates.css`. Declarations do not preload unused candidates. The standalone route imports both. The inspector imports only its own scoped CSS.
- Apply `monoTypographyStyle(config)` on the scene root. `--mono-font-numeric` / `--mono-type-balance-family` must own **both Hero and financial columns**, including asset amounts. Golos 2.004 is text-only: its `.tf` glyph widths are unequal despite `tnum`.
- Body/balance/button/menu/label/mono role vars are `--mono-type-{role}-{family,size,weight}`. Extra tokens: `--mono-type-section-size`, `--mono-type-row-value-size`, `--mono-type-body-line-height`, `--mono-type-label-tracking`, `--mono-type-numeric-features`, `--mono-type-numeric-variant`. Legacy `--mono-font-*` aliases remain. The balance size is an upper bound; scene fitting and fraction formatting belong to the scene owner.

Legacy migration uses the agreed nullable typography slice. Null retains the exact old CSS. New defaults are never auto-applied to old records.

## Compact controls

`mono-lab-controls.tsx` imports its scoped CSS and exports:

- `MonoLabIconButton`: `label`, native button props, 18px icon children, optional `tooltipPlacement="top"|"bottom"`. The button is 44×44; the hover/focus tooltip is portaled outside scroll clipping, clamped to the viewport, flips vertically, and closes on Escape. Scroll/resize listeners and the short hover timer are removed on cleanup.
- `MonoLabSliderRow`: `label,value,min,max,step,unit?,disabled?,onChange,onStart?,onCommit?`. Numeric edits commit on blur/Enter, Escape cancels; repeated keys and pointer drag commit once. Ranges and numeric fields retain 44px hit height.
- `MonoLabSection`: native details/summary with `title,children,defaultOpen?`.

No runtime dependency was added. Central `mono-preview.tsx` and `mono-workbench.css` are untouched.

## Preview and validation

The isolated sample uses the repository's `WalletSnapshot`, full live amount strings, functional demo buttons and menu, Russian/Belarusian/Latin specimens, tabular financial rows and five curated choices. Its local state supports gesture Undo/Redo, A/B, width, long amount, light surface and explicit JSON copy. It neither persists nor edits wallet data.

14 focused unit/component tests passed. Three Chromium E2E tests cover five sets × 320/390/430/480 real widths, full long amounts, numeric family propagation to asset columns, inactive face/network isolation, font failure/recovery, mobile hit targets and tooltip clipping/focus/Escape. New code passed scoped ESLint. The production build passed after regenerating corrupted local `.next/dev/types` cache files; those generated files are not committed. Full repo lint had no errors and one existing `mono-preview.tsx` hook dependency warning.

The duplicate full repo unit run was stopped at coordinator request; it had passed core 13, platform 17 and UI 160, then reported three failures in unchanged `mono-working-preset-lab.test.tsx` under concurrent build load. No claim is made that the full integrated suite is green; ORACLE owns that gate.

Run the scoped browser checks against an existing dev server:

```powershell
$env:MONO_FONT_LAB_BASE_URL = 'http://127.0.0.1:3124'
pnpm --filter @wallet/miniapp exec playwright test --config=mono-font-lab.playwright.config.ts
```

Font provenance and reproducible audit: [research](mono-font-research.md), [asset notices](../../apps/miniapp/public/fonts/mono/README.md), `scripts/mono-font-audit.py` and `mono-font-audit.json`. No push, merge or deploy was performed by this executor.
