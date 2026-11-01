"""Fetch the reviewed eval source pages; no model calls or user trip data."""
import concurrent.futures
import datetime
from html.parser import HTMLParser
import json
import os
import pathlib
import re
import sys
import urllib.request
import urllib.parse


class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_page(url):
    observed = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Reviewed source must be an HTTPS URL without credentials")
        opener = urllib.request.build_opener(NoRedirect)
        request = urllib.request.Request(url, headers={"User-Agent": "Faroway UAT evidence check"})
        with opener.open(request, timeout=15) as response:
            body = response.read(1_000_001)
            if len(body) > 1_000_000:
                raise ValueError("Source exceeds evidence size limit")
            html = body.decode(response.headers.get_content_charset() or "utf-8", errors="replace")
        parser = PageText()
        parser.feed(html)
        return {"url": url, "observedAt": observed, "text": re.sub(r"\s+", " ", " ".join(parser.parts)).strip()}
    except Exception as error:
        return {"url": url, "observedAt": observed, "error": str(error)}


def main():
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in ("--addresses", "--hotels")):
        sys.exit("Usage: python3 scripts/uat/fetch-grounding-pages.py NEW_OUTPUT_JSON [--addresses|--hotels]")
    output = pathlib.Path(sys.argv[1])
    if output.exists():
        sys.exit("Output exists; preserve previous evidence")
    fixture = {
        "--addresses": "agentic-venue-addresses.json",
        "--hotels": "agentic-hotel-constraints.json",
    }.get(sys.argv[2] if len(sys.argv) == 3 else "", "agentic-venue-constraints.json")
    facts = json.loads((pathlib.Path(__file__).parent.parent / "fixtures" / fixture).read_text())
    urls = sorted({fact["sourceUrl"] for fact in facts})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pages = list(pool.map(fetch_page, urls))
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as file:
        json.dump(pages, file, ensure_ascii=False, indent=2)
    print(json.dumps({"pages": len(pages), "retrieved": sum("text" in p for p in pages), "modelCalls": 0}))


if __name__ == "__main__":
    main()
