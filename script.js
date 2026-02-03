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
  const { isAmp = false, insertAfter = null } = options;
  const results = document.getElementById("results");

  const card = document.createElement("div");
  card.className = "card";
  if (isAmp) card.classList.add("amp-card");

  card.innerHTML = `
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

    <div class="muted">Checking domain…</div>
  `;

  // ✅ Insert AMP card right after parent card
  if (insertAfter && insertAfter.nextSibling) {
    results.insertBefore(card, insertAfter.nextSibling);
  } else {
    results.appendChild(card);
  }

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
            ? `<a href="#" onclick="openAmp('${data.amphtml}', this)">` +
              `${data.amphtml}</a>`
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
   const httpBtn = card.querySelector(".http-btn");
   
   if (okBadge) {
     setTimeout(() => {
       okBadge.remove();
       if (httpBtn) httpBtn.classList.remove("hidden");
     }, 2000);
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
   AMP HANDLER
================================ */

function openAmp(url, linkEl) {
  const parentCard = linkEl.closest(".card");

  // Prevent duplicate AMP cards
  if (parentCard.nextSibling?.classList?.contains("amp-card")) return;

  linkEl.style.pointerEvents = "none";
  linkEl.style.opacity = "0.6";

  processDomain(url, {
    isAmp: true,
    insertAfter: parentCard
  });
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


async function showHttpStatus(btn, domain) {
  const card = btn.closest(".card");
  const originalHtml = card.innerHTML;

  card.dataset.original = originalHtml;
  card.innerHTML = `<div class="muted">Checking HTTP status…</div>`;

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  try {
    const res = await fetch(`/.netlify/functions/httpstatus?domain=${cleanDomain}`);
    const data = await res.json();

    const rows = data.map(row => {
     const badges = row.statusChain.map(code => {
       if (code === 301 || code === 302 || code === 307 || code === 308) {
         return `
           <span class="badge blue has-tooltip">
             ${code}
             <span class="tooltip">
               Redirect → ${row.finalUrl}
             </span>
           </span>
         `;
       }
   
       return `<span class="badge green">200</span>`;
     }).join(" ");
   
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
  card.innerHTML = card.dataset.original;
}


/* ================================
   THEME TOGGLE (KEEP)
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





