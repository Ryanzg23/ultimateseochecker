export async function handler(event) {
  let url = event.queryStringParameters.url;

  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  try {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (SEO Meta Checker)"
      }
    });

    let redirect301 = null;

    if (response.status === 301 || response.status === 302) {
      redirect301 = response.headers.get("location") || "";
    }

    if (![200, 301, 302].includes(response.status)) {
      throw new Error("inactive");
    }

    const html = response.status === 200 ? await response.text() : "";

    const getTag = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim() : "";
    };

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        url,
        title: getTag(/<title[^>]*>([^<]+)<\/title>/i),
        description: getTag(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i),
        canonical: getTag(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i),
        amphtml: getTag(/<link\s+rel=["']amphtml["']\s+href=["']([^"']+)["']/i),
        redirect301
      })
    };

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: "Domain not active" })
    };
  }
}
