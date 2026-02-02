export async function handler(event) {
  let inputUrl = event.queryStringParameters.url;

  if (!inputUrl.startsWith("http")) {
    inputUrl = "https://" + inputUrl;
  }

  try {
    // ✅ Fetch with automatic redirect following
    const response = await fetch(inputUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (SEO Meta Checker)"
      }
    });

    // ✅ Final URL after ALL redirects
    const finalUrl = response.url;

    const html = await response.text();

    const getTag = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim() : "";
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        inputUrl,
        finalUrl,
        title: getTag(/<title[^>]*>([^<]+)<\/title>/i),
        description: getTag(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i),
        canonical: getTag(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i),
        amphtml: getTag(/<link\s+rel=["']amphtml["']\s+href=["']([^"']+)["']/i)
      })
    };

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: "Domain not active" })
    };
  }
}
