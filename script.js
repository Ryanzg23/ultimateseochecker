async function fetchSEO(inputUrl, card) {
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
      <div class="value">
        ${
          data.amphtml
            ? `<a href="${data.amphtml}" target="_blank">${data.amphtml}</a>`
            : "—"
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
      <button class="retry-btn">Retry</button>
    `;

    card.querySelector(".retry-btn").onclick = () => {
      card.innerHTML = `
        <h3>${inputUrl}</h3>
        <div class="value">Retrying…</div>
      `;
      fetchSEO(inputUrl, card);
    };
  }
}

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

    await fetchSEO(inputUrl, card);
  }
}
