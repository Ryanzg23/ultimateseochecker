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

    if (res404.status === 404 && !redirectHome) {
      has404 = true;
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

      if (
        lower.includes("not found") ||
        lower.includes("404") ||
        lower.includes("page not found")
      ) {
        soft404 = true;
      }

    }

   /* ==============================
   CHECK 404.HTML FILE
============================== */

let html404Exists = false;
let html404RedirectHome = false;

try {

  const resFile = await fetch(origin + "/404.html", {
    redirect: "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (404 Checker)"
    }
  });

  if (resFile.status === 200) {
    html404Exists = true;
  }

  if ([301,302,307,308].includes(resFile.status)) {

    const location = resFile.headers.get("location");

    if (location) {

      const final = new URL(location, origin);

      if (final.pathname === "/") {
        html404RedirectHome = true;
      }

    }

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
