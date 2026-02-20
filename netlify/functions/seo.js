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
      
        const elementRegex = /<(a|button)[^>]*>/gi;
        let match;
      
        function isMatch(text) {
          text = text.toLowerCase().trim();
      
          return targets.some(t => {
            if (t === "daftar") return text.startsWith("daftar");
            if (t === "login") return /\blogin\b/.test(text);
            if (t === "masuk") return text === "masuk";
            return text.includes(t);
          });
        }
      
        while ((match = elementRegex.exec(html)) !== null) {
          const tagStart = match.index;
      
          // extract full tag
          const tagMatch = html.slice(tagStart).match(/^<(a|button)([\s\S]*?)>/i);
          if (!tagMatch) continue;
      
          const tag = tagMatch[0];
      
          // attributes
          const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
          const ariaMatch = tag.match(/aria-label=["']([^"']+)["']/i);
          const titleMatch = tag.match(/title=["']([^"']+)["']/i);
          const classMatch = tag.match(/class=["']([^"']+)["']/i);
          const idMatch = tag.match(/id=["']([^"']+)["']/i);
          const tapMatch = tag.match(/on=["'][^"']*tap:[^"']*["']/i);
      
          // inner text (capture until closing)
          let innerText = "";
          const closeTag = new RegExp(`</${tagMatch[1]}>`, "i");
          const after = html.slice(tagStart + tag.length);
          const closeIndex = after.search(closeTag);
          if (closeIndex !== -1) {
            innerText = after.slice(0, closeIndex)
              .replace(/<[^>]+>/g, " ")
              .trim();
          }
      
          const candidates = [
            innerText,
            ariaMatch?.[1],
            titleMatch?.[1],
            classMatch?.[1],
            idMatch?.[1]
          ].filter(Boolean);
      
          const matched = candidates.some(isMatch);
      
          if (matched) {
            try {
              if (hrefMatch) {
                const url = new URL(hrefMatch[1], finalUrl).href;
                found.add(url);
              } else if (tapMatch) {
                found.add(finalUrl + "#login"); // AMP modal
              }
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

