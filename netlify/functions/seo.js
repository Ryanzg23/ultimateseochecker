export async function handler(event) {
  let inputUrl = event.queryStringParameters.url;

  if (!inputUrl.startsWith("http")) {
    inputUrl = "https://" + inputUrl;
  }

  let response, html, status;

  try {
    response = await fetch(inputUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOChecker/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      },
      redirect: "follow"
    });

    status = response.status;
    html = await response.text();
  } catch {
    return {
      statusCode: 200,
      body: JSON.stringify({
        inputUrl,
        finalUrl: inputUrl,
        status: 0,
        error: "fetch_failed"
      })
    };
  }

  const getTag = (regex) => {
    const match = html.match(regex);
    return match ? match[1].trim() : "";
  };

  const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);

  const description =
    getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);

  const canonical =
  getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ||
  getTag(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);

  const amphtml =
  getTag(/<link[^>]*rel=["']amphtml["'][^>]*href=["']([^"']*)["']/i) ||
  getTag(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']amphtml["']/i);

  const robotsMeta =
    getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) ||
    getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);

  /* ================================
     ROBOTS.TXT & SITEMAP (SERVER)
  ================================ */

  const origin = new URL(response.url).origin;

  async function exists(url) {
    try {
      let r = await fetch(url, { method: "HEAD" });
      if (r.ok) return true;
      r = await fetch(url, { method: "GET" });
      return r.ok;
    } catch {
      return false;
    }
  }

  const robotsTxtUrl = `${origin}/robots.txt`;
  const sitemapUrl = `${origin}/sitemap.xml`;

  const [hasRobotsTxt, hasSitemap] = await Promise.all([
    exists(robotsTxtUrl),
    exists(sitemapUrl)
  ]);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      inputUrl,
      finalUrl: response.url,
      status,
      title,
      description,
      canonical,
      amphtml,
      robotsMeta,
      hasRobotsTxt,
      robotsTxtUrl,
      hasSitemap,
      sitemapUrl
    })
  };
}

