export async function handler(event) {
  const input = event.queryStringParameters?.url;

  if (!input) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing url" })
    };
  }

  let root;
  try {
    const u = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input);
    root = u.origin;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid URL" })
    };
  }

  const visited = new Set();
  const queue = [root];
  const urls = [];

  const MAX_PAGES = 50;

  const visited = new Set();
const queue = [root];
const urls = [];

const MAX_PAGES = 50;

/* ===== URL NORMALIZER ===== */
function normalizeUrl(u) {
  try {
    const url = new URL(u);

    // remove hash
    url.hash = "";

    // remove query (optional for sitemap)
    url.search = "";

    // normalize root slash
    if (url.pathname === "") {
      url.pathname = "/";
    }

    // remove trailing slash duplicates
    url.pathname = url.pathname.replace(/\/+$/, "/");

    return url.href;
  } catch {
    return u;
  }
}

  
  async function crawl(url) {
    if (visited.has(url)) return;
    if (visited.size >= MAX_PAGES) return;

    visited.add(url);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Sitemap Generator)"
        }
      });

      if (!res.ok) return;

      const normalized = normalizeUrl(url);
      if (!urls.includes(normalized)) {
        urls.push(normalized);
      }

      const html = await res.text();

      const linkRegex = /<a[^>]*href=["']([^"']+)["']/gi;
      let match;

      while ((match = linkRegex.exec(html)) !== null) {
        try {
          const link = normalizeUrl(new URL(match[1], root).href);

          if (
            link.startsWith(root) &&
            !visited.has(link) &&
            !link.includes("#") &&
            !link.match(/\.(jpg|png|gif|pdf|zip|mp4|svg)$/i)
          ) {
            queue.push(link);
          }
        } catch {}
      }
    } catch {}
  }

  while (queue.length && visited.size < MAX_PAGES) {
    const next = queue.shift();
    await crawl(next);
  }

  /* ===== build sitemap xml ===== */
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u}</loc>\n  </url>`
      )
      .join("\n") +
    `\n</urlset>`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml",
      "Access-Control-Allow-Origin": "*"
    },
    body: xml
  };
}
