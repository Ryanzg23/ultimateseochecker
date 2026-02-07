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
       ROBOTS.TXT / SITEMAP.XML (3-STATE)
    ================================ */
    const origin = new URL(finalUrl).origin;

    async function detectFile(path) {
      try {
        const res = await fetch(origin + path, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
          }
        });

        // Explicitly missing
        if (res.status === 404 || res.status === 410) {
          return { status: "missing" };
        }

        const final = new URL(res.url);

        // Redirected to homepage or root
        if (final.pathname === "/" || final.pathname === "") {
          return { status: "missing" };
        }

        // Redirected to something else (not the same file)
        if (!final.pathname.toLowerCase().includes(path.replace("/", ""))) {
          return { status: "missing" };
        }

        // Accessible
        if (res.status === 200) {
          return {
            status: "exists",
            url: final.href
          };
        }

        // Blocked or unknown
        return { status: "unknown" };
      } catch {
        return { status: "unknown" };
      }
    }

    const robots = await detectFile("/robots.txt");
    const sitemap = await detectFile("/sitemap.xml");

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
