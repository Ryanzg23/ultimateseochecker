const PSI_API_KEY = "AIzaSyCHPQ51PmfyXRoOOJqxc_15wuMKrI_yR-c";

function extract(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : "";
}

async function safePSI(url, strategy) {
  try {
    const res = await fetch(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
        `?url=${encodeURIComponent(url)}` +
        `&strategy=${strategy}` +
        `&key=${PSI_API_KEY}`,
      { timeout: 15000 }
    );

    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

function getScore(data) {
  const score = data?.lighthouseResult?.categories?.performance?.score;
  return score !== undefined ? Math.round(score * 100) : null;
}

function getAmpAudit(data) {
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

    // PSI calls (SAFE)
    const psiMobile = await safePSI(url, "mobile");
    const psiDesktop = await safePSI(url, "desktop");

    let linkedAmpPSI = null;
    if (amphtml) {
      linkedAmpPSI = await safePSI(amphtml, "mobile");
    }

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
          mobile: getScore(psiMobile),
          desktop: getScore(psiDesktop)
        },
        ampStatus: getAmpAudit(psiMobile),
        linkedAmp: {
          url: amphtml || null,
          status: linkedAmpPSI ? getAmpAudit(linkedAmpPSI) : "No AMP linked"
        },
        ampTestUrl: `https://search.google.com/test/amp?url=${encodeURIComponent(
          url
        )}`
      })
    };
  } catch (err) {
    return {
      statusCode: 200, // IMPORTANT: still return 200
      body: JSON.stringify({
        url,
        error: "Partial failure",
        pageSpeed: {},
        ampStatus: "Cannot be evaluated"
      })
    };
  }
}
