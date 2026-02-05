const CONCURRENCY = 5;

/* ================================
   HELPERS
================================ */

function getRootDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isHomepageRedirect(inputUrl, finalUrl) {
  try {
    const input = new URL(inputUrl);
    const final = new URL(finalUrl);

    return (
      input.pathname !== "/" &&
      final.pathname === "/" &&
      input.hostname === final.hostname
    );
  } catch {
    return false;
  }
}

/* ================================
   MAIN RUN
================================ */

async function run() {
  const domains = document
    .getElementById("domains")
    .value.split("\n")
    .map(d => d.trim())
    .filter(Boolean);

  if (!domains.length) return;

  document.getElementById("results").innerHTML = "";

  for (const domain of domains) {
    await processDomain(domain);
  }
}

/* ================================
   PROCESS DOMAIN
================================ */

async function processDomain(domain) {
  const results = document.getElementById("results");

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="muted">Checking…</div>`;
  results.appendChild(card);

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error();

    const inputRoot = getRootDomain(data.inputUrl);
    const finalRoot = getRootDomain(data.finalUrl);

    const redirected = inputRoot && finalRoot && inputRoot !== finalRoot;
    const is301ToHomepage = isHomepageRedirect(data.inputUrl, data.finalUrl);
    const is404 = data.status === 404 || data.status === 410;

    card.innerHTML = `
      <h3>${data.inputUrl}</h3>

      ${is301ToHomepage ? `
        <div class="status-label green">301 to homepage</div>
      ` : ``}

      ${is404 ? `
        <div class="status-label red">404 not found</div>
      ` : ``}

      ${redirected ? `
        <div class="redirect">301 Redirect → ${data.finalUrl}</div>
      ` : ``}

      <div class="label">Title (${data.title.length} characters)</div>
      <div class="value">${data.title || "—"}</div>

      <div class="label">Meta Description (${data.description.length} characters)</div>
      <div class="value">${data.description || "—"}</div>

      <div class="label">Canonical</div>
      <div class="value">${data.canonical || "—"}</div>

      <div class="label">AMP HTML</div>
      <div class="value">${data.amphtml || "—"}</div>

      <div class="label">Robots</div>
      <div class="value">
        ${data.robots ? `<a href="${data.robots}" target="_blank">${data.robots}</a>` : "No Robots detected"}
      </div>

      <div class="label">Sitemap</div>
      <div class="value">
        ${data.sitemap ? `<a href="${data.sitemap}" target="_blank">${data.sitemap}</a>` : "No Sitemap detected"}
      </div>
    `;

  } catch {
    card.innerHTML = `
      <h3>${domain}</h3>
      <div class="status-label red">Domain not active</div>
    `;
  }
}
