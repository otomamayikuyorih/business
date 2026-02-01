// scripts/build_note_feed.mjs
import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";

const NOTE_RSS = "https://note.com/biz_organized/rss";
const OUT_PATH = path.join("data", "feed.json");
const MAX_ITEMS = 8;

const parser = new Parser({
  headers: {
    "User-Agent": "man-ai-feed-bot/1.0 (+github actions)",
  },
});

function toISODate(d) {
  const dt = d ? new Date(d) : null;
  return dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : null;
}

function pickThumb(item) {
  // note RSS: enclosure / media:thumbnail / content:encoded 内の画像…などがあり得る
  // rss-parserのcustomFields無しでも enclosure.url が取れることが多い
  if (item.enclosure?.url) return item.enclosure.url;

  // item.content に img が含まれている場合の簡易抽出
  const html = item["content:encoded"] || item.content || item.contentSnippet || "";
  const m = String(html).match(/<img[^>]+src="([^"]+)"/i);
  if (m?.[1]) return m[1];

  return "";
}

async function main() {
  const feed = await parser.parseURL(NOTE_RSS);

  const items = (feed.items || []).slice(0, MAX_ITEMS).map((it) => ({
    title: it.title || "",
    link: it.link || "",
    date: toISODate(it.isoDate || it.pubDate) || "",
    thumb: pickThumb(it),
  }));

  const out = {
    generated_at: Date.now(),
    feeds: {
      note: items,
      youtube: [], // noteだけ検証なので空でOK（今のUIがyoutubeも見るなら空配列が安全）
    },
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf-8");

  console.log(`Wrote ${OUT_PATH} (${items.length} items)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
