const CONCURRENCY = 5;

/* ================================
   UTIL: HOSTNAME NORMALIZATION
================================ */

function normalizeHost(url) {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function isSameSite(a, b) {
  return normalizeHost(a) === normalizeHost(b);
}

/* ================================
   UI HELPERS
================================ */

function setLoading(state) {
  document.getElementById("runBtn").disabled = state;
  document.getElementById("clearBtn").disabled = state;
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
  setLoading(false);
}

/* ================================
   PROCESS DOMAIN
================================ */

async function processDomain(domain) {
  const results = document.getElementById("results");

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-header">
      <h3>${domain}</h3>
      <span class="badge blue">LOADING</span>
    </div>
    <div class="muted">Checking domain…</div>
  `;
  results.appendChild(card);

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(domain)}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error("inactive");
    }

    /* -------- EXTERNAL REDIRECT ONLY -------- */
    if (data.redirect301 && normalizeHost(domain) !== normalizeHost(data.redirect301)) {
      card.innerHTML = `
        <div class="card-header">
          <h3>${data.url}</h3>
        </div>
        <div class="redirect">
          301 Redirect → ${data.redirect301}
        </div>
      `;
      return;
    }

    /* -------- ACTIVE (INTERNAL REDIRECT OK) -------- */
    const titleCount = data.title ? data.title.length : 0;
    const descCount = data.description ? data.description.length : 0;

    card.innerHTML = `
      <div class="card-header">
        <h3>${data.url}</h3>
        <span class="badge green ok-badge">OK</span>
      </div>

      ${data.redirect301 ? `
        <div class="redirect">
          301 Redirect → ${data.redirect301}
        </div>
      ` : ""}

      <div class="label">Title (${titleCount} characters)</div>
      <div class="value">${data.title || "—"}</div>

      <div class="label">Meta Description (${descCount} characters)</div>
      <div class="value">${data.description || "—"}</div>

      <div class="label">Canonical</div>
      <div class="value">${data.canonical || "—"}</div>

      <div class="label">AMP HTML</div>
      <div class="value">${data.amphtml || "—"}</div>
    `;

    /* -------- AUTO-HIDE OK BADGE -------- */
    const okBadge = card.querySelector(".ok-badge");
    if (okBadge) {
      setTimeout(() => okBadge.remove(), 2000);
    }

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
   PROGRESS BAR
================================ */

function initProgress(total) {
  const progress = document.getElementById("progress");
  progress.classList.remove("hidden");
  updateProgress(0, total);
}

function updateProgress(done, total) {
  const percent = Math.round((done / total) * 100);
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressText").textContent =
    done === total ? `${total} Done` : `${done} / ${total}`;
}

/* ================================
   THEME TOGGLE
================================ */

function toggleTheme() {
  const html = document.documentElement;
  const btn = document.getElementById("themeToggle");

  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("theme", next);
  btn.textContent = next === "dark" ? "🌙" : "☀️";
}

(function () {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = saved;
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = saved === "dark" ? "🌙" : "☀️";
})();

