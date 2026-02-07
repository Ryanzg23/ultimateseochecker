export async function handler(event) {
  let url = event.queryStringParameters.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing URL" })
    };
  }

  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  try {
    const response = await fetch(url, {
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

    const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);
    const description = getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const canonical = getTag(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
    const amphtml = getTag(/<link\s+rel=["']amphtml["']\s+href=["']([^"']*)["']/i);
    const robots = getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) || getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);

    const origin = new URL(finalUrl).origin;

    const robots = await fetch(`${origin}/robots.txt`, { redirect: "manual" })
      .then(r => r.ok ? r.url : "")
      .catch(() => "");

    const sitemap = await fetch(`${origin}/sitemap.xml`, { redirect: "manual" })
      .then(r => r.ok ? r.url : "")
      .catch(() => "");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        inputUrl: url,
        finalUrl,
        status,
        title,
        description,
        canonical,
        amphtml,
        robots,
        sitemap,
        robots
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        inputUrl: url,
        error: "Failed to fetch page"
      })
    };
  }
}


