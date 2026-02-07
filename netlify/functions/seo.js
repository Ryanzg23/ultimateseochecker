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
        "User-Agent":
          "Mozilla/5.0 (compatible; BulkSEOChecker/1.0; +https://example.com)"
      }
    });

    const status = response.status;
    const finalUrl = response.url;
    const html = await response.text();

    /* ================================
       HELPER
    ================================ */
    const getTag = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim() : "";
    };

    /* ================================
       META EXTRACTION (STABLE)
    ================================ */
    const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);

    const description =
      getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);

    const canonical =
      getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);

    const amphtml =
      getTag(/<link[^>]*rel=["']amphtml["'][^>]*href=["']([^"']*)["']/i);

    const robotsMeta =
      getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);

   /* ================================
   ROBOTS.TXT & SITEMAP.XML (REAL-WORLD SAFE)
================================ */
const origin = new URL(finalUrl).origin;

let robots = null;
let robotsStatus = "not_detected";

let sitemap = null;
let sitemapStatus = "not_detected";

/* ---------- robots.txt ---------- */
try {
  const robotsRes = await fetch(`${origin}/robots.txt`, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (robotsRes.status === 200) {
    const text = await robotsRes.text();

    if (/user-agent\s*:|disallow\s*:|allow\s*:/i.test(text)) {
      robots = `${origin}/robots.txt`;
      robotsStatus = "detected";
    } else {
      // 200 but HTML / blocked
      robotsStatus = "blocked";
    }
  } else if (robotsRes.status === 403) {
    robotsStatus = "blocked";
  }
} catch {
  robotsStatus = "blocked";
}

/* ---------- sitemap.xml ---------- */
try {
  const sitemapRes = await fetch(`${origin}/sitemap.xml`, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (sitemapRes.status === 200) {
    const text = await sitemapRes.text();

    if (/<urlset|<sitemapindex/i.test(text)) {
      sitemap = `${origin}/sitemap.xml`;
      sitemapStatus = "detected";
    } else {
      sitemapStatus = "blocked";
    }
  } else if (sitemapRes.status === 403) {
    sitemapStatus = "blocked";
  }
} catch {
  sitemapStatus = "blocked";
}


// ---- sitemap.xml ----
try {
  const sitemapRes = await fetch(`${origin}/sitemap.xml`, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BulkSEOChecker/1.0)"
    }
  });

  if (sitemapRes.status === 200) {
    const finalSitemapUrl = new URL(sitemapRes.url);
    const text = await sitemapRes.text();

    const looksLikeSitemap =
      /<urlset|<sitemapindex/i.test(text);

    const stillSitemap =
      finalSitemapUrl.pathname.toLowerCase().includes("sitemap");

    if (looksLikeSitemap && stillSitemap) {
      sitemap = finalSitemapUrl.href;
    }
  }
} catch {}

    // ---- sitemap.xml ----
    try {
      const sitemapRes = await fetch(`${origin}/sitemap.xml`, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BulkSEOChecker/1.0)"
        }
      });

      if (sitemapRes.status === 200) {
        const text = await sitemapRes.text();
        if (/<urlset|<sitemapindex/i.test(text)) {
          sitemap = `${origin}/sitemap.xml`;
        }
      }
    } catch {}

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
        canonical,
        amphtml,
        robotsMeta,
        robots,
        sitemap
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Failed to fetch page"
      })
    };
  }
}


