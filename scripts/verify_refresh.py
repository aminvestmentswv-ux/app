"""Verify a Pages export and decode real source photos before publication."""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urlsplit

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGE_HOSTS = {"image-cdn.carrot.com", "cdn.carrot.com", "www.aminvestmentswv.com"}


class Scripts(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.sources = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "script" and attributes.get("src"):
            self.sources.append(attributes["src"])


def decode_image(path):
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        image.load()
        width, height = image.size
        if width <= 0 or height <= 0:
            raise ValueError("Image has invalid dimensions")
        return {"width": width, "height": height, "format": image.format}


def verify_export(directory, base_path=None, domain=None):
    base_path = os.environ.get("AM_APP_WEB_BASE_PATH", "/app") if base_path is None else base_path
    domain = os.environ.get("AM_APP_WEB_DOMAIN", "") if domain is None else domain
    if (domain, base_path) not in {("", "/app"), ("app.aminvestmentswv.com", "")}:
        raise ValueError("Unexpected Pages domain or base path")
    directory = directory.resolve()
    cname = directory / "CNAME"
    if domain:
        if not cname.is_file() or cname.read_text().strip() != domain:
            raise ValueError("The custom domain is missing from the Pages export")
    elif cname.exists():
        raise ValueError("Unexpected custom domain in the Pages export")
    html = (directory / "index.html").read_text()
    if "<title>AM Investments app</title>" not in html:
        raise ValueError("The exported app title is missing or incorrect")
    sources = Scripts(html).sources
    if not sources:
        raise ValueError("The exported app has no JavaScript bundle")
    for source in sources:
        parsed = urlsplit(source)
        prefix = base_path + "/"
        if parsed.scheme or parsed.netloc or not parsed.path.startswith(prefix):
            raise ValueError("Unexpected script URL or incorrect Pages base path")
        target = (directory / parsed.path.removeprefix(prefix)).resolve()
        if not target.is_relative_to(directory) or not target.is_file() or not target.stat().st_size:
            raise ValueError("The exported JavaScript bundle is missing or empty")
    logos = list(directory.rglob("am-investments-logo*.jpg"))
    if not logos:
        raise ValueError("The official company logo is missing from the export")
    for logo in logos:
        decode_image(logo)
    return len(sources)


def verify_photos(snapshot, result):
    active = [p for p in snapshot["properties"] if p["status"] in {"available", "coming-soon", "under-contract"}]
    urls = list(dict.fromkeys(image["url"] for p in active for image in p.get("images", [])))
    result["photoScope"] = "all available, coming-soon and under-contract photos"
    if not urls:
        urls = list(dict.fromkeys(image["url"] for p in snapshot["properties"] for image in p.get("images", [])))[:3]
        result["photoScope"] = "up to three source photos when active listings have no photos"
    with tempfile.TemporaryDirectory(prefix="am-refresh-photos-") as temporary:
        for index, url in enumerate(urls):
            parsed = urlsplit(url)
            if parsed.scheme != "https" or parsed.hostname not in IMAGE_HOSTS or parsed.username or parsed.password:
                raise ValueError("Unexpected property-photo destination")
            target = Path(temporary) / str(index)
            request = subprocess.run([
                "curl", "--fail", "--silent", "--show-error", "--location",
                "--proto", "=https", "--proto-redir", "=https",
                "--retry", "2", "--retry-delay", "1", "--max-time", "30",
                "--output", str(target), "--write-out", "%{json}", url,
            ], capture_output=True, text=True)
            if request.returncode:
                raise RuntimeError(f"Property-photo download failed for {url}: {request.stderr.strip()}")
            response = json.loads(request.stdout)
            final = urlsplit(response["url_effective"])
            if final.scheme != "https" or final.hostname not in IMAGE_HOSTS:
                raise ValueError("Property photo redirected to an unexpected destination")
            if response["http_code"] != 200 or not (response.get("content_type") or "").lower().startswith("image/"):
                raise ValueError("Property-photo response is not an HTTP 200 image")
            photo = {"url": url, "bytes": target.stat().st_size, **decode_image(target)}
            photo["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
            result["photos"].append(photo)
            print(f"Verified photo {index + 1}/{len(urls)}: {photo['width']}x{photo['height']}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-dir", type=Path, default=ROOT / "web-build")
    parser.add_argument("--snapshot", type=Path, default=ROOT / "src/data/properties.json")
    parser.add_argument("--report", type=Path, default=ROOT / "test-results/hourly-refresh.json")
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    result = {
        "passed": False, "checkedAt": snapshot["checkedAt"], "photos": [],
        "domain": os.environ.get("AM_APP_WEB_DOMAIN", ""),
        "basePath": os.environ.get("AM_APP_WEB_BASE_PATH", "/app"),
        "counts": {status: sum(p["status"] == status for p in snapshot["properties"])
                   for status in ["available", "coming-soon", "under-contract", "sold"]},
    }
    try:
        result["bundles"] = verify_export(args.web_dir)
        verify_photos(snapshot, result)
        result["passed"] = True
    except Exception as error:
        result["error"] = str(error)
        raise
    finally:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps({key: value for key, value in result.items() if key != "photos"}, indent=2), flush=True)


if __name__ == "__main__":
    main()
