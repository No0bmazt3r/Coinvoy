# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow"]
# ///
"""Makes every logo file and app icon from public/Coinvoy.png. Run: pnpm icons"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "Coinvoy.png"
OUT = ROOT / "frontend" / "public"

TILE = (0xF7, 0xF5, 0xF1)  # light background, so the black outline shows


def fit(im: Image.Image, width: int) -> Image.Image:
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def rounded(tile: Image.Image, radius: float = 0.22) -> Image.Image:
    """Rounded corners like an app icon, drawn 4x larger and scaled down so the edges stay smooth."""
    big = (tile.width * 4, tile.height * 4)
    mask = Image.new("L", big, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big[0] - 1, big[1] - 1), radius=round(big[0] * radius), fill=255)
    out = tile.copy()
    out.putalpha(mask.resize(tile.size, Image.LANCZOS))
    return out


def main() -> None:
    master = Image.open(SRC).convert("RGBA")
    logo = master.crop(master.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox())

    fit(logo, 512).save(OUT / "logo.png", optimize=True)
    fit(logo, 512).save(ROOT / "backend" / "ml" / "app" / "render" / "logo.png", optimize=True)  # for the Penyata PDF

    # The logo keeps its own colours everywhere, including the app icons
    big = fit(logo, 800)
    for size, scale, name in [(192, .78, "icon-192.png"), (512, .78, "icon-512.png"),
                              (512, .62, "icon-maskable-512.png"), (180, .72, "apple-touch-icon.png")]:
        tile = Image.new("RGBA", (size, size), (*TILE, 255))
        mark = fit(big, round(size * scale))
        tile.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
        tile.convert("RGB").save(OUT / name, optimize=True)
        if name == "icon-512.png":  # the README picture, with rounded corners
            rounded(tile).save(ROOT / "public" / "Coinvoy-tile.png", optimize=True)

    favicon = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    mark = fit(big, 64)
    favicon.alpha_composite(mark, (0, (64 - mark.height) // 2))
    favicon.save(OUT / "favicon.png", optimize=True)
    print(f"icons written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
