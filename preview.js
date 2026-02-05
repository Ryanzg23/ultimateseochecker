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

function getQueryUrls() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("urls");
  if (!raw) return [];

  return decodeURIComponent(raw)
    .split(",")
    .map(u => u.trim())
    .filter(Boolean);
}

/* ================================
   RENDER
================================ */

function createCard(title) {
  const card = document.createElement("div");
  card.className = "preview-card";

  card.innerHTML = `
    <div class="preview-header">
      <a href="${title}" target="_blank" rel="noopener">${title}</a>
      <button class="reload-btn">Reload</button>
    </div>
    <div class="preview-body loading">Loading…</div>
  `;

  return card;
}

function setStatus(card, type, text, url) {
  const body = card.querySelector(".preview-body");

  body.className = "preview-body blocked";
  body.innerHTML = `
    <div class="preview-status ${type}">
      ${text}
    </div>
    <button class="open-site" onclick="window.open('${url}', '_blank')">
      Open Site
    </button>
  `;
}

function setIframe(card, url) {
  const body = card.querySelector(".preview-body");

  body.className = "preview-body";
  body.innerHTML = `
    <iframe
      src="${url}"
      loading="lazy"
      referrerpolicy="no-referrer"
    ></iframe>
  `;
}

/* ================================
   MAIN
================================ */

async function loadPreview(url, card) {
  const body = card.querySelector(".preview-body");

  try {
    const res = await fetch(
      `/.netlify/functions/seo?url=${encodeURIComponent(url)}`
    );
    const data = await res.json();

    if (!res.ok || data.error) {
      setStatus(card, "danger", "Failed to load preview", url);
      return;
    }

    const inputRoot = getRootDomain(data.inputUrl);
    const finalRoot = getRootDomain(data.finalUrl);

    // 404 / 410
    if (data.status === 404 || data.status === 410) {
      setStatus(card, "danger", "404 – page not found", url);
      return;
    }

    // 301 to homepage
    if (isHomepageRedirect(data.inputUrl, data.finalUrl)) {
      setStatus(card, "success", "301 → homepage (preview skipped)", data.finalUrl);
      return;
    }

    // Redirect to different root domain
    if (inputRoot && finalRoot && inputRoot !== finalRoot) {
      setStatus(
        card,
        "warning",
        `301 → ${finalRoot} (preview skipped)`,
        data.finalUrl
      );
      return;
    }

    // Try iframe
    setIframe(card, data.inputUrl);

    // Detect iframe block
    const iframe = card.querySelector("iframe");
    iframe.onerror = () => {
      setStatus(card, "warning", "Preview blocked by site", data.inputUrl);
    };

  } catch {
    setStatus(card, "danger", "Preview failed", url);
  }
}

/* ================================
   INIT
================================ */

(function init() {
  const urls = getQueryUrls();
  const grid = document.getElementById("previewGrid");

  if (!urls.length) {
    grid.innerHTML = `<div class="muted">No URLs provided</div>`;
    return;
  }

  urls.forEach(url => {
    const normalized = url.startsWith("http") ? url : "https://" + url;
    const card = createCard(normalized);

    grid.appendChild(card);

    const reloadBtn = card.querySelector(".reload-btn");
    reloadBtn.onclick = () => loadPreview(normalized, card);

    loadPreview(normalized, card);
  });
})();
