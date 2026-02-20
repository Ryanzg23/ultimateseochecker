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
      getTag(/<link[^>]*rel=["']amphtml["'][^>]*href=["']([^"']*)["']/i);

    /* ---------- META ROBOTS ---------- */
    const robotsMeta =
      getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);

    /* ================================
       STRICT ROBOTS.TXT DETECTION
    ================================ */
    async function detectRobots(origin) {
      try {
        const res = await fetch(origin + "/robots.txt", {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
          }
        });

        if (res.status !== 200) {
          return { status: "missing" };
        }

        const final = new URL(res.url);

        // must still be robots.txt
        if (!final.pathname.toLowerCase().endsWith("/robots.txt")) {
          return { status: "missing" };
        }

        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("text/plain")) {
          return { status: "missing" };
        }

        const text = await res.text();

        const firstLine = text
          .split(/\r?\n/)
          .map(l => l.trim())
          .find(l => l.length > 0);

        if (!firstLine || !/^user-agent:/i.test(firstLine)) {
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

    /* ================================
       SITEMAP.XML DETECTION (VALID XML)
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

    const robots = await detectRobots(origin);
    const sitemap = await detectSitemap(origin);

    /* ================================
       AUTH LINKS (DAFTAR / LOGIN)
    ================================ */
    function extractAuthLinks(labels) {
      const targets = labels.map(t => t.toLowerCase());
      const found = new Set();

      const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
      const buttonRegex = /<button[^>]*>(.*?)<\/button>/gis;

      let match;

      // scan <a>
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const text = match[2]
          .replace(/<[^>]+>/g, "")
          .trim()
          .toLowerCase();

        const matched = targets.some(t => {
          if (t === "masuk") return text === "masuk";
          return text.includes(t);
        });

        if (matched) {
          try {
            const url = new URL(href, finalUrl).href;
            found.add(url);
          } catch {}
        }
      }

      // scan <button>
      while ((match = buttonRegex.exec(html)) !== null) {
        const inner = match[1]
          .replace(/<[^>]+>/g, "")
          .trim()
          .toLowerCase();

        const matched = targets.some(t => {
          if (t === "masuk") return inner === "masuk";
          return inner.includes(t);
        });

        if (matched) {
          const onclickMatch = match[0].match(/location\.href=['"]([^'"]+)['"]/i);
          if (onclickMatch) {
            try {
              const url = new URL(onclickMatch[1], finalUrl).href;
              found.add(url);
            } catch {}
          }
        }
      }

      return found.size ? Array.from(found) : null;
    }

    const authLinks = {
      daftar: extractAuthLinks([
        "daftar",
        "register",
        "sign up",
        "signup",
        "join"
      ]),
      login: extractAuthLinks([
        "login",
        "masuk",
        "sign in",
        "signin",
        "log in"
      ])
    };

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

  } catch {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Failed to fetch page"
      })
    };
  }
}
