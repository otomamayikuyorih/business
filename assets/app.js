// assets/app.js

function toEpoch(s) {
  if (!s) return 0;
  // note: pubDate (RFC822), YouTube: ISO
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

function fmtDate(s) {
  const t = toEpoch(s);
  if (!t) return "";
  return new Date(t).toLocaleString("ja-JP");
}

function stripTags(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function joinCategories(cats) {
  if (!Array.isArray(cats) || cats.length === 0) return "";
  const uniq = [...new Set(cats.map((c) => (c || "").trim()).filter(Boolean))];
  return uniq.join(" / ");
}

function makeNoteItem(item) {
  const li = document.createElement("li");
  li.className = "card note";

  // thumb がある時だけ 2カラムにしたいのでクラス付与
  const thumbUrl = (item.thumb || "").trim();
  if (thumbUrl) {
    li.classList.add("hasThumb");

    const img = document.createElement("img");
    img.className = "thumb";
    img.loading = "lazy";
    img.src = thumbUrl;
    img.alt = item.title || "note";
    li.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "body";

  const a = document.createElement("a");
  a.className = "title";
  a.href = item.link;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = item.title || item.link;
  body.appendChild(a);

  // meta: date / author / categories
  const parts = [];
  const d = fmtDate(item.date);
  if (d) parts.push(d);
  if (item.author) parts.push(`by ${item.author}`);
  const cats = joinCategories(item.categories);
  if (cats) parts.push(cats);

  if (parts.length) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = parts.join("  |  ");
    body.appendChild(meta);
  }

  // description (text)
  const desc =
    (item.description_text && item.description_text.trim()) ||
    stripTags(item.description_html || "");

  if (desc) {
    const p = document.createElement("p");
    p.className = "desc";
    p.textContent = desc.length > 160 ? desc.slice(0, 160) + "…" : desc;
    body.appendChild(p);
  }

  // optional extra indicator
  if (item.enclosures && item.enclosures.length) {
    const ex = document.createElement("div");
    ex.className = "extra";
    ex.textContent = `enclosure: ${item.enclosures.length}`;
    body.appendChild(ex);
  }

  li.appendChild(body);
  return li;
}

function makeYtItem(v) {
  const a = document.createElement("a");
  a.className = "yt card";
  a.href = v.link;
  a.target = "_blank";
  a.rel = "noopener";

  const thumbUrl = (v.thumb || "").trim();
  if (thumbUrl) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.loading = "lazy";
    img.src = thumbUrl;
    img.alt = v.title || "YouTube";
    a.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "body";

  const t = document.createElement("div");
  t.className = "title";
  t.textContent = v.title || v.link;
  body.appendChild(t);

  const d = fmtDate(v.date);
  if (d) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = d;
    body.appendChild(meta);
  }

  a.appendChild(body);
  return a;
}

async function loadFeeds() {
  const res = await fetch(`./data/feed.json?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`feed.json fetch failed: ${res.status}`);

  const data = await res.json();

  // generated_at
  const genAt = new Date((data.generated_at || 0) * 1000);
  const genEl = document.getElementById("genAt");
  if (genEl) {
    genEl.textContent = `generated: ${isNaN(genAt) ? "-" : genAt.toLocaleString("ja-JP")}`;
  }

  // note
  const noteList = document.getElementById("noteList");
  if (!noteList) throw new Error("missing #noteList");
  noteList.innerHTML = "";

  const notes = (data.feeds?.note || [])
    .slice()
    .sort((a, b) => toEpoch(b.date) - toEpoch(a.date))
    .slice(0, 6);

  notes.forEach((item) => noteList.appendChild(makeNoteItem(item)));

  // youtube
  const ytList = document.getElementById("ytList");
  if (!ytList) throw new Error("missing #ytList");
  ytList.innerHTML = "";

  const yts = (data.feeds?.youtube || [])
    .slice()
    .sort((a, b) => toEpoch(b.date) - toEpoch(a.date))
    .slice(0, 6);

  yts.forEach((v) => ytList.appendChild(makeYtItem(v)));
}

loadFeeds().catch((e) => {
  console.error(e);

  // 画面にも出す（真っ白回避）
  const top = document.querySelector("#top .brandText");
  if (top) {
    const p = document.createElement("p");
    p.style.marginTop = "8px";
    p.style.color = "crimson";
    p.textContent = `feed load error: ${e?.message || e}`;
    top.appendChild(p);
  }
});
