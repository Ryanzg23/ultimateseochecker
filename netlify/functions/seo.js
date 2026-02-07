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
    getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);

  const amphtml =
    getTag(/<link[^>]*rel=["']amphtml["'][^>]*href=["']([^"']*)["']/i);

  const robots =
    getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) ||
    getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);

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
      robots
    })
  };
}
