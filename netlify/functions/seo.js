export async function handler(event) {
  let inputUrl = event.queryStringParameters?.url;

  if (!inputUrl) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing url parameter" })
    };
  }

  if (!/^https?:\/\//i.test(inputUrl)) {
    inputUrl = "https://" + inputUrl;
  }

  try {
    /* ================================
       FETCH MAIN PAGE
    ================================ */
    const response = await fetch(inputUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
      }
    });

    const status = response.status;
    const finalUrl = response.url;
    const html = await response.text();

    /* ================================
       HELPER
    ================================ */
    const getTag = (regex) => {
      const match = html.match(regex);
      return match ? match[1].trim() : "";
    };

    /* ================================
       META EXTRACTION
    ================================ */

    const title = getTag(/<title[^>]*>([^<]*)<\/title>/i);

    const description =
      getTag(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);

    const keywords =
  getTag(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i) ||
  getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']keywords["']/i);

    /* ---------- CANONICAL (HARDENED) ---------- */
    const rawCanonical =
      getTag(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ||
      getTag(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);

    let canonical = "";

    if (rawCanonical) {
      const trimmed = rawCanonical.trim();

      // ignore empty or placeholder canonicals
      if (trimmed !== "" && trimmed !== "#") {
        try {
          canonical = new URL(trimmed, finalUrl).href;
        } catch {
          canonical = "";
        }
      }
    }

    /* ---------- AMP ---------- */
    const amphtml =
      getTag(/<link[^>]*rel=["']amphtml["'][^>]*href=["']([^"']*)["']/i);

    /* ---------- META ROBOTS ---------- */
    const robotsMeta =
      getTag(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i) ||
      getTag(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']robots["']/i);

    /* ================================
       ROBOTS.TXT / SITEMAP.XML (3-STATE)
    ================================ */
    const origin = new URL(finalUrl).origin;

    async function detectFile(path) {
      try {
        const res = await fetch(origin + path, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
          }
        });

        // explicitly missing
        if (res.status === 404 || res.status === 410) {
          return { status: "missing" };
        }

        const final = new URL(res.url);

        // redirected to homepage
        if (final.pathname === "/" || final.pathname === "") {
          return { status: "missing" };
        }

        // redirected to something else (not same file)
        if (!final.pathname.toLowerCase().includes(path.replace("/", ""))) {
          return { status: "missing" };
        }

        // accessible
        if (res.status === 200) {
          return {
            status: "exists",
            url: final.href
          };
        }

        return { status: "unknown" };
      } catch {
        return { status: "unknown" };
      }
    }

    const robots = await detectFile("/robots.txt");
    const sitemap = await detectFile("/sitemap.xml");


    /* ================================
   AUTH LINKS (DAFTAR / LOGIN)
================================ */

function extractAuthLink(label) {
  const regexes = [
    // <a>Daftar</a>
    new RegExp(`<a[^>]*href=["']([^"']+)["'][^>]*>\\s*${label}\\s*<\\/a>`, "i"),

    // <button onclick="location.href='...'">Daftar</button>
    new RegExp(`<button[^>]*onclick=["'][^"']*['"]([^"']+)['"][^>]*>\\s*${label}\\s*<\\/button>`, "i"),

    // data-href
    new RegExp(`<[^>]*data-href=["']([^"']+)["'][^>]*>\\s*${label}\\s*<`, "i")
  ];

  for (const rx of regexes) {
    const match = html.match(rx);
    if (match && match[1]) {
      try {
        return new URL(match[1], finalUrl).href;
      } catch {
        return null;
      }
    }
  }

  return null;
}

const authLinks = {
  daftar: extractAuthLink("daftar"),
  login: extractAuthLink("login")
};

    /* ================================
       RESPONSE
    ================================ */
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
     body: JSON.stringify({
        inputUrl,
        finalUrl,
        status,
        title,
        description,
        keywords,
        canonical,
        amphtml,
        robotsMeta,
        robots,
        sitemap,
        authLinks  
      })
    };
  } catch {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Failed to fetch page"
      })
    };
  }
}




