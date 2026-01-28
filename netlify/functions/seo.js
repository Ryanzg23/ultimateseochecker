const PSI_API_KEY = "AIzaSyCHPQ51PmfyXRoOOJqxc_15wuMKrI_yR-c";

function extract(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : "";
}

async function runPSI(url) {
  try {
    const res = await fetch(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
        `?url=${encodeURIComponent(url)}` +
        "&strategy=mobile" +
        "&category=performance" +
        `&key=${PSI_API_KEY}`
    );
    return await res.json();
  } catch {
    return null;
  }
}

function getScore(data) {
  const score = data?.lighthouseResult?.categories?.performance?.score;
  return score !== undefined ? Math.round(score * 100) : null;
}

function getAmpStatus(data) {
  const audit = data?.lighthouseResult?.audits?.["amp-valid"];
  if (!audit) return "Cannot be evaluated";
  return audit.score === 1 ? "Valid" : "Invalid";
}

export async function handler(event) {
  let url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing URL" }) };
  }

  if (!url.startsWith("http")) url = "https://" + url;

  try {
    // Fetch HTML
    const htmlRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 SEO-Checker" }
    });
    const html = await htmlRes.text();

    const title = extract(html, /<title[^>]*>([^<]*)<\/title>/i);
    const description = extract(
      html,
      /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i
    );
    const canonical = extract(
      html,
      /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i
    );
    const amphtml = extract(
      html,
      /<link\s+rel=["']amphtml["']\s+href=["']([^"']*)["']/i
    );

    // ONE PSI CALL ONLY
    const psi = await runPSI(url);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        url,
        title,
        description,
        canonical,
        amphtml,
        pageSpeed: {
          mobile: getScore(psi),
          desktop: null // desktop removed to avoid timeout
        },
        ampStatus: getAmpStatus(psi),
        ampTestUrl: `https://search.google.com/test/amp?url=${encodeURIComponent(
          url
        )}`,
        linkedAmp: {
          url: amphtml || null,
          status: "Check manually"
        }
      })
    };
  } catch {
    return {
      statusCode: 200,
      body: JSON.stringify({
        url,
        error: "Partial failure"
      })
    };
  }
}
