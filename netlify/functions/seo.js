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
       SIMPLE ROBOTS / SITEMAP CHECK
    ================================ */
    const origin = new URL(finalUrl).origin;

async function checkFile(path) {
  const bases = [
    origin,
    origin.replace("https://", "http://")
  ];

  for (const base of bases) {
    try {
      const res = await fetch(base + path, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      if (res.status === 404 || res.status === 410) continue;

      const final = new URL(res.url);

      // homepage redirect = not detected
      if (final.pathname === "/" || final.pathname === "") continue;

      // must still be same file
      if (!final.pathname.toLowerCase().includes(path.replace("/", ""))) continue;

      return final.href;
    } catch {
      continue;
    }
  }

  return null;
}

    const robots = await checkFile("/robots.txt");
    const sitemap = await checkFile("/sitemap.xml");

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
      body: JSON.stringify({ error: "Failed to fetch page" })
    };
  }
}

