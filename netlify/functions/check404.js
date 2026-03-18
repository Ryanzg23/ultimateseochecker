export async function handler(event) {

  let url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing url parameter" })
    };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  try {

    const origin = new URL(url).origin;

    /* ==============================
       DOMAIN REDIRECT CHECK
    ============================== */
    
    let redirectDomain = false;
    let redirectTarget = "";
    
    try {
    
      const resDomain = await fetch(origin, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
        }
      });
    
      if ([301,302,307,308].includes(resDomain.status)) {
    
        const location = resDomain.headers.get("location");
    
        if (location) {
    
          const final = new URL(location, origin);
    
          const inputHost = new URL(origin).hostname.replace(/^www\./,"");
          const finalHost = final.hostname.replace(/^www\./,"");
    
          if (inputHost !== finalHost) {
            redirectDomain = true;
            redirectTarget = final.hostname;
          }
    
        }
    
      }
    
    } catch {}

    const fake404 = origin + "/this-page-should-not-exist-404-test-983475";

    /* ==============================
       SKIP 404 CHECK IF DOMAIN REDIRECTS
    ============================== */
    
    if (redirectDomain) {
    
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url,
          redirectDomain,
          redirectTarget
        })
      };
    
    }

    const res404 = await fetch(fake404, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (404 Checker)"
      }
    });

    const text = await res404.text();
    const lower = text.toLowerCase();

    /* ==============================
       HOMEPAGE REDIRECT CHECK
    ============================== */

    let redirectHome = false;

    if ([301,302,307,308].includes(res404.status)) {

      const location = res404.headers.get("location");

      if (location) {

        const final = new URL(location, origin);

        if (final.pathname === "/") {
          redirectHome = true;
        }

      }

    }

    /* ==============================
       PROPER 404 DETECTION
    ============================== */

    let has404 = false;
        
        /* SOFT 404 */
        if (res404.status === 200) {
          if (
            lower.includes("404") ||
            lower.includes("not found") ||
            lower.includes("page not found") ||
            lower.includes("doesn't exist") ||
            lower.includes("does not exist")
          ) {
            has404 = true;
            soft404 = true;
          }
        }
    
    /* ==============================
       APACHE DEFAULT 404
    ============================== */

    let apache404 = false;

    if (
      lower.includes("the requested url was not found on this server") ||
      lower.includes("additionally, a 404 not found error was encountered")
    ) {
      apache404 = true;
    }

    /* ==============================
       SOFT 404 DETECTION
    ============================== */

    let soft404 = false;

    if (res404.status === 200) {
    
      const contentLength = text.length;
    
      if (
        lower.includes("not found") ||
        lower.includes("404") ||
        lower.includes("page not found") ||
        lower.includes("doesn't exist") ||
        lower.includes("does not exist") ||
        contentLength < 1500   // 🔥 small page = likely 404
      ) {
        soft404 = true;
      }
    
    }

   /* ==============================
   CHECK 404.HTML FILE
============================== */
let html404Exists = false;
let html404Url = null;

try {

  const paths = ["/404.html", "/404"];

  for (const p of paths) {

    let currentUrl = origin + p;

    for (let i = 0; i < 3; i++) {

      const res = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (404 Checker)"
        }
      });

      // ✅ SUCCESS (even if blocked)
      if (
        res.status === 200 ||
        res.status === 403 ||
        res.status === 406
      ) {
        html404Exists = true;
        html404Url = currentUrl;
        break;
      }

      // 🔁 FOLLOW REDIRECT
      if ([301, 302, 307, 308].includes(res.status)) {

        const location = res.headers.get("location");
        if (!location) break;

        currentUrl = location.startsWith("http")
          ? location
          : new URL(location, currentUrl).href;

      } else {
        break;
      }

    }

    if (html404Exists) break;
  }

} catch {}

    /* ==============================
       RESPONSE
    ============================== */

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
       body: JSON.stringify({
        url: origin,
        has404,
        apache404,
        soft404,
        redirectHome,
      
        html404Exists,
        html404RedirectHome,
        html404Url,
      
        alt404Exists,
        alt404Url,
      
        redirectDomain,
        redirectTarget,
        testUrl: fake404
      })
    };

  } catch {

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: "fetch_failed"
      })
    };

  }

}
