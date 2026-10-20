# MONO demo portrait v1

Generated on 2026-10-05 with the built-in `image_gen.imagegen` tool. One generation call, no reference images, no external photograph, no CLI/API fallback. The tool did not report its model identifier.

This is an original fictional adult for an explicitly demo profile. It does not represent a customer, the owner, a verified identity or supplied account data. The host opts in through `MONO_DEMO_AVATAR`; `AvatarControl` does not select an identity.

## Files and derivation

- Selected master and exact prompt remain in the private plan workspace:
  `.superpowers/sdd/2026-10-05-profile-quick-menu/assets/task-2/avatar-demo-source.png` and `avatar-demo.prompt.txt`.
- Master: PNG 1254 × 1254, 2,038,596 bytes.
- Master SHA256: `d1131aae65ff7d243907f70edec729d2b0ca6cc5e7f667537c1151800c1b467b`.
- Runtime file: `demo-portrait-v1.webp`, 160 × 160, 4,022 bytes, no alpha.
- Runtime SHA256: `b406c991f010e15ca43dc38e2a2ad7c377798e4b174896773b013288b74fbd98`.
- Deterministic resize/encoding only: existing local sharp 0.35.4, resize160×160 fit=cover (square source), WebP quality90 / effort6. No portrait retouching or baked frame/glow/sparks.

## Exact generation prompt

```text
Use case: photorealistic-natural
Asset type: original fictional demo profile portrait for a minimalist mobile wallet header, displayed inside a 36–40 CSS pixel circle.
Primary request: create one calm, contemporary human portrait of a wholly fictional adult; no reference person, no imitation of a celebrity or customer.
Scene/backdrop: smooth plain warm gray studio background, quiet and uncluttered.
Subject: an adult around thirty with short dark hair, warm medium skin, a relaxed closed mouth and attentive direct gaze, wearing a simple charcoal crew-neck shirt.
Style/medium: photorealistic natural editorial portrait, honest skin texture, soft detail, no beauty filter or stylized glamour.
Composition/framing: one square image; centered face, near-front view, tight head and upper shoulders; the full hair silhouette stays within a circular-safe crop; head occupies about two thirds of the frame, eyes above center; clear separation between hair, face and background so it remains readable at 36 pixels.
Lighting/mood: soft broad natural studio light; gentle modeling without deep shadows; composed, approachable, restrained.
Color palette: muted graphite, warm neutral skin and warm gray; balanced light and dark values suitable for both light and dark UI.
Constraints: exactly one fictional person; a finished portrait bitmap only; no circular border or baked UI effects, no glow or sparks, no text, no initials, no logos, no watermark, no props, no jewellery, no suit, no costume, no fintech symbols; no grid, collage, multiple variants or app mockup.
```
