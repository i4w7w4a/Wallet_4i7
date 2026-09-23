# Typography → MonoScene adapter

Verified on the coordinator-approved shared baseline
`31b49c319ce1fe297f143d1a9878ce0667e8665a`, taken by ordinary local merge.

`src/mono-preview/mono-typography-scene.css` is opt-in under
`.mono-page[data-mono-typography="true"]`. Import it in the host, then set the
normalized `monoTypographyStyle(loadedConfig)` tokens and marker only after font
readiness. For null/legacy remove both typography tokens and marker; existing
legacy styles already consume some `--mono-font-*` aliases.

| Role | Consumers |
|---|---|
| body | scene root, profile name, asset names, empty asset copy |
| button | Material action labels, old periods, `MonoChart` period buttons |
| menu | bottom navigation item labels |
| label | balance headings, chart captions, eyebrow, demo/status copy, Promo labels |
| balance/numeric | Hero, amounts, asset sums **and quantities**, percent changes |
| mono | asset identifiers; no third family is introduced |

Section titles use the derived section size and existing real strong weight.
Body line-height and label tracking come from the model. The adapter never sets
Hero font-size/line-height/spacing, number-part styles, fraction scale, fit bounds,
padding, radius, borders, transforms, colors, effects or motion. MonoBalance owns
the size cap and fraction behavior. New domain components work anywhere inside
the opted-in root, including `.mono-scene-domain`.

For the four fixed Material action tiles, button size is a maximum:
`min(requested, max(12px, 3.8cqw))` against the existing preview container. The
inspector explicitly labels it «Макс. размер роли». Icons, tile geometry, chosen
family and weight stay unchanged. The 320px proof includes Manrope 800 with the
maximum button size 16px and navigation size 15px, checking every text boundary
against its own hit area. Navigation fits its requested size without a cap.

Scoped proof: `mono-typography-scene.spec.ts` uses the actual MonoScene on `/mono`
and actual domain components on `/design-lab/scene`, at 320px. It verifies inactive
CSS and legacy restoration, role family/size/weight, numeric column routing,
Material geometry and unchanged fitting/fractions. No component source or markup
is copied into the test. Run against the existing dev server:

```powershell
$env:MONO_FONT_LAB_BASE_URL = 'http://127.0.0.1:3124'
pnpm --filter @wallet/miniapp exec playwright test mono-typography-scene.spec.ts --config=mono-font-lab.playwright.config.ts
```

Screenshots are written to `test-results/mono-font-lab/mono-scene-roles-320.png`,
`mono-scene-manrope-max-320.png` and `scene-role-adapter.png`. Root import/style/marker, loading and Apply are
owned by ORACLE; this change does not edit central renderer or host files.
