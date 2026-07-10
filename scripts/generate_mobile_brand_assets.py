from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]

COLORS = {
    "deep": "#03150E",
    "forest": "#0A3A28",
    "forest2": "#11543C",
    "cream": "#F4E9D1",
    "cream_text": "#F7F1E4",
    "gold": "#D8A84A",
    "mint": "#2DD48F",
    "brass": "#B87333",
}


def hex_to_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return int(a + (b - a) * t)


def vertical_gradient(size, top, bottom):
    w, h = size
    top_rgb = hex_to_rgb(top)
    bottom_rgb = hex_to_rgb(bottom)
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(lerp(top_rgb[i], bottom_rgb[i], t) for i in range(3))
        draw.line([(0, y), (w, y)], fill=color)
    return img.convert("RGBA")


def add_radial_glow(img, center, radius, color, alpha):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    rgb = hex_to_rgb(color)
    cx, cy = center
    steps = 80
    for i in range(steps, 0, -1):
        t = i / steps
        r = int(radius * t)
        a = int(alpha * (t ** 1.7) / steps * 2.4)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*rgb, a))
    img.alpha_composite(overlay)


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def draw_q_monogram(draw, box, stroke_scale=1.0):
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    cream = hex_to_rgb(COLORS["cream"])
    gold = hex_to_rgb(COLORS["gold"])

    sw = max(4, int(w * 0.09 * stroke_scale))
    cx = x0 + w * 0.5
    cy = y0 + h * 0.48
    r = w * 0.29
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=cream, width=sw)
    draw.line([cx + r * 0.45, cy + r * 0.52, x0 + w * 0.8, y0 + h * 0.78], fill=gold, width=sw, joint="curve")
    inner_r = max(2, int(w * 0.11))
    draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(*hex_to_rgb(COLORS["deep"]), 108))


def draw_queue_mark(draw, box):
    x0, y0, x1, y1 = box
    w = x1 - x0
    cream = hex_to_rgb(COLORS["cream"])
    gold = hex_to_rgb(COLORS["gold"])
    sw = max(4, int(w * 0.08))
    r = w * 0.31
    cx = x0 + w * 0.5
    cy = y0 + w * 0.5
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=cream, width=sw)
    for i, length in enumerate([0.52, 0.42, 0.52]):
        y = y0 + w * (0.32 + i * 0.18)
        draw.line([x0 + w * 0.25, y, x0 + w * (0.25 + length), y], fill=cream, width=sw, joint="curve")
    draw.line([x0 + w * 0.62, y0 + w * 0.62, x0 + w * 0.8, y0 + w * 0.8], fill=gold, width=sw, joint="curve")


def make_icon(size, round_icon=False):
    scale = 4
    canvas_size = size * scale
    img = vertical_gradient((canvas_size, canvas_size), COLORS["forest2"], COLORS["deep"])
    add_radial_glow(img, (int(canvas_size * 0.28), int(canvas_size * 0.18)), int(canvas_size * 0.5), COLORS["mint"], 72)
    add_radial_glow(img, (int(canvas_size * 0.76), int(canvas_size * 0.08)), int(canvas_size * 0.45), COLORS["gold"], 50)
    draw = ImageDraw.Draw(img)
    margin = int(canvas_size * 0.13)
    draw_q_monogram(draw, (margin, margin, canvas_size - margin, canvas_size - margin), 1.2)
    if round_icon:
        mask = rounded_mask((canvas_size, canvas_size), canvas_size // 2)
        rounded = Image.new("RGBA", img.size, (0, 0, 0, 0))
        rounded.paste(img, (0, 0), mask)
        img = rounded
    else:
        mask = rounded_mask((canvas_size, canvas_size), int(canvas_size * 0.24))
        rounded = Image.new("RGBA", img.size, (0, 0, 0, 0))
        rounded.paste(img, (0, 0), mask)
        img = rounded
    return img.resize((size, size), Image.Resampling.LANCZOS)


def find_font(size, bold=True):
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size)


def draw_centered_text(draw, text, y, font, fill, width):
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (width - (bbox[2] - bbox[0])) // 2
    draw.text((x, y), text, font=font, fill=fill)


def make_splash(size):
    w, h = size
    img = vertical_gradient((w, h), COLORS["forest"], COLORS["deep"])
    add_radial_glow(img, (w // 2, int(h * -0.08)), int(min(w, h) * 0.65), COLORS["gold"], 70)
    add_radial_glow(img, (w // 2, int(h * 1.05)), int(min(w, h) * 0.65), COLORS["mint"], 58)
    draw = ImageDraw.Draw(img)

    mark_size = int(min(w, h) * 0.22)
    mark_x = (w - mark_size) // 2
    mark_y = int(h * 0.39) - mark_size // 2
    draw.rounded_rectangle(
        [mark_x, mark_y, mark_x + mark_size, mark_y + mark_size],
        radius=int(mark_size * 0.24),
        fill=hex_to_rgb(COLORS["forest"]),
        outline=(*hex_to_rgb(COLORS["cream"]), 52),
        width=max(2, mark_size // 48),
    )
    draw_q_monogram(draw, (mark_x + mark_size * 0.08, mark_y + mark_size * 0.08, mark_x + mark_size * 0.92, mark_y + mark_size * 0.92), 1.1)

    title_font = find_font(int(min(w, h) * 0.078), True)
    sub_font = find_font(int(min(w, h) * 0.026), True)
    draw_centered_text(draw, "Queued", mark_y + mark_size + int(h * 0.035), title_font, hex_to_rgb(COLORS["cream_text"]), w)
    draw_centered_text(draw, "Share what's worth your time.", mark_y + mark_size + int(h * 0.11), sub_font, (214, 240, 224, 160), w)

    line_w = int(w * 0.42)
    y = int(h * 0.78)
    for x in range((w - line_w) // 2, (w + line_w) // 2):
        t = abs((x - w / 2) / (line_w / 2))
        a = int(190 * (1 - t))
        draw.point((x, y), fill=(*hex_to_rgb(COLORS["gold"]), a))
        draw.point((x, y + 1), fill=(*hex_to_rgb(COLORS["gold"]), max(0, a - 50)))
    return img


def save(path, img):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def main():
    source_dir = ROOT / "docs" / "mockups" / "assets"
    save(source_dir / "queued-icon-q-monogram-1024.png", make_icon(1024))
    save(source_dir / "queued-splash-q-monogram-2732.png", make_splash((2732, 2732)))

    ios_icon = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"
    save(ios_icon, make_icon(1024))

    ios_splash_dir = ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset"
    splash_square = make_splash((2732, 2732))
    for name in ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]:
        save(ios_splash_dir / name, splash_square)

    densities = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for density, px in densities.items():
        base = ROOT / "android" / "app" / "src" / "main" / "res" / f"mipmap-{density}"
        save(base / "ic_launcher.png", make_icon(px))
        save(base / "ic_launcher_round.png", make_icon(px, round_icon=True))
        save(base / "ic_launcher_foreground.png", make_icon(px))

    splash_sizes = {
        "mdpi": (320, 480),
        "hdpi": (480, 800),
        "xhdpi": (720, 1280),
        "xxhdpi": (960, 1600),
        "xxxhdpi": (1280, 1920),
    }
    for density, (pw, ph) in splash_sizes.items():
        save(ROOT / "android" / "app" / "src" / "main" / "res" / f"drawable-port-{density}" / "splash.png", make_splash((pw, ph)))
        save(ROOT / "android" / "app" / "src" / "main" / "res" / f"drawable-land-{density}" / "splash.png", make_splash((ph, pw)))
    save(ROOT / "android" / "app" / "src" / "main" / "res" / "drawable" / "splash.png", make_splash((480, 800)))


if __name__ == "__main__":
    main()
