const input = sessionStorage.getItem("previewDomains") || "";
const domains = input.split("\n").map(d => d.trim()).filter(Boolean);

const grid = document.getElementById("previewGrid");

/* ================================
   HELPERS
================================ */

function normalizeBase(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/* ================================
   CHECK DOMAIN (301 ROOT)
================================ */

async function checkDomain(domain) {
  const url = domain.startsWith("http") ? domain : "https://" + domain;

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    const inputRoot = normalizeBase(data.inputUrl);
    const finalRoot = normalizeBase(data.finalUrl);

    return {
      inputUrl: data.inputUrl,
      finalUrl: data.finalUrl,
      redirected: inputRoot && finalRoot && inputRoot !== finalRoot
    };

  } catch {
    return { inputUrl: domain, error: true };
  }
}

/* ================================
   RENDER
================================ */

async function render() {
  for (const domain of domains) {
    const card = document.createElement("div");
    card.className = "preview-card";
    card.innerHTML = `<div class="muted">Loading…</div>`;
    grid.appendChild(card);

    const result = await checkDomain(domain);

    if (result.error) {
      card.innerHTML = `
        <div class="preview-header">
          <span>${domain}</span>
        </div>
        <div class="error">Domain not active</div>
      `;
      continue;
    }

    if (result.redirected) {
      card.innerHTML = `
        <div class="preview-header">
          <a href="${result.inputUrl}" target="_blank" class="preview-link">
            ${result.inputUrl}
          </a>
        </div>
        <div class="redirect">
          301 Domain → ${result.finalUrl}
        </div>
      `;
      continue;
    }

    card.innerHTML = `
      <div class="preview-header">
        <a href="${result.inputUrl}" target="_blank" class="preview-link">
          ${result.inputUrl}
        </a>

        <button class="reload-btn" onclick="reloadIframe(this)">
          Reload
        </button>
      </div>

      <div class="iframe-wrapper">
        <iframe
          src="${result.inputUrl}"
          loading="lazy"
          referrerpolicy="no-referrer"
        ></iframe>

        <div class="iframe-fallback hidden">
          <div>Preview blocked by site</div>
          <a href="${result.inputUrl}" target="_blank" class="open-site-btn">
            Open Site
          </a>
        </div>
      </div>
    `;

    detectIframeBlocked(card);
  }
}

/* ================================
   IFRAME FALLBACK DETECTION
================================ */

function detectIframeBlocked(card) {
  setTimeout(() => {
    const iframe = card.querySelector("iframe");
    const fallback = card.querySelector(".iframe-fallback");

    if (!iframe || !fallback) return;

    try {
      if (iframe.contentDocument?.body?.childElementCount === 0) {
        iframe.style.display = "none";
        fallback.classList.remove("hidden");
      }
    } catch {
      iframe.style.display = "none";
      fallback.classList.remove("hidden");
    }
  }, 2500);
}

/* ================================
   RELOAD IFRAME
================================ */

function reloadIframe(btn) {
  const card = btn.closest(".preview-card");
  const iframe = card.querySelector("iframe");
  const fallback = card.querySelector(".iframe-fallback");

  if (!iframe) return;

  iframe.style.display = "block";
  if (fallback) fallback.classList.add("hidden");

  const src = iframe.src;
  iframe.src = "";
  setTimeout(() => {
    iframe.src = src;
    detectIframeBlocked(card);
  }, 50);
}

/* ================================
   INIT
================================ */

render();
