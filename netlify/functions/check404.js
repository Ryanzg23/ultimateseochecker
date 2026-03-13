export async function handler(event) {

  let url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing url parameter" })
    };
  }

  /* ensure protocol */

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  try {

    const origin = new URL(url).origin;

    /* ==============================
       CREATE FAKE PAGE
    ============================== */

    const fake404 = origin + "/this-page-should-not-exist-404-test";

    /* ==============================
       REQUEST FAKE PAGE
    ============================== */

    const res404 = await fetch(fake404, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (404 Checker)"
      }
    });

    const text = await res404.text();

    /* ==============================
       CHECK HOMEPAGE REDIRECT
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
       VALID 404 DETECTION
    ============================== */

    let has404 = false;

    if (res404.status === 404 && !redirectHome) {
      has404 = true;
    }

    /* ==============================
       SOFT 404 DETECTION
    ============================== */

    let soft404 = false;

    if (res404.status === 200) {

      const lower = text.toLowerCase();

      if (
        lower.includes("not found") ||
        lower.includes("404") ||
        lower.includes("page not found")
      ) {
        soft404 = true;
      }

    }

    /* ==============================
       CHECK IF 404.HTML EXISTS
    ============================== */

    let html404Exists = false;

    try {

      const resFile = await fetch(origin + "/404.html", {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (404 Checker)"
        }
      });

      if (resFile.status === 200) {
        html404Exists = true;
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
        soft404,
        redirectHome,
        html404Exists,
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
