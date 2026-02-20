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

  /* ===== URL NORMALIZER ===== */
  function normalizeUrl(u) {
    try {
      const url = new URL(u);

      url.hash = "";
      url.search = "";

      if (url.pathname === "") {
        url.pathname = "/";
      }

      // normalize trailing slash
      if (url.pathname !== "/") {
        url.pathname = url.pathname.replace(/\/+$/, "");
      }

      return url.href;
    } catch {
      return u;
    }
  }

  /* ===== PRIORITY CALC ===== */
  function calcPriority(u) {
    try {
      const path = new URL(u).pathname;
      if (path === "/" || path === "") return "1.00";

      const depth = path.split("/").filter(Boolean).length;
      if (depth === 1) return "0.80";
      if (depth === 2) return "0.60";
      return "0.50";
    } catch {
      return "0.50";
    }
  }

  async function crawl(url) {
    const normalized = normalizeUrl(url);

    if (visited.has(normalized)) return;
    if (visited.size >= MAX_PAGES) return;

    visited.add(normalized);

    try {
      const res = await fetch(normalized, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Sitemap Generator)"
        }
      });

      if (!res.ok) return;

      // add to sitemap list
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

  /* ===== BUILD XML ===== */
  const now = new Date().toISOString();

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${u}</loc>\n` +
          `    <lastmod>${now}</lastmod>\n` +
          `    <priority>${calcPriority(u)}</priority>\n` +
          `  </url>`
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
