const CONCURRENCY = 5;

async function run() {
  const input = document.getElementById("domains").value;
  const domains = input.split("\n").map(d => d.trim()).filter(Boolean);
  const results = document.getElementById("results");

  results.innerHTML = "";
  initProgress(domains.length);

  let completed = 0;
  const queue = [...domains];

  const workers = Array.from({ length: CONCURRENCY }, () => worker());

  async function worker() {
    while (queue.length) {
      const domain = queue.shift();
      await processDomain(domain);
      completed++;
      updateProgress(completed, domains.length);
    }
  }

  await Promise.all(workers);
}

async function processDomain(domain) {
  const results = document.getElementById("results");

  const card = document.createElement("div");
  card.className = "card loading";
  card.innerHTML = `
    <div class="card-header">
      <h3>${domain}</h3>
      <span class="badge blue">LOADING</span>
    </div>
    <div class="value muted">Fetching data…</div>
  `;
  results.appendChild(card);

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(domain)}`);
    const data = await res.json();

    const titleCount = data.title.length;
    const descCount = data.description.length;

    card.className = "card success";
    card.innerHTML = `
      <div class="card-header">
        <h3>${data.url}</h3>
        <span class="badge green">OK</span>
      </div>

      <div class="label">Title (${titleCount} characters)</div>
      <div class="value">${data.title || "—"}</div>

      <div class="label">Meta Description (${descCount} characters)</div>
      <div class="value">${data.description || "—"}</div>

      <div class="label">Canonical</div>
      <div class="value">${data.canonical || "—"}</div>

      <div class="label">AMP HTML</div>
      <div class="value">${data.amphtml || "—"}</div>
    `;
  } catch {
    card.className = "card error";
    card.innerHTML = `
      <div class="card-header">
        <h3>${domain}</h3>
        <span class="badge red">ERROR</span>
      </div>
      <div class="value">Failed to fetch data</div>
      <button class="retry" onclick="retry('${domain}', this)">Retry</button>
    `;
  }
}

function retry(domain, btn) {
  btn.remove();
  processDomain(domain);
}

/* ---------- PROGRESS ---------- */

function initProgress(total) {
  document.getElementById("progress").classList.remove("hidden");
  updateProgress(0, total);
}

function updateProgress(done, total) {
  const percent = Math.round((done / total) * 100);
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressText").textContent = `${done} / ${total}`;
}

/* ---------- THEME ---------- */

function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("theme", next);
}

(function () {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.dataset.theme = saved;
})();
