"""Regenerate local GLSL strings from the pinned Paper Shaders source checkout.

Usage: python extract-upstream.py PATH_TO_paper-design/shaders_COMMIT
The generated file is committed; this script is only provenance tooling.
"""

from pathlib import Path
import re
import sys


root = Path(sys.argv[1]) / "packages/shaders/src"
destination = Path(__file__).with_name("shaders.ts")


def literal(source: str, name: str) -> str:
    match = re.search(r"export const " + name + r"(?:\s*:\s*string)?\s*=\s*`([\s\S]*?)`;", source)
    if not match:
        raise ValueError(f"Missing literal: {name}")
    return match.group(1)


utils = (root / "shader-utils.ts").read_text(encoding="utf-8")
helpers = {key: literal(utils, key) for key in ("declarePI", "rotation2", "simplexNoise", "textureRandomizerGB", "colorBandingFix")}
numbers = {
    "heatmapMeta.maxColorCount": "10",
    "heatmapMeta.maxColorCount + 1": "11",
    "pulsingBorderMeta.maxColorCount": "5",
    "pulsingBorderMeta.maxSpots": "4",
    "gemSmokeMeta.maxColorCount": "6",
    "gemSmokeMeta.maxColorCount + 1": "7",
}


def expand(source: str) -> str:
    def replacement(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        return helpers.get(key, numbers.get(key, f"UNRESOLVED:{key}"))

    result = re.sub(r"\$\{([^}]+)\}", replacement, source)
    if "UNRESOLVED:" in result:
        raise ValueError("Unexpected source interpolation")
    return result


parts = [
    "/**",
    " * Modified Paper Shaders GLSL, Copyright 2026 Paper (Apache-2.0).",
    " * Source: 43cd68db79fa0b1759f72ffc941b3238e2a3954c, packages/shaders/src/.",
    " * ShaderMount was not copied. Helpers are expanded and outputs are clamped to",
    " * premultiplied RGBA for the Novex compositor. See ./NOTICE and ./PROVENANCE.md.",
    " */",
]
vertex = literal((root / "vertex-shader.ts").read_text(encoding="utf-8"), "vertexShaderSource")
parts.append("export const PAPER_VERTEX = `" + vertex + "`;")

for filename, upstream, exported in (
    ("liquid-metal.ts", "liquidMetalFragmentShader", "PAPER_LIQUID_METAL_FRAGMENT"),
    ("pulsing-border.ts", "pulsingBorderFragmentShader", "PAPER_PULSING_BORDER_FRAGMENT"),
    ("gem-smoke.ts", "gemSmokeFragmentShader", "PAPER_GEM_SMOKE_FRAGMENT"),
    ("heatmap.ts", "heatmapFragmentShader", "PAPER_HEATMAP_FRAGMENT"),
):
    fragment = expand(literal((root / "shaders" / filename).read_text(encoding="utf-8"), upstream))
    fragment = fragment.replace("fragColor = vec4(color, opacity);", "fragColor = vec4(clamp(color, vec3(0.0), vec3(opacity)), opacity);")
    parts.append("export const " + exported + " = `" + fragment + "`;")

destination.write_text("\n\n".join(parts) + "\n", encoding="utf-8")

noise_source = (root / "get-shader-noise-texture.ts").read_text(encoding="utf-8")
noise_match = re.search(r"const noiseSrc\s*=\s*'([^']+)'", noise_source)
if not noise_match:
    raise ValueError("Missing Paper noise texture")
Path(__file__).with_name("noise-source.ts").write_text(
    "/** Paper Shaders 0.0.81 source-derived 128x128 noise PNG (Apache-2.0). */\n"
    + "export const PAPER_NOISE_DATA_URI = '" + noise_match.group(1) + "';\n",
    encoding="utf-8",
)
