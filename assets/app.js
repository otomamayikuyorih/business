// assets/app.js

function toEpoch(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

function fmtDate(s) {
  const t = toEpoch(s);
  if (!t) return "";
  return new Date(t).toLocaleString("ja-JP");
}

function stripTags(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * note の 1記事分 DOM を生成
 */
function makeNoteItem(item) {
  const li = document.createElement("li");
  li.className = "card note";

  const body = document.createElement("div");
  body.className = "body";

  /* ===== title ===== */
  const a = document.createElement("a");
  a.className = "title";
  a.href = item.link;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = item.title || item.link;
  body.appendChild(a);

  /* ===== meta (date) ===== */
  const dateText = fmtDate(item.date);
  if (dateText) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = dateText;
    body.appendChild(meta);
  }

  /* ===== description + 続きはこちら ===== */
  const rawDesc =
    item.description_text ||
    stripTags(item.description_html || "");

  if (rawDesc) {
    const p = document.createElement("p");
    p.className = "desc";

    const limit = 160;
    const trimmed =
      rawDesc.length > limit
        ? rawDesc.slice(0, limit).replace(/\s+$/, "") + "…"
        : rawDesc;

    // 本文テキスト
    const span = document.createElement("span");
    span.textContent = trimmed + " ";
    p.appendChild(span);

    // （続きはこちら）
    const more = document.createElement("a");
    more.href = item.link;
    more.target = "_blank";
    more.rel = "noopener";
    more.className = "moreLink";
    more.textContent = "（続きはこちら）";

    p.appendChild(more);
    body.appendChild(p);
  }

  li.appendChild(body);
  return li;
}

/**
 * feed.json を読み込んで描画
 */
async function loadFeeds() {
  const res = await fetch(`./data/feed.json?v=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`feed.json fetch failed: ${res.status}`);

  const data = await res.json();

  /* ===== generated_at ===== */
  const genEl = document.getElementById("genAt");
  if (genEl && data.generated_at) {
    const d = new Date(data.generated_at * 1000);
    genEl.textContent = `generated: ${d.toLocaleString("ja-JP")}`;
  }

  /* ===== note list ===== */
  const noteList = document.getElementById("noteList");
  if (!noteList) throw new Error("missing #noteList");

  noteList.innerHTML = "";

  const notes = (data.feeds?.note || [])
  .slice()
  .sort((a, b) => toEpoch(b.date) - toEpoch(a.date))
  .slice(0, 3);   // ← 最新3件だけ表示

  notes.forEach((item) => {
    noteList.appendChild(makeNoteItem(item));
  });
}

/* ===== boot ===== */
loadFeeds().catch((err) => {
  console.error(err);

  // 画面にもエラーを出す（真っ白防止）
  const list = document.getElementById("noteList");
  if (list) {
    const li = document.createElement("li");
    li.style.color = "crimson";
    li.textContent = `Error loading feed: ${err.message || err}`;
    list.appendChild(li);
  }
});
