export async function handler(event) {
  let inputUrl = event.queryStringParameters.url;

  if (!inputUrl.startsWith("http")) {
    inputUrl = "https://" + inputUrl;
  }

  try {
    // Follow redirects automatically
    const response = await fetch(inputUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (SEO Meta Checker)"
      }
    });

    const finalUrl = response.url;
    const html = await response.text();

    const origin = new URL(finalUrl).origin;

    /* ---------- META PARSERS ---------- */

    const getTitle = () => {
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return m ? m[1].trim() : "";
    };

    const getDescription = () => {
      const m =
        html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/i) ||
        html.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']description["'][^>]*>/i);
      return m ? m[1].trim() : "";
    };

    const getCanonical = () => {
      const m =
        html.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i) ||
        html.match(/<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["'][^>]*>/i);
      return m ? m[1].trim() : "";
    };

    const getAmp = () => {
      const m =
        html.match(/<link[^>]*rel\s*=\s*["']amphtml["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i) ||
        html.match(/<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']amphtml["'][^>]*>/i);
      return m ? m[1].trim() : "";
    };

    /* ---------- ROBOTS & SITEMAP CHECK ---------- */

    async function exists(url) {
      try {
        const r = await fetch(url, { method: "HEAD" });
        return r.ok;
      } catch {
        return false;
      }
    }

    const robotsUrl = `${origin}/robots.txt`;
    const sitemapUrl = `${origin}/sitemap.xml`;

    const [hasRobots, hasSitemap] = await Promise.all([
      exists(robotsUrl),
      exists(sitemapUrl)
    ]);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        inputUrl,
        finalUrl,
        title: getTitle(),
        description: getDescription(),
        canonical: getCanonical(),
        amphtml: getAmp(),
        robots: hasRobots ? robotsUrl : "",
        sitemap: hasSitemap ? sitemapUrl : ""
      })
    };

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: "Domain not active" })
    };
  }
}
