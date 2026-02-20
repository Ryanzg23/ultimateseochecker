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

  const v = content.toLowerCase();
  const hasIndex = v.includes("index");
  const hasNoindex = v.includes("noindex");
  const hasFollow = v.includes("follow");
  const hasNofollow = v.includes("nofollow");

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
  ["runBtn", "clearBtn", "openBulkBtn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = state;
  });
}

function clearDomains() {
  document.getElementById("domains").value = "";
  document.getElementById("results").innerHTML = "";
  document.getElementById("progress").classList.add("hidden");
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById("progressText").textContent = "";
}

function openBulk() {
  document.getElementById("domains").value
    .split("\n")
    .map(d => d.trim())
    .filter(Boolean)
    .forEach(d => {
      const url = d.startsWith("http") ? d : "https://" + d;
      window.open(url, "_blank", "noopener");
    });
}

function openAmpTest() {
  const input = document.getElementById("domains").value;
  const urls = input.split("\n").map(d => d.trim()).filter(Boolean);
  if (!urls.length) return;

  urls.forEach(u => {
    const url = u.startsWith("http") ? u : "https://" + u;
    window.open(
      "https://search.google.com/test/amp?url=" + encodeURIComponent(url),
      "_blank",
      "noopener"
    );
  });
}

function openRichTest() {
  const input = document.getElementById("domains").value;
  const urls = input.split("\n").map(d => d.trim()).filter(Boolean);
  if (!urls.length) return;

  urls.forEach(u => {
    const url = u.startsWith("http") ? u : "https://" + u;
    window.open(
      "https://search.google.com/test/rich-results?url=" +
        encodeURIComponent(url),
      "_blank",
      "noopener"
    );
  });
}

function openPreview() {
  const urls = document.getElementById("domains").value
    .split("\n")
    .map(d => d.trim())
    .filter(Boolean);

  if (!urls.length) return;
  window.open(`/preview.html?urls=${encodeURIComponent(urls.join(","))}`, "_blank");
}

/* ================================
   PROCESS DOMAIN
================================ */

async function processDomain(domain, options = {}) {
  const { isAmp = false, insertAfter = null, parentTitle = "", parentDesc = "" } = options;
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

    const robotsInfo = interpretRobots(data.robotsMeta);
    const titleCount = data.title.length;
    const descCount = data.description.length;

    /* ===== AMP META COMPARISON ===== */
    let titleMismatch = false;
    let descMismatch = false;

    if (isAmp) {
      const canonTitle = parentTitle.trim();
      const canonDesc = parentDesc.trim();
      const ampTitle = (data.title || "").trim();
      const ampDesc = (data.description || "").trim();

      if (canonTitle && ampTitle && canonTitle !== ampTitle) titleMismatch = true;
      if (canonDesc && ampDesc && canonDesc !== ampDesc) descMismatch = true;
    }

    /* store canonical meta for AMP compare */
    if (!isAmp) {
      card.dataset.title = data.title || "";
      card.dataset.desc = data.description || "";
    }

    card.dataset.original = `
      <div class="card-header">
        <h3>
           <a href="${data.finalUrl || data.inputUrl}" target="_blank" class="card-url">
             ${data.inputUrl}
           </a>
         </h3>
        <div class="card-actions">
          ${!redirected && !isAmp ? `<span class="badge green ok-badge">OK</span>` : ``}
          <button class="secondary small http-btn hidden"
            onclick="showHttpStatus(this, '${data.inputUrl}')">See HTTP Status</button>
          ${isAmp ? `<span class="badge purple">AMP</span>` : ``}
        </div>
      </div>

      ${redirected ? `<div class="redirect">301 → ${data.finalUrl}</div>` : ""}

      <div class="label">
        Title (${titleCount} characters)
        ${titleMismatch ? `<span class="note red">Title mismatch</span>` : ``}
      </div>
      <div class="value ${titleMismatch ? "mismatch" : ""}">
        ${data.title || "—"}
      </div>

      <div class="label">
        Meta Description (${descCount} characters)
        ${descMismatch ? `<span class="note red">Description mismatch</span>` : ``}
      </div>
      <div class="value ${descMismatch ? "mismatch" : ""}">
        ${data.description || "—"}
      </div>

      <div class="label">
        Meta Keywords (${data.keywords ? data.keywords.split(",").length : 0})
      </div>
      <div class="value">${data.keywords || "—"}</div>

      <div class="label inline">
        Meta Robots:
        <span class="robots ${robotsInfo.status}">
          ${robotsInfo.label}
        </span>
        ${robotsInfo.note ? `<span class="robots-note">${robotsInfo.note}</span>` : ""}
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

      <div class="label">robots.txt</div>
      <div class="value">
        ${data.robots
          ? `<a href="${data.robots.url}" target="_blank">${data.robots.url}</a>`
          : `
            No Robots detected
            <button class="mini-btn"
              onclick="generateRobots('${data.inputUrl}')">
              Generate Robots
            </button>
          `}
      </div>

      <div class="label">Sitemap</div>
      <div class="value">
        ${
          data.sitemap && data.sitemap.status === "exists"
            ? `<a href="${data.sitemap.url}" target="_blank">${data.sitemap.url}</a>`
            : `
              <span class="muted">No Sitemap detected</span>
              <button class="mini-btn sitemap-gen"
                onclick="generateSitemap('${data.inputUrl}')">
                Generate Sitemap
              </button>
            `
        }
      </div>

      <div class="label">Daftar</div>
      <div class="value">${renderAuthLinks(data.authLinks?.daftar)}</div>

      <div class="label">Login</div>
      <div class="value">${renderAuthLinks(data.authLinks?.login)}</div>
    `;

    card.innerHTML = card.dataset.original;

    setTimeout(() => {
      card.querySelector(".ok-badge")?.remove();
      card.querySelector(".http-btn")?.classList.remove("hidden");
      card.dataset.ready = card.innerHTML;
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

  const parentTitle = parent.dataset.title || "";
  const parentDesc = parent.dataset.desc || "";

  el.style.pointerEvents = "none";
  el.style.opacity = "0.6";

  processDomain(url, {
    isAmp: true,
    insertAfter: parent,
    parentTitle,
    parentDesc
  });
}
