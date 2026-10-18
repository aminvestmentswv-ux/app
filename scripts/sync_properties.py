"""Import verified public Carrot listings; no credentials or third-party packages.

This is a build-time website importer, not a claim that Carrot supplies a JSON API.
Failed fetches or unrecognized markup leave the previous snapshot untouched.
"""
from __future__ import annotations

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urljoin, urlsplit, urlunsplit, urlencode

BASE = "https://www.aminvestmentswv.com"
COMING_SOON_URL = BASE + "/coming-soon-properties/"
ROOT = Path(__file__).resolve().parents[1]
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Element:
    def __init__(self, tag="root", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def has(self, css_class):
        return css_class in self.attrs.get("class", "").split()

    def all(self, tag=None, css_class=None):
        found = []
        for child in self.children:
            if isinstance(child, Element):
                if (tag is None or child.tag == tag) and (css_class is None or child.has(css_class)):
                    found.append(child)
                found.extend(child.all(tag, css_class))
        return found

    def text(self):
        return "".join(
            "\n" if isinstance(c, Element) and c.tag == "br" else
            c.text() if isinstance(c, Element) else c for c in self.children
        )


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def official_url(url):
    parsed = urlsplit(urljoin(BASE, url))
    if parsed.scheme != "https" or parsed.hostname not in {"www.aminvestmentswv.com", "aminvestmentswv.com"}:
        raise ValueError("Unexpected external property or pagination URL")
    if not parsed.path.startswith("/property/"):
        raise ValueError("Unexpected path outside the property collection")
    return urlunsplit(("https", "www.aminvestmentswv.com", parsed.path, parsed.query, ""))


def fetch(url, cache):
    path = cache / (re.sub(r"[^a-zA-Z0-9]", "_", url) + ".html")
    # Reuse responses within one sync run only; never silently reuse old HTML.
    if path.exists():
        return path.read_text()
    result = subprocess.run([
        "curl", "--fail", "--silent", "--show-error", "--location",
        "--proto", "=https", "--proto-redir", "=https", "--max-time", "30", url,
    ], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f"Website request failed for {url}: {result.stderr.strip()}")
    path.write_text(result.stdout)
    return result.stdout


def parse_archive(html):
    doc = Document(html).root
    listings = []
    for article in doc.all("article", "type-property"):
        links = article.all("a")
        if not links:
            raise ValueError("Property card is missing its link")
        listings.append(official_url(links[0].attrs["href"]))
    if not listings:
        raise ValueError("Property archive contains no recognized cards")
    following = [n.attrs.get("href") for n in doc.all("link") if "next" in n.attrs.get("rel", "").split()]
    return listings, official_url(following[0]) if following else None


def detail_fields(article):
    fields = {}
    for dl in article.all("dl"):
        label = None
        for node in dl.children:
            if not isinstance(node, Element):
                continue
            if node.tag == "dt":
                label = clean(node.text()).rstrip(":").lower()
            elif node.tag == "dd" and label:
                fields[label] = node.text().strip()
                label = None
    return fields


def parse_detail(html, url):
    doc = Document(html).root
    articles = doc.all("article", "type-property")
    if len(articles) != 1:
        raise ValueError("Expected one complete property article")
    article = articles[0]
    fields = detail_fields(article)
    terms = clean(fields.get("terms", "")).lower()
    if terms != "for sale":
        if terms in {"for rent", "lease option", "owner finance", "assignment of contract"}:
            return None
        raise ValueError("Missing or unrecognized listing terms")
    headings = article.all("h1", "property-title")
    if len(headings) != 1:
        raise ValueError("Property title is missing")
    badges = headings[0].all(css_class="badge")
    labels = {clean(b.text()).lower() for b in badges}
    mapping = {"for sale": "available", "coming soon": "coming-soon", "sold": "sold", "under contract": "under-contract", "pending": "under-contract"}
    statuses = {mapping[label] for label in labels if label in mapping}
    if len(statuses) != 1 or any(label not in mapping for label in labels):
        raise ValueError(f"Unrecognized or conflicting sale status: {sorted(labels)}")
    status = statuses.pop()
    title = clean("".join(c.text() if isinstance(c, Element) else c for c in headings[0].children if not isinstance(c, Element) or not c.has("badge")))
    if not title:
        raise ValueError("Property title has no address or descriptive text")
    address_field = fields.get("address", "")
    lines = [clean(line) for line in address_field.splitlines() if clean(line)]
    location = re.fullmatch(r"(.+?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?", clean(" ".join(lines[1:]))) if len(lines) > 1 else None
    record = {
        "id": urlsplit(url).path.strip("/").split("/")[-1],
        "listingType": "sale", "status": status, "title": title,
        "address": lines[0] if location else title,
        "city": location[1] if location else "", "state": location[2] if location else "",
        "locationIncomplete": location is None,
        "detailsUrl": official_url(url),
        "sourceStatus": " / ".join(sorted(labels)),
    }
    if location and location[3]:
        record["postalCode"] = location[3]
    for label, key in [("price", "price"), ("bedrooms", "bedrooms"), ("bathrooms", "bathrooms"), ("square feet", "squareFeet")]:
        raw = clean(fields.get(label, ""))
        numeric = re.sub(r"[$,]", "", raw)
        if re.fullmatch(r"\d+(?:\.\d+)?", numeric) and float(numeric) > 0:
            number = float(numeric)
            record[key] = int(number) if number.is_integer() else number
    # Some Carrot templates place the asking price in the article header only.
    if "price" not in record:
        headers = article.all("header")
        if headers:
            for node in headers[0].all("li", "lead"):
                match = re.fullmatch(r"\$([\d,]+(?:\.\d{2})?)", clean(node.text()))
                if match and float(match[1].replace(",", "")) > 0:
                    record["price"] = float(match[1].replace(",", ""))
    content = article.all(css_class="property-content")
    if content:
        paragraphs = [clean(p.text()) for p in content[0].all("p") if clean(p.text())]
        record["description"] = "\n\n".join(paragraphs)
    images = []
    photo_nodes = article.all(css_class="slider-for") + content
    for region in photo_nodes:
        for image in region.all("img"):
            src = image.attrs.get("src", "")
            parsed = urlsplit(src)
            if parsed.scheme == "https" and parsed.hostname in {"image-cdn.carrot.com", "cdn.carrot.com", "www.aminvestmentswv.com"} and src not in [i["url"] for i in images]:
                images.append({"url": src, "alt": clean(image.attrs.get("alt", "")) or record["address"]})
    record["images"] = images
    if images:
        record["imageUrl"] = images[0]["url"]
    return record


def property_key(property):
    return tuple(re.sub(r"[^a-z0-9]", "", property.get(field, "").casefold())
                 for field in ["address", "city", "state"])


def responsive_photo_url(source):
    """Use the same Carrot image service/format used by the website's own images.

    Its unresized photo endpoint can reject large originals with HTTP 413.
    Keep the original URL alongside the mobile-sized delivery URL for provenance.
    """
    url = urlsplit(source)
    if url.hostname != "image-cdn.carrot.com" or not url.path.startswith("/uploads/") or url.query:
        return source
    request = {
        "bucket": "production.carrot-uploads.oncarrot.com", "key": url.path.lstrip("/"),
        "edits": {"resize": {"width": 1152}, "toFormat": "webp", "webp": {"quality": 80}},
    }
    encoded = base64.b64encode(json.dumps(request, separators=(",", ":")).encode()).decode()
    return "https://image-cdn.carrot.com/" + encoded


def parse_coming_soon(html):
    """Read the dedicated public page, which controls the Coming Soon collection."""
    doc = Document(html).root
    sections = [section for section in doc.all("section")
                if any(clean(h.text()).casefold() == "coming soon properties"
                       for h in section.all("h1"))]
    if len(sections) != 1:
        raise ValueError("Expected one Coming Soon Properties section")
    section = sections[0]
    intro, after_heading = [], False
    for node in section.children:
        if not isinstance(node, Element):
            continue
        if node.tag == "h1":
            after_heading = True
        elif after_heading and node.tag == "p":
            intro.append(clean(node.text()))
        elif after_heading:
            break
    articles = section.all("article")
    if not articles:
        raise ValueError("Coming Soon page contains no recognized property cards")
    records, seen = [], set()
    for article in articles:
        headings = article.all("h2")
        paragraphs = [clean(p.text()) for p in article.all("p")]
        if len(headings) != 1 or len(paragraphs) < 3 or paragraphs[0].casefold() != "coming soon":
            raise ValueError("Incomplete or unrecognized Coming Soon card")
        address = clean(headings[0].text())
        location = re.fullmatch(r"(.+?),\s*([A-Z]{2})", paragraphs[1])
        if not address or not location or not location[1].strip() or not all(paragraphs[2:]):
            raise ValueError("Coming Soon card is missing its address, location or description")
        record = {
            "id": "coming-soon-" + re.sub(r"[^a-z0-9]+", "-", f"{address}-{location[1]}".casefold()).strip("-"),
            "listingType": "sale", "status": "coming-soon", "sourceStatus": "coming soon",
            "title": address, "address": address, "city": location[1], "state": location[2],
            "locationIncomplete": False, "detailsUrl": COMING_SOON_URL,
            "description": "\n\n".join(intro + paragraphs[2:]), "images": [],
        }
        key = property_key(record)
        if key in seen:
            raise ValueError("Duplicate property on the Coming Soon page")
        seen.add(key)
        for image in article.all("img"):
            src = image.attrs.get("src", "")
            url = urlsplit(src)
            if (url.scheme != "https" or url.username or url.password or
                    url.hostname not in {"image-cdn.carrot.com", "cdn.carrot.com", "www.aminvestmentswv.com"}):
                raise ValueError("Unrecognized Coming Soon photo URL")
            if src not in [photo["sourceUrl"] for photo in record["images"]]:
                record["images"].append({"url": responsive_photo_url(src), "sourceUrl": src,
                                         "alt": clean(image.attrs.get("alt", "")) or address})
        if record["images"]:
            record["imageUrl"] = record["images"][0]["url"]
        else:
            placeholders = [clean(node.text()) for node in article.all("div")
                            if not node.all() and clean(node.text())]
            if placeholders:
                record["description"] += "\n\n" + "\n\n".join(placeholders)
        records.append(record)
    return records


def merge_coming_soon(properties, upcoming):
    """Keep this section exactly aligned with the dedicated website page."""
    upcoming_keys = {property_key(property) for property in upcoming}
    return [property for property in properties
            if property["status"] != "coming-soon" and property_key(property) not in upcoming_keys] + upcoming


def apply_owner_overrides(properties):
    """Keep dated owner corrections across refreshes without hiding source badges.

    Corrections apply only to their original status. A later Sold badge is never
    changed to Available by a correction for an outdated Pending badge.
    Remove or revise the config when the owner reports another status change.
    """
    overrides = json.loads((ROOT / "src/data/property-overrides.json").read_text())
    for property in properties:
        override = overrides.get(property["id"])
        if override is None or property["status"] != override["fromStatus"]:
            continue
        if (override["fromStatus"] != "under-contract" or override["status"] != "available"
                or not override["reason"].strip()):
            raise ValueError("Invalid owner availability correction")
        datetime.strptime(override["confirmedOn"], "%Y-%m-%d")
        property["status"] = override["status"]
        property["statusOverride"] = {key: override[key] for key in
                                      ["fromStatus", "status", "confirmedOn", "reason"]}
        for replacement in override.get("descriptionReplacements", []):
            property["description"] = property.get("description", "").replace(
                replacement["from"], replacement["to"])
    return properties


def sync(output):
    import tempfile
    with tempfile.TemporaryDirectory(prefix="am-listing-sync-") as temp:
        cache = Path(temp)
        pages, links, seen = [], [], set()
        url = BASE + "/property/?terms=sale"
        while url:
            if url in pages or len(pages) >= 100:
                raise ValueError("Loop or excessive pagination in property archive")
            pages.append(url)
            batch, following = parse_archive(fetch(url, cache))
            for link in batch:
                if link in seen:
                    raise ValueError(f"Duplicate listing across archive pages: {link}")
                seen.add(link)
                links.append(link)
            if following:
                parsed = urlsplit(following)
                url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode({"terms": "sale"}), ""))
            else:
                url = None
            print(f"Read archive page {len(pages)}; found {len(links)} property links", flush=True)

        def read_property(link):
            try:
                return parse_detail(fetch(link, cache), link)
            except Exception as error:
                raise ValueError(f"Cannot verify {link}: {error}") from error

        with ThreadPoolExecutor(max_workers=4) as pool:
            imported = list(pool.map(read_property, links))
        properties = [p for p in imported if p is not None]
        if not properties:
            raise ValueError("Refusing to replace inventory with an empty import")
        apply_owner_overrides(properties)
        upcoming = parse_coming_soon(fetch(COMING_SOON_URL, cache))
        excluded_count = len(imported) - len(properties)
        properties = merge_coming_soon(properties, upcoming)
        pages.append(COMING_SOON_URL)
        snapshot = {
            "schemaVersion": 1, "checkedAt": datetime.now(timezone.utc).isoformat(),
            "sourceUrl": BASE + "/property/", "sourcePages": pages,
            "sourcePropertyCount": len(properties) + excluded_count, "excludedNonSaleCount": excluded_count,
            "properties": properties,
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(".tmp")
        temporary.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n")
        temporary.replace(output)
        counts = {status: sum(p["status"] == status for p in properties) for status in ["available", "coming-soon", "under-contract", "sold"]}
        print(f"Saved {len(properties)} verified for-sale properties to {output}: {counts}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "src/data/properties.json")
    args = parser.parse_args()
    sync(args.output)
