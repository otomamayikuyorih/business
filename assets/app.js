function toEpoch(s) {
  if (!s) return 0;
  // note: pubDate (RFC822), YouTube: ISO
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

function labelOf(kind) {
  if (kind === "note") return "note";
  if (kind === "youtube") return "YouTube";
  return kind;
}

async function loadFeeds() {
  const res = await fetch(`./data/feed.json?v=${Date.now()}`, { cache: "no-store" });
  const data = await res.json();

  const genAt = new Date((data.generated_at || 0) * 1000);
  document.getElementById("genAt").textContent =
    `generated: ${isNaN(genAt) ? "-" : genAt.toLocaleString("ja-JP")}`;

  // ---- MIX HEADLINES (note + youtube) ----
  const mixed = [];
  (data.feeds.note || []).forEach(x => mixed.push({ ...x, kind: "note", ts: toEpoch(x.date) }));
  (data.feeds.youtube || []).forEach(x => mixed.push({ ...x, kind: "youtube", ts: toEpoch(x.date) }));
  mixed.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const mixList = document.getElementById("mixList");
  mixList.innerHTML = "";
  mixed.slice(0, 3).forEach(item => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = item.title || item.link;

    const meta = document.createElement("span");
    meta.className = "hmeta";
    const d = item.ts ? new Date(item.ts).toLocaleDateString("ja-JP") : "";
    meta.textContent = ` ${labelOf(item.kind)} / ${d}`;

    li.appendChild(a);
    li.appendChild(meta);
    mixList.appendChild(li);
  });

  // ---- existing note list ----
  const noteList = document.getElementById("noteList");
  noteList.innerHTML = "";
  (data.feeds.note || []).forEach(item => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = item.title || item.link;
    li.appendChild(a);
    noteList.appendChild(li);
  });

  // ---- existing youtube grid ----
  const yt = document.getElementById("ytList");
  yt.innerHTML = "";
  (data.feeds.youtube || []).slice(0, 3).forEach(v => {
    const a = document.createElement("a");
    a.className = "yt";
    a.href = v.link;
    a.target = "_blank";
    a.rel = "noopener";

    if (v.thumb) {
      const img = document.createElement("img");
      img.src = v.thumb;
      img.alt = v.title || "YouTube";
      a.appendChild(img);
    }

    const t = document.createElement("div");
    t.className = "t";
    t.textContent = v.title || v.link;
    a.appendChild(t);

    yt.appendChild(a);
  });
}

loadFeeds().catch(console.error);



