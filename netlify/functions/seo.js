export async function handler(event) {
  let inputUrl = event.queryStringParameters.url;
  if (!inputUrl.startsWith("http")) inputUrl = "https://" + inputUrl;

  try {
    const normalizeHost = (u) =>
      new URL(u).hostname.replace(/^www\./, "").toLowerCase();

    /* ---------- FIRST REQUEST (detect redirect) ---------- */
    const first = await fetch(inputUrl, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (SEO Meta Checker)" }
    });

    let redirect301 = null;
    let redirectType = "none";
    let finalUrl = inputUrl;

    const locationHeader = first.headers.get("location");

    if (locationHeader && [301, 302].includes(first.status)) {
      // ✅ Resolve relative redirects properly
      const resolvedLocation = new URL(locationHeader, inputUrl).href;
      redirect301 = resolvedLocation;

      const fromHost = normalizeHost(inputUrl);
      const toHost = normalizeHost(resolvedLocation);

      if (fromHost === toHost) {
        // INTERNAL redirect → follow
        redirectType = "internal";
        finalUrl = resolvedLocation;
      } else {
        // EXTERNAL redirect → stop
        redirectType = "external";
      }
    }

    /* ---------- EXTERNAL REDIRECT: DO NOT FETCH HTML ---------- */
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

    /* ---------- FETCH FINAL URL (original or internal redirect) ---------- */
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

  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: "Domain not active" })
    };
  }
}
