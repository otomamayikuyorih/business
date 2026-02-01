async function loadFeeds() {
  const res = await fetch("data/feeds.json", { cache: "no-store" });
  const data = await res.json();

  const genAt = new Date((data.generated_at || 0) * 1000);
  document.getElementById("genAt").textContent =
    `generated: ${isNaN(genAt) ? "-" : genAt.toLocaleString("ja-JP")}`;

  // note
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

  // youtube
  const yt = document.getElementById("ytList");
  yt.innerHTML = "";
  (data.feeds.youtube || []).slice(0, 6).forEach(v => {
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
