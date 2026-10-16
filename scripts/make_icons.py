# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow"]
# ///
"""Regenerate every app icon from the master logo, public/Coinvoy.png. Run: pnpm icons"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "Coinvoy.png"
OUT = ROOT / "frontend" / "public"

INK = (0x1D, 0x1E, 0x1D)
LIME = (0xB5, 0xFC, 0x04)
SHADE = (0x3E, 0x63, 0x00)  # olive: reads as the ribbon's shadow on light and dark backgrounds


def lum(r: int, g: int, b: int) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def fit(im: Image.Image, width: int) -> Image.Image:
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def shaded(im: Image.Image) -> Image.Image:
    """Ink strokes vanish on dark backgrounds, so map ink → olive and keep the lime (blends included). One file works on both themes."""
    im = im.copy()
    px = im.load()
    lime_l, ink_l = lum(*LIME), lum(*INK)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a:
                w = max(0.0, min(1.0, (lum(r, g, b) - ink_l) / (lime_l - ink_l)))
                px[x, y] = (*(round(w * li + (1 - w) * d) for li, d in zip(LIME, SHADE, strict=True)), a)
    return im


def main() -> None:
    master = Image.open(SRC).convert("RGBA")
    logo = master.crop(master.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox())

    shaded(fit(logo, 384)).save(OUT / "logo.png", optimize=True)

    big = shaded(fit(logo, 800))
    for size, scale, name in [(192, .78, "icon-192.png"), (512, .78, "icon-512.png"),
                              (512, .62, "icon-maskable-512.png"), (180, .72, "apple-touch-icon.png")]:
        tile = Image.new("RGBA", (size, size), (*INK, 255))
        mark = fit(big, round(size * scale))
        tile.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
        tile.convert("RGB").save(OUT / name, optimize=True)

    favicon = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    mark = fit(big, 64)
    favicon.alpha_composite(mark, (0, (64 - mark.height) // 2))
    favicon.save(OUT / "favicon.png", optimize=True)
    print(f"icons written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
