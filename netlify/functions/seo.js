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
      function extractAuthLinks(labels) {
        const targets = labels.map(t => t.toLowerCase());
        const found = new Set();
      
        const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;
      
        function textMatches(text) {
          text = text.toLowerCase().trim();
      
          return targets.some(t => {
            if (t === "daftar") return text.startsWith("daftar");
            if (t === "login") return text.includes("login");
            if (t === "masuk") return text === "masuk";
            return text.includes(t);
          });
        }
      
        while ((match = linkRegex.exec(html)) !== null) {
          const href = match[1];
          const inner = match[2]
            .replace(/<[^>]+>/g, "")
            .trim();
      
          let matched = false;
      
          // 1️⃣ normal inner text
          if (inner && textMatches(inner)) {
            matched = true;
          }
      
          // 2️⃣ aria/title/class/id attributes
          const tag = match[0];
      
          const attrs = [
            tag.match(/aria-label=["']([^"']+)["']/i)?.[1],
            tag.match(/title=["']([^"']+)["']/i)?.[1],
            tag.match(/class=["']([^"']+)["']/i)?.[1],
            tag.match(/id=["']([^"']+)["']/i)?.[1]
          ].filter(Boolean);
      
          if (!matched && attrs.some(textMatches)) {
            matched = true;
          }
      
          // 3️⃣ CSS pseudo content detection (NEW)
          if (!matched && !inner) {
            // extract nearby CSS
            const cssContext = html.slice(Math.max(0, match.index - 500), match.index + 500);
      
            if (textMatches(cssContext)) {
              matched = true;
            }
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

      authLinks = {
        daftar: extractAuthLinks([
          "daftar",
          "register",
          "sign up",
          "signup",
          "join",
          "main demo"
        ]),
        login: extractAuthLinks([
          "login",
          "masuk",
          "sign in",
          "signin",
          "log in"
        ])
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


