export async function handler(event) {
  const input = event.queryStringParameters.domain;
  if (!input) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing domain" })
    };
  }

  // Normalize input
  let cleaned = input.replace(/^https?:\/\//, "").trim();

  // Extract host + path (keep subfolder)
  let host = cleaned;
  let path = "";

  const slashIndex = cleaned.indexOf("/");
  if (slashIndex !== -1) {
    host = cleaned.slice(0, slashIndex);
    path = cleaned.slice(slashIndex);
  }

  // Remove duplicate www
  host = host.replace(/^www\./, "");

  const variants = Array.from(new Set([
    `http://${host}${path}`,
    `http://www.${host}${path}`,
    `https://${host}${path}`,
    `https://www.${host}${path}`
  ]));

  const results = [];

  for (const url of variants) {
    try {
      let currentUrl = url;
      let statusChain = [];
      let redirects = 0;

      for (let i = 0; i < 5; i++) {
        const res = await fetch(currentUrl, {
          redirect: "manual",
          headers: {
            "User-Agent": "SEO HTTP Status Checker"
          }
        });

        statusChain.push(res.status);

        if ([301, 302, 307, 308].includes(res.status)) {
          const location = res.headers.get("location");
          if (!location) break;

          currentUrl = location.startsWith("http")
            ? location
            : new URL(location, currentUrl).href;

          redirects++;
        } else {
          break;
        }
      }

      results.push({
        requestUrl: url,
        statusChain,
        finalUrl: currentUrl,
        redirects
      });

    } catch {
      results.push({
        requestUrl: url,
        statusChain: ["ERR"],
        finalUrl: "",
        redirects: 0
      });
    }
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(results)
  };
}
