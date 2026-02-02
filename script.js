async function run() {
  const input = document.getElementById("domains").value;
  const domains = input.split("\n").map(d => d.trim()).filter(Boolean);
  const results = document.getElementById("results");

  results.innerHTML = "";

  for (const domain of domains) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<h3>${domain}</h3><div>Loading...</div>`;
    results.appendChild(card);

    try {
      const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(domain)}`);
      const data = await res.json();

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
      `;
    } catch (e) {
      card.innerHTML = `<h3>${domain}</h3><div>Error loading data</div>`;
    }
  }
}
