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

  const urls = input
    .split("\n")
    .map(d => d.trim())
    .filter(Boolean);

  if (!urls.length) return;

  urls.forEach(u => {
    const url = u.startsWith("http") ? u : "https://" + u;

    const ampTestUrl =
      "https://search.google.com/test/amp?url=" +
      encodeURIComponent(url);

    window.open(ampTestUrl, "_blank", "noopener");
  });
}

function openRichTest() {
  const input = document.getElementById("domains").value;

  const urls = input
    .split("\n")
    .map(d => d.trim())
    .filter(Boolean);

  if (!urls.length) return;

  urls.forEach(u => {
    const url = u.startsWith("http") ? u : "https://" + u;

    const richUrl =
      "https://search.google.com/test/rich-results?url=" +
      encodeURIComponent(url);

    window.open(richUrl, "_blank", "noopener");
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

async function generateSitemap(url) {
  if (!url) return;

  try {
    const res = await fetch(
      `/.netlify/functions/sitemapgen?url=${encodeURIComponent(url)}`
    );

    if (!res.ok) {
      throw new Error("Generator error");
    }

    const xml = await res.text();

    // basic validation
    if (!xml || !xml.includes("<urlset")) {
      throw new Error("Invalid sitemap");
    }

    // derive filename from domain
    let filename = "sitemap.xml";
    try {
      const u = new URL(url);
      filename = u.hostname.replace(/^www\./, "") + "-sitemap.xml";
    } catch {}

    // download file
    const blob = new Blob([xml], { type: "application/xml" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

  } catch (err) {
    console.error("Sitemap generation failed:", err);
    alert("Failed to generate sitemap");
  }
}

function generateRobots(domain) {
  try {
    const url = new URL(domain.startsWith("http") ? domain : "https://" + domain);
    const origin = url.origin;

    const content =
`User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "robots.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch {
    alert("Failed to generate robots.txt");
  }
}


/* ================================
   MAIN RUN
================================ */

async function run() {
  const domains = document.getElementById("domains").value
    .split("\n")
    .map(d => d.trim())
    .filter(Boolean);

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

      <div class="label">Title (${titleCount} characters)</div>
      <div class="value">${data.title || "—"}</div>

      <div class="label">Meta Description (${descCount} characters)</div>
      <div class="value">${data.description || "—"}</div>

      <div class="label">
        Meta Keywords (${data.keywords ? data.keywords.split(",").length : 0})
      </div>
      <div class="value">
        ${data.keywords || "—"}
      </div>

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
        <button
          class="mini-btn sitemap-gen"
          onclick="generateSitemap('${data.inputUrl}')"
        >
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

function renderAuthLinks(list) {
  if (!list || !list.length) return "Not detected";

  if (list.length === 1) {
    return `<a href="${list[0]}" target="_blank">${list[0]}</a>`;
  }

  const id = "auth_" + Math.random().toString(36).slice(2);

  const extraLinks = list
    .slice(1)
    .map(u => `<div><a href="${u}" target="_blank">${u}</a></div>`)
    .join("");

  return `
    <div class="auth-links">
      <div><a href="${list[0]}" target="_blank">${list[0]}</a></div>

      <div class="auth-toggle muted" onclick="expandAuth('${id}', this)">
        +${list.length - 1} more
      </div>

      <div id="${id}" class="auth-extra hidden">
        ${extraLinks}
        <div class="auth-toggle muted" onclick="collapseAuth('${id}')">
          hide other links
        </div>
      </div>
    </div>
  `;
}

function expandAuth(id, btn) {
  const box = document.getElementById(id);
  if (!box) return;

  box.classList.remove("hidden");
  btn.classList.add("hidden");
}

function collapseAuth(id) {
  const box = document.getElementById(id);
  if (!box) return;

  const wrapper = box.closest(".auth-links");
  const expandBtn = wrapper.querySelector(".auth-toggle");

  box.classList.add("hidden");
  expandBtn.classList.remove("hidden");
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

  const clean = domain.replace(/^https?:\/\//, "");

  try {
    const res = await fetch(`/.netlify/functions/httpstatus?domain=${clean}`);
    const data = await res.json();

    const rows = data.map(row => {
      let badges = "";
      const finalStatus = row.statusChain[row.statusChain.length - 1];

      let meaningfulRedirect = false;
      try {
        const req = new URL(row.requestUrl);
        const fin = new URL(row.finalUrl);

        // Ignore trailing slash / same protocol changes
        meaningfulRedirect =
          req.hostname !== fin.hostname ||
          req.protocol !== fin.protocol;
      } catch {}

      // Redirect badge + tooltip
      if (meaningfulRedirect) {
        const redirectCode = row.statusChain.find(code =>
          [301, 302, 307, 308].includes(code)
        );

        if (redirectCode) {
          badges += `
            <span class="badge blue has-tooltip">
              ${redirectCode}
              <span class="tooltip">
                Redirect → ${row.finalUrl}
              </span>
            </span>
          `;
        }
      }

      // Final status badge
      if (finalStatus === 200) {
        badges += `<span class="badge green">200</span>`;
      } else if (finalStatus === 404) {
        badges += `<span class="badge red">404</span>`;
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
      <div class="issue-pill danger">Failed to load HTTP status</div>
      <button class="secondary small" onclick="restoreCard(this)">Back</button>
    `;
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
  document.getElementById("progressBar").style.width =
    Math.round((done / total) * 100) + "%";
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

  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = next === "dark" ? "🌙" : "☀️";
}

(function restoreTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = saved;

  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = saved === "dark" ? "🌙" : "☀️";
})();
























