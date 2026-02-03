const CONCURRENCY = 5;

/* ================================
   UI HELPERS
================================ */

function setLoading(state) {
  document.getElementById("runBtn").disabled = state;
  document.getElementById("clearBtn").disabled = state;
  document.getElementById("openBulkBtn").disabled = state;
}

function clearDomains() {
  document.getElementById("domains").value = "";
  document.getElementById("results").innerHTML = "";

  const progress = document.getElementById("progress");
  progress.classList.add("hidden");
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById("progressText").textContent = "";
}

/* ================================
   MAIN RUN
================================ */

async function run() {
  const input = document.getElementById("domains").value;
  const domains = input.split("\n").map(d => d.trim()).filter(Boolean);
  if (!domains.length) return;

  setLoading(true);
  document.getElementById("results").innerHTML = "";
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
  setLoading(false);
}

/* ================================
   PROCESS DOMAIN (MAIN + AMP)
================================ */

async function processDomain(domain, options = {}) {
  const { isAmp = false } = options;
  const results = document.getElementById("results");

  const card = document.createElement("div");
  card.className = "card";
  if (isAmp) card.classList.add("amp-card");

  card.innerHTML = `
    <div class="card-header">
      <h3>${domain}</h3>
      ${isAmp ? `<span class="badge purple">AMP</span>` : `<span class="badge blue">LOADING</span>`}
    </div>
    <div class="muted">Checking domain…</div>
  `;
  results.appendChild(card);

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error();

    const redirected = data.finalUrl !== data.inputUrl;
    const titleCount = data.title.length;
    const descCount = data.description.length;

    card.innerHTML = `
      <div class="card-header">
        <h3>${data.inputUrl}</h3>
        ${!redirected && !isAmp ? `<span class="badge green ok-badge">OK</span>` : ``}
        ${isAmp ? `<span class="badge purple">AMP</span>` : ``}
      </div>

      ${redirected ? `
        <div class="redirect">
          301 Redirect → ${data.finalUrl}
        </div>
      ` : ``}

      <div class="label">Title (${titleCount} characters)</div>
      <div class="value">${data.title || "—"}</div>

      <div class="label">Meta Description (${descCount} characters)</div>
      <div class="value">${data.description || "—"}</div>

      <div class="label">Canonical</div>
      <div class="value">${data.canonical || "—"}</div>

      <div class="label">AMP HTML</div>
      <div class="value">
        ${
          data.amphtml && !isAmp
            ? `<a href="#" onclick="openAmp('${data.amphtml}', this)">Open AMP</a>`
            : data.amphtml || "—"
        }
      </div>

      <div class="label">Robots</div>
      <div class="value">
        ${data.robots
          ? `<a href="${data.robots}" target="_blank">${data.robots}</a>`
          : "No Robots detected"}
      </div>

      <div class="label">Sitemap</div>
      <div class="value">
        ${data.sitemap
          ? `<a href="${data.sitemap}" target="_blank">${data.sitemap}</a>`
          : "No Sitemap detected"}
      </div>
    `;

    const okBadge = card.querySelector(".ok-badge");
    if (okBadge) setTimeout(() => okBadge.remove(), 2000);

  } catch {
    card.innerHTML = `
      <div class="card-header">
        <h3>${domain}</h3>
        <span class="badge red">ERROR</span>
      </div>
      <div class="value">Domain not active</div>
    `;
  }
}

/* ================================
   AMP CARD HANDLER (NEW)
================================ */

function openAmp(url, el) {
  el.textContent = "Loading AMP…";
  el.style.pointerEvents = "none";

  processDomain(url, { isAmp: true });
}

/* ================================
   PROGRESS
================================ */

function initProgress(total) {
  const p = document.getElementById("progress");
  p.classList.remove("hidden");
  updateProgress(0, total);
}

function updateProgress(done, total) {
  document.getElementById("progressBar").style.width =
    Math.round((done / total) * 100) + "%";

  document.getElementById("progressText").textContent =
    done === total ? `${total} Done` : `${done} / ${total}`;
}

/* ================================
   THEME TOGGLE (KEEP THIS)
================================ */

function toggleTheme() {
  const html = document.documentElement;
  const btn = document.getElementById("themeToggle");

  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("theme", next);

  if (btn) btn.textContent = next === "dark" ? "🌙" : "☀️";
}

(function () {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = saved;
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = saved === "dark" ? "🌙" : "☀️";
})();
