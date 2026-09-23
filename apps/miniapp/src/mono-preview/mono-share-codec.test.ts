// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MONO_PALETTE_ROLES, normalizeMonoPaletteConfig } from "@wallet/ui";
import { createMonoAppearanceEnvelope } from "./mono-preset-envelope";
import { createMonoTypographyDefaults } from "./mono-typography";
import { createMonoShareUrl, readMonoShareFragment } from "./mono-share-codec";
import { encodeMonoSharePayload } from "./mono-share-transport";

describe("self-contained appearance links", () => {
  it("roundtrips all appearance slices in a deterministic fragment, leaving the request path clean", async () => {
    const envelope = createMonoAppearanceEnvelope("mercury");
    envelope.appearance.logo = { version: 1, variant: "plaque", customColor: true, hue: 39 };
    envelope.appearance.chart.visible = false;
    envelope.appearance.layout.chartPosition = "bottom";
    envelope.appearance.assets.variant = "tiles";
    envelope.appearance.balance.composition = "centered";
    envelope.appearance.environment = { theme: "light", background: "tide" };
    const link = await createMonoShareUrl(envelope, "https://wallet.example/mono?private=excluded");
    const url = new URL(link);
    expect(url.origin + url.pathname + url.search).toBe("https://wallet.example/mono/view");
    expect(link.length).toBeLessThan(4096);
    expect(await createMonoShareUrl(envelope, url.origin)).toBe(link);
    expect(await readMonoShareFragment(url.hash)).toEqual(envelope);
    envelope.appearance.logo.hue = 220;
    expect((await readMonoShareFragment(url.hash)).appearance.logo.hue).toBe(39);
  });

  it("validates after decompression even when attacker supplies a correct checksum", async () => {
    const envelope = createMonoAppearanceEnvelope();
    const token = await encodeMonoSharePayload(JSON.stringify({ ...envelope, profile: { address: "secret" } }));
    await expect(readMonoShareFragment(`#mono=${token}`)).rejects.toMatchObject({ kind: "invalid" });
    const future = await encodeMonoSharePayload(JSON.stringify({ ...envelope, version: 88 }));
    await expect(readMonoShareFragment(`#mono=${future}`)).rejects.toMatchObject({ kind: "version" });
  });

  it("never silently accepts incomplete links or URL schemes outside the hosted viewer", async () => {
    await expect(readMonoShareFragment("#other=data")).rejects.toMatchObject({ kind: "invalid" });
    await expect(createMonoShareUrl(createMonoAppearanceEnvelope(), "javascript:alert(1)")).rejects.toMatchObject({ kind: "invalid" });
    await expect(createMonoShareUrl(createMonoAppearanceEnvelope(), "https://secret:password@wallet.example")).rejects.toMatchObject({ kind: "invalid" });
  });

  it("keeps a dense full appearance with high precision overrides within a practical link budget", async () => {
    const envelope = createMonoAppearanceEnvelope("frost");
    let index = 1;
    const sample = () => ((index++ * 2654435761) >>> 0) / 2 ** 32;
    const color = () => ({ l: sample(), c: sample() * .4, h: sample() * 360, alpha: sample() });
    for (const mode of ["dark", "light"] as const) {
      const theme = envelope.appearance.palette.config.themes[mode];
      for (const role of MONO_PALETTE_ROLES) theme.roles[role] = {
        mode: "manual", offset: { l: sample() * 2 - 1, c: sample() * .8 - .4, h: sample() * 720 - 360 },
        value: color(), locked: true, lockedValue: color(),
      };
    }
    envelope.appearance.palette.config = normalizeMonoPaletteConfig(envelope.appearance.palette.config);
    envelope.appearance.typography = createMonoTypographyDefaults("frost");
    envelope.appearance.background = { version: 1, recipe: "aperture", intensity: .837, speed: .642, pointerResponse: .943, character: "precise", calm: true };
    const link = await createMonoShareUrl(envelope, "https://wallet.135.181.70.158.nip.io");
    expect(link.length).toBeLessThan(12_000);
    expect(await readMonoShareFragment(new URL(link).hash)).toEqual(envelope);
  });
});
