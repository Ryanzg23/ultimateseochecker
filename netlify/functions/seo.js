const PSI_API_KEY = "AIzaSyCHPQ51PmfyXRoOOJqxc_15wuMKrI_yR-c";

// ===============================
// SIMPLE IN-MEMORY CACHE
// ===============================
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const cache = new Map();

function getFromCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

function saveToCache(key, data) {
  cache.set(key, {
    timestamp: Date.now(),
    data
  });
}

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

  // -------------------------------
  // CHECK CACHE FIRST
  // -------------------------------
  const cachedResult = getFromCache(url);
  if (cachedResult) {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        ...cachedResult,
        cached: true
      })
    };
  }

  try {
    // -------------------------------
    // Fetch HTML
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
    // PageSpeed (parallel)
    // -------------------------------
    const [psiDesktop, psiMobile] = await Promise.all([
      runPSI(url, "desktop"),
      runPSI(url, "mobile")
    ]);

    const result = {
      url,
      title,
      description,
      canonical,
      amphtml,
      pageSpeed: {
        desktop: getScore(psiDesktop),
        mobile: getScore(psiMobile)
      }
    };

    // -------------------------------
    // SAVE TO CACHE
    // -------------------------------
    saveToCache(url, result);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        ...result,
        cached: false
      })
    };
  } catch {
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
