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
   RENDER HELPERS
================================ */

function createCard(url) {
  const card = document.createElement("div");
  card.className = "preview-card";

  card.innerHTML = `
    <div class="preview-header">
      <a class="preview-url" href="${url}" target="_blank" rel="noopener">
        ${url}
      </a>
      <button class="reload-btn" title="Reload preview">Reload</button>
    </div>

    <div class="preview-body loading">
      Loading…
    </div>
  `;

  return card;
}

function setBlocked(card, type, message, openUrl) {
  const body = card.querySelector(".preview-body");

  body.className = "preview-body blocked";
  body.innerHTML = `
    <div class="preview-status ${type}">
      ${message}
    </div>

    <div class="preview-actions">
      <button
        class="open-site-btn"
        onclick="window.open('${openUrl}', '_blank')"
      >
        Open Site
      </button>
    </div>
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
   PREVIEW LOADER
================================ */

async function loadPreview(url, card) {
  const body = card.querySelector(".preview-body");
  body.className = "preview-body loading";
  body.textContent = "Loading…";

  try {
    const res = await fetch(
      `/.netlify/functions/seo?url=${encodeURIComponent(url)}`
    );
    const data = await res.json();

    if (!res.ok || data.error) {
      setBlocked(card, "danger", "Failed to load preview", url);
      return;
    }

    const inputRoot = getRootDomain(data.inputUrl);
    const finalRoot = getRootDomain(data.finalUrl);

    // 404 / 410
    if (data.status === 404 || data.status === 410) {
      setBlocked(card, "danger", "404 – page not found", url);
      return;
    }

    // 301 to homepage
    if (isHomepageRedirect(data.inputUrl, data.finalUrl)) {
      setBlocked(
        card,
        "success",
        "301 → homepage (preview skipped)",
        data.finalUrl
      );
      return;
    }

    // Redirect to different root domain
    if (inputRoot && finalRoot && inputRoot !== finalRoot) {
      setBlocked(
        card,
        "warning",
        `301 → ${finalRoot} (preview skipped)`,
        data.finalUrl
      );
      return;
    }

    // Try iframe
    setIframe(card, data.inputUrl);

    const iframe = card.querySelector("iframe");
    iframe.onerror = () => {
      setBlocked(card, "warning", "Preview blocked by site", data.inputUrl);
    };

  } catch {
    setBlocked(card, "danger", "Preview failed", url);
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

  urls.forEach(raw => {
    const url = raw.startsWith("http") ? raw : "https://" + raw;

    const card = createCard(url);
    grid.appendChild(card);

    const reloadBtn = card.querySelector(".reload-btn");
    reloadBtn.onclick = () => loadPreview(url, card);

    loadPreview(url, card);
  });
})();
