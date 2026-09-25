"""Check that a rendered plate has readable one-sided bevel lighting.

Usage: python check-plate-light.py image.png cellSize lineWidth bevel
Manual image gate for the isolated/integrated GPU probe. Requires Pillow only
in the test environment; no runtime package or product dependency.
"""

import sys
from PIL import Image


def luminance(rgb):
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def patch_luminance(image, x, y):
    values = [
        luminance(image.getpixel((xx, yy))[:3])
        for xx in range(round(x) - 1, round(x) + 2)
        for yy in range(round(y) - 1, round(y) + 2)
    ]
    return sum(values) / len(values)


def main():
    image = Image.open(sys.argv[1]).convert("RGB")
    cell = float(sys.argv[2])
    line = float(sys.argv[3])
    bevel = float(sys.argv[4])
    shoulder = line * 0.5 + bevel * 0.5
    y = cell * 0.5
    tiles = min(3, int(image.width / cell))
    sides = [
        (
            patch_luminance(image, index * cell + shoulder, y),
            patch_luminance(image, (index + 1) * cell - shoulder, y),
        )
        for index in range(tiles)
    ]
    delta = sum(abs(left - right) for left, right in sides) / len(sides)
    print(f"side-light bevel delta={delta:.2f} RGB luma; samples={sides}")
    if delta < 8:
        raise SystemExit("FAIL: symmetric dark bevels read as raised cubes")


if __name__ == "__main__":
    main()
