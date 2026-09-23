"""Offline audit. Requires fonttools==4.65.0, brotli==1.2.0, uharfbuzz==0.52.0.

Run from the repository root. No downloads or font mutations; writes the checked
metrics manifest consumed by the finite local registry.
"""
import hashlib
import json
from io import BytesIO
from pathlib import Path

import uharfbuzz as hb
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "apps/miniapp/public/fonts/mono"
OUT = ROOT / "apps/miniapp/src/mono-preview/mono-font-audit.json"
LETTERS = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюяЎўІі"
    "0123456789%+−,.…↑↓"
)
CURRENCIES = "₽$€£¥₸₿"
records = {}
for path in sorted(FONTS.glob("*.woff2")):
    font = TTFont(path)
    cmap = font.getBestCmap()
    missing = "".join(char for char in LETTERS if ord(char) not in cmap)
    assert not missing, f"{path.name}: missing required text {missing}"
    axes = {a.axisTag: [a.minValue, a.maxValue] for a in font["fvar"].axes} if "fvar" in font else {}
    font.flavor = None
    sfnt = BytesIO()
    font.save(sfnt)
    face = hb.Face(sfnt.getvalue())
    shaped = hb.Font(face)
    weight_range = axes.get("wght", [font["OS/2"].usWeightClass] * 2)
    widths_by_weight = {}
    for weight in sorted(set([*weight_range, sum(weight_range) / 2])):
        shaped.set_variations({"wght": weight})
        buffer = hb.Buffer()
        buffer.add_str("0123456789")
        buffer.guess_segment_properties()
        hb.shape(shaped, buffer, {"tnum": True, "lnum": True})
        widths_by_weight[str(weight)] = [pos.x_advance for pos in buffer.glyph_positions]
    tabular = all(len(set(widths)) == 1 for widths in widths_by_weight.values())
    # Golos 2.004's .tf glyphs are proportional. It must never own numeric roles.
    assert tabular == (not path.name.startswith("golos-")), f"{path.name}: tabular policy changed; review registry"
    records[path.name] = {
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "bytes": path.stat().st_size,
        "version": font["name"].getDebugName(5),
        "axes": axes,
        "scripts": ["latin", "russian", "belarusian"],
        "missingCurrencies": "".join(char for char in CURRENCIES if ord(char) not in cmap),
        "tabular": tabular,
        "digitAdvances": widths_by_weight,
        "metrics": {"unitsPerEm": font["head"].unitsPerEm, "ascent": font["hhea"].ascent,
                    "descent": font["hhea"].descent, "lineGap": font["hhea"].lineGap},
    }
OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Audited {len(records)} WOFF2 assets: Latin, Russian, Belarusian; explicit currency gaps; shaped digits.")
