# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow"]
# ///
"""Makes every logo file and app icon from public/Coinvoy.png. Run: pnpm icons"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "Coinvoy.png"
OUT = ROOT / "frontend" / "public"

TILE = (0xF7, 0xF5, 0xF1)  # light background, so the black outline shows


def fit(im: Image.Image, width: int) -> Image.Image:
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def main() -> None:
    master = Image.open(SRC).convert("RGBA")
    logo = master.crop(master.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox())

    fit(logo, 512).save(OUT / "logo.png", optimize=True)

    # The logo keeps its own colours everywhere, including the app icons
    big = fit(logo, 800)
    for size, scale, name in [(192, .78, "icon-192.png"), (512, .78, "icon-512.png"),
                              (512, .62, "icon-maskable-512.png"), (180, .72, "apple-touch-icon.png")]:
        tile = Image.new("RGBA", (size, size), (*TILE, 255))
        mark = fit(big, round(size * scale))
        tile.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
        tile.convert("RGB").save(OUT / name, optimize=True)
        if name == "icon-512.png":
            tile.convert("RGB").save(ROOT / "public" / "Coinvoy-tile.png", optimize=True)  # the README picture

    favicon = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    mark = fit(big, 64)
    favicon.alpha_composite(mark, (0, (64 - mark.height) // 2))
    favicon.save(OUT / "favicon.png", optimize=True)
    print(f"icons written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
