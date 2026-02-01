// scripts/build_note_feed.mjs
import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";

const NOTE_RSS = "https://note.com/biz_organized/rss";
const YT_RSS = "https://www.youtube.com/feeds/videos.xml?channel_id=UCjxf5PsgMyF_t1Az_6duZfg";

const OUT_PATH = path.join("data", "feed.json");
const MAX_NOTE = 8;
const MAX_YT = 6;

const parser = new Parser({
  headers: {
    "User-Agent": "man-ai-feed-bot/1.0 (+github actions)",
  },
});

function toISODate(d) {
  const dt = d ? new Date(d) : null;
  return dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : "";
}

function pickNoteThumb(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  const html = item["content:encoded"] || item.content || item.contentSnippet || "";
  const m = String(html).match(/<img[^>]+src="([^"]+)"/i);
  return m?.[1] || "";
}

function pickYouTubeThumb(item) {
  // YouTube RSS: media:group -> media:thumbnail
  const g = item["media:group"];
  const thumbs = g?.["media:thumbnail"];
  // thumbs は配列のことが多い
  if (Array.isArray(thumbs) && thumbs[0]?.$?.url) return thumbs[0].$?.url;
  // 単体オブジェクトのこともある
  if (thumbs?.$?.url) return thumbs.$.url;

  // フォールバック: content から img を拾う
  const html = item.content || item.contentSnippet || "";
  const m = String(html).match(/<img[^>]+src="([^"]+)"/i);
  return m?.[1] || "";
}

async function main() {
  const [note, yt] = await Promise.all([
    parser.parseURL(NOTE_RSS),
    parser.parseURL(YT_RSS),
  ]);

  const notes = (note.items || []).slice(0, MAX_NOTE).map((it) => ({
    title: it.title || "",
    link: it.link || "",
    date: toISODate(it.isoDate || it.pubDate),
    thumb: pickNoteThumb(it),
  }));

  const yts = (yt.items || []).slice(0, MAX_YT).map((it) => ({
    title: it.title || "",
    link: it.link || "",
    date: toISODate(it.isoDate || it.pubDate),
    thumb: pickYouTubeThumb(it),
  }));

  const out = {
    generated_at: Math.floor(Date.now() / 1000),
    feeds: {
      note: notes,
      youtube: yts,
    },
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Wrote ${OUT_PATH} (note:${notes.length}, yt:${yts.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
