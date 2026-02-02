export async function handler(event) {
  let inputUrl = event.queryStringParameters.url;
  if (!inputUrl.startsWith("http")) inputUrl = "https://" + inputUrl;

  try {
    const normalizeHost = (u) =>
      new URL(u).hostname.replace(/^www\./, "").toLowerCase();

    // First request (detect redirect)
    const first = await fetch(inputUrl, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (SEO Meta Checker)" }
    });

    let redirect301 = null;
    let redirectType = "none";
    let finalUrl = inputUrl;

    const location = first.headers.get("location");

    if (location && [301, 302].includes(first.status)) {
      redirect301 = location;

      const fromHost = normalizeHost(inputUrl);
      const toHost = normalizeHost(location);

      if (fromHost === toHost) {
        // ✅ INTERNAL redirect → follow
        redirectType = "internal";
        finalUrl = location;
      } else {
        // ❌ EXTERNAL redirect → stop
        redirectType = "external";
      }
    }

    // If external redirect, do NOT fetch HTML
    if (redirectType === "external") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          url: inputUrl,
          redirect301,
          redirectType
        })
      };
    }

    // Fetch final page (original or internal redirect)
    const response = await fetch(finalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (SEO Meta Checker)" }
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
        redirectType,
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
