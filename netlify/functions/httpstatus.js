export async function handler(event) {
  let base = event.queryStringParameters.domain;

  if (!base) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing domain" })
    };
  }

base = base
  .replace(/^https?:\/\//, "")
  .replace(/^www\./, "")
  .replace(/\/.*$/, "");


const variants = Array.from(new Set([
  `http://${base}`,
  `http://www.${base}`,
  `https://${base}`,
  `https://www.${base}`
]));

  async function check(url) {
    let redirects = 0;
    let currentUrl = url;
    let statusChain = [];

    try {
      for (let i = 0; i < 5; i++) {
        const res = await fetch(currentUrl, {
          redirect: "manual",
          headers: { "User-Agent": "Mozilla/5.0 (HTTP Status Checker)" }
        });

        statusChain.push(res.status);

        if ([301, 302, 307, 308].includes(res.status)) {
          const loc = res.headers.get("location");
          if (!loc) break;

          currentUrl = new URL(loc, currentUrl).href;
          redirects++;
        } else {
          break;
        }
      }

      return {
        requestUrl: url,
        statusChain,
        finalUrl: currentUrl,
        redirects
      };

    } catch {
      return {
        requestUrl: url,
        statusChain: [],
        finalUrl: "",
        redirects: 0,
        error: true
      };
    }
  }

  const results = await Promise.all(variants.map(check));

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(results)
  };
}
