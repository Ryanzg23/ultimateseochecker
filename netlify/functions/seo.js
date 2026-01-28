// ===============================
// CONFIG
// ===============================
const PSI_API_KEY = "AIzaSyCHPQ51PmfyXRoOOJqxc_15wuMKrI_yR-c";

// ===============================
// HELPERS
// ===============================
async function getPageSpeed(url, strategy) {
  const apiUrl =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
    `?url=${encodeURIComponent(url)}` +
    `&strategy=${strategy}` +
    "&category=performance" +
    `&key=${PSI_API_KEY}`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    const score =
      data.lighthouseResult?.categories?.performance?.score;

    return score !== undefined
      ? Math.round(score * 100)
      : null;
  } catch {
    return null;
  }
}

async function checkAMP(url) {
  const apiUrl =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
    `?url=${encodeURIComponent(url)}` +
    "&strategy=mobile" +
    `&key=${PSI_API_KEY}`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    const ampAudit =
      data.lighthouseResult?.audits?.["amp-valid"];

    if (!ampAudit) return "Not AMP";
    return ampAudit.score === 1 ? "Valid" : "Invalid";
  } catch {
    return "Unknown";
  }
}

function extract(html, regex) {
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

// ===============================
// NETLIFY FUNCTION
// ===============================
export async function handler(event) {
  let url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing URL parameter" })
    };
  }

  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  try {
    // -------------------------------
    // Fetch page HTML
    // -------------------------------
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 SEO-Checker"
      }
    });

    const html = await response.text();

    // -------------------------------
    // Extract SEO tags
    // -------------------------------
    const title = extract(
      html,
      /<title[^>]*>([^<]*)<\/title>/i
    );

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

    // -------------------------------
    // PageSpeed + AMP
    // -------------------------------
    const mobileScore = await getPageSpeed(url, "mobile");
    const desktopScore = await getPageSpeed(url, "desktop");
    const ampStatus = await checkAMP(url);

    // -------------------------------
    // Response
    // -------------------------------
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
        amphtml,
        pageSpeed: {
          mobile: mobileScore,
          desktop: desktopScore
        },
        ampStatus,
        ampTestUrl: `https://search.google.com/test/amp?url=${encodeURIComponent(
          url
        )}`
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch or analyze page"
      })
    };
  }
}
