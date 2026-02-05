const input = sessionStorage.getItem("previewDomains") || "";
const domains = input.split("\n").map(d => d.trim()).filter(Boolean);

const grid = document.getElementById("previewGrid");

async function checkDomain(domain) {
  const url = domain.startsWith("http") ? domain : "https://" + domain;

  try {
    const res = await fetch(`/.netlify/functions/seo?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    const inputRoot = getRootDomain(data.inputUrl);
    const finalRoot = getRootDomain(data.finalUrl);

    return {
      domain: data.inputUrl,
      finalUrl: data.finalUrl,
      redirected: inputRoot !== finalRoot
    };

  } catch {
    return { domain, error: true };
  }
}

function getRootDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function render() {
  for (const domain of domains) {
    const card = document.createElement("div");
    card.className = "preview-card";
    card.innerHTML = `<div class="muted">Loading…</div>`;
    grid.appendChild(card);

    const result = await checkDomain(domain);

    if (result.error) {
      card.innerHTML = `
        <h3>${domain}</h3>
        <div class="error">Domain not active</div>
      `;
      continue;
    }

    if (result.redirected) {
      card.innerHTML = `
        <h3>${result.domain}</h3>
        <div class="redirect">
          301 Domain → ${result.finalUrl}
        </div>
      `;
      continue;
    }

    card.innerHTML = `
  <div class="preview-header">
    <a href="${result.domain}" target="_blank" class="preview-link">
      ${result.domain}
    </a>

    <button class="reload-btn" onclick="reloadIframe(this)">
      Reload
    </button>
  </div>

  <iframe
      src="${result.domain}"
      loading="lazy"
      referrerpolicy="no-referrer"
    ></iframe>
  `;
  }
}

render();


function reloadIframe(btn) {
  const card = btn.closest(".preview-card");
  const iframe = card.querySelector("iframe");
  if (!iframe) return;

  const src = iframe.src;
  iframe.src = "";
  setTimeout(() => {
    iframe.src = src;
  }, 50);
}
