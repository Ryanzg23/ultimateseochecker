const PSI_API_KEY = "AIzaSyCHPQ51PmfyXRoOOJqxc_15wuMKrI_yR-c";

// ===============================
// HELPERS
// ===============================
function extract(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : "";
}

async function runPSI(url, strategy) {
  try {
    const res = await fetch(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
        `?url=${encodeURIComponent(url)}` +
        `&strategy=${strategy}` +
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
    // Fetch HTML (SEO tags)
    // -------------------------------
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

    // -------------------------------
    // PageSpeed (Desktop + Mobile)
    // Parallel to reduce total time
    // -------------------------------
    const [psiDesktop, psiMobile] = await Promise.all([
      runPSI(url, "desktop"),
      runPSI(url, "mobile")
    ]);

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
          desktop: getScore(psiDesktop),
          mobile: getScore(psiMobile)
        }
      })
    };
  } catch {
    // IMPORTANT: return 200 so frontend can show Retry button
    return {
      statusCode: 200,
      body: JSON.stringify({
        url,
        title: "",
        description: "",
        canonical: "",
        amphtml: "",
        pageSpeed: {
          desktop: null,
          mobile: null
        }
      })
    };
  }
}
