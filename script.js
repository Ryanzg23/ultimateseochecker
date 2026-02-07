const CONCURRENCY = 5;

/* ================================
   HELPERS
================================ */

function interpretRobots(content) {
  if (!content) {
    return {
      label: "not set",
      status: "neutral",
      note: "Default is index, follow"
    };
  }

  const value = content.toLowerCase();
  const hasIndex = value.includes("index");
  const hasNoindex = value.includes("noindex");
  const hasFollow = value.includes("follow");
  const hasNofollow = value.includes("nofollow");

  if (hasNoindex && hasNofollow) return { label: "noindex, nofollow", status: "danger" };
  if (hasNoindex) return { label: "noindex", status: "danger" };
  if (hasNofollow) return { label: "nofollow", status: "warning" };
  if (hasIndex && hasFollow) return { label: "index, follow", status: "success" };
  if (hasIndex) return { label: "index only", status: "warning" };
  if (hasFollow) return { label: "follow only", status: "warning" };

  return { label: content, status: "neutral" };
}

function getRootDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isHomepageRedirect(inputUrl, finalUrl) {
  try {
    const i = new URL(inputUrl);
    const f = new URL(finalUrl);
    return i.pathname !== "/" && f.pathname === "/" && i.hostname === f.hostname;
  } catch {
    return false;
  }
}

/* ================================
   UI CONTROLS
================================ */

function setLoading(state) {
  document.getElementById("runBtn").disabled = state;
  document.getElementById("clearBtn").disabled = state;
  document.getElementById("openBulkBtn").disabled = state;
}

function clearDomains() {
  document.getElementById("domains").value = "";
  document.getElementById("results").innerHTML = "";
  document.getElementById("progress").classList.add("hidden");
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById("progressText").textContent = "";
}

function openBulk() {
  const input = document.getElementById("domains").value;
  input.split("\n").map(d => d.trim()).filter(Boolean).forEach(d => {
    const url = d.startsWith("http") ? d : "https://" + d;
    window.open(url, "_blank", "noopener");
  });
}

function openPreview() {
  const urls = document.getElementById("domains").value
    .split("\n").map(d => d.trim()).filter(Boolean);

  if (!urls.length) return;
  window.open(`/preview.html?urls=${encodeURIComponent(urls.join(","))}`, "_blank");
}

/* ================================
   MAIN RUN
================================ */

async function run() {
  const domains = document.getElementById("domains").value
    .split("\n").map(d => d.trim()).filter(Boolean);

  if (!domains.length) return;

  setLoading(true);
  document.getElementById("results").innerHTML = "";
  initProgress(domains.length);

  let completed = 0;
  const queue = [...domains];

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const domain = queue.shift();
      await processDomain(domain);
      completed++;
      updateProgress(completed, domains.length);
    }
  });

  await Promise.all(workers);
  setLoading(false);
}

/* ================================
   PROCESS DOMAIN
================================ */

async function processDomain(domain, options = {}) {
  const { isAmp = false, insertAfter = null } = options;
  const results = document.getElementById("results");

  const card = document.createElement("div");
  card.className = "card";
  if (isAmp) card.classList.add("amp-card");

  card.innerHTML = `
    <div class="card-header">
      <h3>${domain}</h3>
      <div class="card-actions">
        ${isAmp ? `<span class="badge purple">AMP</span>` : `<span class="badge blue">LOADING</span>`}
      </div>
    </div>
    <div class="muted">Checking domain…</div>
  `;

  insertAfter?.nextSibling
    ? results.insertBefore(card, insertAfter.nextSibling)
    : results.appendChild(card);

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (!res.ok || data.error === "fetch_failed") throw new Error();

    const robotsInfo = interpretRobots(data.robots);
    const inputRoot = getRootDomain(data.inputUrl);
    const finalRoot = getRootDomain(data.finalUrl);

    const redirected = inputRoot && finalRoot && inputRoot !== finalRoot;
    const is301Home = isHomepageRedirect(data.inputUrl, data.finalUrl);
    const is404 = data.status === 404 || data.status === 410;

    if (is404 || is301Home) {
      card.innerHTML = `
        <div class="card-header"><h3>${data.inputUrl}</h3></div>
        <div class="issue-pill ${is404 ? "danger" : "success"}">
          ${is404 ? "404 – page not found" : "301 → homepage"}
        </div>
      `;
      return;
    }

    const titleCount = data.title.length;
    const descCount = data.description.length;

    card.innerHTML = `
      <div class="card-header">
        <h3>${data.inputUrl}</h3>
        <div class="card-actions">
          ${!redirected && !isAmp ? `<span class="badge green ok-badge">OK</span>` : ``}
          <button class="secondary small http-btn hidden"
            onclick="showHttpStatus(this, '${data.inputUrl}')">See HTTP Status</button>
          ${isAmp ? `<span class="badge purple">AMP</span>` : ``}
        </div>
      </div>

      ${redirected ? `<div class="redirect">301 → ${data.finalUrl}</div>` : ""}

      <div class="label">Title (${titleCount} characters)</div>
      <div class="value">${data.title || "—"}</div>

      <div class="label">Meta Description (${descCount} characters)</div>
      <div class="value">${data.description || "—"}</div>

      <div class="label">Robots</div>
      <div class="value">
        <span class="robots ${robotsInfo.status}">${robotsInfo.label}</span>
        ${robotsInfo.note ? `<span class="robots-note">(${robotsInfo.note})</span>` : ""}
      </div>

      <div class="label">Canonical</div>
      <div class="value">${data.canonical || "—"}</div>

      <div class="label">AMP HTML</div>
      <div class="value">
        ${
          data.amphtml && !isAmp
            ? `<a href="#" onclick="openAmp('${data.amphtml}', this)">${data.amphtml}</a>`
            : data.amphtml || "—"
        }
      </div>
    `;

    setTimeout(() => {
      card.querySelector(".ok-badge")?.remove();
      card.querySelector(".http-btn")?.classList.remove("hidden");
    }, 1000);

  } catch {
    card.innerHTML = `
      <div class="card-header"><h3>${domain}</h3></div>
      <div class="issue-pill danger">Domain not reachable</div>
    `;
  }
}

/* ================================
   AMP HANDLER
================================ */

function openAmp(url, el) {
  const parent = el.closest(".card");
  if (parent.nextSibling?.classList.contains("amp-card")) return;

  el.style.pointerEvents = "none";
  el.style.opacity = "0.6";

  processDomain(url, { isAmp: true, insertAfter: parent });
}

/* ================================
   HTTP STATUS
================================ */

async function showHttpStatus(btn, domain) {
  const card = btn.closest(".card");
  card.dataset.ready = card.innerHTML;
  card.innerHTML = `<div class="muted">Checking HTTP status…</div>`;

  try {
    const res = await fetch(`/.netlify/functions/httpstatus?domain=${domain.replace(/^https?:\/\//, "")}`);
    const data = await res.json();

    card.innerHTML = `
      <div class="card-header">
        <h3>HTTP Status</h3>
        <button class="secondary small" onclick="restoreCard(this)">Back</button>
      </div>
      ${data.map(r => `
        <div class="http-row">
          <div>${r.requestUrl}</div>
          <div>${r.statusChain.join(" → ")}</div>
        </div>
      `).join("")}
    `;
  } catch {
    restoreCard(btn);
  }
}

function restoreCard(btn) {
  const card = btn.closest(".card");
  card.innerHTML = card.dataset.ready;
}

/* ================================
   PROGRESS
================================ */

function initProgress(total) {
  document.getElementById("progress").classList.remove("hidden");
  updateProgress(0, total);
}

function updateProgress(done, total) {
  document.getElementById("progressBar").style.width = `${(done / total) * 100}%`;
  document.getElementById("progressText").textContent =
    done === total ? `${total} Done` : `${done} / ${total}`;
}

/* ================================
   THEME TOGGLE
================================ */

function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === "dark" ? "light" : "dark";
  html.dataset.theme = next;
  localStorage.setItem("theme", next);
  document.getElementById("themeToggle").textContent = next === "dark" ? "🌙" : "☀️";
}

(function () {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = saved;
})();
