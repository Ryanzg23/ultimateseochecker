export async function handler(event) {
  let url = event.queryStringParameters.url;
  if (!url.startsWith("http")) url = "https://" + url;

  try {
    const firstResponse = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (SEO Meta Checker)"
      }
    });

    const location = firstResponse.headers.get("location");
    let finalUrl = url;
    let redirect301 = null;

    if (location && (firstResponse.status === 301 || firstResponse.status === 302)) {
      redirect301 = location;

      const fromHost = new URL(url).hostname.replace(/^www\./, "");
      const toHost = new URL(location).hostname.replace(/^www\./, "");

      // 👉 FOLLOW redirect ONLY if same host
      if (fromHost === toHost) {
        finalUrl = location;
      }
    }

    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (SEO Meta Checker)"
      }
    });

    const html = await response.text();

    const getTag = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim() : "";
    };

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        url: finalUrl,
        redirect301,
        title: getTag(/<title[^>]*>([^<]+)<\/title>/i),
        description: getTag(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i),
        canonical: getTag(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i),
        amphtml: getTag(/<link\s+rel=["']amphtml["']\s+href=["']([^"']+)["']/i)
      })
    };

  } catch {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: "Domain not active" })
    };
  }
}
