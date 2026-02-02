export async function handler(event) {
  let url = event.queryStringParameters.url;

  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (SEO Meta Checker)"
      }
    });

    const html = await response.text();

    const getTag = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim() : "";
    };

    const title = getTag(/<title[^>]*>([^<]+)<\/title>/i);
    const description = getTag(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const canonical = getTag(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const amphtml = getTag(/<link\s+rel=["']amphtml["']\s+href=["']([^"']+)["']/i);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        url,
        title,
        description,
        canonical,
        amphtml
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch page" })
    };
  }
}
