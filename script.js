const CONCURRENCY = 5;

function getRootDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.toLowerCase();
  } catch {
    return "";
  }
}

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
   OPEN BULK
================================ */

function openBulk() {
  const input = document.getElementById("domains").value;
  const domains = input.split("\n").map(d => d.trim()).filter(Boolean);

  domains.forEach(d => {
    const url = d.startsWith("http") ? d : "https://" + d;
    window.open(url, "_blank", "noopener");
  });
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
   PROCESS DOMAIN (SEO + AMP)
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

  if (insertAfter && insertAfter.nextSibling) {
    results.insertBefore(card, insertAfter.nextSibling);
  } else {
    results.appendChild(card);
  }

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error();

    const inputDomain = getRootDomain(data.inputUrl);
      const finalDomain = getRootDomain(data.finalUrl);
      
      const redirected = inputDomain && finalDomain && inputDomain !== finalDomain;
    const titleCount = data.title.length;
    const descCount = data.description.length;

    card.dataset.original = `
      <div class="card-header">
        <h3>${data.inputUrl}</h3>
        <div class="card-actions">
          ${!redirected && !isAmp ? `<span class="badge green ok-badge">OK</span>` : ``}

          <button
            class="secondary small http-btn hidden"
            onclick="showHttpStatus(this, '${data.inputUrl}')"
          >
            See HTTP Status
          </button>

          ${isAmp ? `<span class="badge purple">AMP</span>` : ``}
        </div>
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
            ? `<a href="#" onclick="openAmp('${data.amphtml}', this)">${data.amphtml}</a>`
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

    card.innerHTML = card.dataset.original;

    const okBadge = card.querySelector(".ok-badge");
    const httpBtn = card.querySelector(".http-btn");
    
    if (okBadge) {
      setTimeout(() => {
        okBadge.remove();
        if (httpBtn) httpBtn.classList.remove("hidden");
    
        // ✅ Save the POST-OK state for Back button
        card.dataset.ready = card.innerHTML;
      }, 1000);
    } else {
      // No OK badge case (redirected / AMP)
      card.dataset.ready = card.innerHTML;
    }


  } catch {
    card.innerHTML = `
      <div class="card-header">
        <h3>${domain}</h3>
        <div class="card-actions">
          <span class="badge red">ERROR</span>
        </div>
      </div>
      <div class="value">Domain not active</div>
    `;
  }
}

/* ================================
   AMP HANDLER
================================ */

function openAmp(url, el) {
  const parentCard = el.closest(".card");
  if (parentCard.nextSibling?.classList?.contains("amp-card")) return;

  el.style.pointerEvents = "none";
  el.style.opacity = "0.6";

  processDomain(url, {
    isAmp: true,
    insertAfter: parentCard
  });
}

/* ================================
   HTTP STATUS VIEW
================================ */

async function showHttpStatus(btn, domain) {
  const card = btn.closest(".card");
  const original = card.dataset.original;

  card.innerHTML = `<div class="muted">Checking HTTP status…</div>`;

  const clean = domain.replace(/^https?:\/\//, "");

  try {
    const res = await fetch(`/.netlify/functions/httpstatus?domain=${clean}`);
    const data = await res.json();

    const rows = data.map(row => {
      let badges = "";

    // first redirect only
    const firstRedirect = row.statusChain.find(code =>
      [301, 302, 307, 308].includes(code)
    );
    
    const finalStatus = row.statusChain[row.statusChain.length - 1];
    
    if (firstRedirect) {
      badges += `
        <span class="badge blue has-tooltip">
          ${firstRedirect}
          <span class="tooltip">
            Redirect → ${row.finalUrl}
          </span>
        </span>
      `;
    }
    
    if (finalStatus === 200) {
      badges += `<span class="badge green">200</span>`;
    }

      return `
        <div class="http-row">
          <div class="http-url">${row.requestUrl}</div>
          <div class="http-status">${badges}</div>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="card-header">
        <h3>HTTP Status</h3>
        <div class="card-actions">
          <button class="secondary small" onclick="restoreCard(this)">Back</button>
        </div>
      </div>

      <div class="http-table">
        <div class="http-row head">
          <div>Request URL</div>
          <div>Status</div>
        </div>
        ${rows}
      </div>
    `;

  } catch {
    card.innerHTML = `
      <div>Error loading HTTP status</div>
      <button class="secondary small" onclick="restoreCard(this)">Back</button>
    `;
  }
}

function restoreCard(btn) {
  const card = btn.closest(".card");
  card.innerHTML = card.dataset.ready || card.dataset.original;
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
   THEME TOGGLE (STABLE)
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


function openPreview() {
  const domains = document.getElementById("domains").value.trim();
  if (!domains) return;

  sessionStorage.setItem("previewDomains", domains);
  window.open("preview.html", "_blank");
}




