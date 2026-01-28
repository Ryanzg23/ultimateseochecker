async function run() {
  const textarea = document.getElementById("domains");
  const results = document.getElementById("results");

  const urls = textarea.value
    .split("\n")
    .map(u => u.trim())
    .filter(Boolean);

  results.innerHTML = "";

  if (urls.length === 0) {
    results.innerHTML = "<p>Please enter at least one URL.</p>";
    return;
  }

  for (const inputUrl of urls) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${inputUrl}</h3>
      <div class="value">Checking…</div>
    `;
    results.appendChild(card);

    try {
      const res = await fetch(
        `/.netlify/functions/seo?url=${encodeURIComponent(inputUrl)}`
      );
      const data = await res.json();

      if (!res.ok) throw new Error();

      card.innerHTML = `
        <h3>${data.url}</h3>

        <div class="label">Title</div>
        <div class="value">${data.title || "—"}</div>

        <div class="label">Meta Description</div>
        <div class="value">${data.description || "—"}</div>

        <div class="label">Canonical</div>
        <div class="value">${data.canonical || "—"}</div>

        <div class="label">AMP HTML</div>
        <div class="value">${data.amphtml || "—"}</div>

        <div class="label">AMP Status (Canonical)</div>
        <div class="value">
          ${data.ampStatus || "—"}<br>
          <a href="${data.ampTestUrl}" target="_blank">Open AMP Test</a>
        </div>

        <div class="label">Linked AMP Version</div>
        <div class="value">
          ${
            data.linkedAmp?.url
              ? `Status: ${data.linkedAmp.status}<br>
                 <a href="${data.linkedAmp.url}" target="_blank">Open AMP URL</a>`
              : "No AMP linked"
          }
        </div>

        <div class="label">PageSpeed</div>
        <div class="value">
          Desktop: ${data.pageSpeed?.desktop ?? "—"} / 100<br>
          Mobile: ${data.pageSpeed?.mobile ?? "—"} / 100
        </div>
      `;
    } catch {
      card.innerHTML = `
        <h3>${inputUrl}</h3>
        <div class="value">Error fetching data</div>
      `;
    }
  }
}
