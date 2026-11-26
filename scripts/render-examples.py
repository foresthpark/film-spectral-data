# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow", "rawpy", "tifffile"]
# ///
"""Renders each example photo through every stock, for the side-by-side examples on stock pages.

Run: uv run scripts/render-examples.py [--helper PATH] [--data DIR] [--only STOCK_ID ...]
Reads data/examples.json, downloads the raws into examples-cache/ (gitignored), and writes
public/examples/<photo>/original.jpg, public/examples/<photo>/<stock>.jpg and public/examples/index.json.
Rendering uses the Negs engine helper with Film Bridge's settings (upstream spektrafilm parity) and
auto exposure. Derived images keep the source photo's licence (CC BY-SA photos stay CC BY-SA).
"""

import argparse
import json
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
import rawpy
import tifffile
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PLUGIN = ROOT.parent / "spektrafilm-c1-plugin"
CACHE = ROOT / "examples-cache"
OUT = ROOT / "public/examples"
WORKING_LONG_EDGE = 2400  # decoded input size: plenty for the output and quick to render
OUTPUT_LONG_EDGE = 1200
JPEG_QUALITY = 82
METERING_FILM, METERING_PAPER = "kodak_portra_400", "kodak_portra_endura"


def start_helper(helper, data):
    process = subprocess.Popen([helper, "--data-dir", data], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True)
    state = {"id": 0}

    def call(command):
        state["id"] += 1
        process.stdin.write(json.dumps({"id": state["id"], **command}) + "\n")
        process.stdin.flush()
        reply = json.loads(process.stdout.readline())
        if "error" in reply:
            raise RuntimeError(reply["error"])
        return reply["result"]

    return call, process


def film_bridge_params(defaults, is_slide, locked_ev=None):
    """Film Bridge's settings (mac/Sources/FilmBridge/Look.swift), which match upstream spektrafilm.
    Without locked_ev the engine meters (auto exposure); with it, exposure is fixed at that EV."""
    overrides = {
        "io.input_interpretation": {"mode": "manual"},
        "io.input_color_space": "ProPhoto RGB",
        "io.input_cctf_decoding": True,
        "io.output_color_space": "sRGB",
        "io.output_cctf_encoding": True,
        "io.scan_film": is_slide,
        "workflow.route": "input > film > scan" if is_slide else "input > film > print > scan",
        "enlarger.print_exposure_compensation": False,
        "settings.spectral_boundary": "upstream",
        "settings.output_adaptation": "direct",
        "settings.use_enlarger_lut": False,
        "settings.use_scanner_lut": False,
        "settings.use_fast_stats": False,
        "camera.auto_exposure": locked_ev is None,
        "camera.auto_exposure_method": "center_weighted",
        "camera.exposure_compensation_ev": locked_ev or 0.0,
        "camera.film_format_mm": 36.0,
        "film_render.grain.active": True,
    }
    params = json.loads(json.dumps(defaults))
    for path, value in overrides.items():
        *parents, leaf = path.split(".")
        node = params
        for name in parents:
            node = node[name]
        if leaf not in node:  # the helper silently ignores unknown fields, so fail loudly instead
            raise KeyError(f"helper params have no field {path}")
        node[leaf] = value
    return params


def prepare_input(photo):
    """Downloads the raw once and decodes it to a ProPhoto (gamma 1.8) 16-bit TIFF at the working size."""
    CACHE.mkdir(exist_ok=True)
    raw_path = CACHE / f"{photo['id']}.raw"
    tiff_path = CACHE / f"{photo['id']}.tif"
    if not raw_path.exists():
        print(f"downloading {photo['id']}", flush=True)
        request = urllib.request.Request(photo["rawUrl"], headers={"User-Agent": "film-spectral-data"})
        with urllib.request.urlopen(request) as response:
            raw_path.write_bytes(response.read())
    if not tiff_path.exists():
        with rawpy.imread(str(raw_path)) as raw:
            rgb = raw.postprocess(output_color=rawpy.ColorSpace.ProPhoto, gamma=(1.8, 16), output_bps=16,
                                  no_auto_bright=True, use_camera_wb=True).astype(np.float64)
        # Average whole blocks down to about the working size (box filter; plenty for 1200 px output).
        factor = max(1, round(max(rgb.shape[:2]) / WORKING_LONG_EDGE))
        h, w = (rgb.shape[0] // factor) * factor, (rgb.shape[1] // factor) * factor
        small = rgb[:h, :w].reshape(h // factor, factor, w // factor, factor, 3).mean(axis=(1, 3))
        tifffile.imwrite(tiff_path, np.round(small).astype(np.uint16))
    return tiff_path


def save_jpeg(call, reply, frame, path):
    rgba = np.frombuffer(frame.read_bytes(), dtype=np.uint8).reshape(reply["height"], reply["width"], 4)
    image = Image.fromarray(rgba[..., :3].copy())
    image.thumbnail((OUTPUT_LONG_EDGE, OUTPUT_LONG_EDGE), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, quality=JPEG_QUALITY, optimize=True, progressive=True)


def exposed(rgba_srgb, ev):
    """Brightens an sRGB frame by ev stops in linear light, as Film Bridge shows its original."""
    srgb = rgba_srgb[..., :3].astype(np.float64) / 255
    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4) * 2**ev
    encoded = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.clip(linear, 0, None) ** (1 / 2.4) - 0.055)
    return (np.clip(encoded, 0, 1) * 255 + 0.5).astype(np.uint8)


def render_photo(call, scratch, photo, stocks, defaults, only):
    tiff = prepare_input(photo)
    frame = scratch / "frame.rgba"
    out_dir = OUT / photo["id"]
    # Per-photo brightness change on top of metering, like Film Bridge's exposure slider.
    adjustment = photo.get("exposureEV", 0.0)
    long_edge = max(Image.open(tiff).size)
    base = {"input": str(tiff), "limit_preview": True, "preview_path": str(frame),
            "interactive_scale": min(1.0, OUTPUT_LONG_EDGE / long_edge)}

    # The original at the exposure the film renders are metered to (Portra 400 as the reference).
    metering = call({"command": "render", **base, "film": METERING_FILM, "paper": METERING_PAPER,
                     "params": film_bridge_params(defaults, False)})
    ev = metering["film_histogram"]["ev"]
    reply = call({"command": "original", **base, "params": film_bridge_params(defaults, False)})
    rgba = np.frombuffer(frame.read_bytes(), dtype=np.uint8).reshape(reply["height"], reply["width"], 4)
    original = Image.fromarray(exposed(rgba, ev + adjustment))
    original.thumbnail((OUTPUT_LONG_EDGE, OUTPUT_LONG_EDGE), Image.LANCZOS)
    out_dir.mkdir(parents=True, exist_ok=True)
    original.save(out_dir / "original.jpg", quality=JPEG_QUALITY, optimize=True, progressive=True)

    rendered, failed = [], []
    for stock in stocks.values():
        if only and stock["id"] not in only:
            continue
        film, paper = (METERING_FILM, stock["id"]) if stock["paper"] else (stock["id"], stock["target_print"])
        is_slide = stocks[film]["positive"]
        if paper is None:
            paper = next(s["id"] for s in stocks.values() if s["paper"] and not s["cine_print"] and not s["bw"])
        try:
            # Meter with this film, then render at the metered EV plus the photo's adjustment.
            metered = call({"command": "render", **base, "film": film, "paper": paper,
                            "params": film_bridge_params(defaults, is_slide)})["film_histogram"]["ev"]
            reply = call({"command": "render", **base, "film": film, "paper": paper,
                          "params": film_bridge_params(defaults, is_slide, metered + adjustment)})
            save_jpeg(call, reply, frame, out_dir / f"{stock['id']}.jpg")
            rendered.append(stock["id"])
        except RuntimeError as error:
            failed.append(f"{stock['id']}: {error}")
        print(f"{photo['id']} {len(rendered) + len(failed)}/{len(stocks)} {stock['id']}", flush=True)
    return rendered, failed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--helper", default=PLUGIN / "vendor/negs/target/release/spektrafilm-native")
    parser.add_argument("--data", default=PLUGIN / "vendor/negs/data")
    parser.add_argument("--only", nargs="*", default=[], help="render only these stock ids")
    args = parser.parse_args()

    photos = json.loads((ROOT / "data/examples.json").read_text())
    call, process = start_helper(str(args.helper), str(args.data))
    catalog = call({"command": "catalog"})
    stocks = {s["id"]: s for s in catalog["profiles"]}
    index, problems = [], []
    with tempfile.TemporaryDirectory() as scratch:
        for photo in photos:
            rendered, failed = render_photo(call, Path(scratch), photo, stocks, catalog["defaults"], set(args.only))
            problems += [f"{photo['id']} {line}" for line in failed]
            index.append({key: photo[key] for key in photo if key != "rawUrl"} | {"stocks": sorted(rendered)})
    process.stdin.close()
    process.wait()
    (OUT / "index.json").write_text(json.dumps(index, indent=1))
    print(f"wrote {OUT / 'index.json'}; failures: {problems or 'none'}")


if __name__ == "__main__":
    main()
