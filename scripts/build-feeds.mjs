// scripts/build-feeds.mjs
import fs from "node:fs";
import path from "node:path";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "ALL-MAN-Bot" } });
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${url}`);
  return await res.text();
}

/** ===== note RSS “できるだけ全部拾う”用ユーティリティ ===== */

function decodeBasicEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickCdataOrText(inner) {
  const cdata = inner.match(/<!\[CDATA\[(.*?)\]\]>/s)?.[1];
  return cdata != null ? cdata : inner;
}

function getFirstTagInner(xml, tagName) {
  const re = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );
  const m = xml.match(re);
  return m?.[1] ?? "";
}

function getFirstTagText(xml, tagName) {
  const inner = getFirstTagInner(xml, tagName);
  const text = pickCdataOrText(inner).trim();
  return decodeBasicEntities(text);
}

function getAllTagText(xml, tagName) {
  const re = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "gi"
  );
  const out = [];
  for (const m of xml.matchAll(re)) {
    const inner = m[1] ?? "";
    const text = decodeBasicEntities(pickCdataOrText(inner).trim());
    if (text) out.push(text);
  }
  return out;
}

function getAllSelfClosingTagAttrs(xml, tagName) {
  // <tag ... /> or <tag ...> の attrs を拾う（media:thumbnail, enclosure など）
  const re = new RegExp(`<${tagName}\\s+([^>]*?)(?:\\/?>)`, "gi");
  const items = [];

  for (const m of xml.matchAll(re)) {
    const attrStr = (m[1] ?? "").trim();
    if (!attrStr) continue;

    const attrs = {};

    // "..."
    for (const a of attrStr.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)) {
      attrs[a[1]] = decodeBasicEntities(a[2]);
    }
    // '...'
    for (const a of attrStr.matchAll(/([:\w-]+)\s*=\s*'([^']*)'/g)) {
      if (!(a[1] in attrs)) attrs[a[1]] = decodeBasicEntities(a[2]);
    }

    items.push(attrs);
  }

  return items;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// note RSS: <item> から “取れる情報は全部” 拾う
function pickItemsFromRss(xml, limit = 10) {
  const items = [];
  const blocks = xml.split("<item>").slice(1);

  for (const b0 of blocks) {
    if (items.length >= limit) break;

    // </item> までを対象にする（後続の <item> 混入防止）
    const b = b0.split("</item>")[0] ?? b0;

    // 基本
    const title = getFirstTagText(b, "title");
    const link = getFirstTagText(b, "link");
    const pubDate = getFirstTagText(b, "pubDate");
    const guid = getFirstTagText(b, "guid");

    // 作者（揺れ対策）
    const author = getFirstTagText(b, "author");
    const dcCreator = getFirstTagText(b, "dc:creator");

    // 本文/要約（HTMLのことが多い）
    const descriptionHtml = getFirstTagText(b, "description");
    const contentEncoded = getFirstTagText(b, "content:encoded");

    // 複数あり得る
    const categories = getAllTagText(b, "category");

    // noteのサムネ（複数拾う）
    const thumbs = getAllSelfClosingTagAttrs(b, "media:thumbnail");
    const thumb = thumbs[0]?.url ?? "";

    // enclosure（url/type/length 等）
    const enclosures = getAllSelfClosingTagAttrs(b, "enclosure");

    // 追加で出る可能性のあるもの（あれば）
    const dcDate = getFirstTagText(b, "dc:date");
    const mediaContent = getAllSelfClosingTagAttrs(b, "media:content");

    if (!link) continue;

    items.push({
      title,
      link,
      date: pubDate || dcDate,
      guid,
      author: dcCreator || author,

      categories,

      description_html: descriptionHtml,
      description_text: descriptionHtml ? stripTags(descriptionHtml) : "",
      content_encoded: contentEncoded,

      thumb,
      thumbs,
      enclosures,
      media_content: mediaContent,

      // 取りこぼし対策（必要なければ消してOK）
      raw_item_xml: b,
    });
  }

  return items;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  // note RSS（安定）
  const noteRssUrl = "https://note.com/biz_organized/rss";

  // YouTube Atom feed（channel_id 固定：env不要）
  const ytFeedUrl =
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCjxf5PsgMyF_t1Az_6duZfg";

  const [noteXml, ytXml] = await Promise.all([
    fetchText(noteRssUrl),
    fetchText(ytFeedUrl),
  ]);

  // note（できるだけ全部）
  const noteItems = pickItemsFromRss(noteXml, 10);

  // YouTube Atom: <entry> をざっくりパース
  const yt = [];
  const entries = ytXml.split("<entry>").slice(1);
  for (const e of entries) {
    if (yt.length >= 8) break;

    const title = (e.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
    const link = (
      e.match(/<link[^>]*rel="alternate"[^>]*href="(.*?)"/)?.[1] ?? ""
    ).trim();
    const published = (e.match(/<published>(.*?)<\/published>/)?.[1] ?? "").trim();
    const thumb = (e.match(/<media:thumbnail[^>]*url="(.*?)"/)?.[1] ?? "").trim();

    if (link) yt.push({ title, link, date: published, thumb });
  }

  // app.js が ./data/feed.json を読むので、ここは feed.json に統一
  const out = {
    generated_at: Math.floor(Date.now() / 1000),
    feeds: { note: noteItems, youtube: yt },
  };

  ensureDir(path.join(process.cwd(), "data"));
  fs.writeFileSync(path.join("data", "feed.json"), JSON.stringify(out, null, 2), "utf-8");

  console.log("wrote data/feed.json");
  console.log(`note: ${noteItems.length}, youtube: ${yt.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
