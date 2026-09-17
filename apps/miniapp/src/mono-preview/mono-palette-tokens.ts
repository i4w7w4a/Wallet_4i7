import { resolveMonoPalette, type MonoPaletteRole, type ThemePaletteState } from "@wallet/ui";
import type { CSSProperties } from "react";

// Semantic paint aliases preserve exact legacy fallbacks until Palette Lab is enabled.
const paintTokens: Record<string, { role: MonoPaletteRole; alpha: number }> = {
  "--mono-palette-canvas-ff": {
    "role": "canvas",
    "alpha": 1
  },
  "--mono-palette-surfaceBase-ff": {
    "role": "surfaceBase",
    "alpha": 1
  },
  "--mono-palette-surfaceRaised-ff": {
    "role": "surfaceRaised",
    "alpha": 1
  },
  "--mono-palette-textPrimary-ff": {
    "role": "textPrimary",
    "alpha": 1
  },
  "--mono-palette-textSecondary-ff": {
    "role": "textSecondary",
    "alpha": 1
  },
  "--mono-palette-textMuted-ff": {
    "role": "textMuted",
    "alpha": 1
  },
  "--mono-palette-borderSubtle-ff": {
    "role": "borderSubtle",
    "alpha": 1
  },
  "--mono-palette-borderStrong-ff": {
    "role": "borderStrong",
    "alpha": 1
  },
  "--mono-palette-focus-ff": {
    "role": "focus",
    "alpha": 1
  },
  "--mono-palette-textDisabled-ff": {
    "role": "textDisabled",
    "alpha": 1
  },
  "--mono-palette-borderSubtle-99": {
    "role": "borderSubtle",
    "alpha": 0.6
  },
  "--mono-palette-chartLine-ff": {
    "role": "chartLine",
    "alpha": 1
  },
  "--mono-palette-borderSubtle-88": {
    "role": "borderSubtle",
    "alpha": 0.5333333333333333
  },
  "--mono-palette-borderSubtle-31": {
    "role": "borderSubtle",
    "alpha": 0.19215686274509805
  },
  "--mono-palette-borderSubtle-66": {
    "role": "borderSubtle",
    "alpha": 0.4
  },
  "--mono-palette-borderSubtle-12": {
    "role": "borderSubtle",
    "alpha": 0.07058823529411765
  },
  "--mono-palette-borderSubtle-bb": {
    "role": "borderSubtle",
    "alpha": 0.7333333333333333
  },
  "--mono-palette-atmosphereCool-12": {
    "role": "atmosphereCool",
    "alpha": 0.07058823529411765
  },
  "--mono-palette-atmosphereWarm-1a": {
    "role": "atmosphereWarm",
    "alpha": 0.10196078431372549
  },
  "--mono-palette-atmosphereCool-18": {
    "role": "atmosphereCool",
    "alpha": 0.09411764705882353
  },
  "--mono-palette-atmosphereWarm-1f": {
    "role": "atmosphereWarm",
    "alpha": 0.12156862745098039
  },
  "--mono-palette-atmosphereCool-13": {
    "role": "atmosphereCool",
    "alpha": 0.07450980392156863
  },
  "--mono-palette-atmosphereWarm-17": {
    "role": "atmosphereWarm",
    "alpha": 0.09019607843137255
  },
  "--mono-palette-canvas-10": {
    "role": "canvas",
    "alpha": 0.06274509803921569
  },
  "--mono-palette-atmosphereWarm-0a": {
    "role": "atmosphereWarm",
    "alpha": 0.0392156862745098
  },
  "--mono-palette-atmosphereCool-08": {
    "role": "atmosphereCool",
    "alpha": 0.03137254901960784
  },
  "--mono-palette-atmosphereWarm-27": {
    "role": "atmosphereWarm",
    "alpha": 0.15294117647058825
  },
  "--mono-palette-atmosphereWarm-76": {
    "role": "atmosphereWarm",
    "alpha": 0.4627450980392157
  },
  "--mono-palette-atmosphereCool-57": {
    "role": "atmosphereCool",
    "alpha": 0.3411764705882353
  },
  "--mono-palette-atmosphereWarm-40": {
    "role": "atmosphereWarm",
    "alpha": 0.25098039215686274
  },
  "--mono-palette-borderSubtle-22": {
    "role": "borderSubtle",
    "alpha": 0.13333333333333333
  },
  "--mono-palette-borderSubtle-84": {
    "role": "borderSubtle",
    "alpha": 0.5176470588235295
  },
  "--mono-palette-atmosphereWarm-47": {
    "role": "atmosphereWarm",
    "alpha": 0.2784313725490196
  },
  "--mono-palette-atmosphereCool-29": {
    "role": "atmosphereCool",
    "alpha": 0.1607843137254902
  },
  "--mono-palette-atmosphereWarm-3d": {
    "role": "atmosphereWarm",
    "alpha": 0.23921568627450981
  },
  "--mono-palette-atmosphereCool-42": {
    "role": "atmosphereCool",
    "alpha": 0.25882352941176473
  },
  "--mono-palette-atmosphereWarm-41": {
    "role": "atmosphereWarm",
    "alpha": 0.2549019607843137
  },
  "--mono-palette-borderSubtle-50": {
    "role": "borderSubtle",
    "alpha": 0.3137254901960784
  },
  "--mono-palette-atmosphereCool-77": {
    "role": "atmosphereCool",
    "alpha": 0.4666666666666667
  },
  "--mono-palette-atmosphereCool-3a": {
    "role": "atmosphereCool",
    "alpha": 0.22745098039215686
  },
  "--mono-palette-atmosphereCool-25": {
    "role": "atmosphereCool",
    "alpha": 0.1450980392156863
  },
  "--mono-palette-borderSubtle-10": {
    "role": "borderSubtle",
    "alpha": 0.06274509803921569
  },
  "--mono-palette-borderSubtle-70": {
    "role": "borderSubtle",
    "alpha": 0.4392156862745098
  },
  "--mono-palette-atmosphereWarm-8a": {
    "role": "atmosphereWarm",
    "alpha": 0.5411764705882353
  },
  "--mono-palette-borderSubtle-9e": {
    "role": "borderSubtle",
    "alpha": 0.6196078431372549
  },
  "--mono-palette-borderSubtle-4d": {
    "role": "borderSubtle",
    "alpha": 0.30196078431372547
  },
  "--mono-palette-borderSubtle-0c": {
    "role": "borderSubtle",
    "alpha": 0.047058823529411764
  },
  "--mono-palette-borderSubtle-16": {
    "role": "borderSubtle",
    "alpha": 0.08627450980392157
  },
  "--mono-palette-borderSubtle-5c": {
    "role": "borderSubtle",
    "alpha": 0.3607843137254902
  },
  "--mono-palette-borderSubtle-35": {
    "role": "borderSubtle",
    "alpha": 0.20784313725490197
  },
  "--mono-palette-borderSubtle-55": {
    "role": "borderSubtle",
    "alpha": 0.3333333333333333
  },
  "--mono-palette-borderSubtle-27": {
    "role": "borderSubtle",
    "alpha": 0.15294117647058825
  },
  "--mono-palette-borderSubtle-94": {
    "role": "borderSubtle",
    "alpha": 0.5803921568627451
  },
  "--mono-palette-borderSubtle-b3": {
    "role": "borderSubtle",
    "alpha": 0.7019607843137254
  },
  "--mono-palette-surfaceBase-87": {
    "role": "surfaceBase",
    "alpha": 0.5294117647058824
  },
  "--mono-palette-borderSubtle-2d": {
    "role": "borderSubtle",
    "alpha": 0.17647058823529413
  },
  "--mono-palette-borderSubtle-8a": {
    "role": "borderSubtle",
    "alpha": 0.5411764705882353
  },
  "--mono-palette-borderSubtle-14": {
    "role": "borderSubtle",
    "alpha": 0.0784313725490196
  },
  "--mono-palette-borderSubtle-e0": {
    "role": "borderSubtle",
    "alpha": 0.8784313725490196
  },
  "--mono-palette-surfaceOverlay-ff": {
    "role": "surfaceOverlay",
    "alpha": 1
  },
  "--mono-palette-borderSubtle-24": {
    "role": "borderSubtle",
    "alpha": 0.1411764705882353
  },
  "--mono-palette-surfaceBase-80": {
    "role": "surfaceBase",
    "alpha": 0.5019607843137255
  },
  "--mono-palette-borderSubtle-72": {
    "role": "borderSubtle",
    "alpha": 0.4470588235294118
  },
  "--mono-palette-borderSubtle-3d": {
    "role": "borderSubtle",
    "alpha": 0.23921568627450981
  },
  "--mono-palette-borderSubtle-3a": {
    "role": "borderSubtle",
    "alpha": 0.22745098039215686
  },
  "--mono-palette-borderSubtle-28": {
    "role": "borderSubtle",
    "alpha": 0.1568627450980392
  },
  "--mono-palette-atmosphereCool-1b": {
    "role": "atmosphereCool",
    "alpha": 0.10588235294117647
  },
  "--mono-palette-borderSubtle-08": {
    "role": "borderSubtle",
    "alpha": 0.03137254901960784
  },
  "--mono-palette-atmosphereWarm-16": {
    "role": "atmosphereWarm",
    "alpha": 0.08627450980392157
  },
  "--mono-palette-canvas-18": {
    "role": "canvas",
    "alpha": 0.09411764705882353
  },
  "--mono-palette-canvas-11": {
    "role": "canvas",
    "alpha": 0.06666666666666667
  },
  "--mono-palette-atmosphereCool-1c": {
    "role": "atmosphereCool",
    "alpha": 0.10980392156862745
  },
  "--mono-palette-atmosphereWarm-15": {
    "role": "atmosphereWarm",
    "alpha": 0.08235294117647059
  },
  "--mono-palette-canvas-17": {
    "role": "canvas",
    "alpha": 0.09019607843137255
  },
  "--mono-palette-canvas-13": {
    "role": "canvas",
    "alpha": 0.07450980392156863
  },
  "--mono-palette-atmosphereCool-1a": {
    "role": "atmosphereCool",
    "alpha": 0.10196078431372549
  },
  "--mono-palette-atmosphereWarm-19": {
    "role": "atmosphereWarm",
    "alpha": 0.09803921568627451
  },
  "--mono-palette-canvas-16": {
    "role": "canvas",
    "alpha": 0.08627450980392157
  },
  "--mono-palette-borderSubtle-0d": {
    "role": "borderSubtle",
    "alpha": 0.050980392156862744
  },
  "--mono-palette-borderSubtle-33": {
    "role": "borderSubtle",
    "alpha": 0.2
  },
  "--mono-palette-surfaceOverlay-f0": {
    "role": "surfaceOverlay",
    "alpha": 0.9411764705882353
  },
  "--mono-palette-atmosphereCool-88": {
    "role": "atmosphereCool",
    "alpha": 0.5333333333333333
  },
  "--mono-palette-atmosphereCool-65": {
    "role": "atmosphereCool",
    "alpha": 0.396078431372549
  },
  "--mono-palette-atmosphereCool-14": {
    "role": "atmosphereCool",
    "alpha": 0.0784313725490196
  },
  "--mono-palette-atmosphereWarm-0f": {
    "role": "atmosphereWarm",
    "alpha": 0.058823529411764705
  },
  "--mono-palette-atmosphereWarm-10": {
    "role": "atmosphereWarm",
    "alpha": 0.06274509803921569
  },
  "--mono-palette-atmosphereCool-0b": {
    "role": "atmosphereCool",
    "alpha": 0.043137254901960784
  },
  "--mono-palette-atmosphereCool-10": {
    "role": "atmosphereCool",
    "alpha": 0.06274509803921569
  },
  "--mono-palette-atmosphereCool-07": {
    "role": "atmosphereCool",
    "alpha": 0.027450980392156862
  },
  "--mono-palette-borderSubtle-07": {
    "role": "borderSubtle",
    "alpha": 0.027450980392156862
  },
  "--mono-palette-atmosphereWarm-69": {
    "role": "atmosphereWarm",
    "alpha": 0.4117647058823529
  },
  "--mono-palette-borderSubtle-39": {
    "role": "borderSubtle",
    "alpha": 0.2235294117647059
  },
  "--mono-palette-borderSubtle-0a": {
    "role": "borderSubtle",
    "alpha": 0.0392156862745098
  },
  "--mono-palette-atmosphereWarm-0d": {
    "role": "atmosphereWarm",
    "alpha": 0.050980392156862744
  },
  "--mono-palette-atmosphereCool-ff": {
    "role": "atmosphereCool",
    "alpha": 1
  },
  "--mono-palette-atmosphereCool-16": {
    "role": "atmosphereCool",
    "alpha": 0.08627450980392157
  },
  "--mono-palette-atmosphereWarm-13": {
    "role": "atmosphereWarm",
    "alpha": 0.07450980392156863
  },
  "--mono-palette-atmosphereWarm-18": {
    "role": "atmosphereWarm",
    "alpha": 0.09411764705882353
  },
  "--mono-palette-atmosphereCool-03": {
    "role": "atmosphereCool",
    "alpha": 0.011764705882352941
  },
  "--mono-palette-borderSubtle-1d": {
    "role": "borderSubtle",
    "alpha": 0.11372549019607843
  },
  "--mono-palette-canvas-08": {
    "role": "canvas",
    "alpha": 0.03137254901960784
  },
  "--mono-palette-canvas-0d": {
    "role": "canvas",
    "alpha": 0.050980392156862744
  },
  "--mono-palette-borderSubtle-2b": {
    "role": "borderSubtle",
    "alpha": 0.16862745098039217
  },
  "--mono-palette-edgeCool-18": {
    "role": "edgeCool",
    "alpha": 24 / 255
  },
  "--mono-palette-edgeWarm-18": {
    "role": "edgeWarm",
    "alpha": 24 / 255
  }
};

// Numeric values are safe for the prepaint cache; it never stores CSS source.
// RGB channels use 0..255, alpha uses 0..1.
export function monoPaletteChannels(theme: ThemePaletteState): Record<string, [number, number, number, number]> {
  const resolved = resolveMonoPalette(theme);
  return Object.fromEntries(Object.entries(paintTokens).map(([name, { role, alpha }]) => {
    const color = resolved.srgb[role];
    return [name, [color.r * 255, color.g * 255, color.b * 255, alpha * color.alpha]];
  })) as Record<string, [number, number, number, number]>;
}

export function monoPaletteStyle(theme: ThemePaletteState): CSSProperties {
  return Object.fromEntries(Object.entries(monoPaletteChannels(theme)).map(([name, [r, g, b, alpha]]) => {
    return [name, `rgb(${r} ${g} ${b} / ${alpha})`];
  })) as CSSProperties;
}
