export async function handler(event) {
  let inputUrl = event.queryStringParameters?.url;

  if (!inputUrl) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing url parameter" })
    };
  }

  if (!/^https?:\/\//i.test(inputUrl)) {
    inputUrl = "https://" + inputUrl;
  }

  try {
    /* ================================
       FETCH MAIN PAGE
    ================================ */
    const response = await fetch(inputUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
      }
    });

    const status = response.status;
    const finalUrl = response.url;
    const html = await response.text();
    const origin = new URL(finalUrl).origin;

    /* ================================
       HELPER
    ================================ */
    const getTag = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim() : "";
    };

    /* ================================
       META EXTRACTION
    ================================ */
    const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);

    const description =
      getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);

    const keywords =
      getTag(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']keywords["']/i);

    /* ---------- CANONICAL ---------- */
    const rawCanonical =
      getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ||
      getTag(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);

    let canonical = "";
    if (rawCanonical) {
      const trimmed = rawCanonical.trim();
      if (trimmed && trimmed !== "#") {
        try {
          canonical = new URL(trimmed, finalUrl).href;
        } catch {}
      }
    }

    /* ---------- AMP ---------- */
    const amphtml =
      getTag(/<link[^>]*rel=["']amphtml["'][^>]*href=["']([^"']*)["']/i) ||
      getTag(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']amphtml["']/i);

    /* ---------- META ROBOTS ---------- */
    const robotsMeta =
      getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);

    /* ================================
       ROBOTS.TXT DETECTION
    ================================ */
    async function detectRobots(origin) {
      try {
        const res = await fetch(origin + "/robots.txt", {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
          }
        });

        if (!res || res.status !== 200) return null;

        const text = (await res.text()).replace(/\r/g, "").trim();
        if (!text) return null;

        const lower = text.toLowerCase();

        const hasCrawlerDirective =
          lower.includes("user-agent:") ||
          lower.includes("disallow:") ||
          lower.includes("allow:") ||
          lower.includes("sitemap:");

        if (!hasCrawlerDirective) return null;

        return { url: origin + "/robots.txt" };

      } catch {
        return null;
      }
    }

    const robots = await detectRobots(origin);

    /* ================================
       SITEMAP.XML DETECTION
    ================================ */
    async function detectSitemap(origin) {
      try {
        const res = await fetch(origin + "/sitemap.xml", {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
          }
        });

        if (res.status !== 200) {
          return { status: "missing" };
        }

        const final = new URL(res.url);
        if (!final.pathname.toLowerCase().includes("sitemap")) {
          return { status: "missing" };
        }

        const text = await res.text();
        if (!/<urlset|<sitemapindex/i.test(text)) {
          return { status: "missing" };
        }

        return {
          status: "exists",
          url: final.href
        };

      } catch {
        return { status: "missing" };
      }
    }

    const sitemap = await detectSitemap(origin);

    /* ================================
       AUTH LINKS (LOGIN / DAFTAR)
    ================================ */
    let authLinks = { daftar: null, login: null };

    try {
function extractAuthLinks(type) {
  const found = new Set();

  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const raw = match[0];
    const inner = match[2];

    // flatten visible text
    const text = inner
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const classAttr = (raw.match(/class=["']([^"']+)["']/i)?.[1] || "").toLowerCase();
    const roleAttr = (raw.match(/role=["']([^"']+)["']/i)?.[1] || "").toLowerCase();
    const hrefLower = href.toLowerCase();

    let matched = false;

    if (type === "daftar") {
      // starts with daftar OR class OR href contains daftar
      matched =
        text.startsWith("daftar") ||
        classAttr.includes("daftar") ||
        hrefLower.includes("daftar");
    }

    if (type === "login") {
      // contains login/masuk anywhere OR class OR href
      matched =
        text.includes("login") ||
        text.includes("masuk") ||
        classAttr.includes("login") ||
        classAttr.includes("masuk") ||
        hrefLower.includes("login") ||
        hrefLower.includes("masuk");
    }

    if (matched) {
      try {
        const url = new URL(href, finalUrl).href;
        found.add(url);
      } catch {}
    }
  }

  return found.size ? Array.from(found) : null;
}

const authLinks = {
  daftar: extractAuthLinks("daftar"),
  login: extractAuthLinks("login")
};

    } catch {
      authLinks = { daftar: null, login: null };
    }

    /* ================================
       RESPONSE
    ================================ */
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputUrl,
        finalUrl,
        status,
        title,
        description,
        keywords,
        canonical,
        amphtml,
        robotsMeta,
        robots,
        sitemap,
        authLinks
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "fetch_failed"
      })
    };
  }
}






