# scripts/fetch_feeds.py
import json
import re
import time
import urllib.request
import xml.etree.ElementTree as ET

USER_AGENT = "all-man-bot/1.1 (+https://github.com/)"

NOTE_RSS = "https://note.com/biz_organized/rss"
YOUTUBE_HANDLE_URL = "https://www.youtube.com/@jazz-manbo"

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=25) as res:
        return res.read()

def parse_rss(xml_bytes: bytes, limit: int = 5):
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    items = []
    if channel is None:
        return items

    for item in channel.findall("item")[:limit]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        items.append({"title": title, "link": link, "date": pub})
    return items

def parse_atom(xml_bytes: bytes, limit: int = 5):
    ns = {"a": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(xml_bytes)
    entries = []

    for entry in root.findall("a:entry", ns)[:limit]:
        title = (entry.findtext("a:title", default="", namespaces=ns) or "").strip()
        link_el = entry.find("a:link", ns)
        link = (link_el.get("href") if link_el is not None else "").strip()
        published = (entry.findtext("a:published", default="", namespaces=ns) or "").strip()

        # YouTube thumbnail (media:thumbnail)
        thumb = ""
        for el in entry.iter():
            if el.tag.endswith("thumbnail") and "url" in el.attrib:
                thumb = el.attrib["url"]
                break

        entries.append({"title": title, "link": link, "date": published, "thumb": thumb})
    return entries

def resolve_youtube_channel_id_from_handle(handle_url: str) -> str:
    """
    Fetch https://www.youtube.com/@handle and extract channelId (UCxxxx).
    This runs in GitHub Actions so CORS isn't a concern.
    """
    html = fetch(handle_url).decode("utf-8", errors="ignore")

    # common patterns in YouTube HTML/JSON blobs
    m = re.search(r'"channelId":"(UC[a-zA-Z0-9_-]{20,})"', html)
    if m:
        return m.group(1)

    m = re.search(r'channel_id=(UC[a-zA-Z0-9_-]{20,})', html)
    if m:
        return m.group(1)

    # fallback: look for /channel/UC... links
    m = re.search(r'/channel/(UC[a-zA-Z0-9_-]{20,})', html)
    if m:
        return m.group(1)

    raise RuntimeError("Could not resolve YouTube channelId from handle page.")

def main():
    out = {"generated_at": int(time.time()), "feeds": {"note": [], "youtube": []}}

    # note RSS
    try:
        note_xml = fetch(NOTE_RSS)
        out["feeds"]["note"] = parse_rss(note_xml, limit=6)
    except Exception as e:
        out["feeds"]["note_error"] = str(e)

    # youtube RSS (resolve channel_id automatically)
    try:
        channel_id = resolve_youtube_channel_id_from_handle(YOUTUBE_HANDLE_URL)
        yt_feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        yt_xml = fetch(yt_feed_url)
        out["feeds"]["youtube"] = parse_atom(yt_xml, limit=8)
        out["feeds"]["youtube_channel_id"] = channel_id
    except Exception as e:
        out["feeds"]["youtube_error"] = str(e)

    with open("data/feeds.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
